import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preflightConsultingInvite } from '../../studycrack-mobile-app/src/features/consulting-v2/api.js';
import vm from 'node:vm';

const html = await readFile(new URL('../../jungsi-consulting-app.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../../studycrack-mobile-app/src/features/consulting-v2/api.js', import.meta.url), 'utf8');
const shared = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const auth = await readFile(new URL('../../js/auth.js', import.meta.url), 'utf8');
const policy = JSON.parse(await readFile(new URL('../public-site-files.json', import.meta.url), 'utf8'));

test('the invite fragment is captured before assets load and removed from the visible URL', () => {
    const capture = html.indexOf("window.location.hash.slice(1)");
    const firstAsset = html.indexOf('<link rel="stylesheet"');
    assert.ok(capture > 0 && capture < firstAsset);
    assert.match(html, /history\.replaceState\(null, '', window\.location\.pathname \+ window\.location\.search\)/);
    assert.doesNotMatch(html.slice(0, firstAsset), /googletagmanager|analytics|dataLayer/i);
});

test('a fresh link replaces malformed storage and an invalid new link cannot silently reopen an older invitation', () => {
    const capture = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const app = 'APP_123e4567-e89b-12d3-a456-426614174000', token = 'A'.repeat(43);
    function open(hash, previous) {
        const storage = new Map(previous ? [['sc_jungsi_invite_v1', previous]] : []);
        vm.runInNewContext(capture, { URLSearchParams, Date, window: { location: { hash, pathname: '/2027-jungsi-consulting/start', search: '' }, addEventListener() {} },
            history: { replaceState() {} }, crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' },
            sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } });
        return storage.get('sc_jungsi_invite_v1');
    }
    const valid = open(`#app=${app}&invite=${token}`, '{malformed');
    assert.equal(JSON.parse(valid).applicationId, app);
    assert.equal(JSON.parse(valid).token, token);
    assert.equal(open('#app=APP_another&invite=invalid', valid), undefined);
    assert.equal(open('', valid), valid);
    assert.equal(JSON.parse(open(`#app=${app}&invite=${token}`, valid)).idempotencyKey, JSON.parse(valid).idempotencyKey);
});

test('the invite secret stays out of local storage and public preflight omits credentials', () => {
    assert.doesNotMatch(client, /localStorage/);
    assert.match(client, /credentials: 'omit'/);
    assert.match(client, /referrerPolicy: 'no-referrer'/);
    assert.match(client, /public_preflight_v2_consulting_invite/);
    assert.match(client, /student_claim_v2_consulting_invite/);
});

test('login and signup preserve only the allowlisted consulting return path', () => {
    assert.match(shared, /'\/2027-jungsi-consulting\/start'/);
    assert.match(shared, /sc_jungsi_invite_v1/);
    assert.match(auth, /isSafeAuthReturnPath\(value\)/);
    assert.match(auth, /createSocialLoginUrl\(\{ provider, returnUrl:/);
});

test('the deployment policy includes the page, assets, and clean URL alias', () => {
    for (const file of ['jungsi-consulting-2027.html', 'jungsi-consulting-app.html', 'css/jungsi-consulting.css', 'js/jungsi-consulting.js']) assert.ok(policy.files.includes(file));
    assert.equal(policy.aliases['2027-jungsi-consulting/start'], 'jungsi-consulting-app.html');
});

test('public invite lookup distinguishes slow connectivity from invalid credentials and cancels on exit', async () => {
    const fetchImpl = (_url, { signal }) => new Promise((_, reject) => {
        const abort = () => reject(Object.assign(new Error(), { name: 'AbortError' }));
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
    });
    const args = { applicationId: 'APP_synthetic', token: 'synthetic', publicApiUrl: 'https://example.invalid/public', fetchImpl };
    assert.deepEqual(await preflightConsultingInvite({ ...args, timeoutMs: 5 }), { ok: false, code: 'TIMEOUT' });
    const controller = new AbortController();
    const pending = preflightConsultingInvite({ ...args, signal: controller.signal });
    controller.abort();
    assert.deepEqual(await pending, { ok: false, code: 'REQUEST_ABORTED' });
    const server = await preflightConsultingInvite({ ...args, fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ success: false, code: 'SERVICE_UNAVAILABLE' }) }) });
    assert.deepEqual(server, { ok: false, code: 'SERVICE_UNAVAILABLE', status: 503 });
    const malformed = await preflightConsultingInvite({ ...args, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
    assert.deepEqual(malformed, { ok: false, code: 'INVITE_UNAVAILABLE', status: 200 });
});
