import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalculatorPlanCandidate, calculatorPlanDraft, groupPlanTargets, normalizePlanTargets, removeCalculatorPlanCandidate, setPlanTarget, validRepresentatives } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-plan-model.js';
import { createCalculatorComparisonPortfolio } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-portfolio-model.js';
import { requestCalculatorCatalog } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-catalog-api.js';
import { parseCalculatorWorkspace, requestCalculatorWorkspace } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-workspace-api.js';
const digest = 'sha256:' + 'a'.repeat(64), appId = 'APP_11111111-1111-4111-8111-111111111111';
const scores = { admissionYear: 2027, basis: 'raw', exam: { kor: { opt: '언어와매체', common: 60, elective: 20, raw: 80 }, math: { opt: '미적분', common: 60, elective: 14, raw: 74 }, inq1: { name: '사회·문화', raw: 44 }, inq2: { name: '생활과 윤리', raw: 45 }, eng: { grd: 2 }, hist: { grd: 1 } } };
const target = (i, group = 'ga') => ({ university: '예시대학교', major: '예시학과', admissionUnitId: 'UNIT_TEST_' + i, selection: { key: 'PICK_' + i.toString(16).padStart(32, '0'), recordId: 'U_' + i.toString(16).padStart(16, '0'), trackId: 'TRACK_TEST', admissionGroup: group, universityName: '예시대학교', campusName: '서울캠퍼스', unitName: '예시학과', trackName: '일반전형', catalogDigest: digest } });
const runCatalog = value => requestCalculatorCatalog({ analysisApiUrl: '/analysis', admissionGroup: 'ga', query: '', apiFetch: async () => ({ ok: true, status: 200, json: async () => ({ success: true, ...value }) }) });

test('the saved representative opens in its group and a replacement only changes that slot', () => {
  const first = target(1), representative = target(2), na = target(3, 'na'), da = target(4, 'da');
  const legacy = { university: '예시대학교', major: '미분류 학과' };
  const original = [da, first, na, representative, legacy];
  assert.deepEqual(groupPlanTargets(original, { ga: representative.selection.key }), [representative, na, da]);
  assert.deepEqual(setPlanTarget([representative, na, da], first), [first, na, da]);
  assert.equal(original.length, 5);
});

test('same-named units remain distinct by unit, track and group; representatives belong to their own group', () => {
  const ga = target(1), na = target(2, 'na');
  assert.equal(normalizePlanTargets(scores, [ga, na]).length, 2);
  const duplicate = target(3); duplicate.admissionUnitId = ga.admissionUnitId;
  assert.equal(normalizePlanTargets(scores, [ga, duplicate]), null);
  const repeatedKey = target(3); repeatedKey.selection.key = ga.selection.key;
  assert.equal(normalizePlanTargets(scores, [ga, repeatedKey]), null);
  const reps = { ga: ga.selection.key, na: na.selection.key, da: null };
  assert.equal(validRepresentatives(reps, [ga, na]), true);
  for (const wrong of [{ ga: null, na: null }, { ...reps, da: ga.selection.key }, { ...reps, na: 'PICK_' + 'f'.repeat(32) }, { ...reps, extra: null }]) assert.equal(Boolean(validRepresentatives(wrong, [ga, na])), false);
});

test('multi-candidate drafts retain all selections, cap at six, and clear a removed representative', () => {
  const targets = Array.from({ length: 7 }, (_, index) => target(index + 1));
  const draft = targets.reduce(addCalculatorPlanCandidate, calculatorPlanDraft(null, true, true));
  assert.deepEqual(draft.targets, targets.slice(0, 6));
  assert.equal(draft.representatives.ga, targets[0].selection.key);
  const changed = removeCalculatorPlanCandidate(draft, targets[0].selection.key);
  assert.equal(changed.representatives.ga, null);
  assert.equal(addCalculatorPlanCandidate(changed, structuredClone(targets[1])), changed);
  assert.deepEqual(calculatorPlanDraft(changed, true, true), changed);
  assert.equal(calculatorPlanDraft(changed, true, false).targets.length, 1);
});

test('comparison portfolio keeps failed alternatives and exports only available representatives', () => {
  const first = target(1), second = target(2);
  const representatives = { ga: first.selection.key, na: null, da: null };
  const result = { selectionKey: first.selection.key, university: first.university, major: first.major, status: 'available', convertedScore: 720 };
  const entries = new Map([[first.selection.key, { status: 'ready', result, response: { basis: 'raw' } }], [second.selection.key, { status: 'error', error: '잠시 후 시도' }]]);
  const view = reps => createCalculatorComparisonPortfolio({ profile: { scores }, plan: { name: '예시', targets: [first, second], representatives: reps }, entries });
  assert.deepEqual(view(representatives).candidates.map(row => row.status), ['ready', 'error']);
  assert.equal(view(representatives).cards[0].score.value, '720.00점');
  assert.equal(view(representatives).exportMessage, '');
  assert.match(view({ ...representatives, ga: second.selection.key }).exportMessage, /계산 결과/);
  assert.match(view({ ...representatives, ga: null }).exportMessage, /대표 후보/);
});

test('catalog pages reject mixed groups, digests, duplicated identities and malformed pagination', async () => {
  const page = { contractVersion: 'calculator-catalog-v1', admissionYear: 2027, catalogDigest: digest, admissionGroup: 'ga', query: '', total: 1, items: [target(1)], nextCursor: null };
  assert.equal((await runCatalog(page)).ok, true);
  for (const mutate of [v => { v.items[0].selection.admissionGroup = 'na'; }, v => { v.items[0].selection.catalogDigest = 'sha256:' + 'b'.repeat(64); }, v => { v.items.push(v.items[0]); v.total++; }, v => { v.nextCursor = 0; }, v => { v.total = 0; }, v => { v.total = 2; }, v => { v.items[0] = null; }, v => { v.items[0].admissionUnitId = 'legacy_unit'; }]) {
    const wrong = structuredClone(page); mutate(wrong); assert.equal((await runCatalog(wrong)).code, 'INVALID_RESPONSE');
  }
});

test('workspace preserves grouped candidates and representatives and accepts only a canonically refreshed acknowledgement', async () => {
  const ga = target(1), na = target(2, 'na'), reps = { ga: ga.selection.key, na: na.selection.key, da: null }, at = '2026-11-21T00:00:00.000Z';
  const plan = { planId: 'PLAN_TEST_A', revision: 1, name: '내 지원안', targets: [ga, na], representatives: reps, updatedAt: at };
  const value = { contractVersion: 'calculator-workspace-v2', applicationId: appId, workspaceId: 'WS_' + 'a'.repeat(32), revision: 2, legacyRevision: 0, updatedAt: at, status: 'saved', profile: { revision: 1, scores, updatedAt: at }, plans: [plan], lastSavedPlanId: plan.planId, canSave: true, canDelete: true, consentAccepted: true, consentRevision: 'CALCULATOR_INPUT_STORAGE_20261120_V1', source: 'self_reported', reviewed: false };
  assert.deepEqual(parseCalculatorWorkspace(value, appId).plans[0].representatives, reps);
  const data = { expectedWorkspaceRevision: 1, planId: null, name: plan.name, targets: [ga, na], representatives: reps };
  const request = response => requestCalculatorWorkspace({ consultingApiUrl: '/core', apiFetch: async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: response }) }) }, { applicationId: appId, type: 'student_save_calculator_plan', data });
  const refreshed = structuredClone(value); refreshed.plans[0].targets[0].selection.unitName = '갱신한 공식명'; refreshed.plans[0].targets[0].selection.catalogDigest = 'sha256:' + 'b'.repeat(64);
  assert.equal((await request(refreshed)).ok, true);
  for (const mutate of [v => { v.plans[0].representatives.ga = null; }, v => { v.plans[0].targets[0].selection.recordId = 'U_' + 'f'.repeat(16); }]) { const wrong = structuredClone(value); mutate(wrong); assert.equal((await request(wrong)).code, 'INVALID_RESPONSE'); }
});
