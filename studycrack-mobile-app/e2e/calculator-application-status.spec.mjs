import { expect, test } from '@playwright/test';
const calculatorPath = '/2027-jungsi-consulting/calculator';
const appId = 'APP_11111111-1111-4111-8111-111111111111';
const credentials = { version: 1, productType: 'calculator', requestKey: 'web_11111111-1111-4111-8111-111111111111', token: 'A'.repeat(43), capturedAt: Date.parse('2026-11-20T00:00:00.000Z') };
async function setup(page, options = {}) {
  await page.clock.setFixedTime('2026-11-20T01:00:00.000Z');
  const context = page.context(), state = { calls: [], owner: 'student-A', linked: false, receipt: true, failRead: false, failLink: false, defer: false, release: null, ...options };
  state.application = { applicationId: appId, productType: 'calculator', revision: 0, applicationState: 'PAYMENT_REVIEW', paymentStatus: 'pending', state: 'pending_payment', accountLinked: false, accessActive: false, amount: 25000, submittedAt: '2026-11-20T00:00:00.000Z', accessEndsAt: '2027-01-07T14:59:59.999Z', paymentDueAt: '2026-11-27T14:59:59.999Z', openingAt: '2026-11-28T00:00:00+09:00' };
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
    return route.fulfill({ json: { success: true, contractVersion: 'jungsi-calculator-access-v1', admissionYear: 2027, access: { allowed: false, source: 'none' }, service: { state: 'preparing', purchaseAvailable: false } } });
  });
  const home = () => ({ contractVersion: 'calculator-applications-v1', items: state.owner === 'student-A' && (state.linked || state.application.applicationState === 'CLAIMED') ? [{ ...state.application }] : [], hasMore: false, needsReview: false, accountEmailMask: state.owner === 'student-A' ? 'a***@example.invalid' : 'b***@example.invalid' });
  await context.route('**/__status-core', async route => {
    const request = route.request().postDataJSON(); state.calls.push(request); let data;
    expect(request.data?.userId).toBeUndefined(); expect(request.data?.studentId).toBeUndefined();
    if (request.type === 'student_get_calculator_applications') {
      const snapshot = home(); if (state.defer) await new Promise(resolve => { state.release = resolve; });
      if (state.failRead) return route.fulfill({ status: 503, json: { success: false } }); data = snapshot;
    } else if (request.type === 'student_get_calculator_input') {
      data = { contractVersion: 'calculator-input-v1', applicationId: appId, status: 'empty', revision: 0, input: null, updatedAt: null, candidateCount: 0, basis: null, source: 'self_reported', reviewed: false, canSave: true, consentRevision: 'CALCULATOR_INPUT_STORAGE_20261120_V1' };
    } else if (request.type === 'student_preview_calculator_application_link') {
      if (state.owner !== 'student-A') return route.fulfill({ status: 404, json: { success: false } });
      data = { contractVersion: 'calculator-application-link-v1', application: { ...state.application }, accountEmailMask: 'a***@example.invalid', linked: state.linked };
    } else if (request.type === 'student_link_calculator_application_view') {
      if (state.failLink) return route.fulfill({ status: 500, json: { success: false } });
      state.linked = true; state.application.revision++; data = { applicationId: appId, linked: true, idempotent: false };
    } else if (request.type === 'student_get_v2_consulting_home') data = { available: false, calculator: home() };
    else throw new Error('Unexpected status request ' + request.type);
    try { await route.fulfill({ json: { success: true, data } }); } catch (_) {}
  });
  return state;
}
const panel = page => page.getByRole('region', { name: '나의 계산기 신청', exact: true });
const linkButton = page => page.getByRole('button', { name: '이 계정에 신청 상태 연결', exact: true });

test('신청 접수 증명과 현재 학생 계정 확인 후에만 상태를 연결하고 새로고침·새 탭에서도 유지한다', async ({ page }, testInfo) => {
  const state = await setup(page); await page.goto(calculatorPath);
  await expect(linkButton(page)).toBeDisabled();
  expect(state.calls.some(x => x.type === 'student_link_calculator_application_view')).toBe(false);
  await panel(page).getByRole('checkbox').check();
  page.once('dialog', dialog => dialog.dismiss()); await linkButton(page).click();
  expect(state.linked).toBe(false);
  page.once('dialog', dialog => dialog.accept()); await linkButton(page).click();
  await expect(panel(page)).toContainText('신청 접수 · 입금 확인 대기');
  await expect(panel(page)).toContainText('다른 기기에서도');
  expect(state.calls.filter(x => x.type === 'student_link_calculator_application_view')).toHaveLength(1);
  expect(state.calls.find(x => x.type === 'student_link_calculator_application_view').data).toMatchObject({ expectedRevision: 0, confirmed: true, token: credentials.token, requestKey: credentials.requestKey });
  await page.evaluate(() => { localStorage.setItem('syntheticNoReceipt', '1'); sessionStorage.removeItem('sc_jungsi_application_v1'); });
  await page.reload(); await expect(panel(page)).toContainText(appId); await expect(linkButton(page)).toHaveCount(0);
  const other = await page.context().newPage(); await other.clock.setFixedTime('2026-11-20T01:00:00.000Z'); await other.goto(calculatorPath); await expect(panel(other)).toContainText(appId); await other.close();
  await page.setViewportSize({ width: 320, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('calculator-application-status-320.png'), fullPage: true });
  expect(state.calls.some(x => x.type.includes('claim_v2') || x.type.includes('verify'))).toBe(false);
});
test('입금 승인된 신청의 이용 인증 대기와 기존에 활성화된 이용권을 구분한다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true });
  Object.assign(state.application, { state: 'activation_required', applicationState: 'INVITED', paymentStatus: 'verified' });
  await page.goto(calculatorPath); await expect(panel(page)).toContainText('입금 확인 완료 · 이용 인증 대기');
  await expect(panel(page)).toContainText('10자리 인증코드');
  Object.assign(state.application, { state: 'active', applicationState: 'CLAIMED', accountLinked: true, accessActive: true });
  await page.getByRole('button', { name: '신청 상태 다시 확인' }).click(); await expect(panel(page)).toContainText('계산기 이용권 활성');
  await expect(panel(page)).toContainText('11월 28일 공개 예정');
  Object.assign(state.application, { state: 'expired', accessActive: false });
  await page.getByRole('button', { name: '신청 상태 다시 확인' }).click(); await expect(panel(page)).toContainText('이용 기간 종료');
});
test('읽기 지연·실패를 신청 없음으로 표시하지 않고 수동 재시도로 복구한다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true, defer: true }); await page.goto(calculatorPath);
  await expect(panel(page)).toContainText('확인하고 있습니다'); await expect(panel(page)).not.toContainText('신청이 없습니다');
  await expect.poll(() => typeof state.release).toBe('function'); state.failRead = true; state.release();
  await expect(panel(page)).toContainText('불러오지 못했습니다'); await expect(panel(page)).not.toContainText('신청이 없습니다');
  state.defer = false; state.failRead = false;
  await page.getByRole('button', { name: '신청 상태 다시 확인' }).click(); await expect(panel(page)).toContainText(appId);
});
test('연결 실패를 완료로 표시하거나 자동 재전송하지 않는다', async ({ page }) => {
  const state = await setup(page, { failLink: true }); await page.goto(calculatorPath);
  await panel(page).getByRole('checkbox').check(); page.once('dialog', dialog => dialog.accept()); await linkButton(page).click();
  await expect(panel(page)).toContainText('자동 재전송하지 않습니다');
  await expect(linkButton(page)).toHaveCount(0); expect(state.calls.filter(x => x.type === 'student_link_calculator_application_view')).toHaveLength(1);
  await page.getByRole('button', { name: '신청 상태 다시 확인' }).click();
  await expect(panel(page)).toContainText('이 계정에 연결된 계산기 신청이 없습니다');
  expect(state.calls.filter(x => x.type === 'student_link_calculator_application_view')).toHaveLength(1);
});
test('이전 학생의 지연 응답은 계정 전환 후 표시하지 않는다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true, defer: true }); await page.goto(calculatorPath);
  await expect.poll(() => typeof state.release).toBe('function'); const release = state.release;
  state.owner = 'student-B'; state.defer = false;
  await page.evaluate(() => { localStorage.setItem('userId', 'student-B'); window.dispatchEvent(new Event('studycrack:session-ended')); }); release();
  await expect(panel(page)).toContainText('이 계정에 연결된 계산기 신청이 없습니다'); await expect(panel(page)).not.toContainText(appId);
});
test('나의 컨설팅에서 계산기 신청 상태를 별도 카드로 보여준다', async ({ page }) => {
  const state = await setup(page, { receipt: false, linked: true }); await page.goto('/2027-jungsi-consulting/home');
  await expect(page.getByRole('heading', { name: '등록된 컨설팅이 없습니다' })).toBeVisible();
  const card = page.getByRole('region', { name: '합격 계산기 신청 현황' });
  await expect(card).toContainText('신청 접수 · 입금 확인 대기'); await expect(card.getByRole('link')).toHaveAttribute('href', calculatorPath);
  expect(state.calls.some(x => x.type === 'student_link_calculator_application_view')).toBe(false);
});
