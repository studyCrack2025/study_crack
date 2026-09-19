import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow, mockUser } from './support/mock-api.mjs';
const id = 'PI_123e4567e89b12d3a456426614174000';
const item = { orderId: id, paymentIntentId: id, product: 'STANDARD', date: '2026-09-12', amount: 49000 };
async function setup(page, replies) {
  await installAuthenticatedSession(page); await installApiMock(page, { userOverrides: { tutorialRewardClaimed: true } });
  const calls = [];
  await page.route('**/api/payment', async route => {
    const payload = route.request().postDataJSON(); calls.push(payload);
    if (payload.type === 'get_payment_status') return route.fulfill({ json: { success: true, data: { paymentIntentId: id, purchaseKind: 'subscription', tier: 'STANDARD', amount: 49000, status: 'paid', fulfillmentStatus: 'pending' } } });
    expect(payload.type).toBe('list_payment_history');
    expect(Object.keys(payload.data)).toEqual(['cursor']);
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply.delay) await new Promise(resolve => setTimeout(resolve, reply.delay));
    if (reply.waitFor) await reply.waitFor;
    const { waitFor, onReply, ...data } = reply;
    await route.fulfill({ status: reply.error || 200, json: reply.error ? {} : { success: true, data } });
    onReply?.();
  });
  return calls;
}
test('account entry opens shared history, then verified pending status, without purchasing', async ({ page }) => {
  const calls = await setup(page, [{ items: [item], cursor: null }]);
  await page.goto('/studycrack-mobile.html?screen=accountInfo');
  expect((await page.getByRole('link', { name: '결제 내역 · 상태 확인' }).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.getByRole('link', { name: '결제 내역 · 상태 확인' }).click();
  await expect(page.locator('#historyList li')).toHaveCount(1);
  await page.locator('#historyList a').click();
  await expect(page.locator('#successTitle')).toHaveText('결제 완료 · 이용권 반영 대기');
  expect(calls.map(call => call.type)).toEqual(['list_payment_history', 'get_payment_status']);
});
test('web MY provides the same history entry', async ({ page }) => {
  await setup(page, [{ items: [], cursor: null }]);
  await page.route('**/api/user', route => {
    const type = route.request().postDataJSON().type;
    if (['get_login_profile', 'get_user', 'get_user_mypage'].includes(type)) return route.fulfill({ json: { ...mockUser, tutorialRewardClaimed: true } });
    return route.fallback();
  });
  await page.goto('/mypage.html');
  await expect(page.getByRole('link', { name: '결제 내역 · 상태 확인' })).toBeVisible();
  expect((await page.getByRole('link', { name: '결제 내역 · 상태 확인' }).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.getByRole('link', { name: '결제 내역 · 상태 확인' }).click();
  await expect(page.locator('#historyMessage')).toContainText('표시할 결제 기록이 없습니다');
});
test('pagination deduplicates records and retries failed next page with the same cursor', async ({ page }) => {
  const calls = await setup(page, [{ items: [item], cursor: id }, { error: 500 }, { items: [item, { ...item, orderId: 'OLD_1', paymentIntentId: null }], cursor: null }]);
  await page.goto('/payment-history.html');
  await page.locator('#historyMore').click();
  await expect(page.locator('#historyMessage')).toContainText('이전 조회 결과');
  await expect(page.locator('#historyList li')).toHaveCount(1);
  await page.locator('#historyMore').click();
  await expect(page.locator('#historyList li')).toHaveCount(2);
  await expect(page.locator('#historyMore')).toBeHidden();
  expect(calls.map(call => call.data.cursor)).toEqual([null, id, id]);
});
test('legacy and hostile strings are text and never produce an executable status link', async ({ page }) => {
  await setup(page, [{ items: [{ ...item, orderId: '<img src=x onerror=alert(1)>', product: '<b>이전 상품</b>', paymentIntentId: null }], cursor: null }]);
  await page.goto('/payment-history.html');
  await expect(page.locator('#historyList h2')).toHaveText('<b>이전 상품</b>');
  await expect(page.locator('#historyList img, #historyList b')).toHaveCount(0);
  await expect(page.locator('#historyList a')).toHaveAttribute('href', '/qna');
});
test('server error is distinct from empty and manual refresh can recover', async ({ page }) => {
  await setup(page, [{ error: 500 }, { items: [], cursor: null }]);
  await page.goto('/payment-history.html');
  await expect(page.locator('#historyMessage')).toContainText('불러오지 못했습니다');
  await page.locator('#historyRefresh').click();
  await expect(page.locator('#historyMessage')).toContainText('표시할 결제 기록이 없습니다');
});
test('expired login preserves the existing protected-page login redirect', async ({ page }) => {
  await setup(page, [{ items: [item], cursor: id }, { error: 401 }]);
  await page.route('**/auth', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/payment-history.html');
  await page.locator('#historyMore').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('#historyList li')).toHaveCount(0);
});
test('forbidden account clears records and offers login plus manual retry', async ({ page }) => {
  await setup(page, [{ items: [item], cursor: id }, { error: 403 }]);
  await page.goto('/payment-history.html');
  await page.locator('#historyMore').click();
  await expect(page.locator('#historyLogin')).toBeVisible();
  await expect(page.locator('#historyList li')).toHaveCount(0);
});
test('changed account invalidates a delayed response and blocks duplicate clicks', async ({ page }) => {
  let release;
  let onReply;
  const waitFor = new Promise(resolve => { release = resolve; });
  const replied = new Promise(resolve => { onReply = resolve; });
  await setup(page, [{ items: [item], cursor: null, waitFor, onReply }]);
  await page.goto('/payment-history.html');
  await expect(page.locator('#historyRefresh')).toBeDisabled();
  await page.evaluate(() => { localStorage.setItem('userId', 'different'); window.dispatchEvent(new StorageEvent('storage', { key: 'userId' })); });
  await expect(page.locator('#historyMessage')).toContainText('계정이 변경');
  release();
  await replied;
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator('#historyList li')).toHaveCount(0);
});
test('malformed response does not partially render records', async ({ page }) => {
  await setup(page, [{ items: [item, { ...item, amount: '49000' }], cursor: null }]);
  await page.goto('/payment-history.html');
  await expect(page.locator('#historyMessage')).toContainText('불러오지 못했습니다');
  await expect(page.locator('#historyList li')).toHaveCount(0);
});
for (const width of [320, 375, 390, 430]) {
  test(`history fits ${width}px and uses 44px controls`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page, [{ items: [item, { ...item, orderId: 'ORDER_legacy', paymentIntentId: null }], cursor: null }]);
    await page.goto('/payment-history.html');
    await expect(page.locator('#historyList li')).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
    for (const height of await page.locator('.pay-history-link:visible').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))) expect(height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`payment-history-${width}.png`), fullPage: true });
  });
}
