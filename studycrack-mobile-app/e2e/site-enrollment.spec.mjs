import { expect, test } from '@playwright/test';

const applicationId = 'APP_123e4567-e89b-12d3-a456-426614174000';
const bankTransfer = { bankName: '시험은행', accountNumber: '000-000-000000', accountHolder: '시험사업자' };
async function prepare(page, options = {}) {
  const state = { submits: [], attributionRequests: [], application: null, amount: 200000, ...options };
  await page.route('**/gtm.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: "window.IS_LOCAL=false;window.CONFIG={api:{consultingPublic:'/__enrollment',consulting:'/__consulting',auth:'/__auth'}};" }));
  await page.route('**/__enrollment', async route => {
    const { type, data } = route.request().postDataJSON();
    if (type === 'get_v2_consulting_campaign') return route.fulfill({ json: { success: true, data: { campaignSlug: '2027-jungsi-consulting', admissionYear: 2027, enrollmentStatus: 'open', ...(state.attribution ? { attributionFormEntry: 'entry.123456' } : {}), applicationUrl: 'https://docs.google.com/forms/d/e/synthetic/viewform' } } });
    if (type === 'create_consulting_ad_attribution') {
      state.attributionRequests.push(data);
      if (state.deferAttribution) await new Promise(resolve => { state.releaseAttribution = resolve; });
      if (state.failAttribution) return route.fulfill({ status: 503, json: { success: false } });
      return route.fulfill({ json: { success: true, data: { token: 'synthetic-signed-token', expiresAt: '2030-01-01T00:00:00.000Z' } } });
    }
    if (type === 'get_site_enrollment') {
      if (state.unavailable) return route.fulfill({ status: 503, json: { success: false, code: 'CALCULATOR_DATA_NOT_READY' } });
      expect(data.formVersion).toBe(2);
      return route.fulfill({ json: { success: true, data: { productType: data.productType, productName: data.productType === 'calculator' ? '2027 정시 합격 계산기' : '2027 정시 컨설팅', amount: data.productType === 'calculator' ? 25000 : state.amount, earlybird: state.amount === 200000, accessEndsAt: '2027-03-01T00:00:00.000Z', bankTransfer, formVersion: state.oldContract ? 1 : 2, consentRevision: state.oldContract ? 'JUNGSI_SITE_2027_V1' : 'JUNGSI_SITE_2027_V2' } } });
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
async function fill(page, productType = 'consulting') {
  await page.getByLabel(productType === 'calculator' ? '이용자 이름' : '학생 이름', { exact: true }).fill('홍길동');
  await page.getByLabel('연락처', { exact: true }).fill('010-1234-5678');
  await page.getByLabel('이메일', { exact: true }).fill('synthetic@example.invalid');
  await page.getByLabel('입금자명', { exact: true }).fill('홍길동');
  if (productType === 'consulting') {
    await page.getByRole('combobox', { name: '연락처의 본인·대리인 구분', exact: true }).selectOption('self');
    await page.getByRole('combobox', { name: '입금자와의 관계', exact: true }).selectOption('self');
  }
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
  expect(state.submits[0].formVersion).toBe(2); expect(state.submits[0].consentRevision).toBe('JUNGSI_SITE_2027_V2');
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
  await fill(page, 'calculator'); await page.locator('#jungsiEnrollmentSubmit').click();
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
  await expect(page.getByLabel('이용자 이름', { exact: true })).toBeDisabled();
  await expect(page.locator('#jungsiEnrollmentReceipt')).toBeHidden();
  await expect(page.locator('#jungsiEnrollmentSubmit')).toBeDisabled();
  state.unavailable = false; await page.locator('#jungsiEnrollmentRetry').click();
  await expect(page.getByLabel('이용자 이름', { exact: true })).toBeEnabled();
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

test('컨설팅은 두 관계를 명시적으로 선택하고 기타 내용은 해당 선택일 때만 전송한다', async ({ page }) => {
  const state = await prepare(page);
  await page.locator('#consultingApply').click();
  const form = page.locator('#jungsiEnrollmentForm');
  await expect(form.locator('[name="contactMethod"], [name="studentStatus"]')).toHaveCount(0);
  await expect(page.locator('#jungsiEnrollmentCollection')).toContainText('연락처의 본인·대리인 구분');
  await fill(page);
  await page.getByRole('combobox', { name: '연락처의 본인·대리인 구분', exact: true }).selectOption('other');
  await page.getByLabel('연락처 관계 기타 내용', { exact: true }).fill('별도 담당자');
  await page.getByRole('combobox', { name: '연락처의 본인·대리인 구분', exact: true }).selectOption('family');
  await expect(form.locator('[name="contactRelationshipDetail"]')).toBeHidden();
  await expect(form.locator('[name="contactRelationshipDetail"]')).toBeDisabled();
  await page.getByRole('combobox', { name: '입금자와의 관계', exact: true }).selectOption('other');
  await page.locator('#jungsiEnrollmentSubmit').click();
  expect(state.submits).toHaveLength(0);
  await page.getByLabel('입금자 관계 기타 내용', { exact: true }).fill('형제자매');
  await page.locator('#jungsiEnrollmentSubmit').click();
  await expect(page.locator('#jungsiEnrollmentReceipt')).toBeVisible();
  expect(state.submits).toHaveLength(1);
  expect(state.submits[0].contactRelationship).toBe('family');
  expect(state.submits[0].payerRelationship).toBe('other');
  expect(state.submits[0].payerRelationshipDetail).toBe('형제자매');
  for (const field of ['contactMethod', 'studentStatus', 'contactRelationshipDetail']) expect(state.submits[0]).not.toHaveProperty(field);
});

test('계산기는 네 가지 정보만 받고 수집 항목 안내·필수 동의도 상품에 맞게 표시한다', async ({ page }) => {
  const state = await prepare(page);
  await page.getByRole('tab', { name: '합격 계산기', exact: true }).click(); await page.locator('#calculatorApply').click();
  const form = page.locator('#jungsiEnrollmentForm');
  await expect(page.locator('#jungsiEnrollmentCollection')).toHaveText('이용자 이름, 연락처, 이메일, 입금자명 및 동의 여부');
  await expect(form.getByRole('combobox')).toHaveCount(0);
  for (const field of ['contactRelationship', 'payerRelationship', 'contactRelationshipDetail', 'payerRelationshipDetail']) {
    await expect(form.locator(`[name="${field}"]`)).toBeHidden();
    await expect(form.locator(`[name="${field}"]`)).toBeDisabled();
  }
  await fill(page, 'calculator');
  await form.locator('[name="privacyConsent"]').uncheck();
  await page.locator('#jungsiEnrollmentSubmit').click(); expect(state.submits).toHaveLength(0);
  await form.locator('[name="privacyConsent"]').check();
  await form.locator('[name="termsConsent"]').uncheck();
  await page.locator('#jungsiEnrollmentSubmit').click(); expect(state.submits).toHaveLength(0);
  await form.locator('[name="termsConsent"]').check();
  await page.locator('#jungsiEnrollmentSubmit').click();
  await expect(page.locator('#jungsiEnrollmentReceipt')).toBeVisible();
  expect(state.submits).toHaveLength(1);
  expect(state.submits[0].acceptedAmount).toBe(25000);
  for (const field of ['studentName', 'phone', 'email', 'payerName']) expect(typeof state.submits[0][field]).toBe('string');
  for (const field of ['contactRelationship', 'payerRelationship', 'contactMethod', 'studentStatus', 'contactRelationshipDetail', 'payerRelationshipDetail']) expect(state.submits[0]).not.toHaveProperty(field);
});

test('상품을 바꾸면 이전 관계와 동의를 이어받지 않고 새 상품의 입력을 확인한다', async ({ page }) => {
  const state = await prepare(page);
  await page.locator('#consultingApply').click(); await fill(page);
  await page.getByRole('combobox', { name: '입금자와의 관계', exact: true }).selectOption('other');
  await page.getByLabel('입금자 관계 기타 내용', { exact: true }).fill('전환 전 입력');
  await page.getByRole('button', { name: '신청 창 닫기' }).click();
  await page.getByRole('tab', { name: '합격 계산기', exact: true }).click(); await page.locator('#calculatorApply').click();
  await expect(page.getByLabel('이용자 이름', { exact: true })).toHaveValue('');
  await expect(page.locator('[name="privacyConsent"]')).not.toBeChecked();
  await expect(page.locator('[name="payerRelationshipDetail"]')).toHaveValue('');
  await page.getByRole('button', { name: '신청 창 닫기' }).click();
  await page.getByRole('tab', { name: '정시 컨설팅', exact: true }).click(); await page.locator('#consultingApply').click();
  await expect(page.getByRole('combobox', { name: '입금자와의 관계', exact: true })).toHaveValue('');
  await expect(page.locator('[name="payerRelationshipDetail"]')).toBeHidden();
  expect(state.submits).toHaveLength(0);
});

test('새 문항 계약이 없는 구형 응답에는 제출을 열거나 구형 항목을 추정하지 않는다', async ({ page }) => {
  const state = await prepare(page, { oldContract: true });
  await page.locator('#consultingApply').click();
  await expect(page.locator('#jungsiEnrollmentStatus')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#jungsiEnrollmentSubmit')).toBeDisabled();
  expect(state.submits).toHaveLength(0);
});

test('수집 안내와 개인정보·환불 규정은 신청 창에서 열람하고 동의 상태를 바꾸지 않는다', async ({ page }) => {
  const state = await prepare(page);
  await page.locator('#consultingApply').click();
  const form = page.locator('#jungsiEnrollmentForm');
  await form.locator('.jungsi-enrollment-note > summary').click();
  await expect(page.locator('#jungsiEnrollmentCollection')).toBeVisible();
  for (const label of ['개인정보처리방침', '환불 규정']) {
    await form.getByRole('link', { name: label, exact: true }).click();
    const policy = page.locator('#jungsi-policy-dialog');
    await expect(policy).toBeVisible();
    await expect(policy.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await policy.getByRole('button', { name: '규정 닫기', exact: true }).click();
    await expect(page.locator('#jungsiEnrollment')).toBeVisible();
  }
  await expect(form.locator('[name="privacyConsent"]')).not.toBeChecked();
  await expect(form.locator('[name="termsConsent"]')).not.toBeChecked();
  expect(state.submits).toHaveLength(0);
});

test('두 상품 신청은 작은 화면에서도 가로 넘침 없이 마지막 확인 버튼에 접근한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await prepare(page);
  for (const productType of ['consulting', 'calculator']) {
    await page.getByRole('tab', { name: productType === 'calculator' ? '합격 계산기' : '정시 컨설팅', exact: true }).click();
    await page.locator(productType === 'calculator' ? '#calculatorApply' : '#consultingApply').click();
    await fill(page, productType);
    expect(await page.locator('#jungsiEnrollment').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    for (const name of ['studentName', 'phone', 'email', 'payerName']) expect(await page.locator(`[name="${name}"]`).evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.locator('#jungsiEnrollmentSubmit').scrollIntoViewIfNeeded();
    await expect(page.locator('#jungsiEnrollmentSubmit')).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`${productType}-application-320.png`) });
    await page.getByRole('button', { name: '신청 창 닫기' }).click();
  }
});


test('광고 토큰 조회가 늦어도 계산기 모달에 구글폼을 노출하지 않고 사이트 신청을 유지한다', async ({ page }) => {
  const state = await prepare(page, { attribution: true, deferAttribution: true });
  await expect.poll(() => state.attributionRequests.length).toBe(1);
  await page.getByRole('tab', { name: '합격 계산기', exact: true }).click();
  await page.locator('#calculatorApply').click();
  await expect(page.locator('#jungsiEnrollmentPrice')).toContainText('25,000원');
  state.releaseAttribution();
  await expect(page.locator('#jungsiGoogleForm')).toHaveAttribute('data-available', 'true');
  await expect(page.locator('#jungsiGoogleForm')).toBeHidden();
  await page.getByRole('button', { name: '신청 창 닫기' }).click();
  await page.getByRole('tab', { name: '정시 컨설팅', exact: true }).click();
  await page.locator('#consultingApply').click();
  await expect(page.locator('#jungsiGoogleForm')).toBeVisible();
  const href = await page.locator('#jungsiGoogleForm').getAttribute('href');
  expect(new URL(href).searchParams.get('entry.123456')).toBe('synthetic-signed-token');
  await expect(page.locator('#jungsiGoogleForm')).toHaveText('기존 구글폼으로 컨설팅 신청');
  await expect(page.locator('#consultingApply')).toHaveAttribute('href', '#application');
  expect(state.submits).toHaveLength(0);
});

test('광고 연결 실패는 기존 구글폼 주소로 돌아가며 사이트 신청을 막지 않는다', async ({ page }) => {
  const state = await prepare(page, { attribution: true, failAttribution: true });
  await expect.poll(() => state.attributionRequests.length).toBe(1);
  await expect(page.locator('#jungsiGoogleForm')).toHaveAttribute('data-available', 'true');
  await page.locator('#consultingApply').click();
  await expect(page.locator('#jungsiEnrollmentPrice')).toContainText('200,000원');
  await expect(page.locator('#jungsiGoogleForm')).toHaveAttribute('href', 'https://docs.google.com/forms/d/e/synthetic/viewform');
  await expect(page.locator('#consultingApply')).toHaveAttribute('href', '#application');
  expect(state.submits).toHaveLength(0);
});
