import { expect, test } from '@playwright/test';

const caseId = 'CASE_123e4567-e89b-12d3-a456-426614174000';
const otherCase = 'CASE_123e4567-e89b-12d3-a456-426614174001';

function installSyntheticApi() {
  window.hasClientSession = () => true;
  window.apiFetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const s = window.__analysis;
    s.calls.push(request);
    const reply = (data, status = 200, code = '') => new Response(JSON.stringify(status === 200 ? { success: true, data } : { success: false, code }), { status, headers: { 'Content-Type': 'application/json' } });
    if (request.type === 'counselor_list_written_sessions') return reply({ sessions: [s.caseId, s.otherCase].map(caseId => ({ caseId, status: 'completed' })) });
    if (request.type === 'student_get_v2_report') return reply({ available: false, report: null });
    if (request.type === 'counselor_get_candidate_analysis') {
      if (s.deferGet) { s.deferGet = false; await new Promise(resolve => { window.__resolveGet = resolve; }); }
      if (s.getForbidden) return reply(null, 403, 'FORBIDDEN');
      return reply({ caseId: request.data.caseId, caseRevision: s.caseRevision, analysisRevision: s.analysisRevision,
        workspace: { sourceReady: true, canRun: s.canRun, canApprove: s.canApprove, workflowState: s.workflowState, catalog: s.catalog, surveyPreferences: { desiredRegions: ['서울'], desiredMajors: ['경영'], desiredTracks: [] } }, analysis: request.data.caseId === s.otherCase ? null : s.analysis });
    }
    if (request.type === 'counselor_run_candidate_analysis') {
      if (s.deferRun) await new Promise(resolve => { window.__resolveRun = resolve; });
      if (s.runConflict) { s.runConflict = false; if (s.analysis) { s.analysis.stale = true; s.analysis.staleReasons = ['ANALYSIS_DATA_VERSION_CHANGED']; } return reply(null, 409, 'ANALYSIS_REVISION_CONFLICT'); }
      if (!s.keys.includes(request.data.idempotencyKey)) {
        s.keys.push(request.data.idempotencyKey); s.analysisRevision++;
        s.analysis = { analysisInputId: 'ANALYSIS_INPUT_SYNTHETIC', analysisResultId: 'ANALYSIS_SYNTHETIC', resultDigest: `sha256:${'a'.repeat(64)}`, status: 'generated', stale: false, staleReasons: [],
          input: { preferences: { ...request.data.preferences, freeText: '' }, options: request.data.options, scoreSnapshot: { records: [{ subject: '국어', standardScore: 126, percentile: 89, grade: 2 }] } },
          result: { status: 'partial', candidates: [{ admissionUnitId: 'UNIT_SYNTHETIC', universityName: s.name, admissionUnitName: '경영학과', admissionGroup: 'ga', riskBand: 'match', convertedScore: 82,
            expectedCutoff: { point: 80, low: 78, high: 84 }, probability: null, probabilityStatus: 'not_available', confidence: 'not_available', conversionTrace: [{ stepId: 'STEP_001', operation: 'multiply', output: 82 }], reasonCodes: ['PREFERENCE_MATCH'] }], excluded: [], warnings: [], versions: { formulaVersion: 'formula-1.0.0' } } };
        if (s.workflowState === 'REPORT_REVIEW') { s.workflowState = 'REPORT_GENERATING'; if (s.draft) s.draft.status = 'draft'; }
      }
      if (s.failAfterCommit) { s.failAfterCommit = false; return reply(null, 500, 'INTERNAL_SERVER_ERROR'); }
      return reply({ analysisResultId: s.analysis.analysisResultId, status: 'generated' });
    }
    if (request.type === 'counselor_approve_candidate_analysis') {
      if (s.deferApprove) await new Promise(resolve => { window.__resolveApprove = resolve; });
      s.analysis.status = 'approved'; return reply({ analysisResultId: s.analysis.analysisResultId, status: 'approved' });
    }
    if (request.type === 'counselor_get_v2_report_draft' || request.type === 'admin_get_v2_report_review') return reply({ caseId: s.caseId, workflowState: s.workflowState, transcriptHash: 'frozen-synthetic', draft: s.draft });
    if (request.type === 'counselor_save_v2_report_draft') {
      s.workflowState = 'REPORT_GENERATING';
      const content = structuredClone(request.data.content);
      content.candidates = content.candidates.map(item => request.data.analysisResultId ? { ...s.analysis.result.candidates.find(candidate => candidate.admissionUnitId === item.candidateId), ...item } : { ...item, probability: null, convertedScore: null });
      s.draft = { ...request.data, content, status: 'draft', draftRevision: (s.draft?.draftRevision || 0) + 1 };
      return reply({ draftRevision: s.draft.draftRevision, workflowState: s.workflowState });
    }
    if (request.type === 'counselor_submit_v2_report_review') { s.workflowState = 'REPORT_REVIEW'; s.draft.status = 'review'; return reply({ workflowState: s.workflowState }); }
    if (request.type === 'admin_approve_v2_report') { s.workflowState = 'REPORT_SCHEDULED'; s.draft.status = 'approved'; return reply({ releaseAt: request.data.releaseAt }); }
    if (request.type === 'admin_reopen_v2_report') {
      if (s.deferReopen) await new Promise(resolve => { window.__resolveReopen = resolve; });
      if (s.reopenConflict) return reply(null, 409, 'REPORT_REOPEN_CONFLICT');
      s.workflowState = 'REPORT_GENERATING'; s.draft.status = 'draft'; s.draft.publicationHoldReasonCode = 'REPORT_REAPPROVAL_REQUESTED';
      return reply({ caseId: s.caseId, workflowState: s.workflowState });
    }
    return reply(null, 400, 'INVALID_REQUEST');
  };
}

async function prepare(page, { role = 'tutor', canRun = true, canApprove = true, name = '합성대학교', getForbidden = false } = {}) {
  await page.addInitScript(data => {
    localStorage.setItem('userRole', data.role);
    window.__analysis = { ...data, calls: [], keys: [], caseRevision: 9, analysisRevision: 0, analysis: null, draft: null, workflowState: 'WRITTEN_SESSION_COMPLETED',
      catalog: { regions: [{ id: 'REGION_SEOUL', label: '서울' }], tracks: [{ id: 'TRACK_BUSINESS', label: '경영' }], units: [{ id: 'UNIT_SYNTHETIC', label: '합성대학교 경영학과' }] } };
  }, { role, canRun, canApprove, name, getForbidden, caseId, otherCase });
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `(${installSyntheticApi.toString()})();` }));
  await page.goto(`/2027-jungsi-consulting/report?caseId=${caseId}`);
  if (role !== 'student') await expect(page.getByRole('heading', { name: getForbidden ? '후보 분석' : '후보 분석과 검토', exact: true })).toBeVisible();
}
async function run(page) {
  await page.getByLabel('분석 실행 사유').fill('상담에서 확인한 희망 지역 반영');
  await page.getByRole('button', { name: '후보 분석 실행', exact: true }).click();
  await expect(page.getByRole('heading', { name: /합성대학교 · 경영학과/ }).first()).toBeVisible();
}
async function approve(page) {
  await page.getByLabel('분석 승인 사유').fill('환산과 후보 구성 검토 완료');
  await page.getByLabel('점수·예상컷·확률 범위·제외 후보와 유의사항을 검토했습니다.').check();
  await page.getByRole('button', { name: '분석 검토 승인', exact: true }).click();
  await expect(page.locator('.consulting-analysis-results')).toContainText('검토 승인 완료');
}

test('첫 분석·숫자 비가용 결과·검토 승인·보고서 연결과 저장이 이어진다', async ({ page }) => {
  await prepare(page);
  await expect(page.getByRole('button', { name: '후보 분석 실행' })).toBeDisabled();
  await run(page);
  await expect(page.locator('.consulting-analysis-results')).toContainText('확률 미제공');
  await expect(page.getByRole('button', { name: '분석 검토 승인', exact: true })).toBeDisabled();
  await approve(page);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '승인한 후보를 보고서에 연결' }).click();
  await expect(page.getByLabel('후보 1 대학')).toHaveValue('합성대학교');
  await expect(page.getByLabel('후보 1 대학')).toHaveJSProperty('readOnly', true);
  await expect(page.getByLabel('후보 1 모집군')).toHaveValue('가군');
  await page.getByLabel('후보 1 근거').fill('상담에서 지원 의향을 확인함');
  await page.getByRole('button', { name: '초안 저장', exact: true }).click();
  await expect(page.getByText('초안을 저장했습니다.', { exact: true })).toBeVisible();
  const calls = await page.evaluate(() => window.__analysis.calls);
  const request = calls.find(call => call.type === 'counselor_run_candidate_analysis');
  expect(request.data).not.toHaveProperty('scoreSnapshot'); expect(request.data.preferences).not.toHaveProperty('freeText');
  const saved = calls.filter(call => call.type === 'counselor_save_v2_report_draft').at(-1);
  expect(saved.data.analysisResultId).toBe('ANALYSIS_SYNTHETIC');
  expect(saved.data.content.candidates[0]).toEqual({ candidateId: 'UNIT_SYNTHETIC', rationale: '상담에서 지원 의향을 확인함' });
  expect(await page.locator('.consulting-analysis').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  for (const label of ['핵심 요약', '성적 판단', '지원 전략', '위험 요소와 유의사항', '파이널 콜 확인 항목']) await page.getByLabel(label, { exact: true }).fill('상담에서 확인한 합성 보고서 내용');
  await page.getByRole('button', { name: '저장 후 검수 요청', exact: true }).click();
  await expect(page.getByText('관리자 검수를 요청했습니다.', { exact: true })).toBeVisible();
});

test('분석 저장 후 응답 실패 시 같은 키로 재확인하며 중복 클릭을 잠근다', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => { window.__analysis.failAfterCommit = true; window.__analysis.deferRun = true; });
  await page.getByLabel('분석 실행 사유').fill('동일 요청 재확인');
  await page.getByRole('button', { name: '후보 분석 실행', exact: true }).click();
  await expect(page.getByRole('button', { name: '분석 중…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '초안 저장', exact: true })).toBeDisabled();
  await page.evaluate(() => { window.__analysis.deferRun = false; window.__resolveRun(); });
  await expect(page.locator('.consulting-analysis-alert')).toContainText('같은 입력으로 다시');
  await page.getByRole('button', { name: '후보 분석 실행', exact: true }).click();
  await expect(page.locator('.consulting-analysis-results')).toContainText('검토 대기');
  const requests = await page.evaluate(() => window.__analysis.calls.filter(call => call.type === 'counselor_run_candidate_analysis'));
  expect(requests).toHaveLength(2); expect(requests[0].data).toEqual(requests[1].data);
  expect(await page.evaluate(() => window.__analysis.keys.length)).toBe(1);
});

test('기준 변경 충돌은 최신 결과를 다시 읽고 승인·연결을 막는다', async ({ page }) => {
  await prepare(page); await run(page);
  await page.evaluate(() => { window.__analysis.runConflict = true; });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '후보 다시 분석', exact: true }).click();
  await expect(page.locator('.consulting-analysis-results')).toContainText('다시 분석해야');
  await expect(page.getByRole('button', { name: '분석 검토 승인', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '승인한 후보를 보고서에 연결' })).toBeDisabled();
});

test('관리자도 보고서 초안이 없어도 분석을 실행·승인할 수 있다', async ({ page }) => {
  await prepare(page, { role: 'admin' }); await run(page); await approve(page);
  await expect(page.getByRole('button', { name: '승인한 후보를 보고서에 연결' })).toHaveCount(0);
  expect(await page.evaluate(() => window.__analysis.calls.some(call => call.type === 'admin_approve_v2_report'))).toBe(false);
});

test('권한이 없으면 실행·승인을 막고 학생 화면은 분석 요청을 하지 않는다', async ({ page }) => {
  await prepare(page, { canRun: false, canApprove: false });
  await expect(page.getByRole('button', { name: '후보 분석 실행' })).toBeDisabled();
  await expect(page.getByText('분석 실행 권한이 없습니다.', { exact: false })).toBeVisible();
  await page.addInitScript(() => { localStorage.setItem('userRole', 'student'); });
  await page.goto(`/2027-jungsi-consulting/report?caseId=${caseId}`);
  await expect(page.getByRole('heading', { name: '보고서를 준비하고 있습니다' })).toBeVisible();
  expect(await page.evaluate(() => window.__analysis.calls.some(call => call.type.includes('candidate_analysis')))).toBe(false);
});

test('이름의 HTML은 실행되지 않고 세션 종료 후 분석 정보를 제거한다', async ({ page }) => {
  await prepare(page, { name: '<img src=x onerror=alert(1)>' });
  await page.getByLabel('분석 실행 사유').fill('합성 이름 검사');
  await page.getByRole('button', { name: '후보 분석 실행', exact: true }).click();
  await expect(page.locator('.consulting-analysis-results')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.consulting-analysis-results img')).toHaveCount(0);
  await page.evaluate(() => { window.hasClientSession = () => false; window.dispatchEvent(new Event('studycrack:session-ended')); });
  await expect(page.locator('.consulting-analysis-results')).toHaveCount(0);
});

test('학생 전환 전에 시작한 조회의 늦은 응답은 새 학생 결과를 덮지 않는다', async ({ page }) => {
  await prepare(page); await run(page);
  await page.evaluate(() => { window.__analysis.deferGet = true; });
  await page.getByRole('button', { name: '분석 새로고침' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('학생 케이스 선택').selectOption(otherCase);
  await expect(page.getByText('아직 실행한 분석이 없습니다.', { exact: false })).toBeVisible();
  await page.evaluate(() => window.__resolveGet());
  await expect(page.locator('.consulting-analysis-candidates article')).toHaveCount(0);
  await expect(page.getByLabel('학생 케이스 선택')).toHaveValue(otherCase);
});

test('조회 거절은 실행 버튼 없이 안내하고 모바일·데스크톱 결과 배치를 확인한다', async ({ page }, testInfo) => {
  await prepare(page); await run(page); await approve(page);
  const top = async () => { await page.evaluate(() => { document.body.scrollTop = 0; document.documentElement.scrollTop = 0; window.scrollTo(0, 0); }); await expect(page.getByRole('heading', { name: '후보 분석과 검토' })).toBeInViewport(); };
  await top();
  await page.screenshot({ path: `/private/tmp/jungsi-analysis-${testInfo.project.name}-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.consulting-analysis')).toBeVisible();
  expect(await page.locator('.consulting-analysis').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await top();
  await page.screenshot({ path: `/private/tmp/jungsi-analysis-${testInfo.project.name}-desktop.png` });
  await page.evaluate(() => { window.__analysis.getForbidden = true; });
  await page.getByRole('button', { name: '분석 새로고침' }).click();
  await expect(page.getByRole('button', { name: '분석 다시 불러오기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '후보 다시 분석' })).toHaveCount(0);
});

test('승인 직전 결과가 바뀌면 이전 체크를 해제하고 재검토를 요구한다', async ({ page }) => {
  await prepare(page); await run(page);
  await page.getByLabel('분석 승인 사유').fill('수치를 확인함');
  await page.getByLabel('점수·예상컷·확률 범위·제외 후보와 유의사항을 검토했습니다.').check();
  await page.evaluate(() => { window.__analysis.analysis.resultDigest = `sha256:${'b'.repeat(64)}`; });
  await page.getByRole('button', { name: '분석 검토 승인', exact: true }).click();
  await expect(page.getByText('검토한 분석이 변경되었습니다. 최신 결과를 다시 검토해주세요.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('점수·예상컷·확률 범위·제외 후보와 유의사항을 검토했습니다.')).not.toBeChecked();
  expect(await page.evaluate(() => window.__analysis.calls.some(call => call.type === 'counselor_approve_candidate_analysis'))).toBe(false);
});

test('분석 권한이 없는 상담사도 숫자 없는 수동 보고서 경로를 유지한다', async ({ page }) => {
  await prepare(page, { getForbidden: true });
  for (const label of ['핵심 요약', '성적 판단', '지원 전략', '위험 요소와 유의사항', '파이널 콜 확인 항목', '수동 검토 사유']) await page.getByLabel(label, { exact: true }).fill('상담사가 확인한 수동 검토 근거');
  await page.getByLabel('후보 1 대학').fill('수동 합성대');
  await page.getByLabel('후보 1 모집단위').fill('수동 합성학과');
  await page.getByLabel('후보 1 모집군').fill('가군');
  await page.getByLabel('후보 1 근거').fill('합성 상담 근거');
  await page.getByRole('button', { name: '저장 후 검수 요청', exact: true }).click();
  await expect(page.getByText('관리자 검수를 요청했습니다.', { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => window.__analysis.calls.filter(call => call.type === 'counselor_save_v2_report_draft').at(-1));
  expect(saved.data).not.toHaveProperty('analysisResultId');
  expect(saved.data.analysisFallback.status).toBe('manual_review');
  expect(saved.data.content.candidates[0]).not.toHaveProperty('probability');
});

async function loadManualReport(page, workflowState = 'REPORT_REVIEW') {
  await page.evaluate(workflowState => {
    const s = window.__analysis;
    s.workflowState = workflowState;
    s.draft = { status: workflowState === 'REPORT_REVIEW' ? 'review' : 'approved', draftRevision: 2, content: {
      title: '합성 수동 보고서', executiveSummary: '상담 요약', scoreAssessment: '성적 확인',
      candidates: [{ universityName: '합성 대학', admissionUnitName: '합성 학과', admissionGroup: '가군', rationale: '상담 확인', convertedScore: null, expectedCutoff: null, probability: null, probabilityStatus: 'not_available' }],
      applicationStrategy: '지원 전략', risksAndCautions: '유의사항', finalCallChecklist: '파이널 콜 확인'
    } };
  }, workflowState);
  await page.getByRole('button', { name: '보고서 새로고침' }).click();
  await expect(page.getByRole('heading', { name: '합성 수동 보고서', exact: true })).toBeVisible();
}

test('공개 예약 후 취소 사유와 확인을 거쳐 재검토로 돌리고 중복 작업을 잠근다', async ({ page }, testInfo) => {
  await prepare(page, { role: 'admin' }); await loadManualReport(page);
  await page.getByLabel('공개 시각 (기기 현지 시각)').fill('2027-01-01T12:00');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '승인하고 공개 예약', exact: true }).click();
  await expect(page.getByRole('heading', { name: '공개 예약 재검토', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '공개 예약 취소 후 재검토', exact: true })).toBeDisabled();
  await page.getByLabel('공개 예약 취소 사유').fill('상담 내용 변경으로 다시 검토');
  expect(await page.locator('.consulting-report-document').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.getByRole('heading', { name: '공개 예약 재검토', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/private/tmp/jungsi-publication-${testInfo.project.name}.png` });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '공개 예약 취소 후 재검토', exact: true }).click();
  expect(await page.evaluate(() => window.__analysis.calls.some(call => call.type === 'admin_reopen_v2_report'))).toBe(false);
  await page.evaluate(() => { window.__analysis.deferReopen = true; });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '공개 예약 취소 후 재검토', exact: true }).click();
  await expect(page.getByRole('button', { name: '예약 취소 중…', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '보고서 새로고침' })).toBeDisabled();
  await page.evaluate(() => window.__resolveReopen());
  await expect(page.getByText('공개가 보류된 보고서입니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '공개 예약 취소 후 재검토', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '승인하고 공개 예약', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.__analysis.calls.filter(call => call.type === 'admin_reopen_v2_report'))).toEqual([{ type: 'admin_reopen_v2_report', data: { caseId, reason: '상담 내용 변경으로 다시 검토' } }]);
});

test('공개와 취소가 경합하면 성공으로 안내하지 않고 최신 상태를 다시 읽는다', async ({ page }) => {
  await prepare(page, { role: 'admin' }); await loadManualReport(page, 'REPORT_SCHEDULED');
  await page.evaluate(() => { window.__analysis.reopenConflict = true; });
  await page.getByLabel('공개 예약 취소 사유').fill('다시 확인');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '공개 예약 취소 후 재검토', exact: true }).click();
  await expect(page.getByText('최신 보고서 상태를 다시 불러와주세요.', { exact: false })).toBeVisible();
  await expect(page.getByText('공개 예약을 취소했습니다.', { exact: false })).toHaveCount(0);
  await page.evaluate(() => { window.__analysis.workflowState = 'FINAL_CALL_SCHEDULING'; });
  await page.getByRole('button', { name: '보고서 새로고침' }).click();
  await expect(page.getByRole('heading', { name: '공개 예약 재검토', exact: true })).toHaveCount(0);
});

test('상담사는 공개 보류 안내를 보고 초안을 고쳐 다시 검수를 요청한다', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    const s = window.__analysis;
    s.workflowState = 'REPORT_GENERATING';
    s.draft = { status: 'draft', draftRevision: 3, publicationHoldReasonCode: 'REPORT_SOURCE_CHANGED', content: { title: '보류된 합성 보고서', executiveSummary: '', scoreAssessment: '', candidates: [], applicationStrategy: '', risksAndCautions: '', finalCallChecklist: '' } };
  });
  await page.getByRole('button', { name: '보고서 다시 불러오기' }).click();
  await expect(page.getByText('예약 공개가 보류되었습니다.', { exact: false })).toBeVisible();
  for (const label of ['핵심 요약', '성적 판단', '지원 전략', '위험 요소와 유의사항', '파이널 콜 확인 항목', '수동 검토 사유']) await page.getByLabel(label, { exact: true }).fill('변경 내용을 다시 확인함');
  await page.getByRole('button', { name: '후보 추가', exact: true }).click();
  await page.getByLabel('후보 1 대학').fill('합성 대학'); await page.getByLabel('후보 1 모집단위').fill('합성 학과');
  await page.getByLabel('후보 1 모집군').fill('가군'); await page.getByLabel('후보 1 근거').fill('변경 기준 확인');
  await page.getByRole('button', { name: '저장 후 검수 요청', exact: true }).click();
  await expect(page.getByText('관리자 검수를 요청했습니다.', { exact: true })).toBeVisible();
});
