import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932], [568, 320]]) {
  test(`프로필 고정 로그아웃과 취소 초점·스크롤 복원 (${width}x${height})`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    const api = await installApiMock(page, { tier: 'standard', userOverrides: { name: '긴이름을 가진 테스트 학생' } });
    await page.goto('/studycrack-mobile.html?screen=timer');
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    const sheet = page.getByRole('dialog', { name: '프로필 메뉴', exact: true });
    const button = sheet.getByRole('button', { name: '로그아웃', exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await sheet.locator('.my-summary-body').evaluate(el => { el.scrollTop = 180; });
    const scroll = await sheet.locator('.my-summary-body').evaluate(el => el.scrollTop);
    await page.screenshot({ path: info.outputPath(`profile-footer-${width}.png`), animations: 'disabled' });
    for (const dismiss of ['cancel', 'escape']) {
      await button.click();
      const modal = page.getByRole('dialog', { name: '로그아웃 확인', exact: true });
      await expect(modal).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(modal.getByRole('button', { name: '취소' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(modal.getByRole('button', { name: '로그아웃', exact: true })).toBeFocused();
      if (dismiss === 'cancel') await modal.getByRole('button', { name: '취소' }).click();
      else await page.keyboard.press('Escape');
      await expect(button).toBeFocused();
      expect(await sheet.locator('.my-summary-body').evaluate(el => el.scrollTop)).toBe(scroll);
    }
    expect(api.requests.filter(r => r.payload.type === 'logout')).toHaveLength(0);
    await expectNoHorizontalOverflow(page);
  });
}

for (const screen of ['timer', 'my', 'settingsMain']) {
  test(`로그아웃 ${screen} 진입은 기존 종료 경로를 한 번 사용한다`, async ({ page }) => {
    await installAuthenticatedSession(page, { restoreOnNavigation: false });
    const api = await installApiMock(page, { tier: 'standard' });
    await page.goto(`/studycrack-mobile.html?screen=${screen}`);
    if (screen === 'timer') await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    await page.locator('[data-action="openLogoutModal"]').click();
    const modal = page.getByRole('dialog', { name: '로그아웃 확인', exact: true });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: '취소' }).click();
    await expect(page.locator('[data-action="openLogoutModal"]')).toBeFocused();
    await page.locator('[data-action="openLogoutModal"]').click();
    await modal.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
    expect(api.requests.filter(r => r.payload.type === 'logout')).toHaveLength(1);
    expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
  });
}
