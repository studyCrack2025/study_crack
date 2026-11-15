import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../js/admin/consulting-materials.js', import.meta.url), 'utf8');
class Element {
    constructor(tag = 'div') { Object.assign(this, { tag, children: [], dataset: {}, value: '', hidden: false, disabled: false, textContent: '', attributes: {} }); }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); return child; }
    replaceChildren(...children) { this.children = children; }
    set innerHTML(value) { this.children = []; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener() {}
    add(option) { this.children.push(option); }
    querySelectorAll(selector) {
        const matches = node => selector.startsWith('.') ? node.className === selector.slice(1) : node.dataset?.field === selector.match(/data-field="([^"]+)"/)?.[1];
        return this.children.flatMap(child => [matches(child) ? child : null, ...(child.querySelectorAll?.(selector) || [])]).filter(Boolean);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
}
function fixture() {
    const elements = new Map(), calls = [];
    const context = vm.createContext({
        window: { addEventListener() {} }, document: { getElementById: id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
            createElement: tag => new Element(tag) },
        Option: function(text, value) { this.text = text; this.value = value; },
        consultingOptionLabel: (value, labels) => labels[value] || value,
        confirm: () => true,
        requestConsultingAdmin: async (type, data) => { calls.push({ type, data }); return { workflowState: 'AVAILABILITY_REQUIRED' }; },
        refreshConsultingWorkspaceStudent: async () => true
    });
    vm.runInContext(source, context);
    vm.runInContext("closeConsultingMaterialDetail = () => { currentConsultingMaterial = null; };", context);
    context.fixture = { case: { caseId: 'CASE_synthetic' }, submission: { revision: 2 }, verification: { status: 'pending' },
        canApproveSurvey: true, canReview: true, canConfirm: false, mutating: false, surveyVersion: 'current', supplementDraft: new Map() };
    vm.runInContext('currentConsultingMaterial = fixture;', context);
    return { context, calls, elements, run: code => vm.runInContext(code, context) };
}

test('questionnaire approval sends only case and revision even when official scores do not exist', async () => {
    const f = fixture();
    await f.run('approveConsultingSurvey()');
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].type, 'admin_approve_v2_survey');
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].data)), { caseId: 'CASE_synthetic', expectedSurveyRevision: 2 });
    assert.match(f.elements.get('consultingMaterialStatus').textContent, /상담 가능 시간 선택을 열었습니다/);
    assert.equal(f.context.fixture.verification.status, 'pending');
});

test('unsent supplement notes disable approval and never issue a request', async () => {
    const f = fixture();
    f.context.fixture.supplementDraft.set('scores.english', { label: '영어', note: '추가 확인' });
    f.run('refreshConsultingSurveyDecision()');
    assert.equal(f.elements.get('consultingSurveyConfirmBtn').disabled, true);
    await f.run('approveConsultingSurvey()');
    assert.equal(f.calls.length, 0);
});

test('historical answers, missing permission and canceled confirmation do not submit approval', async () => {
    for (const kind of ['historical', 'forbidden', 'canceled']) {
        const f = fixture();
        if (kind === 'historical') f.context.fixture.surveyVersion = 'original';
        if (kind === 'forbidden') f.context.fixture.canApproveSurvey = false;
        if (kind === 'canceled') f.context.confirm = () => false;
        await f.run('approveConsultingSurvey()');
        assert.equal(f.calls.length, 0, kind);
    }
});

test('a pending approval blocks duplicate clicks and a late reply cannot replace another student', async () => {
    const f = fixture();
    let resolve;
    f.context.requestConsultingAdmin = async (type, data) => { f.calls.push({ type, data }); return new Promise(done => { resolve = done; }); };
    const pending = f.run('approveConsultingSurvey()');
    await f.run('approveConsultingSurvey()');
    assert.equal(f.calls.length, 1);
    f.run('consultingMaterialRequest++; currentConsultingMaterial = { case: { caseId: "CASE_other" } };');
    resolve({ notificationQueued: true }); await pending;
    assert.equal(f.run('currentConsultingMaterial.case.caseId'), 'CASE_other');
    assert.equal(f.elements.has('consultingMaterialStatus'), false);
});

test('approval errors preserve the open questionnaire and unlock actions without claiming success', async () => {
    const f = fixture();
    f.context.requestConsultingAdmin = async () => { throw new Error('최신 답변을 다시 확인하세요.'); };
    await f.run('approveConsultingSurvey()');
    assert.equal(f.run('currentConsultingMaterial.case.caseId'), 'CASE_synthetic');
    assert.equal(f.elements.get('consultingSurveyConfirmBtn').disabled, false);
    assert.equal(f.elements.get('consultingMaterialStatus').dataset.state, 'error');
    assert.equal(f.elements.get('consultingMaterialStatus').textContent, '최신 답변을 다시 확인하세요.');
});

test('score editor preserves submitted English/history/language grades and does not add a non-taken subject', () => {
    const f = fixture();
    f.context.scores = { examYear: 2026, examType: 'csat', records: [
        { area: 'english', subject: '영어', grade: 2 }, { area: 'korean_history', subject: '한국사', grade: 3 }
    ] };
    f.run('renderConsultingVerifiedScores(scores, true, true)');
    const read = JSON.parse(f.run('JSON.stringify(readConsultingVerifiedScores())'));
    assert.deepEqual(read.records.map(row => [row.area, row.grade]), [['english', 2], ['korean_history', 3]]);
    assert.equal(read.records.some(row => row.area === 'foreign_language'), false);
    f.context.scores.records.push({ area: 'foreign_language', subject: '독일어Ⅰ', grade: 4 });
    f.run('renderConsultingVerifiedScores(scores, true, true)');
    assert.equal(f.run('readConsultingVerifiedScores().records.at(-1).grade'), 4);
    assert.equal(f.run('readConsultingVerifiedScores().records.at(-1).subject'), '독일어Ⅰ');
});

test('official score validation names the missing subject while allowing genuine zero scores', () => {
    const f = fixture();
    f.context.scores = { records: [{ area: 'korean', subject: '국어', selection: '화법과작문', standardScore: 0, percentile: 0, grade: 9 }] };
    assert.equal(f.run('validateConsultingScoreReview(scores)'), '');
    f.context.scores.records[0].grade = null;
    assert.match(f.run('validateConsultingScoreReview(scores)'), /국어 등급/);
});
