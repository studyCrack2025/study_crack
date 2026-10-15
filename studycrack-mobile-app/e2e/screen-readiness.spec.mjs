import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';
import { expectScreenReady, expectScreenViewport } from './support/screen-ready.mjs';

const viewport = { width: 320, height: 700 };
const registryChunk = /\/chunks\/screen-registry-app-[\w-]+\.js(?:\?.*)?$/;

test('지연된 화면 모듈은 준비 화면으로 통과하지 않고 실제 리포트가 표시된 뒤 검사한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
  await page.setViewportSize(viewport);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route(registryChunk, async route => { await pending; await route.continue(); });
  try {
    await page.goto('/studycrack-mobile.html?screen=report', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-screen="report"]')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('앱 화면을 준비하고 있어요');
    const fallbackFrame = await page.locator('.app-frame').elementHandle();
    expect(await fallbackFrame.boundingBox()).not.toBeNull();
    await expect(expectScreenReady(page, 'report', { timeout: 150 })).rejects.toThrow(/actual content must replace/);
    await expect(expectScreenViewport(page, 'report', viewport, { timeout: 150 })).rejects.toThrow(/actual content must replace/);
    release();
    await expectScreenReady(page, 'report');
    await expectScreenViewport(page, 'report', viewport);
    await expect(page.getByRole('heading', { name: '맞춤 전략 리포트' })).toBeVisible();
    expect(await fallbackFrame.evaluate(element => element.isConnected)).toBe(false);
    expect(await fallbackFrame.boundingBox()).toBeNull();
    await fallbackFrame.dispose();
    await expect(expectScreenReady(page, 'unknown')).rejects.toThrow('No real-screen readiness contract');
  } finally {
    release();
  }
});

test('화면 모듈 오류와 실제 프레임 크기 오류를 정상 레이아웃으로 통과시키지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
  await page.setViewportSize(viewport);
  await page.route(registryChunk, route => route.fulfill({ status: 503, contentType: 'text/javascript', body: '' }));
  await page.goto('/studycrack-mobile.html?screen=report');
  await expect(page.getByRole('alert')).toContainText('화면을 불러오지 못했습니다');
  await expect(expectScreenReady(page, 'report', { timeout: 150 })).rejects.toThrow(/actual content must replace/);
  await expect(expectScreenViewport(page, 'report', viewport, { timeout: 150 })).rejects.toThrow(/actual content must replace/);
  await page.unroute(registryChunk);
  await page.reload();
  await expectScreenViewport(page, 'report', viewport);
  await page.locator('.report-page').evaluate(element => { element.style.cssText = 'height:0;width:0;overflow:hidden;padding:0;'; });
  await expect(page.locator('.app-frame')).toHaveCSS('height', `${viewport.height}px`);
  await expect(expectScreenViewport(page, 'report', viewport, { timeout: 150 })).rejects.toThrow(/actual content must replace/);
  await page.locator('.report-page').evaluate(element => { element.removeAttribute('style'); });
  await expectScreenViewport(page, 'report', viewport);
  await page.locator('.app-frame').evaluate(element => { element.style.height = '701.5px'; });
  await expect(expectScreenViewport(page, 'report', viewport, { timeout: 150 })).rejects.toThrow();
});
