import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../js/admin/matching.js', import.meta.url), 'utf8');
test('legacy name assignments are separate from unassigned; failed reload clears stale choices', async () => {
    const elements = {};
    const c = vm.createContext({ console: { error() {} }, ADMIN_API_URL: '/admin', localStorage: { getItem: () => 'admin' },
        getTierBadgeHTML: () => '<span>STANDARD</span>',
        document: { getElementById: id => elements[id] ||= { innerHTML: '', style: {} } },
        apiFetch: async (_url, options) => ({ ok: true, json: async () => JSON.parse(options.body).type === 'admin_get_tutor_list' ? { tutors: [{ tutorId: 't' }] } : [
            { userid: 'legacy', tutorName: 'Teacher' }, { userid: 'new' }, { userid: 'linked', assignedTutorId: 't' }
        ] }) });
    vm.runInContext(source, c);
    await vm.runInContext('loadMatchingData(true)', c);
    assert.equal(vm.runInContext('globalUnmatchedStudents[0].userid', c), 'new');
    assert.equal(vm.runInContext('globalLegacyAssignments[0].userid', c), 'legacy');
    assert.match(elements.newMatchCount.innerText, /신규 1 · 기존 배정 확인 1/);
    c.apiFetch = async () => { throw new Error('500'); };
    await vm.runInContext('loadMatchingData(true)', c);
    assert.equal(vm.runInContext('globalAllStudentsForMatch.length', c), 0);
    assert.match(elements.newMatchList.innerHTML, /미배정 상태를 뜻하지 않습니다/);
});
function fixture(status = 200) {
    const calls = [], alerts = [], elements = {};
    const context = vm.createContext({ console: { error() {} }, ADMIN_API_URL: '/admin', localStorage: { getItem: () => 'admin' },
        alert: text => alerts.push(text), document: { getElementById: id => elements[id] ||= { value: 'selected-tutor', innerHTML: '', style: {}, classList: { toggle() {} } } },
        apiFetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: status === 200, status, json: async () => ({ success: true, assignedTutorId: 'new-id', tutorAssignmentRevision: 8 }) }; } });
    vm.runInContext(source, context);
    vm.runInContext("globalAllStudentsForMatch = [{userid:'student', tutorName:'Display Name', assignedTutorId:'old', tutorAssignmentRevision:7}]; loadMatchingData = async () => {};", context);
    return { calls, alerts, context };
}
test('matching sends exact selected ID and server revision, never a supplied old display name', async () => {
    const f = fixture(); await vm.runInContext("executeMatching('student', true, 'new-id', 'forged-old')", f.context);
    assert.deepEqual(f.calls[0].data, { targetUserId: 'student', newTutorId: 'new-id', expectedRevision: 7 });
    assert.equal(f.alerts.length, 1); assert.match(f.alerts[0], /성공적으로/);
});
for (const status of [400, 403, 409, 500]) test(`matching ${status} never displays success`, async () => {
    const f = fixture(status); await vm.runInContext("executeMatching('student', true, 'new-id')", f.context);
    assert.equal(f.calls.length, 1); assert.equal(f.alerts.length, 1);
    assert.doesNotMatch(f.alerts[0], /성공적으로|완료되었습니다/);
});

for (const [status, code, message] of [[400, 'ASSIGNMENT_INVALID', /요청 정보/], [403, 'ASSIGNMENT_FORBIDDEN', /배정 권한/], [409, 'ASSIGNMENT_CONFLICT', /담당 정보 또는 계정 상태/], [409, 'ASSIGNMENT_TUTOR_BLOCKED', /차단한 튜터/], [500, '', /서버 오류.*500/]]) test(`rejected API promise ${status}/${code} explains the failure and reloads current assignments`, async () => {
    const f = fixture(); let reloads = 0;
    f.context.apiFetch = async () => { throw Object.assign(new Error('private server detail'), { status, code }); };
    f.context.loadMatchingData = async () => { reloads++; };
    await vm.runInContext("executeMatching('student', true, 'new-id')", f.context);
    assert.equal(f.alerts.length, 1);
    assert.match(f.alerts[0], message);
    assert.doesNotMatch(f.alerts[0], /통신 오류|private/);
    assert.equal(reloads, 1);
});

test('real shared API conflict rejection is handled without changing the protected request wrapper', async () => {
    const f = fixture();
    const storage = initial => {
        const values = new Map(Object.entries(initial));
        return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() };
    };
    Object.assign(f.context, { localStorage: storage({ userId: 'admin' }), sessionStorage: storage({}), IS_LOCAL: false,
        CONFIG: { api: { admin: '/admin', auth: '/auth' } }, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
        window: { addEventListener() {}, location: { pathname: '/admin', search: '' } },
        fetch: async () => ({ ok: false, status: 409, json: async () => ({ code: 'ASSIGNMENT_CONFLICT', error: 'private server detail' }) }) });
    const sharedSource = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
    vm.runInContext(sharedSource, f.context);
    await vm.runInContext("executeMatching('student', true, 'new-id')", f.context);
    assert.match(f.alerts[0], /담당 정보 또는 계정 상태/);
    assert.doesNotMatch(f.alerts[0], /통신 오류|private/);
});

test('duplicate clicks share one pending assignment and a lost response triggers lookup instead of automatic resubmission', async () => {
    const f = fixture(); let requests = 0, rejectRequest, reloads = 0;
    f.context.apiFetch = () => { requests++; return new Promise((_, reject) => { rejectRequest = reject; }); };
    f.context.loadMatchingData = async () => { reloads++; };
    const first = vm.runInContext("executeMatching('student', true, 'new-id')", f.context);
    await vm.runInContext("executeMatching('student', true, 'new-id')", f.context);
    assert.equal(requests, 1);
    rejectRequest(new TypeError('connection lost'));
    await first;
    assert.match(f.alerts[0], /결과/);
    assert.equal(reloads, 1);
    assert.equal(requests, 1);
});

test('an unreadable or unrelated success response never announces a confirmed assignment', async () => {
    for (const result of [null, { success: false }, { success: true, assignedTutorId: 'other-id', tutorAssignmentRevision: 8 }, { success: true, assignedTutorId: 'new-id', tutorAssignmentRevision: 9 }]) {
        const f = fixture();
        f.context.apiFetch = async () => ({ ok: true, json: async () => result });
        await vm.runInContext("executeMatching('student', true, 'new-id')", f.context);
        assert.equal(f.alerts.length, 1);
        assert.match(f.alerts[0], /결과를 확인하지 못했습니다/);
    }
});

test('late assignment results cannot notify or reload a different administrator session', async () => {
    const f = fixture(); let resolveRequest, reloads = 0;
    f.context.apiFetch = () => new Promise(resolve => { resolveRequest = resolve; });
    f.context.loadMatchingData = async () => { reloads++; };
    const request = vm.runInContext("executeMatching('student', true, 'new-id')", f.context);
    f.context.localStorage = { getItem: () => 'different-admin' };
    resolveRequest({ ok: true, json: async () => ({ success: true, assignedTutorId: 'new-id', tutorAssignmentRevision: 8 }) });
    await request;
    assert.equal(f.alerts.length, 0);
    assert.equal(reloads, 0);
});
