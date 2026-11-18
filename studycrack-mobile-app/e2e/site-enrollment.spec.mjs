import { expect, test } from '@playwright/test';

const applicationId = 'APP_123e4567-e89b-12d3-a456-426614174000';
const bankTransfer = { bankName: '시험은행', accountNumber: '000-000-000000', accountHolder: '시험사업자' };
async function prepare(page, options = {}) {
  const state = { submits: [], application: null, amount: 200000, ...options };
  await page.route('**/gtm.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: "window.IS_LOCAL=false;window.CONFIG={api:{consultingPublic:'/__enrollment',consulting:'/__consulting',auth:'/__auth'}};" }));
  await page.route('**/__enrollment', async route => {
    const { type, data } = route.request().postDataJSON();
    if (type === 'get_v2_consulting_campaign') return route.fulfill({ json: { success: true, data: { campaignSlug: '2027-jungsi-consulting', admissionYear: 2027, enrollmentStatus: 'open', applicationUrl: 'https://docs.google.com/forms/d/e/synthetic/viewform' } } });
    if (type === 'get_site_enrollment') {
      if (state.unavailable) return route.fulfill({ status: 503, json: { success: false, code: 'CALCULATOR_DATA_NOT_READY' } });
      return route.fulfill({ json: { success: true, data: { productType: data.productType, productName: data.productType === 'calculator' ? '2027 정시 합격 계산기' : '2027 정시 컨설팅', amount: data.productType === 'calculator' ? 25000 : state.amount, earlybird: state.amount === 200000, accessEndsAt: '2027-03-01T00:00:00.000Z', bankTransfer, consentRevision: 'JUNGSI_SITE_2027_V1' } } });
    }
    if (type === 'public_submit_site_application') {
      state.submits.push(data);
      if (state.priceChanged) { state.amount = 300000; return route.fulfill({ status: 409, json: { success: false, code: 'PRICE_CHANGED' } }); }
      state.application = { applicationId, productType: data.productType, productName: data.productType === 'calculator' ? '2027 정시 합격 계산기' : '2027 정시 컨설팅', amount: data.acceptedAmount, accessEndsAt: data.productType === 'calculator' ? '2027-03-01T00:00:00.000Z' : undefined, bankTransfer, maskedEmail: 's***@example.invalid', applicationState: 'PAYMENT_REVIEW' };
      if (state.loseReply) return route.abort('failed');
      return route.fulfill({ status: 202, json: { success: true, data: state.application } });
    }
    if (type === 'public_get_site_application') return route.fulfill({ status: state.application ? 200 : 404, json: state.application ? { success: true, data: state.application } : { success: false, code: 'SITE_APPLICATION_NOT_FOUND' } });
    throw new Error(`Unexpected request: ${type}`);
  });
  await page.goto('/2027-jungsi-consulting#consulting');
  return state;
}
async function fill(page) {
  await page.getByLabel('학생 이름', { exact: true }).fill('홍길동');
  await page.getByLabel('휴대전화', { exact: true }).fill('010-1234-5678');
  await page.getByLabel('이메일', { exact: true }).fill('synthetic@example.invalid');
  await page.getByLabel('입금자명', { exact: true }).fill('홍길동');
  await page.locator('[name="privacyConsent"]').check();
  await page.locator('[name="termsConsent"]').check();
}
test('두 상품은 사이트에서 동의·접수·입금·가입 안내로 연결되고 중복 클릭은 한 번만 저장한다', async ({ page }, testInfo) => {
  const state = await prepare(page);
  await page.locator('#consultingApply').click();
  await expect(page.locator('#jungsiEnrollmentFields input').first()).toBeEnabled();
  await expect(page.locator('#jungsiEnrollmentPrice')).toContainText('200,000원');
  await fill(page);
  await page.evaluate(() => { const form = document.getElementById('jungsiEnrollmentForm'); form.requestSubmit(); form.requestSubmit(); });
  await expect(page.locator('#jungsiEnrollmentReceipt')).toBeVisible();
  expect(state.submits).toHaveLength(1); expect(state.submits[0].productType).toBe('consulting');
  await expect(page.locator('#jungsiReceiptBank')).toHaveText('시험은행 000-000-000000 · 예금주 시험사업자');
  await expect(page.locator('#jungsiEnrollmentReceipt').getByRole('link', { name: '회원가입', exact: true })).toHaveAttribute('href', '/signup?returnUrl=%2F2027-jungsi-consulting%2Fstart');
  const stored = await page.evaluate(() => sessionStorage.getItem('sc_jungsi_application_v1'));
  for (const value of ['홍길동', '010-1234-5678', 'synthetic@example.invalid']) expect(stored).not.toContain(value);
  expect(await page.locator('#jungsiEnrollment').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('application-receipt.png') });
  await page.getByRole('button', { name: '신청 창 닫기' }).click();
  await expect(page.locator('#consultingApply')).toBeFocused();
  await page.getByRole('tab', { name: '합격 계산기', exact: true }).click();
  await page.locator('#calculatorApply').click();
  await expect(page.locator('#jungsiEnrollmentReceipt')).toBeVisible();
  await page.getByRole('button', { name: '새 신청 작성', exact: true }).click();
  await expect(page.locator('#jungsiEnrollmentPrice')).toContainText('25,000원');
  await fill(page); await page.locator('#jungsiEnrollmentSubmit').click();
  await expect(page.locator('#jungsiReceiptProduct')).toHaveText('2027 정시 합격 계산기');
  expect(state.submits).toHaveLength(2); expect(state.submits[1].acceptedAmount).toBe(25000);
});
test('응답 유실·새로고침·로그인 시작 후에는 저장한 접수를 조회하며 다시 제출하지 않는다', async ({ page }) => {
  const state = await prepare(page, { loseReply: true });
  await page.locator('#consultingApply').click(); await fill(page); await page.locator('#jungsiEnrollmentSubmit').click();
  await expect(page.locator('#jungsiEnrollmentStatus')).toContainText('신청 결과를 확인하지 못했습니다.');
  await page.locator('#jungsiEnrollmentRecover').click(); await expect(page.locator('#jungsiEnrollmentReceipt')).toBeVisible();
  await page.evaluate(() => { window.beginClientLogin(); });
  await page.goto('/2027-jungsi-consulting#application');
  await expect(page.locator('#jungsiEnrollmentReceipt')).toBeVisible();
  await page.reload(); await expect(page.locator('#jungsiEnrollmentReceipt')).toBeVisible();
  expect(state.submits).toHaveLength(1);
});
test('자료·운영 설정을 확인하지 못하면 입력과 입금 안내를 열지 않고 재시도를 제공한다', async ({ page }) => {
  const state = await prepare(page, { unavailable: true });
  await page.getByRole('tab', { name: '합격 계산기', exact: true }).click(); await page.locator('#calculatorApply').click();
  await expect(page.locator('#jungsiEnrollmentStatus')).toContainText('계산기 제공 자료를 확인하고 있습니다.');
  await expect(page.getByLabel('학생 이름', { exact: true })).toBeDisabled();
  await expect(page.locator('#jungsiEnrollmentReceipt')).toBeHidden();
  await expect(page.locator('#jungsiEnrollmentSubmit')).toBeDisabled();
  state.unavailable = false; await page.locator('#jungsiEnrollmentRetry').click();
  await expect(page.getByLabel('학생 이름', { exact: true })).toBeEnabled();
  expect(state.submits).toEqual([]);
});
test('가격 변경은 접수를 만들지 않고 새 금액·동의를 다시 확인하게 한다', async ({ page }) => {
  const state = await prepare(page, { priceChanged: true });
  await page.locator('#consultingApply').click(); await fill(page); await page.locator('#jungsiEnrollmentSubmit').click();
  await expect(page.locator('#jungsiEnrollmentStatus')).toContainText('신청 금액이 변경됐습니다.');
  await page.locator('#jungsiEnrollmentRecover').click();
  await expect(page.locator('#jungsiEnrollmentPrice')).toContainText('300,000원');
  await expect(page.locator('[name="privacyConsent"]')).not.toBeChecked();
  await expect(page.locator('[name="termsConsent"]')).not.toBeChecked();
  await expect(page.locator('#jungsiEnrollmentReceipt')).toBeHidden();
  expect(state.application).toBeNull(); expect(state.submits).toHaveLength(1);
});
