import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
const entry = '/studycrack-mobile.html?screen=authLogin';
const bundle = '**/dist/studycrack-mobile.bundle.js';

async function expectCentered(page, width, height) {
  const panel = page.locator('.init-loading');
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThanOrEqual(1);
  expect(box.x).toBeGreaterThanOrEqual(16);
  expect(box.y).toBeGreaterThanOrEqual(16);
  await expectNoHorizontalOverflow(page);
}

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  for (const cssReady of [true, false]) {
    test(`부팅·실패·오프라인·재시도 표시 (${width}px, CSS ${cssReady ? 'ready' : 'missing'})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const api = await installApiMock(page);
      await page.clock.install();
      let fail = true;
      await page.route(bundle, route => fail ? route.abort() : route.continue());
      if (!cssReady) await page.route('**/dist/studycrack-mobile.css', route => fail ? route.abort() : route.continue());
      await page.goto(entry);
      const capture = name => page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${cssReady ? 'ready' : 'missing'}.png`), animations: 'disabled' });
      await capture('loading');
      await expect(page.locator('.mobile-boot-shell [role="status"]')).toContainText('앱 화면을 준비하고 있어요');
      await expectCentered(page, width, height);
      await page.clock.fastForward(12001);
      await expect(page.getByRole('alert')).toContainText('앱을 불러오지 못했습니다');
      await expectCentered(page, width, height);
      const retry = page.getByRole('button', { name: '다시 불러오기' });
      expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(retry).toHaveCSS('background-color', 'rgb(10, 86, 178)');
      await expect(retry).toHaveCSS('font-size', '13px');
      await retry.focus();
      await expect(retry).toHaveCSS('outline-style', 'solid');
      await capture('error');
      await page.context().setOffline(true);
      await expect(page.getByRole('alert')).toContainText('오프라인 상태예요');
      await capture('offline');
      expect(api.requests).toHaveLength(0);
      await page.context().setOffline(false);
      await expect(page.getByRole('alert')).toContainText('연결 상태를 확인한 뒤');
      fail = false;
      await retry.click();
      await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
      await expect(page.locator('.mobile-boot-shell')).toHaveCount(0);
      await expect(page.locator('#root')).toHaveCSS('padding', '0px');
      await expect(page.locator('.app-frame')).toHaveCSS('width', `${width}px`);
      await page.clock.fastForward(12001);
      await expect(page.locator('.init-loading')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  }
}

test('느린 실행 파일이 도착하면 오류 화면에서 정상 앱으로 전환된다', async ({ page }) => {
  await installApiMock(page);
  await page.clock.install();
  let release;
  let held = false;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route(bundle, async route => { held = true; await pending; await route.continue(); });
  try {
    await page.goto(entry, { waitUntil: 'commit' });
    await expect.poll(() => held).toBe(true);
    await page.clock.fastForward(12001);
    await expect(page.getByRole('alert')).toContainText('앱을 불러오지 못했습니다');
    release();
    await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
    await expect(page.locator('.mobile-boot-shell')).toHaveCount(0);
    await page.clock.fastForward(12001);
    await expect(page.locator('.init-loading')).toHaveCount(0);
  } finally { release(); }
});
