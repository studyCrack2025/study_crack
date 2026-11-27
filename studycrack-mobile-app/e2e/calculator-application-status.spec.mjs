import { calculatorAccessFixture, calculatorEmptyStorage } from './support/calculator-fixture.mjs';
import { expect, test } from '@playwright/test';
const calculatorPath = '/2027-jungsi-consulting/calculator';
const appId = 'APP_11111111-1111-4111-8111-111111111111';
const credentials = { version: 1, productType: 'calculator', requestKey: 'web_11111111-1111-4111-8111-111111111111', token: 'A'.repeat(43), capturedAt: Date.parse('2026-11-20T00:00:00.000Z') };
async function setup(page, options = {}) {
  await page.clock.setFixedTime('2026-11-20T01:00:00.000Z');
  const context = page.context(), state = { calls: [], owner: 'student-A', linked: false, allowed: false, accessSource: 'purchase', receipt: true, failRead: false, failLink: false, defer: false, release: null, ...options };
  state.application = { applicationId: appId, productType: 'calculator', revision: 0, applicationState: 'PAYMENT_REVIEW', paymentStatus: 'pending', state: 'pending_payment', accountLinked: false, accessActive: false, amount: 25000, submittedAt: '2026-11-20T00:00:00.000Z', accessEndsAt: '2027-01-07T14:59:59.999Z', paymentDueAt: '2026-11-27T14:59:59.999Z', openingAt: '2026-11-29T18:00:00+09:00' };
  await context.addInitScript(({ receipt, credentials }) => {
    if (!localStorage.getItem('userId')) { localStorage.setItem('userId', 'student-A'); localStorage.setItem('userRole', 'student'); }
    if (receipt && localStorage.getItem('syntheticNoReceipt') !== '1' && !sessionStorage.getItem('sc_jungsi_application_v1')) sessionStorage.setItem('sc_jungsi_application_v1', JSON.stringify(credentials));
  }, { receipt: state.receipt, credentials });
  await context.route('https://www.googletagmanager.com/**', route => route.abort());
  await context.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.IS_LOCAL=false;window.CONFIG={api:{analysis:'/__status-analysis',consulting:'/__status-core',consultingPublic:'/__status-public',auth:'/__status-auth'}};` }));
  await context.route('**/__status-auth', route => route.fulfill({ json: { success: true } }));
  await context.route('**/__status-public', route => route.fulfill({ json: { success: true, data: { campaignSlug: '2027-jungsi-consulting', admissionYear: 2027, enrollmentStatus: 'unavailable', price: null } } }));
  await context.route('**/__status-analysis', route => {
    const { type } = route.request().postDataJSON();
    if (type === 'get_univ_list_only') return route.fulfill({ json: [] });
    expect(type).toBe('get_calculator_access');
    return route.fulfill({ json: calculatorAccessFixture({ allowed: state.allowed, source: state.accessSource, applicationId: appId, accessEndsAt: state.application.accessEndsAt }) });
  });
  const home = () => ({ contractVersion: 'calculator-applications-v1', items: state.owner === 'student-A' && (state.linked || state.application.applicationState === 'CLAIMED') ? [{ ...state.application }] : [], hasMore: false, needsReview: false, accountEmailMask: state.owner === 'student-A' ? 'a***@example.invalid' : 'b***@example.invalid' });
  await context.route('**/__status-core', async route => {
    const request = route.request().postDataJSON(); state.calls.push(request); let data;
    expect(request.data?.userId).toBeUndefined(); expect(request.data?.studentId).toBeUndefined();
    if (request.type === 'student_get_calculator_applications') {
      const snapshot = home(); if (state.defer) await new Promise(resolve => { state.release = resolve; });
      if (state.failRead) return route.fulfill({ status: 503, json: { success: false } }); data = snapshot;
    } else if (request.type === 'student_delete_calculator_input') {
      expect(request.data.expectedRevision).toBe(2); expect(request.data.confirmed).toBe(true);
      state.stored = null; data = { contractVersion: 'calculator-input-v1', applicationId: appId, status: 'empty', revision: 3, input: null, updatedAt: '2026-11-20T00:00:00.000Z', candidateCount: 0, basis: null, source: 'self_reported', reviewed: false, canSave: false, canDelete: false, consentRevision: 'CALCULATOR_INPUT_STORAGE_20261120_V1' };
    } else if (request.type === 'student_get_calculator_input') {
      data = state.stored || { contractVersion: 'calculator-input-v1', applicationId: appId, status: 'empty', revision: 0, input: null, updatedAt: null, candidateCount: 0, basis: null, source: 'self_reported', reviewed: false, canSave: state.application.accessActive, consentRevision: 'CALCULATOR_INPUT_STORAGE_20261120_V1' };
    } else if (request.type === 'student_preview_calculator_application_link') {
      if (state.owner !== 'student-A') return route.fulfill({ status: 404, json: { success: false } });
      data = { contractVersion: 'calculator-application-link-v1', application: { ...state.application }, accountEmailMask: 'a***@example.invalid', linked: state.linked };
    } else if (request.type === 'student_get_v2_consulting_home') data = state.consultingActive ? {
      available: true, workflowState: 'SURVEY_DRAFT', nextAction: 'COMPLETE_SURVEY', nextDueAt: null,
      progress: ['onboarding', 'survey', 'materials', 'written_consultation', 'report', 'final_call'].map((step, index) => ({ step, status: index === 0 ? 'completed' : index === 1 ? 'current' : 'upcoming' })),
      session: null, report: null, alerts: [], calculator: home()
    } : { available: false, calculator: home() };
    else throw new Error('Unexpected status request ' + request.type);
    try { await route.fulfill({ json: { success: true, data } }); } catch (_) {}
  });
  return state;
}
const panel = page => page.getByRole('region', { name: '나의 계산기 신청', exact: true });
const score = page => page.getByRole('textbox', { name: '국어 공통 원점수', exact: true });
const writes = state => state.calls.filter(x => /student_(?:link|save|delete)/.test(x.type));

test('신청 브라우저의 접수 상태만 표시하고 연결 버튼·접수번호·성적 입력을 노출하지 않는다', async ({ page }, testInfo) => {
  const state = await setup(page); await page.goto(calculatorPath);
  await expect(panel(page)).toContainText('신청 접수 · 입금 확인 대기');
  await expect(panel(page)).not.toContainText(appId); await expect(page.getByRole('button', { name: '이 계정에 신청 상태 연결', exact: true })).toHaveCount(0);
  await expect(score(page)).toHaveCount(0); expect(writes(state)).toHaveLength(0);
  await page.reload(); await expect(panel(page)).toContainText('입금 확인 대기'); expect(writes(state)).toHaveLength(0);
  await page.setViewportSize({ width: 320, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('calculator-pending-320.png'), fullPage: true });
});
test('승인됐어도 이메일 이용 인증 전에는 입력을 열지 않고 기존 인증 완료자는 바로 이용한다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true });
  Object.assign(state.application, { applicationState: 'INVITED', paymentStatus: 'verified', state: 'activation_required' });
  await page.goto(calculatorPath); await expect(panel(page)).toContainText('10자리 인증코드를 입력'); await expect(score(page)).toHaveCount(0);
  Object.assign(state.application, { applicationState: 'CLAIMED', state: 'active', accountLinked: true, accessActive: true }); state.allowed = true;
  await page.reload(); await expect(score(page)).toBeVisible(); await expect(panel(page)).toHaveCount(0); await expect(page.getByRole('region', { name: '계산기 이용 상태' })).toContainText('2027. 1. 7.');
  await expect(page.locator('main')).not.toContainText(appId); expect(writes(state)).toHaveLength(0);
});
test('구형 서버가 Basic membership 권한을 보내도 별도 계산기 인증 전에는 입력하지 못한다', async ({ page }) => {
  const state = await setup(page, { receipt: false, allowed: true, accessSource: 'membership' }); await page.goto(calculatorPath);
  await expect(panel(page)).toContainText('인증된 계산기 이용권이 없습니다'); await expect(score(page)).toHaveCount(0); expect(writes(state)).toHaveLength(0);
});

test('활성 신청과 계산기 권한이 어긋나면 재인증 요구 대신 연결 확인 오류를 표시한다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true, allowed: false });
  Object.assign(state.application, { applicationState: 'CLAIMED', paymentStatus: 'verified', state: 'active', accountLinked: true, accessActive: true });
  await page.goto(calculatorPath);
  await expect(page.getByRole('heading', { name: '이용 정보를 확인하지 못했습니다.' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('인증된 이용권과 계산기 연결 상태');
  await expect(page.getByText('입금 승인과 이용 인증이 필요합니다.', { exact: true })).toHaveCount(0);
  await expect(score(page)).toHaveCount(0); expect(writes(state)).toHaveLength(0);
});
test('신청 조회 지연·실패를 신청 없음으로 표시하지 않고 다시 확인으로 복구한다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true, defer: true }); await page.goto(calculatorPath);
  await expect(panel(page)).toContainText('확인하고 있습니다'); await expect(score(page)).toHaveCount(0);
  await expect.poll(() => typeof state.release).toBe('function'); state.defer = false; state.release();
  await expect(panel(page)).toContainText('입금 확인 대기'); state.failRead = true; await page.getByRole('button', { name: '신청 상태 다시 확인' }).click();
  await expect(panel(page)).toContainText('불러오지 못했습니다'); state.failRead = false; await page.getByRole('button', { name: '신청 상태 다시 확인' }).click(); await expect(panel(page)).toContainText('입금 확인 대기');
});
test('계정 전환 뒤 이전 학생의 지연 신청 응답을 표시하지 않는다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true, defer: true }); await page.goto(calculatorPath);
  await expect.poll(() => typeof state.release).toBe('function'); const release = state.release; state.owner = 'student-B'; state.defer = false;
  await page.evaluate(() => { localStorage.setItem('userId', 'student-B'); window.dispatchEvent(new Event('studycrack:session-ended')); }); release();
  await expect(panel(page)).toContainText('이 계정에 인증된 계산기 이용권이 없습니다'); await expect(panel(page)).not.toContainText(appId); await expect(score(page)).toHaveCount(0);
});
test('나의 컨설팅에서 계산기 상태를 별도로 표시하고 신청 계정을 자동 연결하지 않는다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true }); await page.goto('/2027-jungsi-consulting/home');
  await expect(page.getByRole('heading', { name: '등록된 컨설팅이 없습니다' })).toBeVisible();
  const card = page.getByRole('region', { name: '합격 계산기 신청 현황' }); await expect(card).toContainText('신청 접수 · 입금 확인 대기'); await expect(card.getByRole('link')).toHaveAttribute('href', calculatorPath); expect(writes(state)).toHaveLength(0);
});

test('같은 계정의 컨설팅과 계산기 이용권을 함께 표시하고 화면을 오가도 다시 인증하지 않는다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true, allowed: true, consultingActive: true });
  Object.assign(state.application, { applicationState: 'CLAIMED', paymentStatus: 'verified', state: 'active', accountLinked: true, accessActive: true });
  await page.goto('/2027-jungsi-consulting/home');
  await expect(page.getByRole('heading', { name: '나의 정시 컨설팅', exact: true })).toBeVisible();
  const card = page.getByRole('region', { name: '합격 계산기 신청 현황' });
  await expect(card).toContainText('계산기 이용권 활성');
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(calculatorPath + '$'));
  await expect(page.getByRole('region', { name: '계산기 이용 상태', exact: true })).toContainText('이용 가능');
  await expect(score(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: '컨설팅 이용 인증', exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '나의 정시 컨설팅', exact: true })).toBeVisible();
  await expect(card).toContainText('계산기 이용권 활성');
  expect(writes(state)).toHaveLength(0);
  expect(state.calls.some(call => call.type === 'student_claim_v2_consulting_invite')).toBe(false);
});

test('승인 전 과거 저장 자료는 원문을 노출하지 않고 본인 직접 삭제만 허용한다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true });
  state.stored = { contractVersion: 'calculator-input-v1', applicationId: appId, status: 'restricted', revision: 2, input: null, updatedAt: '2026-11-20T00:00:00.000Z', candidateCount: null, basis: null, source: 'self_reported', reviewed: false, canSave: false, canDelete: true, consentRevision: 'CALCULATOR_INPUT_STORAGE_20261120_V1' };
  await page.goto(calculatorPath); await expect(page.getByText(/이전에 저장한 자료가 있습니다/)).toBeVisible(); await expect(score(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '서버 저장본 불러오기', exact: true })).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '서버 저장 자료 삭제', exact: true }).click();
  await expect(page.getByRole('heading', { name: '이전에 저장한 자료', exact: true })).toHaveCount(0);
  expect(writes(state).map(x => x.type)).toEqual(['student_delete_calculator_input']);
});
