import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
];

const SURFACES = [
  ['coaching', 'strategy'],
  ['weekly', 'weekly'],
  ['report', 'report'],
  ['report-detail', 'reportDetail'],
  ['tutor', 'tutor'],
  ['pro-elite', 'proElite'],
  ['locked-feature', 'lockedFeature'],
  ['plan', 'proIntro'],
  ['payment', 'payment'],
  ['payment-complete', 'paymentComplete']
];

test('코칭·리포트 리소스 오류는 빈 화면으로 위장하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, {
    failGameTypes: ['get_weekly_reports', 'get_pro_reports', 'get_qna_list'],
    tier: 'pro'
  });

  for (const [screen, errorCopy] of [
    ['strategy', '코칭 내역을 불러오지 못했어요'],
    ['weekly', '주간 점검을 불러오지 못했어요'],
    ['report', '리포트를 불러오지 못했어요'],
    ['proElite', 'PRO 리포트를 불러오지 못했어요'],
    ['tutor', '질문 내역을 불러오지 못했어요']
  ]) {
    await page.goto(`/studycrack-mobile.html?screen=${screen}`);
    await expect(page.getByText(errorCopy, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('플랜과 결제 화면은 단일 가격 원천을 함께 사용한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
  await page.goto('/studycrack-mobile.html?screen=proIntro');
  await expect(page.locator('.plan-console-detail')).toContainText('49,000원 / 4주');
  await page.locator('[data-plan="Pro"]').click();
  await expect(page.locator('.plan-console-detail')).toContainText('149,000원 / 4주');
  await page.getByRole('button', { name: /149,000원 \/ 4주로 시작하기/ }).click();
  await expect(page.locator('[data-screen="payment"]')).toBeVisible();
  await expect(page.locator('.plan-console-detail')).toContainText('149,000원 / 4주');
});

test('웹 결제 이관은 서버 결제 의도를 만들고 콜백에 불투명 ID만 전달한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { failOnceTypes: ['create_payment_intent'] });
  await page.route('https://pay.nicepay.co.kr/v1/js/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.AUTHNICE={requestPay:function(request){window.__nicePayRequest=request;}};'
    });
  });
  await page.route('**/checkout', async (route) => {
    await route.fulfill({ status: 302, headers: { location: '/checkout.html' } });
  });
  await page.goto('/payment.html?plan=standard');
  await expect(page.locator('#checkoutPlanName')).toHaveText('STANDARD');
  await expect(page.locator('#phone')).toHaveValue('010-1234-5678');
  const alerts = [];
  page.on('dialog', async (dialog) => {
    alerts.push(dialog.message());
    await dialog.accept();
  });
  await page.locator('#submitBtn').click();
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'create_payment_intent').length).toBe(1);
  await expect.poll(() => alerts.length).toBe(1);
  await expect(page.locator('#submitBtn')).toBeEnabled();
  await page.locator('#submitBtn').click();
  await expect(page).toHaveURL(/\/checkout\.html$/);
  const intentRequests = api.requests.filter(({ payload }) => payload.type === 'create_payment_intent');
  expect(intentRequests).toHaveLength(2);
  expect(intentRequests[0].payload.data.idempotencyKey).toBe(intentRequests[1].payload.data.idempotencyKey);
  expect(intentRequests[1].payload.data).toMatchObject({
    purchaseKind: 'subscription',
    tier: 'standard'
  });
  const checkoutData = await page.evaluate(() => JSON.parse(localStorage.getItem('checkoutData') || '{}'));
  expect(checkoutData.paymentIntentId).toBe('PI_123e4567e89b12d3a456426614174000');
  expect(checkoutData.orderId).toBe(checkoutData.paymentIntentId);
  expect(checkoutData.amount).toBe(49000);
  expect(checkoutData.userId).toBeUndefined();

  await page.locator('label[for="methodCard"]').click();
  await page.locator('#agreeTerms').check();
  await page.locator('#btnFinalPay').click();
  await expect.poll(() => page.evaluate(() => window.__nicePayRequest || null)).not.toBeNull();
  const capturedRequest = await page.evaluate(() => window.__nicePayRequest);
  expect(capturedRequest.orderId).toBe(checkoutData.paymentIntentId);
  expect(capturedRequest.amount).toBe(49000);
  expect(JSON.parse(capturedRequest.mallReserved)).toEqual({ paymentIntentId: checkoutData.paymentIntentId });
});

test('잠긴 미리보기는 예시 지표나 발행 상태를 제품 데이터처럼 표시하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic' });
  await page.goto('/studycrack-mobile.html?screen=my');
  await page.getByRole('button', { name: /PRO 리포트/ }).click();
  await expect(page.locator('[data-screen="lockedFeature"]')).toBeVisible();
  for (const copy of ['총 6시간 30분', '90분', '70분', '6월 2주차 PRO 리포트']) {
    await expect(page.getByText(copy, { exact: false })).toHaveCount(0);
  }
});

test('Phase 3 코칭·리포트·결제 화면은 네 viewport에서 경계를 지킨다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const [name, screen] of SURFACES) {
      await page.goto(`/studycrack-mobile.html?screen=${screen}`);
      await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const frame = await page.locator('.app-frame').boundingBox();
      expect(frame).not.toBeNull();
      expect(frame.width).toBeLessThanOrEqual(viewport.width);
      expect(Math.abs(frame.height - viewport.height)).toBeLessThanOrEqual(1);
      const screenshotPath = testInfo.outputPath(`phase-three-${name}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach(`phase-three-${name}-${viewport.width}x${viewport.height}.png`, { path: screenshotPath, contentType: 'image/png' });
    }
  }
});
