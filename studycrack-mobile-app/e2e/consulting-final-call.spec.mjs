import { expect, test } from '@playwright/test';
const caseId = 'CASE_123e4567-e89b-12d3-a456-426614174000';
function installFinalApi() {
  window.hasClientSession = () => true;
  window.apiFetch = async (_url, options) => {
    const { type, data } = JSON.parse(options.body), s = window.__final;
    s.calls.push({ type, data });
    const reply = (data, status = 200) => new Response(JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: '최신 상태를 확인해주세요.', code: 'FINAL_CALL_CONFLICT' }), { status, headers: { 'Content-Type': 'application/json' } });
    if (s.forbidden) return reply(null, 403);
    const status = () => ({ caseId: s.caseId, workflowState: s.workflowState, caseRevision: s.caseRevision, availabilityRevision: s.availabilityRevision, selectedSlots: s.selectedSlots, session: s.session, editable: s.workflowState === 'FINAL_CALL_SCHEDULING' });
    if (type === 'counselor_get_report_amendment_workspace') return reply({ caseId: s.caseId, caseRevision: s.caseRevision, history: [], canCreate: false, canEdit: false, canReview: false, latest: null });
    if (type === 'student_get_v2_final_call_status') { if (s.deferStatus) await new Promise(resolve => { window.__finalResolve = resolve; }); return reply(status()); }
    if (type === 'student_list_v2_final_call_slots') return reply({ slots: s.slots });
    if (type === 'student_submit_v2_final_call_availability') {
      if (s.deferSubmit) await new Promise(resolve => { window.__finalSubmitResolve = resolve; });
      if (s.failSubmit) { s.failSubmit = false; return reply(null, 500); }
      s.availabilityRevision++; s.selectedSlots = data.selectedSlots; s.caseRevision++; s.workflowState = 'FINAL_CALL_BOOKED'; s.session = s.fixtureSession; return reply(status());
    }
    if (type === 'admin_get_final_call_workspace') return reply({ ...status(), counselorId: data.counselorId || 'tutor', candidates: s.slots.map(slot => ({ ...slot, counselorId: data.counselorId || 'tutor', priority: 1 })) });
    if (type === 'admin_confirm_final_call_assignment' || type === 'admin_cancel_final_call_assignment') { s.caseRevision++; s.workflowState = type.includes('cancel') ? 'FINAL_CALL_SCHEDULING' : 'FINAL_CALL_BOOKED'; s.session = { ...s.fixtureSession, status: type.includes('cancel') ? 'cancelled' : 'booked', revision: (s.session?.revision || 0) + 1 }; return reply({}); }
    if (type === 'counselor_list_final_calls') return reply({ sessions: [{ ...s.session, caseId: s.caseId }] });
    if (type === 'counselor_get_final_call_agenda') return reply({ ...status(), serverTime: s.serverTime, publishedReport: { content: { title: '합성 공개 보고서', executiveSummary: '합성 보고서 요약', candidates: [{ universityName: '합성 대학교', admissionUnitName: '학과', rationale: '승인된 판단', probabilityStatus: 'not_available' }] } }, agenda: { entries: [{ id: 'A1', label: '보고서 확인 항목', body: '<img src=x onerror=alert(1)> 합성 통화 준비', source: { kind: 'report', version: 1 } }], digest: 'synthetic-digest' }, checklist: s.checks, agendaReview: s.review, editable: s.workflowState === 'FINAL_CALL_BOOKED' });
    if (type === 'counselor_save_final_call_checklist') { s.checks = data.checklist; s.review = { reviewed: data.reviewed, digest: data.agendaDigest, notes: data.notes }; s.session.revision++; return reply({}); }
    if (type === 'counselor_complete_final_call') { if (s.deferComplete) await new Promise(resolve => { window.__finalCompleteResolve = resolve; }); s.workflowState = 'SERVICE_COMPLETED'; s.session.status = 'completed'; return reply({}); }
    if (type === 'counselor_get_final_call_contact') return reply({ phone: '01000000000', expiresInSeconds: 30 });
    return reply(null, 400);
  };
}
async function prepare(page, role = 'student', extra = {}) {
  await page.addInitScript(({ role, caseId, extra }) => {
    localStorage.setItem('userRole', role);
    const slots = ['WST_20261029_1000', 'WST_20261029_1030', 'WST_20261030_1000'].map(id => ({ slotId: id, localDate: `${id.slice(4, 8)}-${id.slice(8, 10)}-${id.slice(10, 12)}`, localTime: `${id.slice(13, 15)}:${id.slice(15)}`, startAt: `2026-10-${id.slice(10, 12)}T01:${id.slice(15)}:00.000Z`, endAt: `2026-10-${id.slice(10, 12)}T02:00:00.000Z` }));
    const fixtureSession = { sessionId: 'FCS_synthetic', caseId, counselorId: 'tutor', status: 'booked', revision: 1, startAt: '2026-10-29T01:00:00.000Z', endAt: '2026-10-29T01:30:00.000Z' };
    window.__final = { caseId, slots, fixtureSession, session: role === 'tutor' ? { ...fixtureSession } : null, calls: [], workflowState: role === 'tutor' ? 'FINAL_CALL_BOOKED' : 'FINAL_CALL_SCHEDULING', caseRevision: 10, availabilityRevision: 0, selectedSlots: [], checks: { identityConfirmed: false, reportExplained: false, candidatesAndRisksReviewed: false, remainingQuestionsAnswered: false, noGuaranteeExplained: false }, review: null, serverTime: '2026-10-29T01:10:00.000Z', ...extra };
  }, { role, caseId, extra });
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `(${installFinalApi.toString()})();` }));
  await page.goto(`/2027-jungsi-consulting/final-call${role === 'admin' ? `?caseId=${caseId}` : ''}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '파이널 콜', exact: true })).toBeVisible();
}
const selectSlots = async page => { for (const time of ['2026-10-29 10:00', '2026-10-29 10:30', '2026-10-30 10:00']) await page.getByRole('button', { name: time, exact: true }).click(); };
test('학생 가능 시간 검증·자동 배정·확정 일정·보고서 링크가 이어진다', async ({ page }) => {
  await prepare(page); await page.getByRole('button', { name: '가능 시간 제출·자동 배정' }).click(); await expect(page.getByRole('status')).toContainText('3개 이상');
  await selectSlots(page); await page.getByRole('button', { name: '가능 시간 제출·자동 배정' }).click(); await expect(page.locator('.consulting-schedule-confirmed')).toContainText('확정 일정');
  const calls = await page.evaluate(() => window.__final.calls.filter(x => x.type === 'student_submit_v2_final_call_availability')); expect(calls).toHaveLength(1); expect(calls[0].data.selectedSlots).toHaveLength(3); expect(calls[0].data.caseId).toBeUndefined(); await expect(page.getByRole('button', { name: '공개 보고서 보기' })).toBeVisible();
});
test('실패 재시도는 같은 요청 식별자를 재사용하고 처리 중 중복 제출을 막는다', async ({ page }) => {
  await prepare(page, 'student', { failSubmit: true }); await selectSlots(page); await page.getByRole('button', { name: '가능 시간 제출·자동 배정' }).click(); await expect(page.getByRole('status')).toContainText('서버 응답을 확인하지 못했어요.');
  await page.evaluate(() => { window.__final.deferSubmit = true; }); await page.getByRole('button', { name: '가능 시간 제출·자동 배정' }).click(); await expect(page.getByRole('button', { name: '저장 중…' })).toBeDisabled();
  await page.evaluate(() => window.__finalSubmitResolve()); await expect(page.locator('.consulting-schedule-confirmed')).toBeVisible(); const calls = await page.evaluate(() => window.__final.calls.filter(x => x.type === 'student_submit_v2_final_call_availability')); expect(calls).toHaveLength(2); expect(calls[0].data.idempotencyKey).toBe(calls[1].data.idempotencyKey);
});
test('관리자 재배정·취소는 사유와 최신 revision을 전달한다', async ({ page }) => {
  await prepare(page, 'admin'); await page.getByLabel('배정·변경할 시간').selectOption('WST_20261029_1000'); await page.getByLabel('처리 사유', { exact: true }).fill('합성 일정 배정'); await page.getByRole('button', { name: '선택한 일정 확정' }).click();
  await expect(page.getByRole('button', { name: '현재 일정 취소' })).toBeVisible(); await page.getByLabel('처리 사유', { exact: true }).fill('합성 취소 사유'); await page.getByRole('button', { name: '현재 일정 취소' }).click(); await expect(page.getByText('현재 단계: 일정 선택·배정 대기')).toBeVisible();
  const calls = await page.evaluate(() => window.__final.calls.filter(x => ['admin_confirm_final_call_assignment', 'admin_cancel_final_call_assignment'].includes(x.type))); expect(calls).toHaveLength(2); expect(calls[0].data.expectedCaseRevision).toBe(10); expect(calls[1].data.expectedCaseRevision).toBe(11);
});
test('상담사 검토 저장·명시적 실제 통화 확인을 거친 뒤 서비스 완료한다', async ({ page }) => {
  await prepare(page, 'tutor'); await expect(page.getByText('<img src=x onerror=alert(1)> 합성 통화 준비', { exact: true })).toBeVisible(); expect(await page.locator('.consulting-final-agenda img').count()).toBe(0);
  const complete = page.getByRole('button', { name: '통화 완료·서비스 종료' }); await expect(complete).toBeDisabled();
  await page.getByLabel('현재 통화 준비 항목과 근거를 검토했습니다.').check();
  for (const label of ['통화 상대의 본인을 확인했습니다.', '공개 보고서의 판단과 근거를 설명했습니다.', '지원 후보와 위험 요소를 함께 확인했습니다.', '남은 질문에 답하고 필요한 안내를 마쳤습니다.', '합격을 보장하지 않으며 예측에는 한계가 있음을 안내했습니다.']) await page.getByLabel(label, { exact: true }).check();
  await page.getByRole('button', { name: '검토·체크리스트 저장' }).click(); await page.getByLabel('연락처 조회·완료 처리 사유').fill('합성 통화 완료'); await expect(complete).toBeDisabled(); await page.getByLabel('실제 통화를 마쳤으며 서비스를 완료 처리합니다.').check();
  await page.evaluate(() => { window.__final.deferComplete = true; }); await complete.click(); await expect(complete).toBeDisabled(); await page.evaluate(() => window.__finalCompleteResolve()); await expect(page.getByText('모든 컨설팅 과정이 완료됐습니다.')).toBeVisible(); expect(await page.evaluate(() => window.__final.calls.filter(x => x.type === 'counselor_complete_final_call').length)).toBe(1);
});
test('연락처는 저장소에 남기지 않고 화면 숨김과 30초 뒤 지운다', async ({ page }) => {
  await prepare(page, 'tutor'); await page.clock.install(); await page.getByLabel('연락처 조회·완료 처리 사유').fill('합성 통화 준비'); await page.getByRole('button', { name: '통화 연락처 확인' }).click(); await expect(page.locator('.consulting-final-contact')).toHaveText('01000000000');
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }).includes('01000000000'))).toBe(false);
  await page.clock.fastForward(30001); await expect(page.locator('.consulting-final-contact')).toHaveCount(0);
  await page.getByRole('button', { name: '통화 연락처 확인' }).click(); await expect(page.locator('.consulting-final-contact')).toBeVisible(); await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }); await expect(page.locator('.consulting-final-contact')).toHaveCount(0);
});
test('완료된 학생 화면과 320px·데스크톱에서 종료 상태와 보고서 접근을 유지한다', async ({ page }, testInfo) => {
  await prepare(page, 'student', { workflowState: 'SERVICE_COMPLETED', session: { startAt: '2026-10-29T01:00:00.000Z', endAt: '2026-10-29T01:30:00.000Z', status: 'completed' } });
  await expect(page.getByText('파이널 콜 완료', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: '가능 시간 제출·자동 배정' })).toHaveCount(0);
  for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: `/private/tmp/jungsi-final-call-${testInfo.project.name}-${width}.png`, fullPage: true }); }
});
test('권한 거절은 빈 예약으로 오인하지 않고 로그아웃 뒤의 늦은 응답도 무시한다', async ({ page }) => {
  await prepare(page, 'student', { forbidden: true }); await expect(page.getByRole('alert')).toContainText('로그인과 이용 단계');
  await page.evaluate(() => { window.__final.forbidden = false; window.__final.deferStatus = true; }); await page.getByRole('button', { name: '새로 불러오기' }).click(); await page.evaluate(() => { window.dispatchEvent(new Event('studycrack:session-ended')); window.__finalResolve(); }); await expect(page.getByRole('button', { name: '가능 시간 제출·자동 배정' })).toHaveCount(0);
});

test('상담사 공개 보고서와 검토 화면은 작은 화면에서도 읽고 조작할 수 있다', async ({ page }, testInfo) => {
  await prepare(page, 'tutor'); await page.getByText('공개 보고서 전체 보기', { exact: true }).click(); await expect(page.getByRole('heading', { name: '합성 공개 보고서' })).toBeVisible();
  for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: `/private/tmp/jungsi-final-review-${testInfo.project.name}-${width}.png` }); await page.getByRole('button', { name: '통화 완료·서비스 종료' }).scrollIntoViewIfNeeded(); await expect(page.getByRole('button', { name: '통화 완료·서비스 종료' })).toBeInViewport(); await page.screenshot({ path: `/private/tmp/jungsi-final-review-bottom-${testInfo.project.name}-${width}.png` }); await page.evaluate(() => scrollTo(0, 0)); }
});
