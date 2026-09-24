import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expectNoHorizontalOverflow,
  installApiMock,
  installAuthenticatedSession
} from './support/mock-api.mjs';
import { isPathInsideRoot } from './support/static-route-path.mjs';

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
];

const WEB_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp'
};

async function installNoServerStaticRoute(page) {
  if (process.env.PLAYWRIGHT_NO_SERVER !== '1') return;
  await page.route('http://studycrack.local/**', async (route) => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const relativePath = pathname === '/' ? '/studycrack-mobile.html' : pathname;
    const filePath = resolve(WEB_ROOT, `.${relativePath}`);
    if (!isPathInsideRoot(WEB_ROOT, filePath)) {
      await route.fulfill({ status: 403, body: 'Forbidden' });
      return;
    }
    try {
      await route.fulfill({ body: await readFile(filePath), contentType: MIME_TYPES[extname(filePath)] || 'application/octet-stream' });
    } catch {
      await route.fulfill({ status: 404, body: 'Not found' });
    }
  });
}

test.beforeEach(async ({ page }) => installNoServerStaticRoute(page));

test('Phase 1 공통 shell은 네 viewport와 44px navigation 계약을 지킨다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto('/studycrack-mobile.html?screen=timer');
    await expect(page.locator('[data-screen="timer"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const geometry = await page.locator('.app-frame').evaluate((frame) => {
      const frameBox = frame.getBoundingClientRect();
      const content = frame.querySelector('.app-content');
      const tabbar = frame.querySelector('.tabbar');
      const tabButtons = Array.from(frame.querySelectorAll('.tabbar button')).map((button) => button.getBoundingClientRect());
      const normalIcon = frame.querySelector('[data-tab="timer"] .tabbar-icon')?.getBoundingClientRect();
      const aquariumIcon = frame.querySelector('[data-tab="aquarium"] .tabbar-icon')?.getBoundingClientRect();
      return {
        aquariumRaisedBy: normalIcon && aquariumIcon ? normalIcon.top - aquariumIcon.top : 0,
        contentPaddingTop: Number.parseFloat(getComputedStyle(content).paddingTop),
        frameHeight: frameBox.height,
        frameWidth: frameBox.width,
        minTabHeight: Math.min(...tabButtons.map((box) => box.height)),
        tabbarHeight: tabbar.getBoundingClientRect().height
      };
    });

    expect(geometry.frameWidth).toBeLessThanOrEqual(430);
    expect(Math.abs(geometry.frameHeight - viewport.height)).toBeLessThanOrEqual(1);
    expect(geometry.contentPaddingTop).toBeGreaterThanOrEqual(16);
    expect(geometry.minTabHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.tabbarHeight).toBeGreaterThanOrEqual(72);
    expect(geometry.aquariumRaisedBy).toBeGreaterThan(8);

    const screenshotPath = testInfo.outputPath(`phase-one-shell-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`phase-one-shell-${viewport.width}x${viewport.height}.png`, { path: screenshotPath, contentType: 'image/png' });
  }
});

test('secondary heading은 card가 아니고 overlay는 배경과 focus를 격리한다', async ({ page }) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authLogin');

  const trigger = page.getByRole('button', { name: '이메일 찾기' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '이메일 찾기' });
  const content = page.locator('.app-content');
  await expect(dialog).toBeVisible();
  await expect(content).toHaveAttribute('inert', '');
  await expect(content).toHaveAttribute('aria-hidden', 'true');
  await expect(dialog.getByRole('button', { name: '닫기' })).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '이메일 찾기' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '닫기' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(content).not.toHaveAttribute('inert', '');
  await expect(trigger).toBeFocused();

  await installAuthenticatedSession(page);
  await page.goto('/studycrack-mobile.html?screen=addUniversity');
  const introStyle = await page.locator('.sc-secondary-intro').evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, borderTopWidth: style.borderTopWidth, boxShadow: style.boxShadow };
  });
  expect(introStyle.borderTopWidth).toBe('0px');
  expect(introStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(introStyle.boxShadow).toBe('none');
});

test('offline과 reconnecting은 사용자 데이터를 캐시하지 않는 전역 상태로 안내된다', async ({ page, context }) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authLogin');

  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('오프라인 상태예요');
  await context.setOffline(false);
  await expect(page.getByRole('status')).toContainText('다시 연결됐어요');
  await expect(page.locator('.sc-network-status')).toBeHidden({ timeout: 5000 });
});

test('reduced motion에서는 화면 전환과 skeleton 반복 motion이 제거된다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authLogin');
  const animation = await page.locator('[data-screen="authLogin"]').evaluate((screen) => {
    const style = getComputedStyle(screen);
    return { duration: style.animationDuration, iterations: style.animationIterationCount };
  });
  expect(Number.parseFloat(animation.duration)).toBeLessThanOrEqual(0.001);
  expect(animation.iterations).toBe('1');
});
