import { expect, test } from '@playwright/test';
import { installAuthenticatedSession, installApiMock } from './support/mock-api.mjs';

const id = 'PI_123e4567e89b12d3a456426614174000';
const paid = { paymentIntentId: id, purchaseKind: 'subscription', tier: 'BASIC', amount: 25000, status: 'paid', fulfillmentStatus: 'fulfilled' };
const purchases = page => page.evaluate(() => (window.dataLayer || []).filter(row => row.event === 'sc_verified_purchase'));

async function setup(page, data = paid) {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.route('**/api/user', route => route.fulfill({ json: { role: 'student', userId: 'e2e-student' } }));
  const calls = [];
  await page.route('**/api/payment', async route => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, data } });
  });
  return calls;
}

test('confirmed payment is measured once across retry and reload without query or contact leakage', async ({ page }) => {
  const calls = await setup(page);
  await page.goto(`/success.html?paymentIntentId=${id}&email=private%40example.invalid&amount=1&tier=pro`);
  await expect.poll(async () => (await purchases(page)).length).toBe(1);
  const [event] = await purchases(page);
  expect(event.sc.ecommerce.value).toBe(25000);
  expect(event.sc.ecommerce.transaction_id).toBe(id);
  expect(event.sc.plan_type).toBe('basic');
  expect(event.sc.user_id).toBe('e2e-student');
  expect(JSON.stringify(await page.evaluate(() => window.dataLayer))).not.toContain('private');
  expect(new URL(page.url()).search).toBe(`?paymentIntentId=${id}`);
  await page.locator('#statusRetry').click();
  await expect(page.locator('#statusRetry')).toBeEnabled();
  expect(await purchases(page)).toHaveLength(1);
  await page.reload();
  await expect(page.locator('#statusRetry')).toBeEnabled();
  expect(await purchases(page)).toHaveLength(0);
  expect(calls.every(call => call.type === 'get_payment_status')).toBe(true);
});

for (const status of ['intent_created', 'vbank_ready', 'failed', 'expired', 'cancelled']) {
  test(`${status} cannot emit a purchase event`, async ({ page }) => {
    await setup(page, { ...paid, status, vbank: { bankName: 'bank', accountNo: '123', holder: 'holder', expireDate: '2026-12-31' } });
    await page.goto(`/success.html?paymentIntentId=${id}`);
    await expect(page.locator('#statusRetry')).toBeEnabled();
    expect(await purchases(page)).toHaveLength(0);
  });
}

test('retired promotion stops before payment lookup even when the URL contains an intent ID', async ({ page }) => {
  const calls = await setup(page);
  await page.goto(`/success.html?status=promo&source=kcc01&paymentIntentId=${id}`);
  await expect(page.locator('#successTitle')).toHaveText('종료된 프로모션입니다');
  expect(calls).toHaveLength(0);
  expect(await purchases(page)).toHaveLength(0);
  expect(new URL(page.url()).search).toBe('');
});

test('slow identity measurement does not disable confirmed status recovery', async ({ page }) => {
  await setup(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/user', async route => {
    await gate;
    await route.fulfill({ json: { role: 'student', userId: 'e2e-student' } });
  });
  try {
    await page.goto(`/success.html?paymentIntentId=${id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#successTitle')).toHaveText('결제와 이용권 반영이 완료되었습니다');
    await expect(page.locator('#statusRetry')).toBeEnabled();
    expect(await purchases(page)).toHaveLength(0);
    await page.locator('#statusRetry').click();
    await expect(page.locator('#statusRetry')).toBeEnabled();
    release();
    await expect.poll(async () => (await purchases(page)).length).toBe(1);
  } finally { release(); }
});
