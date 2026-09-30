import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const target of ['ranking', 'weekly', 'report', 'proIntro', 'accountInfo', 'notificationList', 'settingsMain', 'customerSupport', 'my']) {
  test(`MY → ${target} → 뒤로는 메뉴 위치와 초점을 복원한다`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier: 'pro' });
    await page.goto('/studycrack-mobile.html?screen=timer');
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    const drawer = page.getByRole('dialog', { name: '프로필 메뉴', exact: true });
    const button = drawer.locator(`[data-target="${target}"]`).first();
    await button.scrollIntoViewIfNeeded();
    const scroll = await drawer.locator('.my-summary-body').evaluate(el => el.scrollTop);
    await button.click();
    await expect(page.locator(`[data-screen="${target}"]`)).toHaveAttribute('data-my-flow', 'true');
    await page.locator('[data-action="back"]').first().click();
    await expect(drawer).toBeVisible();
    await expect(button).toBeFocused();
    await expect.poll(() => drawer.locator('.my-summary-body').evaluate(el => el.scrollTop)).toBeCloseTo(scroll, 0);
    await expect(drawer.locator('[data-action="openStudyRecords"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}

test('MY 계정 하위 창은 우측 패널, 최종 로그아웃은 확인창을 유지한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await page.locator('[data-target="accountInfo"]').click();
  await page.locator('[data-action="openMyProfileEdit"]').click();
  await expect(page.getByRole('dialog', { name: '이름 변경' })).toHaveClass(/sc-side-panel/);
  expect((await page.getByRole('dialog', { name: '이름 변경' }).getByRole('button', { name: '저장', exact: true }).boundingBox()).height).toBeLessThanOrEqual(56);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="accountInfo"]')).toBeVisible();
  await page.locator('[data-action="back"]').first().click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '로그아웃 확인', exact: true })).not.toHaveClass(/sc-side-panel/);
});

test('랭킹 직접 진입의 뒤로는 유령 MY를 만들지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=ranking');
  await page.locator('[data-action="back"]').first().click();
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '프로필 메뉴' })).toHaveCount(0);
});
