import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../js/admin/consulting-reference.js', import.meta.url), 'utf8');
class Element {
    constructor(tag = 'div') { Object.assign(this, { tag, children: [], dataset: {}, value: '', hidden: false, disabled: false, textContent: '', attributes: {} }); }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.append(node); return node; }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener() {}
}
const walk = node => [node, ...node.children.flatMap(walk)];
const digest = char => `sha256:${char.repeat(64)}`;
function fixture() {
    const elements = new Map(), calls = [], timers = new Map(); let sequence = 0;
    const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
    const state = { approved: true, blocked: false, runError: 0, defer: false, release: null };
    const records = [{ area: 'korean', selection: '언어와 매체', rawScore: 80, commonRawScore: 60, electiveRawScore: 20 }];
    const catalog = id => ({ caseId: id, contractVersion: 'consulting-local-reference-v1', dataVersion: digest('a'), rawDataVersion: digest('b'), automaticSurveySupported: true,
        automaticSurvey: { available: state.approved, sourceToken: digest('c'), revision: 0, records, risk: 'balanced', message: '최신 조사서 확정이 필요합니다.' }, streams: ['자연/공학'], universities: ['합성대학교'], initialUniversities: [], totalPrograms: 3, automaticGroupReferences: 3, warning: '2026 참고 실험' });
    const result = request => {
        const candidate = { id: 'REF_' + '1'.repeat(24), university: '합성대학교', program: '<img src=x>', score: 133, passCut: 120, top70Cut: 140, margin: 13, band: '적정', group: '가', groupBasis: '2026_reference' };
        const plan = ['가', '나', '다'].map(group => ({ group, candidate: { ...candidate, group }, reason: '합성 추천 근거' }));
        return { caseId: request.caseId, sourceToken: digest('c'), dataVersion: digest('a'), rawDataVersion: digest('b'), status: state.blocked ? 'blocked' : 'ready', scoreSummary: records,
            missing: state.blocked ? [{ message: '국어: 2026 원점수 대응자료가 준비되지 않았습니다.' }] : [], plans: { A: plan, B: plan, C: plan, distinctGroups: 0 }, stats: { total: 3, calculated: 3, excluded: 0, groupPending: 0, excludedByReason: {} }, candidates: [candidate], page: request.input.page, matchingCandidates: 1, hasNextPage: false };
    };
    const context = vm.createContext({ AbortController, Intl, window: { addEventListener() {} },
        setTimeout: callback => { const id = ++sequence; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
        document: { getElementById: get, createElement: tag => new Element(tag), querySelectorAll: () => walk(get('consultingReferenceUniversities')).filter(x => Object.hasOwn(x.dataset, 'referenceUniversity')) },
        createConsultingFacts: facts => { const node = new Element('dl'); for (const [label, value] of facts) { const child = new Element('dd'); child.textContent = `${label}: ${value}`; node.appendChild(child); } return node; },
        consultingWorkspaceStatus: (id, text) => { get(id).textContent = text; },
        requestConsultingAdmin: async (type, data) => {
            calls.push({ type, data });
            if (type === 'admin_get_reference_experiment') return catalog(data.caseId);
            if (state.defer) await new Promise(resolve => { state.release = resolve; });
            if (state.runError) throw Object.assign(new Error('합성 오류'), { status: state.runError });
            return result(data);
        }
    });
    vm.runInContext(source, context);
    return { state, get, calls, timers, context, run: code => vm.runInContext(code, context), open: () => vm.runInContext("prepareConsultingReference('CASE_synthetic'); openConsultingReference(true);", context) };
}
test('opening an approved student automatically renders A/B/C and sends no editable scores', async () => {
    const f = fixture(); await f.open();
    assert.deepEqual(f.calls.map(x => x.type), ['admin_get_reference_experiment', 'admin_run_reference_experiment']);
    const request = f.calls[1].data;
    assert.equal(request.scoreSource, 'approved_survey'); assert.equal(request.input.scores, undefined);
    assert.equal(walk(f.get('consultingReferencePlans')).filter(x => x.tag === 'article').length, 9);
    assert.equal(walk(f.get('consultingReferenceScores')).filter(x => ['input', 'select'].includes(x.tag)).length, 0);
    assert.equal(walk(f.get('consultingReferencePlans')).filter(x => x.tag === 'img').length, 0);
    assert.equal(f.get('consultingReferenceResults').hidden, false);
    assert.equal(f.calls.some(x => /save|approve|verify|publish/.test(x.type)), false);
});
test('unapproved students cannot use the old manual fallback', async () => {
    const f = fixture(); f.state.approved = false; await f.open();
    assert.equal(f.calls.length, 1); assert.equal(f.get('consultingReferenceForm').hidden, true);
    assert.match(f.get('consultingReferenceStatus').textContent, /조사서 확정/);
});
test('missing raw mappings show specific subjects with no invented result or retry loop', async () => {
    const f = fixture(); f.state.blocked = true; await f.open();
    assert.match(f.get('consultingReferenceStatus').textContent, /국어.*원점수 대응자료/);
    assert.equal(f.get('consultingReferenceResults').hidden, true); assert.equal(f.calls.length, 2);
    assert.equal(f.timers.size, 0); assert.equal(f.get('consultingReferenceRun').disabled, false);
});
test('changing only support conditions clears old results and debounces automatic comparison', async () => {
    const f = fixture(); await f.open(); f.get('consultingReferenceRisk').value = 'safe';
    f.run('invalidateConsultingReference(); invalidateConsultingReference();');
    assert.equal(f.get('consultingReferenceResults').hidden, true); assert.equal(f.calls.length, 2); assert.equal(f.timers.size, 1);
    const callback = [...f.timers.values()][0]; callback();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.length, 3); assert.equal(f.calls[2].data.input.risk, 'safe');
});
test('a late result cannot leak into the next selected student', async () => {
    const f = fixture(); f.state.defer = true; const pending = f.open();
    await new Promise(resolve => setImmediate(resolve)); assert.ok(f.state.release);
    f.run("prepareConsultingReference('CASE_other');"); f.state.release(); await pending;
    assert.equal(f.get('consultingReferenceResults').hidden, true); assert.equal(f.get('consultingReferencePlans').children.length, 0);
});
test('changed source requires reloading while a temporary error allows explicit retry', async () => {
    const f = fixture(); f.state.runError = 503; await f.open();
    assert.match(f.get('consultingReferenceStatus').textContent, /다시 계산/); assert.equal(f.get('consultingReferenceRun').disabled, false);
    f.state.runError = 409; await f.run('runConsultingReference()');
    assert.match(f.get('consultingReferenceStatus').textContent, /기준을 갱신/); assert.equal(f.get('consultingReferenceRun').disabled, true);
    const count = f.calls.length; f.run('invalidateConsultingReference()'); assert.equal(f.calls.length, count); assert.equal(f.timers.size, 0);
});
