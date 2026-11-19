import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../../js/admin/consulting-workspace.js', import.meta.url), 'utf8');
const caseId = 'CASE_123e4567-e89b-42d3-a456-426614174000';
function setup() {
    const nodes = new Map();
    const element = () => ({ hidden: false, offsetParent: {}, children: [], dataset: {}, replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); } });
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    let timer;
    const context = vm.createContext({ window: { addEventListener() {} }, document: { hidden: false, getElementById: get, createElement: element }, setTimeout: fn => { timer = fn; return 1; }, clearTimeout() {}, encodeURIComponent,
        requestConsultingAdmin: async () => ({ items: [{ caseId }], hasMore: false }) });
    vm.runInContext(source, context);
    return { context, nodes, run: code => vm.runInContext(code, context), hasTimer: () => Boolean(timer) };
}
test('new written messages link to the exact case with text-only names and a bounded refresh', async () => {
    const s = setup(); await s.run(`loadConsultingWrittenUnread(0, [{caseId:'${caseId}',studentNameMask:'<img onerror=bad>'}])`);
    const panel = s.nodes.get('consultingWrittenUnread'); assert.equal(panel.hidden, false); assert.equal(panel.children[1].textContent, '<img onerror=bad> · 대화 보기');
    assert.equal(panel.children[1].href, '/2027-jungsi-consulting/written-session?caseId=' + caseId); assert.equal(s.hasTimer(), true);
});
test('stale, hidden and malformed alert replies do not create navigation links', async () => {
    const s = setup(); await s.run('loadConsultingWrittenUnread(9, [])'); assert.equal(s.nodes.get('consultingWrittenUnread').children.length, 0);
    s.context.requestConsultingAdmin = async () => ({ items: [{ caseId: '../../other' }] }); await s.run('loadConsultingWrittenUnread(0, [])'); assert.equal(s.nodes.get('consultingWrittenUnread').children.length, 0);
    s.context.document.hidden = true; let calls = 0; s.context.requestConsultingAdmin = async () => { calls++; return { items: [] }; }; await s.run('loadConsultingWrittenUnread(0, [])'); assert.equal(calls, 0);
});
