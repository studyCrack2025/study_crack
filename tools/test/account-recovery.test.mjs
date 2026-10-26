import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../js/shared/account-recovery.js', import.meta.url), 'utf8');
const { formatRecoveryPhone, requestAccountRecovery } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const url = 'https://example.invalid/auth';

test('account lookup uses the phone format saved by signup, including country-code input', () => {
    for (const phone of ['01012345678', '010-1234-5678', '+82 10 1234 5678', '821012345678']) assert.equal(formatRecoveryPhone(phone), '010-1234-5678');
    assert.equal(formatRecoveryPhone('0212345678'), '02-1234-5678');
    assert.equal(formatRecoveryPhone('0311234567'), '031-123-4567');
});

for (const type of ['find_email', 'send_pw_reset_code', 'reset_password']) test(`${type} sends one public request with no session credentials`, async () => {
    let calls = 0;
    const payload = { type, email: 'student@example.invalid' };
    const data = await requestAccountRecovery({ url, payload, fetchImpl: async (target, options) => {
        calls++;
        assert.equal(target, url);
        assert.equal(options.credentials, 'omit');
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(options.body), payload);
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    } });
    assert.equal(data.success, true);
    assert.equal(calls, 1);
});

for (const [status, expected] of [[400, /인증코드/], [401, /새로고침/], [403, /새로고침/], [404, /가입된 계정/], [429, /요청 횟수/], [500, /서버에서/]]) test(`HTTP ${status} preserves its meaning without exposing private server errors or replaying`, async () => {
    let calls = 0;
    await assert.rejects(requestAccountRecovery({ url, payload: { type: 'reset_password' }, fetchImpl: async () => {
        calls++;
        return { ok: false, status, json: async () => ({ error: 'private infrastructure detail' }) };
    } }), error => {
        assert.equal(error.status, status);
        assert.match(error.message, expected);
        assert.doesNotMatch(error.message, /private|통신/);
        return true;
    });
    assert.equal(calls, 1);
});

test('a legitimate empty search result stays distinct from a broken response', async () => {
    const payload = { type: 'find_email' };
    assert.deepEqual(await requestAccountRecovery({ url, payload, fetchImpl: async () => ({ ok: true, json: async () => ({ success: false }) }) }), { success: false });
    for (const data of [null, {}, { success: 'true' }]) await assert.rejects(requestAccountRecovery({ url, payload, fetchImpl: async () => ({ ok: true, json: async () => data }) }), /응답/);
});

test('unreadable error bodies keep server status; network failures have a connection message', async () => {
    await assert.rejects(requestAccountRecovery({ url, payload: { type: 'find_email' }, fetchImpl: async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('private'); } }) }), /서버에서/);
    await assert.rejects(requestAccountRecovery({ url, payload: { type: 'find_email' }, fetchImpl: async () => { throw new TypeError('private'); } }), /인터넷 연결/);
});

for (const stage of ['request', 'response-body']) test(`a stalled ${stage} is bounded and aborted`, async () => {
    let signal;
    await assert.rejects(requestAccountRecovery({ url, payload: { type: 'find_email' }, timeoutMs: 10, fetchImpl: async (_, options) => {
        signal = options.signal;
        if (stage === 'request') return new Promise(() => {});
        return { ok: true, json: () => new Promise(() => {}) };
    } }), /응답 시간이 초과/);
    assert.equal(signal.aborted, true);
});
