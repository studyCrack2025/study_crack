import { expect, test } from '@playwright/test';
const caseId = 'CASE_123e4567-e89b-12d3-a456-426614174000';
function installApi() {
  window.hasClientSession = () => true;
  window.apiFetch = async (_url, options) => {
    const body = JSON.parse(options.body), { type, data } = body, s = window.__amend; s.calls.push(body);
    const reply = (data, status = 200) => new Response(JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: '합성 검사 응답', code: 'AMENDMENT_CONFLICT' }), { status, headers: { 'Content-Type': 'application/json' } });
    if (body.reportId) return new Response(JSON.stringify({ success: false, error: '합성 PDF 요청 확인' }), { status: 500 });
    if (type === 'admin_get_final_call_workspace') return reply({ caseId: s.caseId, caseRevision: s.caseRevision, workflowState: 'SERVICE_COMPLETED', candidates: [], counselorId: 'tutor', session: s.session });
    if (type === 'counselor_list_final_calls') return reply({ sessions: [s.session] });
    if (type === 'counselor_get_final_call_agenda') return reply({ caseId: s.caseId, caseRevision: s.caseRevision, workflowState: 'SERVICE_COMPLETED', session: s.session, agenda: { entries: [], digest: 'digest' }, checklist: {}, agendaReview: null, editable: false, serverTime: s.session.endAt });
    if (type === 'counselor_get_report_amendment_workspace') {
      if (s.deferGet) await new Promise(resolve => { window.__amendResolve = resolve; }); if (s.forbidden) return reply(null, 403);
      return reply({ caseId: s.caseId, caseRevision: s.caseRevision, publishedAmendmentVersion: s.row?.status === 'published' ? 1 : 0, report: { content: s.content }, history: s.row ? [s.row] : [], latest: s.row,
        canCreate: s.role === 'tutor' && !s.row, canEdit: s.role === 'tutor' && s.row?.status === 'draft', canReview: s.role === 'admin' && s.row?.status === 'review' });
    }
    if (type === 'counselor_save_report_amendment') {
      if (!s.keys.includes(data.idempotencyKey)) { s.keys.push(data.idempotencyKey); s.row = { ...data, version: 1, revision: 1, status: 'draft', changes: data.patches.map(patch => ({ ...patch, label: '성적 판단', before: s.content[patch.field], after: patch.value })) }; s.caseRevision++; }
      if (s.failSave) { s.failSave = false; return reply(null, 500); } return reply({ version: 1, status: 'draft' });
    }
    if (type === 'counselor_submit_report_amendment') { s.row.status = 'review'; s.row.revision++; s.caseRevision++; return reply({}); }
    if (type === 'admin_publish_report_amendment') { if (s.deferPublish) await new Promise(resolve => { window.__amendPublishResolve = resolve; }); if (s.publishConflict) return reply(null, 409); s.row.status = 'published'; s.row.publishedAt = '2026-10-29T01:00:00.000Z'; s.row.revision++; s.caseRevision++; return reply({}); }
    if (type === 'admin_reject_report_amendment') { s.row.status = 'rejected'; s.row.rejectionReason = data.reason; s.caseRevision++; return reply({}); }
    if (type === 'student_get_v2_report') return reply({ workflowState: 'SERVICE_COMPLETED', report: { reportId: s.reportId, content: { ...s.content, scoreAssessment: '정정된 성적 판단' }, publishedAt: '2026-10-28T01:00:00.000Z', amendmentVersion: 1 }, originalReport: { reportId: s.reportId, content: s.content, publishedAt: '2026-10-28T01:00:00.000Z' }, amendments: [s.row] });
    return reply(null, 400);
  };
}
async function prepare(page, role = 'tutor', extra = {}) {
  await page.addInitScript(({ role, caseId, extra }) => {
    localStorage.setItem('userRole', role);
    const content = { title: '합성 정시 보고서', executiveSummary: '핵심 요약', scoreAssessment: '최초 성적 판단', candidates: [{ candidateId: 'C1', universityName: '합성 대학', admissionUnitName: '학과', probabilityStatus: 'manual_review', rationale: '확인한 판단' }], applicationStrategy: '지원 전략', risksAndCautions: '주의 사항', finalCallChecklist: '확인할 항목' };
    const row = { version: 1, revision: 2, status: role === 'student' ? 'published' : 'review', category: 'FACTUAL_TEXT_ERROR', reason: '객관적인 모집요강 문구 오류를 바로잡습니다.', evidenceSummary: '공식 모집요강 원문을 대조하여 표기 오류와 적용 범위를 확인했습니다.', references: ['https://example.edu/admissions/2027'], changes: [{ field: 'scoreAssessment', label: '성적 판단', before: content.scoreAssessment, after: '<img src=x onerror=alert(1)> 정정된 성적 판단' }], invalidatedCandidates: [], publishedAt: role === 'student' ? '2026-10-29T01:00:00.000Z' : null };
    window.__amend = { caseId, content, reportId: 'REPORT_123e4567-e89b-12d3-a456-426614174001', role, row: role === 'tutor' ? null : row, caseRevision: 10, calls: [], keys: [], session: { caseId, sessionId: 'FCS_fixture', status: 'completed', revision: 1, startAt: '2026-10-28T01:00:00.000Z', endAt: '2026-10-28T01:30:00.000Z' }, ...extra };
  }, { role, caseId, extra });
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `(${installApi.toString()})();` }));
  await page.goto(`/2027-jungsi-consulting/${role === 'student' ? 'report' : 'final-call'}?caseId=${caseId}`, { waitUntil: 'domcontentloaded' });
}
async function fillDraft(page) {
  await page.getByLabel('정정 사유 (10자 이상)').fill('공식 모집요강의 객관적인 문구 오류를 정정합니다.');
  await page.getByLabel('확인한 오류 근거 (20자 이상)').fill('공식 모집요강 원문을 대조하여 잘못 표기한 문구와 학생에게 안내할 내용을 확인했습니다.');
  await page.getByLabel('근거 자료 주소 (HTTPS, 한 줄에 하나, 최대 3개)').fill('https://example.edu/admissions/2027');
  await page.getByRole('button', { name: '정정 항목 추가', exact: true }).click(); await page.getByLabel('성적 판단 정정 후').fill('객관적 사실과 대조하여 수정한 성적 판단');
}
test('상담사는 객관적 근거·변경 항목을 저장한 다음 검수를 요청한다', async ({ page }, testInfo) => {
  await prepare(page); await expect(page.getByRole('heading', { name: '보고서 오류 정정', exact: true })).toBeVisible(); await fillDraft(page);
  for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.getByRole('button', { name: '정정 초안 저장', exact: true }).scrollIntoViewIfNeeded(); await expect(page.getByRole('button', { name: '정정 초안 저장', exact: true })).toBeInViewport(); await page.screenshot({ path: testInfo.outputPath(`jungsi-amendment-editor-${testInfo.project.name}-${width}.png`) }); }
  await page.getByRole('button', { name: '정정 초안 저장', exact: true }).click(); await expect(page.getByRole('button', { name: '정정본 검수 요청', exact: true })).toBeEnabled();
  await page.getByLabel('성적 판단 정정 후').fill('저장 전 추가 수정'); await expect(page.getByRole('button', { name: '정정본 검수 요청', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '정정 초안 저장', exact: true }).click(); await page.getByRole('button', { name: '정정본 검수 요청', exact: true }).click(); await expect(page.getByText('정정본을 검수 요청했습니다. 관리자 승인 후 학생에게 공개됩니다.')).toBeVisible();
  expect(await page.evaluate(() => window.__amend.calls.some(x => x.type === 'admin_publish_report_amendment'))).toBe(false);
});
test('응답 유실 재시도는 같은 키를 유지하고 성적 오류는 전체 후보를 판단 보류로 지정한다', async ({ page }) => {
  await prepare(page, 'tutor', { failSave: true }); await fillDraft(page); await page.getByLabel('오류 분류', { exact: true }).selectOption('SCORE_INPUT_ERROR'); await expect(page.getByRole('checkbox', { name: /후보 1/ })).toBeChecked(); await expect(page.getByRole('checkbox', { name: /후보 1/ })).toBeDisabled();
  await page.getByRole('button', { name: '정정 초안 저장', exact: true }).click(); await expect(page.locator('.consulting-amendment-panel [role=status]')).toContainText('서버 응답을 확인하지 못했어요.'); await page.getByRole('button', { name: '정정 초안 저장', exact: true }).click(); await expect(page.getByRole('button', { name: '정정본 검수 요청', exact: true })).toBeVisible();
  const calls = await page.evaluate(() => window.__amend.calls.filter(x => x.type === 'counselor_save_report_amendment')); expect(calls[0].data.idempotencyKey).toBe(calls[1].data.idempotencyKey); expect(calls[0].data.invalidatedCandidates).toEqual([0]);
});
test('관리자는 변경 전후·근거·수치 확인과 승인 사유를 모두 확인한 뒤 공개한다', async ({ page }) => {
  await prepare(page, 'admin'); const publish = page.getByRole('button', { name: '승인하고 정정본 공개', exact: true }); await expect(publish).toBeDisabled(); await page.getByText('정정 1차 · 객관적 문구 오류 · 검수 대기', { exact: true }).click(); await expect(page.locator('section.consulting-amendment-history article')).toContainText('<img src=x onerror=alert(1)> 정정된 성적 판단'); expect(await page.locator('.consulting-amendment-history img').count()).toBe(0);
  for (const label of ['단순 선호 변경이 아닌 객관적 오류이며 근거를 확인했습니다.', '정정 전후 내용과 기존 공개 보고서를 비교했습니다.', '오류 영향 후보의 수치 판단 보류 처리를 확인했습니다.']) await page.getByLabel(label, { exact: true }).check();
  await page.getByLabel('승인·반려 사유 (10자 이상)').fill('공식 원문과 정정 내용을 검토하고 공개합니다.'); await page.evaluate(() => { window.__amend.deferPublish = true; }); page.once('dialog', dialog => dialog.accept()); await publish.click(); await expect(publish).toBeDisabled(); await page.evaluate(() => window.__amendPublishResolve()); await expect(page.getByText('정정 1차 · 객관적 문구 오류 · 공개', { exact: true })).toBeVisible(); expect(await page.evaluate(() => window.__amend.calls.filter(x => x.type === 'admin_publish_report_amendment').length)).toBe(1);
});
test('반려는 사유를 기록하고 공개로 표시하지 않는다', async ({ page }) => {
  await prepare(page, 'admin'); await page.getByLabel('승인·반려 사유 (10자 이상)').fill('추가적인 공식 문서 근거를 확인하여 다시 요청해주세요.'); await page.getByRole('button', { name: '정정본 반려', exact: true }).click(); await expect(page.getByText('정정 1차 · 객관적 문구 오류 · 반려', { exact: true })).toBeVisible(); expect(await page.evaluate(() => window.__amend.calls.some(x => x.type === 'admin_publish_report_amendment'))).toBe(false);
});
test('학생은 최신 정정본·원본·변경 이력을 구분하고 해당 PDF version만 요청한다', async ({ page }, testInfo) => {
  await prepare(page, 'student'); await expect(page.getByRole('heading', { name: '정정 1차 반영본' })).toBeVisible(); await page.getByRole('button', { name: 'PDF 받기', exact: true }).click(); await expect(page.getByRole('status')).toContainText('합성 PDF 요청 확인'); await page.getByRole('button', { name: '최초 원본 보기', exact: true }).click(); await expect(page.getByRole('heading', { name: '최초 원본', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'PDF 받기', exact: true }).click(); const calls = await page.evaluate(() => window.__amend.calls.filter(x => x.reportId)); expect(calls.map(x => x.amendmentVersion)).toEqual([1, 0]); expect(calls.every(x => !x.html)).toBe(true);
  await page.getByRole('button', { name: '최신 정정본 보기', exact: true }).click(); await page.getByText('정정 1차 · 객관적 문구 오류', { exact: true }).click();
  for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: testInfo.outputPath(`jungsi-amendment-${testInfo.project.name}-${width}.png`) }); }
});
test('권한 오류·늦은 조회·로그아웃은 편집과 승인으로 이어지지 않는다', async ({ page }) => {
  await prepare(page, 'tutor', { forbidden: true }); await expect(page.locator('.consulting-amendment-panel [role=alert]')).toContainText('권한과 공개 상태'); await page.evaluate(() => { window.__amend.forbidden = false; window.__amend.deferGet = true; }); await page.getByRole('button', { name: '정정 상태 새로고침', exact: true }).click(); await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__amendResolve(); }); await expect(page.getByRole('button', { name: '정정 초안 저장', exact: true })).toHaveCount(0);
});
