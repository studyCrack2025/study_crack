import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../../js/shared/signup-submit.js', import.meta.url), 'utf8');
const { submitSignupProfile, reauthenticateSignup, completeEmailSignup } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const options = { url: 'https://example.invalid', userId: 'u1', profile: { name: 'test', signupConsent: { schema: 1 } }, uuid: () => '12345678-1234-4234-8234-123456789012', wait: async () => {} };
test('network loss reuses exactly the same signup receipt without recreating an account', async () => {
    const requests = [];
    const result = await submitSignupProfile({ ...options, fetchImpl: async (_, request) => {
        requests.push(request.body);
        if (requests.length < 3) throw new TypeError('network');
        return { ok: true, json: async () => ({ role: 'student' }) };
    } });
    assert.equal(result.role, 'student');
    assert.equal(requests.length, 3);
    assert.equal(new Set(requests).size, 1);
    assert.equal(options.profile.signupAttemptId, undefined);
});
test('policy/identity rejection is not retried; temporary server failures are bounded', async () => {
    for (const status of [400, 403, 409, 429, 500]) {
        let calls = 0;
        await assert.rejects(submitSignupProfile({ ...options, fetchImpl: async () => {
            calls++; return { ok: false, status, json: async () => ({ error: 'denied' }) };
        } }), /denied/);
        assert.equal(calls, status >= 500 || status === 429 ? 3 : 1);
    }
});

test('legacy and invitation signups are not automatically replayed', async () => {
    for (const profile of [{ name: 'test' }, { ...options.profile, promoCode: 'INVITE' }]) {
        let calls = 0;
        await assert.rejects(submitSignupProfile({ ...options, profile, fetchImpl: async () => { calls++; throw new TypeError('network'); } }));
        assert.equal(calls, 1);
    }
});

test('recovery submits a fresh proof without trusting or sending a caller-selected subject', async () => {
    let request;
    await submitSignupProfile({ ...options, recoveryAccessToken: 'proof', fetchImpl: async (_, input) => { request = JSON.parse(input.body); return { ok: true, json: async () => ({ alreadyComplete: true }) }; } });
    assert.equal(request.type, 'resume_signup'); assert.equal(request.userId, undefined); assert.equal(request.accessToken, 'proof');
    assert.equal(options.profile.accessToken, undefined);
});
for (const outcome of ['success', 'failure', 'mfa', 'challenge']) test(`signup reauthentication ${outcome} uses transient storage only`, async () => {
    let storage;
    class CognitoUser {
        constructor(options) { storage = options.Storage; }
        authenticateUser(_details, callbacks) {
            storage.setItem('token', 'temporary');
            if (outcome === 'success') callbacks.onSuccess({ getAccessToken: () => ({ getJwtToken: () => 'proof' }), getIdToken: () => ({ payload: { sub: 'user-a' } }) });
            if (outcome === 'failure') callbacks.onFailure({ message: 'private provider message' });
            if (outcome === 'mfa') callbacks.mfaRequired();
            if (outcome === 'challenge') callbacks.customChallenge();
        }
    }
    const promise = reauthenticateSignup({ CognitoUser, AuthenticationDetails: class {}, pool: {}, email: 'a@example.invalid', password: 'not-stored' });
    if (outcome === 'success') assert.deepEqual(await promise, { accessToken: 'proof', userSub: 'user-a' });
    else await assert.rejects(promise, error => !error.message.includes('private'));
    assert.equal(storage.getItem('token'), null);
});

for (const existing of [false, true]) test(`complete email signup wires ${existing ? 'authenticated resume' : 'new registration'} without persisting credentials`, async () => {
    const requests = []; let logins = 0;
    const result = await completeEmailSignup({ url: options.url, email: 'a@example.invalid', password: 'secret', profile: { ...options.profile, gender: 'other', cognitoPhone: '+821012345678', birthdate: '2005-01-01' },
        pool: { signUp: (_email, _password, _attributes, _unused, callback) => callback(existing ? { code: 'UsernameExistsException' } : null, existing ? null : { userSub: 'new-user' }) },
        CognitoUserAttribute: class { constructor(attribute) { Object.assign(this, attribute); } }, AuthenticationDetails: class {},
        CognitoUser: class { authenticateUser(_details, callbacks) { logins++; callbacks.onSuccess({ getAccessToken: () => ({ getJwtToken: () => 'proof' }), getIdToken: () => ({ payload: { sub: 'existing-user' } }) }); } },
        fetchImpl: async (_url, init) => { requests.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ role: 'student' }) }; } });
    assert.equal(result.ok, true); assert.equal(result.userSub, existing ? 'existing-user' : 'new-user');
    assert.equal(logins, existing ? 1 : 0); assert.equal(requests[0].type, existing ? 'resume_signup' : 'update_profile');
    assert.equal(JSON.stringify(requests).includes('secret'), false);
});
test('signup validation failure neither attempts authentication nor sends a profile', async () => {
    const result = await completeEmailSignup({ pool: { signUp: (_e, _p, _a, _n, cb) => cb({ code: 'InvalidPasswordException', message: 'private' }) },
        CognitoUserAttribute: class {}, profile: {}, fetchImpl: () => { throw Error('must not fetch'); } });
    assert.equal(result.ok, false); assert.match(result.error, /비밀번호/); assert.doesNotMatch(result.error, /private/);
});

test('web signup connects existing-account reauthentication before auto-login and never submits a forged subject', async () => {
    const web = await readFile(new URL('../../js/auth.js', import.meta.url), 'utf8');
    const body = web.slice(web.indexOf('function completeSignUp('), web.indexOf('async function handleFinalSubmit('))
        .replace("await import('./shared/signup-submit.js')", 'await loadSignupModule()');
    const calls = [];
    let resolveDone, rejectDone;
    const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
    const context = {
        AUTH_URL: options.url, console,
        userPool: { signUp: (_e, _p, _a, _n, cb) => cb({ code: 'UsernameExistsException' }) },
        AmazonCognitoIdentity: { AuthenticationDetails: class {}, CognitoUser: class {
            authenticateUser(_details, callbacks) { calls.push('reauth'); callbacks.onSuccess({ getAccessToken: () => ({ getJwtToken: () => 'proof' }), getIdToken: () => ({ payload: { sub: 'actual-user' } }) }); }
        } },
        loadSignupModule: async () => ({ reauthenticateSignup, submitSignupProfile: async payload => { calls.push('submit'); assert.equal(payload.recoveryAccessToken, 'proof'); assert.equal(payload.userId, undefined); } }),
        autoLoginAfterSignup: () => { calls.push('login'); resolveDone(); }
    };
    const complete = vm.runInNewContext(body + '\ncompleteSignUp', context);
    complete({ email: 'a@example.invalid', password: 'secret', attributeList: [], profileData: options.profile, onError: rejectDone });
    await done; assert.deepEqual(calls, ['reauth', 'submit', 'login']);
});

for (const mode of ['confirmed', 'cancel', 'invalid', 'resendDenied', 'confirmationDenied', 'stillUnconfirmed', 'wrongPassword']) test(`unconfirmed signup ${mode} never bypasses confirmation and password proof`, async () => {
    const calls = []; let attempts = 0;
    class CognitoUser {
        authenticateUser(_details, callbacks) {
            calls.push('authenticate'); attempts++;
            if (attempts === 1 || mode === 'stillUnconfirmed') return callbacks.onFailure({ code: 'UserNotConfirmedException' });
            if (mode === 'wrongPassword') return callbacks.onFailure({ code: 'NotAuthorizedException' });
            callbacks.onSuccess({ getAccessToken: () => ({ getJwtToken: () => 'proof' }), getIdToken: () => ({ payload: { sub: 'user-a' } }) });
        }
        resendConfirmationCode(callback) { calls.push('resend'); callback(mode === 'resendDenied' ? Error('denied') : null); }
        confirmRegistration(code, forceAlias, callback) { calls.push('confirm'); assert.equal(forceAlias, false); assert.equal(code, '123456'); callback(mode === 'confirmationDenied' ? Error('denied') : null); }
    }
    const promise = reauthenticateSignup({ CognitoUser, AuthenticationDetails: class {}, pool: {},
        confirmDelivery: () => mode !== 'cancel', requestCode: () => mode === 'invalid' ? 'wrong' : '123456' });
    if (mode === 'confirmed') assert.equal((await promise).accessToken, 'proof'); else await assert.rejects(promise);
    if (mode === 'cancel') assert.deepEqual(calls, ['authenticate']);
    if (mode === 'invalid' || mode === 'resendDenied') assert.deepEqual(calls, ['authenticate', 'resend']);
    assert.ok(calls.filter(call => call === 'resend').length <= 1);
    assert.ok(attempts <= 2);
});
