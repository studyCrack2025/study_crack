import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { test } from 'node:test';

const source = readFileSync(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const key = 'sc_social_attempt_v1';
function storage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return { getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, String(value)),
        removeItem: name => values.delete(name), clear: () => values.clear(), key: index => [...values.keys()][index], get length() { return values.size; } };
}
function runtime({ local = storage(), session = storage(), secure = true, standalone = false } = {}) {
    const opened = [];
    const context = vm.createContext({ localStorage: local, sessionStorage: session, URL, URLSearchParams, Uint8Array, AbortController, setTimeout, clearTimeout,
        IS_LOCAL: false, CONFIG: { api: { auth: '/auth', game: '/game' }, social: { callbackUrl: 'https://dev.studycrack.co.kr/social-callback', google: { clientId: 'synthetic-google' }, naver: { clientId: 'synthetic-naver' } } },
        console: { error() {}, warn() {} }, fetch: async () => ({ ok: false, status: 500, json: async () => ({ error: 'Internal Server Error' }) }),
        window: { crypto: secure ? webcrypto : undefined, navigator: { standalone }, addEventListener() {}, location: { pathname: '/social-callback', href: 'https://dev.studycrack.co.kr/social-callback' },
            open(url, target) { opened.push({ url, target }); return {}; } } });
    vm.runInContext(source + '\nglobalThis.api = { createSocialLoginUrl, readSocialLoginAttempt, consumeSocialLoginAttempt, discardSocialLoginAttempt, navigateSocialLogin, clearClientSession, captureClientSession, isClientSessionCurrent, apiFetch };', context);
    return { context, api: context.api, local, session, opened };
}

for (const provider of ['google', 'naver']) for (const ended of ['0', '1']) test(`${provider}: fresh attempt survives callback bootstrap after ended=${ended}, not old credentials`, () => {
    const r = runtime({ local: storage({ sc_session_ended: ended, userId: 'old-owner' }), session: storage({ accessToken: 'old-access', idToken: 'old-id', deleteConfirmToken: 'old-delete' }) });
    const url = new URL(r.api.createSocialLoginUrl({ provider, purpose: 'mobile', returnUrl: '/studycrack-mobile' }));
    const state = url.searchParams.get('state');
    assert.match(state, new RegExp(`^[a-f0-9]{32}\\|${provider}\\|mobile$`));
    assert.equal(r.local.getItem('userId'), null);
    assert.equal(r.local.getItem('sc_session_ended'), '1');
    r.session.setItem('accessToken', 'stale-after-start');
    const callback = runtime({ local: r.local, session: r.session });
    assert.equal(callback.session.getItem('accessToken'), null);
    assert.equal(callback.session.getItem('idToken'), null);
    assert.equal(callback.session.getItem('deleteConfirmToken'), null);
    assert.equal(callback.api.consumeSocialLoginAttempt(state).provider, provider);
    assert.equal(callback.api.consumeSocialLoginAttempt(state), null);
    assert.equal(callback.session.getItem(key), null);
});

for (const mode of ['expired', 'future', 'epoch', 'owner', 'provider', 'purpose', 'callback', 'return', 'extra-field', 'malformed', 'session-epoch']) test(`invalid ${mode} cannot survive or authenticate`, () => {
    const r = runtime();
    const state = new URL(r.api.createSocialLoginUrl({ provider: 'google' })).searchParams.get('state');
    const attempt = JSON.parse(r.session.getItem(key));
    if (mode === 'expired') attempt.createdAt = Date.now() - 600000;
    if (mode === 'future') attempt.createdAt = Date.now() + 60000;
    if (mode === 'epoch') attempt.epoch = 'old';
    if (mode === 'owner') attempt.owner = 'other';
    if (mode === 'provider') attempt.provider = 'naver';
    if (mode === 'purpose') attempt.purpose = 'delete_reauth';
    if (mode === 'callback') attempt.callback = 'https://evil.invalid/callback';
    if (mode === 'return') attempt.returnUrl = '//evil.invalid/';
    if (mode === 'extra-field') attempt.accessToken = 'must-not-survive';
    r.session.setItem(key, mode === 'malformed' ? '{broken' : JSON.stringify(attempt));
    if (mode === 'session-epoch') r.session.setItem('sc_session_epoch', 'old');
    const callback = runtime({ local: r.local, session: r.session });
    assert.equal(callback.session.getItem(key), null);
    assert.equal(callback.api.consumeSocialLoginAttempt(state), null);
});
for (const mode of ['wrong-state', 'logout', 'new-attempt', 'separate-context']) test(`${mode} cannot authenticate an earlier attempt`, () => {
    const r = runtime();
    const state = new URL(r.api.createSocialLoginUrl({ provider: 'google' })).searchParams.get('state');
    if (mode === 'logout') r.api.clearClientSession();
    if (mode === 'new-attempt') r.api.createSocialLoginUrl({ provider: 'naver' });
    const context = mode === 'separate-context' ? runtime({ local: r.local }).api : r.api;
    assert.equal(context.consumeSocialLoginAttempt(mode === 'wrong-state' ? 'forged' : state), null);
});
test('reauth is owner-bound and preserves the current account and epoch', () => {
    const r = runtime({ local: storage({ userId: 'owner', sc_session_epoch: 'current' }), session: storage({ accessToken: 'current' }) });
    const state = new URL(r.api.createSocialLoginUrl({ provider: 'naver', purpose: 'delete_reauth', returnUrl: '/studycrack-mobile?screen=accountInfo' })).searchParams.get('state');
    assert.equal(r.local.getItem('userId'), 'owner');
    assert.equal(r.local.getItem('sc_session_epoch'), 'current');
    assert.equal(r.session.getItem('accessToken'), 'current');
    assert.equal(r.api.consumeSocialLoginAttempt(state).purpose, 'delete_reauth');
});
test('secure random is mandatory and storage failure never returns an authorize URL', () => {
    const r = runtime({ secure: false });
    assert.throws(() => r.api.createSocialLoginUrl({ provider: 'google' }), /SOCIAL_START_UNAVAILABLE/);
    assert.equal(r.session.getItem(key), null);
    const blocked = runtime();
    blocked.session.setItem = () => { throw new Error('storage unavailable'); };
    assert.throws(() => blocked.api.createSocialLoginUrl({ provider: 'naver' }));
});
test('a request that cannot be consumed is never accepted', () => {
    const r = runtime();
    const state = new URL(r.api.createSocialLoginUrl({ provider: 'google' })).searchParams.get('state');
    r.session.removeItem = () => { throw new Error('storage unavailable'); };
    assert.equal(r.api.consumeSocialLoginAttempt(state), null);
});
test('standalone uses the existing window, never passes credentials to another window', () => {
    const r = runtime({ standalone: true });
    const url = r.api.createSocialLoginUrl({ provider: 'google' });
    r.api.navigateSocialLogin(url);
    assert.deepEqual(r.opened, [{ url, target: '_self' }]);
    assert.throws(() => r.api.navigateSocialLogin('https://evil.invalid/'), /SOCIAL_START_UNAVAILABLE/);
    r.context.window.open = () => null;
    assert.throws(() => r.api.navigateSocialLogin(url), /SOCIAL_START_UNAVAILABLE/);
});
test('ordinary navigation remains same-tab and game500 never ends the session', async () => {
    const r = runtime({ local: storage({ userId: 'owner' }) });
    const epoch = r.local.getItem('sc_session_epoch');
    await assert.rejects(r.api.apiFetch('/game'), error => error.status === 500 && error.code !== 'AUTH_EXPIRED');
    assert.equal(r.local.getItem('userId'), 'owner');
    assert.equal(r.local.getItem('sc_session_ended'), null);
    assert.equal(r.local.getItem('sc_session_epoch'), epoch);
    const url = r.api.createSocialLoginUrl({ provider: 'naver' });
    r.api.navigateSocialLogin(url);
    assert.equal(r.context.window.location.href, url);
    assert.equal(r.opened.length, 0);
});
