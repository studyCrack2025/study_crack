import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test('승인 후 반영 대기는 결제 실패로 단정하거나 새 결제를 실행하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.route('https://pay.nicepay.co.kr/v1/js/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  const alerts = [];
  page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  const message = '결제 승인은 완료되었으나 이용권 반영을 확인 중입니다. 다시 결제하지 말고 결제 내역을 확인하거나 고객센터로 문의해주세요.';
  await page.goto(`/payment.html?error=${encodeURIComponent(message)}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toBe(`결제 안내: ${message}`);
  await expect(page.locator('.price-row.selected')).toHaveCount(0);
  await expect(page.locator('#checkout')).not.toBeVisible();
  expect(new URL(page.url()).searchParams.has('error')).toBe(false);
  expect(api.requests.some(row => row.payload.type === 'create_payment_intent')).toBe(false);
});

for (const query of ['plan=standard&duration=8', 'plan=pro&duration=12주', 'plan=pro&duration=8주', 'plan=standard&duration=4주&duration=12주', 'plan=basic&duration=4주', 'plan=starter&duration=4주']) {
  test(`과거 기간 링크는 자동 선택 없이 구매 조건을 다시 확인한다: ${query}`, async ({ page }, testInfo) => {
    await installAuthenticatedSession(page);
    const api = await installApiMock(page);
    await page.route('https://pay.nicepay.co.kr/v1/js/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    const alerts = [];
    page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
    await page.goto(`/payment.html?${query}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => alerts.length).toBe(1);
    expect(alerts[0]).toContain('4주(28일) 단건 결제');
    await expect(page.locator('#checkout')).not.toBeVisible();
    await expect(page.locator('.price-row.selected')).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has('duration')).toBe(false);
    expect(new URL(page.url()).searchParams.has('plan')).toBe(false);
    expect(api.requests.some(row => row.payload.type === 'create_payment_intent')).toBe(false);
    await page.locator('.price-row[data-tier="standard"] .price-btn').click();
    await expect(page.locator('#checkoutPlanName')).toHaveText('STANDARD');
    await expect(page.locator('#checkoutPlanCycleNote')).toContainText('4주 단위 (49,000원)');
    expect(api.requests.some(row => row.payload.type === 'create_payment_intent')).toBe(false);
    if (query === 'plan=standard&duration=8') await page.screenshot({ path: testInfo.outputPath('web-reselected-four-weeks.png'), fullPage: true });
  });
}

for (const [tier, duration] of [['standard', '4주'], ['pro', '4'], ['basic', ''], ['starter', '1회']]) {
  test(`현재 상품 링크는 선택을 유지하며 결제를 실행하지 않는다: ${tier}`, async ({ page }) => {
    await installAuthenticatedSession(page);
    const api = await installApiMock(page);
    await page.route('https://pay.nicepay.co.kr/v1/js/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    const alerts = [];
    page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
    await page.goto(`/payment.html?plan=${tier}${duration ? `&duration=${encodeURIComponent(duration)}` : ''}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#checkoutPlanName')).toHaveText(tier.toUpperCase());
    expect(alerts).toEqual([]);
    expect(api.requests.some(row => row.payload.type === 'create_payment_intent')).toBe(false);
  });
}
