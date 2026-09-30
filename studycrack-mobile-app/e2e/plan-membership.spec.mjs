import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

for (const tier of ['basic', 'standard', 'free']) {
  test(`현재 멤버십은 구매 선택과 분리되고 웹 티어 색상을 유지한다 (${tier})`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier, userOverrides: { univChangeRemaining: 0 } });
    await page.goto('/studycrack-mobile.html?screen=proIntro');
    const membership = page.getByRole('region', { name: '현재 멤버십', exact: true });
    await expect(membership.locator('strong')).toHaveText(tier.toUpperCase());
    await expect(page.locator('[data-screen="proIntro"]')).not.toContainText('잠긴 기능');
    await expect(membership).toContainText(tier === 'basic' ? '대학 변경 0회 남음' : tier === 'standard' ? '까지 · 대학 변경 무제한' : '유료 이용권이 없어요');
    const initial = await membership.textContent();
    const choices = page.getByRole('group', { name: '플랜 선택', exact: true });
    for (const [plan, color] of [['Basic', 'rgb(34, 168, 97)'], ['Starter', 'rgb(76, 121, 238)'], ['Standard', 'rgb(113, 65, 217)'], ['Pro', 'rgb(249, 115, 22)']]) {
      const button = choices.locator(`[data-plan="${plan}"]`);
      await expect(button).toHaveCSS('border-top-color', color);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(button).toHaveCSS('border-top-color', color);
      await expect(membership).toHaveText(initial);
    }
    await page.goto('/studycrack-mobile.html?screen=proIntro');
    await expect(membership.locator('strong')).toHaveText(tier.toUpperCase());
    await page.screenshot({ path: info.outputPath(`membership-${tier}.png`), animations: 'disabled' });
  });
}
