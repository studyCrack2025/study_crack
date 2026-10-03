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
        apiFetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: status === 200, status }; } });
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
