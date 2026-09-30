import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../js/admin/matching.js', import.meta.url), 'utf8');
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
