import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test('기존 home 즐겨찾기는 분석으로 교체되고 새로고침·브라우저 뒤로가기에서 유지된다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=privacyPolicy');
  await expect(page.locator('[data-screen="privacyPolicy"]')).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  await page.goto('/studycrack-mobile.html?screen=home&source=bookmark#saved');
  await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
  await expect(page).toHaveURL(/\?screen=analysis&source=bookmark#saved$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
  await expect(page.locator('.tabbar [data-tab="analysis"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-screen="home"], .home-kpi-slider')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
  await expect(page).toHaveURL(/\?screen=analysis&source=bookmark#saved$/);
  await page.goBack();
  await expect(page.locator('[data-screen="privacyPolicy"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

for (const previousTab of ['home', 'my']) {
  test(`이전 ${previousTab} 저장값으로 재실행해도 현재 홈은 타이머이고 로컬 계획이 보존된다`, async ({ page }) => {
    await installAuthenticatedSession(page);
    await installApiMock(page);
    await page.goto('/studycrack-mobile.html?screen=timer');
    await expect(page.locator('[data-screen="timer"]')).toBeVisible();
    const oldDrafts = await page.evaluate((tab) => {
      localStorage.setItem('activeTab', tab);
      return localStorage.getItem('plannerItems');
    }, previousTab);
    await page.goto('/studycrack-mobile.html');
    await expect(page.locator('[data-screen="timer"]')).toBeVisible();
    await expect(page.locator('.tabbar [data-tab="timer"]')).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => localStorage.getItem('activeTab'))).toBe('timer');
    expect(await page.evaluate(() => localStorage.getItem('plannerItems'))).toBe(oldDrafts);
    await page.locator('.tabbar [data-tab="planner"]').click();
    await expect(page.locator('.planner-item-v2').filter({ hasText: '독서' })).toBeVisible();
    await page.locator('.tabbar [data-tab="timer"]').click();
    await expect(page.locator('[data-screen="timer"]')).toBeVisible();
    await expect(page.locator('[data-screen="home"], .home-kpi-slider')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}
