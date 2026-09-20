import { expect, test } from '@playwright/test';
import { installAuthenticatedSession, installApiMock } from './support/mock-api.mjs';

const id = 'PI_123e4567e89b12d3a456426614174000';
const owner = 'e2e-student';
const other = 'other-student';
const ready = { paymentIntentId: id, purchaseKind: 'subscription', tier: 'STARTER', amount: 39000, status: 'vbank_ready', fulfillmentStatus: 'pending', vbank: { bankName: 'fixture bank', accountNo: '123-456-789', holder: 'fixture owner', expireDate: '2026-10-01' } };
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

async function setup(page) {
  await installAuthenticatedSession(page, { restoreOnNavigation: false });
  await installApiMock(page);
  await page.addInitScript(() => {
    window.__paymentPageShown = false;
    window.addEventListener('pageshow', () => { window.__paymentPageShown = true; }, { once: true });
  });
  const arrived = deferred(), response = deferred(), settled = deferred();
  const calls = [], navigations = [];
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
  });
  await page.route('**/api/payment', async route => {
    const payload = route.request().postDataJSON();
    expect(payload).toEqual({ type: 'get_payment_status', data: { paymentIntentId: id } });
    const token = (route.request().headers().authorization || '').replace(/^Bearer /, '');
    const subject = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
    const first = calls.length === 0;
    calls.push(subject);
    if (first) { arrived.resolve(); await response.promise; }
    try {
      await route.fulfill(subject === owner
        ? { json: { success: true, data: ready } }
        : { status: 404, json: { error: 'not found' } });
    } finally { if (first) settled.resolve(); }
  });
  return { calls, navigations, arrived, response, settled };
}

async function switchAccount(page) {
  const token = `e2e.${Buffer.from(JSON.stringify({ sub: other, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  await page.evaluate(({ userId, token }) => {
    const oldValue = localStorage.getItem('userId');
    localStorage.setItem('userId', userId);
    sessionStorage.setItem('accessToken', token);
    window.dispatchEvent(new StorageEvent('storage', { key: 'userId', oldValue, newValue: userId, storageArea: localStorage }));
  }, { userId: other, token });
}

async function expectNoBank(page) {
  await expect(page.locator('#vbankBox')).not.toBeVisible();
  await expect(page.locator('#vbankAccount')).toHaveText('-');
  await expect(page.locator('#tierBadge')).toHaveText('결제 확인');
}

for (const rate of [1, 4]) {
  test(`account switch after pageshow rejects the in-flight owner response (${rate}x CPU)`, async ({ page, context }) => {
    const api = await setup(page);
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate });
    try {
      await page.goto(`/success.html?paymentIntentId=${id}`);
      await expect.poll(() => page.evaluate(() => window.__paymentPageShown)).toBe(true);
      await api.arrived.promise;
      await expect(page.locator('#statusRetry')).toBeDisabled();
      await switchAccount(page);
      await expect(page.locator('#successTitle')).toHaveText('결제 상태를 다시 확인해주세요');
      api.response.resolve();
      await api.settled.promise;
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await expectNoBank(page);
      expect(api.calls).toEqual([owner]);
      expect(api.navigations).toHaveLength(1);
      await page.locator('#statusRetry').click();
      await expect(page.locator('#successTitle')).toHaveText('이 계정에서 결제 정보를 확인할 수 없어요');
      await expectNoBank(page);
      expect(api.calls).toEqual([owner, other]);
    } finally {
      api.response.resolve();
      await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await client.detach();
    }
  });

  test(`account switch before pageshow reloads into the new owner without old bank details (${rate}x CPU)`, async ({ page, context }) => {
    const api = await setup(page);
    const imageArrived = deferred(), imageRelease = deferred();
    await page.route('**/__payment-load-gate.png', async route => {
      imageArrived.resolve();
      await imageRelease.promise;
      await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
    });
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const image = document.createElement('img');
        image.hidden = true;
        image.src = '/__payment-load-gate.png';
        document.body.append(image);
      }, { once: true });
    });
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate });
    try {
      await page.goto(`/success.html?paymentIntentId=${id}`, { waitUntil: 'domcontentloaded' });
      await Promise.all([api.arrived.promise, imageArrived.promise]);
      expect(await page.evaluate(() => window.__paymentPageShown)).toBe(false);
      await switchAccount(page);
      await expect(page.locator('#successTitle')).toHaveText('결제 상태를 다시 확인해주세요');
      const reloaded = page.waitForEvent('request', request => request.isNavigationRequest() && request.frame() === page.mainFrame());
      imageRelease.resolve();
      await reloaded;
      await expect.poll(() => api.calls).toEqual([owner, other]);
      await expect(page.locator('#successTitle')).toHaveText('이 계정에서 결제 정보를 확인할 수 없어요');
      api.response.resolve();
      await api.settled.promise;
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await expectNoBank(page);
      expect(api.navigations).toHaveLength(2);
      expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe(other);
    } finally {
      imageRelease.resolve();
      api.response.resolve();
      await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await client.detach();
    }
  });
}
