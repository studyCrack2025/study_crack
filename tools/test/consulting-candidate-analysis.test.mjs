import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateRunRequest, candidatesForReport, canApproveAnalysis, canLinkAnalysis, defaultAnalysisOptions, formatAnalysisRange, isCandidateSnapshot, validateAnalysisOptions } from '../../studycrack-mobile-app/src/features/consulting-v2/candidate-analysis-model.js';
import { getCandidateAnalysis, runCandidateAnalysis } from '../../studycrack-mobile-app/src/features/consulting-v2/candidate-analysis-api.js';

const catalog = { regions: [{ id: 'REGION_SEOUL', label: '서울' }], tracks: [{ id: 'TRACK_BUSINESS', label: '경영' }], units: [{ id: 'UNIT_SYNTHETIC', label: '합성대 경영' }] };
const snapshot = { caseRevision: 9, analysisRevision: 1, workspace: { sourceReady: true, canApprove: true, canRun: true, catalog, surveyPreferences: { desiredRegions: [], desiredMajors: [], desiredTracks: [] } },
    analysis: { analysisResultId: 'ANALYSIS_SYNTHETIC', resultDigest: `sha256:${'a'.repeat(64)}`, status: 'generated', stale: false, input: defaultAnalysisOptions(), result: { status: 'ready', candidates: [{ admissionUnitId: 'UNIT_SYNTHETIC', universityName: '합성대', admissionUnitName: '경영', probability: null }], excluded: [], warnings: [], versions: {} } } };

test('분석 요청에는 선택 옵션과 최신 버전만 포함하고 점수나 원문을 보내지 않는다', () => {
  const request = buildCandidateRunRequest({ caseId: 'synthetic', snapshot, form: defaultAnalysisOptions(), reason: '상담 반영', idempotencyKey: 'synthetic_key' });
  assert.equal(request.expectedCaseRevision, 9); assert.equal(request.expectedAnalysisRevision, 1);
  assert.equal(request.options.candidateCount, 6);
  assert.equal(Object.hasOwn(request, 'scoreSnapshot'), false);
  assert.equal(Object.hasOwn(request.preferences, 'freeText'), false);
});
test('수량·확률 표시 범위·필수/제외 중복·퇴역 선택지는 실행 전에 차단한다', () => {
  for (const mutate of [v => { v.options.candidateCount = 11; }, v => { v.options.targetBandMix.stable = 3; }, v => { v.options.minProbability = 90; v.options.maxProbability = 10; },
    v => { v.preferences.mustInclude = ['UNIT_SYNTHETIC']; v.preferences.exclude = ['UNIT_SYNTHETIC']; }, v => { v.preferences.regions = ['REGION_RETIRED']; }]) {
    const value = defaultAnalysisOptions(); mutate(value); assert.ok(validateAnalysisOptions(value, catalog));
  }
});
test('권한·stale·수치 비가용 상태의 승인과 보고서 연결 경계를 구분한다', () => {
  assert.equal(canApproveAnalysis(snapshot), true); assert.equal(canLinkAnalysis(snapshot), false);
  assert.equal(canApproveAnalysis({ ...snapshot, analysis: { ...snapshot.analysis, stale: true } }), false);
  assert.equal(canApproveAnalysis({ ...snapshot, workspace: { ...snapshot.workspace, canApprove: false } }), false);
  assert.equal(canApproveAnalysis({ ...snapshot, analysis: { ...snapshot.analysis, result: { ...snapshot.analysis.result, status: 'insufficient_data' } } }), false);
  assert.equal(canLinkAnalysis({ ...snapshot, analysis: { ...snapshot.analysis, status: 'approved' } }), true);
  assert.equal(formatAnalysisRange(null, '%'), '미제공');
  assert.equal(formatAnalysisRange({ point: 40, low: 60, high: 80 }, '%'), '미제공');
  assert.equal(formatAnalysisRange({ point: 90, low: 70, high: 110 }, '%'), '미제공');
  const linked = candidatesForReport(snapshot.analysis, [{ candidateId: 'UNIT_SYNTHETIC', rationale: '상담 확인' }]);
  assert.equal(linked[0].probability, null); assert.equal(linked[0].rationale, '상담 확인');
});
test('구형/불완전 조회 응답은 승인 화면으로 넘기지 않는다', () => {
  assert.equal(isCandidateSnapshot(snapshot), true);
  assert.equal(isCandidateSnapshot({ caseRevision: 0, analysis: null }), false);
  assert.equal(isCandidateSnapshot({ ...snapshot, workspace: { ...snapshot.workspace, catalog: null } }), false);
});
test('분석 호출은 기존 보호 클라이언트를 사용하며 권한/충돌 코드를 보존한다', async () => {
  const calls = [];
  const binding = { consultingApiUrl: '/synthetic/consulting', apiFetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: false, status: 409, json: async () => ({ code: 'ANALYSIS_REVISION_CONFLICT' }) }; } };
  const get = await getCandidateAnalysis(binding, 'synthetic');
  assert.equal(get.ok, false); assert.equal(get.status, 409); assert.equal(get.code, 'ANALYSIS_REVISION_CONFLICT');
  assert.deepEqual(calls[0].data, { caseId: 'synthetic', analysisResultId: null });
  await runCandidateAnalysis(binding, { idempotencyKey: 'stable_key' });
  assert.equal(calls[1].data.idempotencyKey, 'stable_key');
});
