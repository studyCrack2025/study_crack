import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const inviteKey = 'sc_jungsi_invite_v1';
const startPath = '/2027-jungsi-consulting/start';
const invite = {
    version: 1, applicationId: 'APP_123e4567-e89b-12d3-a456-426614174000', token: 'A'.repeat(43),
    idempotencyKey: 'claim_11111111-1111-4111-8111-111111111111', capturedAt: 1794890000000
};

function storage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key), clear: () => values.clear(), key: index => [...values.keys()][index],
        get length() { return values.size; } };
}

function runtime(path = startPath, pending = invite) {
    const url = new URL(path, 'https://dev.studycrack.co.kr');
    const local = storage({ sc_session_epoch: 'before-login' });
    const session = storage({ sc_session_epoch: 'before-login', [inviteKey]: JSON.stringify(pending) });
    const listeners = {}, notifications = [];
    const window = { crypto: webcrypto, location: { pathname: url.pathname, search: url.search, origin: url.origin, replace() {} },
        addEventListener: (name, listener) => { listeners[name] = listener; },
        dispatchEvent: event => { notifications.push({ type: event.type, invite: session.getItem(inviteKey) }); } };
    const context = vm.createContext({ window, localStorage: local, sessionStorage: session, URL, URLSearchParams,
        Uint8Array, AbortController, CustomEvent: class { constructor(type) { this.type = type; } }, setTimeout, clearTimeout,
        IS_LOCAL: false, CONFIG: { api: {}, social: { callbackUrl: url.origin + '/social-callback', google: { clientId: 'synthetic' } } } });
    vm.runInContext(source + '\nglobalThis.api = { clearClientSession, beginClientLogin, hasClientSession, createSocialLoginUrl };', context);
    return { local, session, listeners, notifications, api: context.api };
}

function changedSession(r, event, { ended = false } = {}) {
    r.local.setItem('sc_session_epoch', 'after-login');
    r.local.setItem('userId', 'current-student');
    if (ended) r.local.setItem('sc_session_ended', '1');
    r.session.setItem('accessToken', 'previous-access');
    r.session.setItem('idToken', 'previous-id');
    r.session.setItem('deleteConfirmToken', 'previous-confirmation');
    r.session.setItem('private-draft', 'previous-account-data');
    r.listeners[event](event === 'pageshow' ? { persisted: true } : { key: 'sc_session_epoch' });
}

for (const event of ['pageshow', 'storage']) for (const path of [startPath, '/login?returnUrl=' + encodeURIComponent(startPath), '/signup?returnUrl=' + encodeURIComponent(startPath)]) {
    test(`${event} after login preserves the pending invitation on ${path}, and removes prior account data`, () => {
        const r = runtime(path);
        changedSession(r, event);
        assert.deepEqual(JSON.parse(r.session.getItem(inviteKey)), invite);
        for (const key of ['accessToken', 'idToken', 'deleteConfirmToken', 'private-draft']) assert.equal(r.session.getItem(key), null);
        assert.equal(r.local.getItem('userId'), 'current-student');
        assert.equal(r.api.hasClientSession(), true);
        assert.deepEqual(JSON.parse(r.notifications.at(-1).invite), invite, 'invite must be restored before the screen is notified');
    });
}

for (const path of ['/mypage', '/studycrack-mobile', '/login', '/login?returnUrl=' + encodeURIComponent(startPath + '?other=1')]) {
    test(`an unrelated return path does not preserve an invitation: ${path}`, () => {
        const r = runtime(path);
        changedSession(r, 'storage');
        assert.equal(r.session.getItem(inviteKey), null);
    });
}

test('explicit logout and a logout from another tab remove the pending invitation', () => {
    for (const mode of ['explicit', 'other-tab']) {
        const r = runtime();
        if (mode === 'explicit') r.api.clearClientSession();
        else changedSession(r, 'storage', { ended: true });
        assert.equal(r.session.getItem(inviteKey), null);
        assert.equal(r.api.hasClientSession(), false);
    }
});

test('only a structurally valid invitation survives; arbitrary nested data is not carried into the next account', () => {
    for (const pending of [{ ...invite, version: 2 }, { ...invite, token: 'invalid' }, { ...invite, applicationId: 'APP_invalid' }, { ...invite, idempotencyKey: 'invalid' }]) {
        const r = runtime(startPath, pending);
        changedSession(r, 'pageshow');
        assert.equal(r.session.getItem(inviteKey), null);
    }
    const r = runtime(startPath, { ...invite, accessToken: 'previous-access', privateProfile: { name: 'previous-account' } });
    changedSession(r, 'pageshow');
    assert.deepEqual(JSON.parse(r.session.getItem(inviteKey)), invite);
});

for (const method of ['password', 'social']) test(`${method} login still preserves the exact invitation and claim request identity`, () => {
    const r = runtime('/login?returnUrl=' + encodeURIComponent(startPath));
    if (method === 'password') r.api.beginClientLogin();
    else r.api.createSocialLoginUrl({ provider: 'google', returnUrl: startPath });
    assert.deepEqual(JSON.parse(r.session.getItem(inviteKey)), invite);
    assert.equal(r.local.getItem(inviteKey), null);
});

test('guest application continuation keeps only bounded receipt credentials through login and never keeps PII', () => {
    const r = runtime('/signup?returnUrl=' + encodeURIComponent(startPath));
    const value = { version: 1, requestKey: 'web_123e4567-e89b-12d3-a456-426614174000', token: 'B'.repeat(43), productType: 'calculator', capturedAt: Date.now(), email: 'must-not-survive@example.invalid' };
    r.session.setItem('sc_jungsi_application_v1', JSON.stringify(value));
    r.api.beginClientLogin();
    const stored = JSON.parse(r.session.getItem('sc_jungsi_application_v1'));
    assert.equal(stored.requestKey, value.requestKey); assert.equal(stored.productType, 'calculator'); assert.equal(Object.hasOwn(stored, 'email'), false);
    r.api.clearClientSession(); assert.deepEqual(JSON.parse(r.session.getItem('sc_jungsi_application_v1')), stored);
});

test('expired or malformed guest receipt is not carried across authentication', () => {
    for (const patch of [{ capturedAt: Date.now() - 86400001 }, { token: 'guess' }, { productType: 'unknown' }, { capturedAt: Date.now() + 60000 }]) {
        const r = runtime();
        r.session.setItem('sc_jungsi_application_v1', JSON.stringify({ version: 1, requestKey: 'web_123e4567-e89b-12d3-a456-426614174000', token: 'B'.repeat(43), productType: 'calculator', capturedAt: Date.now(), ...patch }));
        r.api.beginClientLogin(); assert.equal(r.session.getItem('sc_jungsi_application_v1'), null);
    }
});
