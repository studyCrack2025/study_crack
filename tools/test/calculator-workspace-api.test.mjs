import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalculatorWorkspace, requestCalculatorWorkspace } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-workspace-api.js';
import { requestCalculatorAccess } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-api.js';
const appId = 'APP_11111111-1111-4111-8111-111111111111', at = '2026-11-21T00:00:00.000Z';
const scores = { admissionYear: 2027, basis: 'raw', exam: { kor: { opt: '언어와매체', common: 60, elective: 20, raw: 80 }, math: { opt: '미적분', common: 60, elective: 14, raw: 74 }, inq1: { name: '사회·문화', raw: 44 }, inq2: { name: '생활과 윤리', raw: 45 }, eng: { grd: 2 }, hist: { grd: 1 } } };
const targets = [{ university: '예시대학교', major: '예시학과' }];
function fixture() { return { contractVersion: 'calculator-workspace-v2', applicationId: appId, workspaceId: 'WS_' + 'a'.repeat(32), revision: 2, legacyRevision: 0, updatedAt: at, status: 'saved',
  profile: { revision: 1, scores, updatedAt: at }, plans: [{ planId: 'PLAN_TEST_A', revision: 1, name: '기본 조합', targets, updatedAt: at }], lastSavedPlanId: 'PLAN_TEST_A',
  canSave: true, canDelete: true, consentAccepted: true, consentRevision: 'CALCULATOR_INPUT_STORAGE_20261120_V1', source: 'self_reported', reviewed: false }; }
const run = (value = fixture(), options = {}) => requestCalculatorWorkspace({ consultingApiUrl: '/consulting', apiFetch: async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: value }) }) }, { applicationId: appId, ...options });

test('workspace parsing retains independent profile and plan revisions and rejects cross-account or malformed data', async () => {
  assert.equal((await run()).ok, true);
  for (const mutate of [v => { v.applicationId = 'APP_other'; }, v => { v.workspaceId = 'user-A'; }, v => { v.revision = -1; }, v => { v.profile.revision = 0; },
    v => { v.profile.scores.admissionYear = 2026; }, v => { v.profile.scores.exam.kor.raw = 79; }, v => { v.plans.push(v.plans[0]); },
    v => { v.lastSavedPlanId = 'PLAN_MISSING'; }, v => { v.plans[0].name = '\n'; }, v => { v.plans[0].targets.push(v.plans[0].targets[0]); },
    v => { v.consentAccepted = false; }, v => { v.reviewed = true; }]) {
    const value = structuredClone(fixture()); mutate(value); assert.equal(parseCalculatorWorkspace(value, appId), null);
  }
});

test('restricted and empty workspaces never restore hidden scores or plans', () => {
  const value = fixture(); Object.assign(value, { status: 'restricted', profile: null, plans: [], lastSavedPlanId: null, canSave: false });
  assert.ok(parseCalculatorWorkspace(value, appId)); value.profile = fixture().profile; assert.equal(parseCalculatorWorkspace(value, appId), null);
  Object.assign(value, { status: 'empty', profile: null, canDelete: false, consentAccepted: false }); assert.ok(parseCalculatorWorkspace(value, appId));
});

test('mutation acknowledgements must match the original scores/plan and next storage revision', async () => {
  const input = { expectedWorkspaceRevision: 1, expectedLegacyRevision: 0, requestId: 'workspace_11111111-1111-4111-8111-111111111111', scores };
  assert.equal((await run(fixture(), { type: 'student_save_calculator_profile', data: input })).ok, true);
  const wrong = structuredClone(fixture()); wrong.profile.scores.exam.eng.grd = 3;
  assert.equal((await run(wrong, { type: 'student_save_calculator_profile', data: input })).code, 'INVALID_RESPONSE');
  assert.equal((await run(fixture(), { type: 'student_save_calculator_profile', data: { ...input, expectedWorkspaceRevision: 2 } })).code, 'INVALID_RESPONSE');
  assert.equal((await run(fixture(), { type: 'student_save_calculator_plan', data: { expectedWorkspaceRevision: 1, planId: null, name: '기본 조합', targets } })).ok, true);
  assert.equal((await run(fixture(), { type: 'student_save_calculator_plan', data: { expectedWorkspaceRevision: 1, planId: null, name: '다른 조합', targets } })).code, 'INVALID_RESPONSE');
  assert.equal((await run(fixture(), { type: 'student_delete_calculator_plan', data: { expectedWorkspaceRevision: 1, planId: 'PLAN_TEST_A' } })).code, 'INVALID_RESPONSE');
});

test('read recovery can retry authentication once; a write is sent once and preserves its idempotency key', async () => {
  let calls = [];
  const binding = { consultingApiUrl: '/consulting', apiFetch: async (_, options) => { calls.push(JSON.parse(options.body)); return calls.length === 1 ? { ok: false, status: 409, json: async () => ({ code: 'AUTH_RETRY_REQUIRED' }) } : { ok: true, status: 200, json: async () => ({ success: true, data: fixture() }) }; } };
  assert.equal((await requestCalculatorWorkspace(binding, { applicationId: appId })).ok, true); assert.equal(calls.length, 2);
  calls = []; const data = { expectedWorkspaceRevision: 1, expectedLegacyRevision: 0, requestId: 'workspace_11111111-1111-4111-8111-111111111111', scores };
  assert.equal((await requestCalculatorWorkspace(binding, { applicationId: appId, type: 'student_save_calculator_profile', data })).ok, false);
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].data, { applicationId: appId, ...data });
});

test('only a supported server workspace version enables the new flow', async () => {
  for (const version of [1, 2, 3, '2']) {
    const value = { success: true, contractVersion: 'jungsi-calculator-access-v1', admissionYear: 2027, access: { allowed: true, source: 'purchase' }, entitlement: { applicationId: appId, accessEndsAt: '2027-01-07T14:59:59.999Z' },
      service: { state: 'preparing', purchaseAvailable: false, calculationEnabled: true, calculationMode: 'development_preview', workspaceVersion: version } };
    const result = await requestCalculatorAccess({ analysisApiUrl: '/analysis', apiFetch: async () => ({ ok: true, status: 200, json: async () => value }) });
    assert.equal(result.ok, version === 1 || version === 2); if (result.ok) assert.equal(result.data.service.workspaceVersion, version);
  }
});
