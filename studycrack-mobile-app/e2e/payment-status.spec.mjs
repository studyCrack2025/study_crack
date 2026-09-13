import { expect, test } from '@playwright/test';
import { installAuthenticatedSession, installApiMock } from './support/mock-api.mjs';
const id = 'PI_123e4567e89b12d3a456426614174000';
const ready = { paymentIntentId: id, purchaseKind: 'subscription', tier: 'STARTER', amount: 39000, status: 'vbank_ready', fulfillmentStatus: 'pending', vbank: { bankName: '확인된 은행', accountNo: '123-456-789', holder: '스터디크랙', expireDate: '2026-10-01 23:59' } };
const paid = { ...ready, status: 'paid', fulfillmentStatus: 'fulfilled', vbank: null };
async function setup(page, replies) {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  const calls = [];
  await page.route('**/api/payment', async route => {
    const payload = route.request().postDataJSON(); calls.push(payload);
    expect(payload).toEqual({ type: 'get_payment_status', data: { paymentIntentId: id } });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply.delay) await new Promise(resolve => setTimeout(resolve, reply.delay));
    await route.fulfill({ status: reply.statusCode || 200, contentType: 'application/json', body: JSON.stringify(reply.statusCode ? { error: 'unavailable' } : { success: true, data: reply.data || reply }) });
  });
  return calls;
}
test('untrusted URL cannot claim payment completion or supply a deposit account', async ({ page }) => {
  const calls = await setup(page, [{ ...paid, fulfillmentStatus: 'pending' }]);
  await page.goto(`/success.html?paymentIntentId=${id}&status=paid&tier=PRO&account=evil&amount=1`);
  await expect(page.locator('#successTitle')).toHaveText('결제 완료 · 이용권 반영 대기');
  await expect(page.locator('#tierBadge')).toHaveText('STARTER');
  await expect(page.locator('#vbankBox')).not.toBeVisible();
  expect(new URL(page.url()).search).toBe(`?paymentIntentId=${id}`);
  expect(calls).toHaveLength(1);
});
test('manual refresh advances deposit wait to pending to fulfilled without another purchase', async ({ page }) => {
  const calls = await setup(page, [ready, { ...paid, fulfillmentStatus: 'processing' }, paid]);
  await page.goto(`/success.html?paymentIntentId=${id}`);
  await expect(page.locator('#vbankAccount')).toHaveText(ready.vbank.accountNo);
  await page.locator('#statusRetry').click();
  await expect(page.locator('#successTitle')).toContainText('반영 대기');
  await expect(page.locator('#vbankBox')).not.toBeVisible();
  await page.locator('#statusRetry').click();
  await expect(page.locator('#successTitle')).toHaveText('결제와 이용권 반영이 완료되었습니다');
  await expect(page.locator('#successDesc')).toContainText('STARTER 39,000원');
  await expect(page.locator('#actionBtn')).toHaveAttribute('href', '/mypage');
  expect(calls).toHaveLength(3);
});
test('server failure clears stale account details and supports manual retry', async ({ page }) => {
  await setup(page, [ready, { statusCode: 500 }, paid]);
  await page.goto(`/success.html?paymentIntentId=${id}`);
  await expect(page.locator('#vbankBox')).toBeVisible();
  await page.locator('#statusRetry').click();
  await expect(page.locator('#successTitle')).toHaveText('결제 상태를 확인하지 못했어요');
  await expect(page.locator('#vbankAccount')).toHaveText('-');
  await page.locator('#statusRetry').click();
  await expect(page.locator('#successTitle')).toContainText('반영이 완료');
});
test('missing or legacy order shows no completion and makes no status request', async ({ page }) => {
  const calls = await setup(page, [paid]);
  await page.goto('/success.html?orderId=old&status=paid&tier=pro');
  await expect(page.locator('#successTitle')).toHaveText('결제 내역 확인이 필요합니다');
  await expect(page.locator('#statusRetry')).not.toBeVisible();
  expect(calls).toHaveLength(0);
});
test('wrong-account response is not interpreted as payment failure', async ({ page }) => {
  await setup(page, [{ statusCode: 404 }]);
  await page.goto(`/success.html?paymentIntentId=${id}`);
  await expect(page.locator('#successTitle')).toContainText('이 계정에서');
  await expect(page.locator('#vbankBox')).not.toBeVisible();
});
test('expired authentication offers login without losing the status link', async ({ page }) => {
  await setup(page, [{ statusCode: 401 }]);
  await page.route('**/auth', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto(`/success.html?paymentIntentId=${id}`);
  await expect(page.locator('#successTitle')).toHaveText('로그인 후 결제 상태를 확인해주세요');
  await expect(page.locator('#actionBtn')).toHaveAttribute('href', '/login');
  await expect(page.locator('#actionBtn')).toHaveAttribute('target', '_blank');
  expect(new URL(page.url()).searchParams.get('paymentIntentId')).toBe(id);
});
for (const [status, label] of [['failed', '실패'], ['expired', '만료'], ['cancelled', '취소']]) {
  test(`terminal ${status} displays verified state without a new purchase action`, async ({ page }) => {
    await setup(page, [{ ...paid, status }]);
    await page.goto(`/success.html?paymentIntentId=${id}`);
    await expect(page.locator('#successTitle')).toContainText(label);
    await expect(page.locator('#actionBtn')).toHaveAttribute('href', '/qna');
  });
}
test('server strings are rendered as text, never as HTML', async ({ page }) => {
  const hostile = '<img src=x onerror="window.injected=true">';
  await setup(page, [{ ...ready, vbank: { ...ready.vbank, holder: hostile } }]);
  await page.goto(`/success.html?paymentIntentId=${id}`);
  await expect(page.locator('#vbankHolder')).toHaveText(hostile);
  await expect(page.locator('#vbankHolder img')).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});
test('only the confirmed matching checkout draft is cleared', async ({ page }) => {
  await setup(page, [paid]);
  await page.addInitScript(({ id }) => localStorage.setItem('checkoutData', JSON.stringify({ paymentIntentId: id, tier: 'starter' })), { id: 'PI_other' });
  await page.goto(`/success.html?paymentIntentId=${id}`);
  await expect(page.locator('#successTitle')).toContainText('반영이 완료');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('checkoutData')).paymentIntentId)).toBe('PI_other');
  await page.evaluate(id => localStorage.setItem('checkoutData', JSON.stringify({ paymentIntentId: id })), id);
  await page.locator('#statusRetry').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('checkoutData'))).toBeNull();
});
test('account switch invalidates an in-flight result', async ({ page }) => {
  await setup(page, [{ data: ready, delay: 500 }]);
  await page.goto(`/success.html?paymentIntentId=${id}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.setItem('userId', 'other'); window.dispatchEvent(new StorageEvent('storage', { key: 'userId' })); });
  await expect(page.locator('#successTitle')).toHaveText('결제 상태를 다시 확인해주세요');
  await page.waitForTimeout(650);
  await expect(page.locator('#vbankBox')).not.toBeVisible();
  await expect(page.locator('#tierBadge')).toHaveText('결제 확인');
});
test('request in progress disables retries and malformed response never claims completion', async ({ page }) => {
  const calls = await setup(page, [{ data: { ...paid, paymentIntentId: 'other' }, delay: 700 }]);
  await page.goto(`/success.html?paymentIntentId=${id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#statusRetry')).toBeDisabled();
  await expect(page.locator('#successTitle')).toHaveText('결제 상태를 확인하지 못했어요');
  expect(calls).toHaveLength(1);
});
for (const width of [320, 375, 390, 430]) {
  test(`verified deposit screen fits ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page, [ready]);
    await page.goto(`/success.html?paymentIntentId=${id}`);
    await expect(page.locator('#vbankBox')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await page.locator('#statusRetry').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`payment-status-${width}.png`), fullPage: true });
  });
}
