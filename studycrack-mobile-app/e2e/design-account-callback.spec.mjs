import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const width of [320, 390]) test(`소셜 복귀 오류 화면도 앱의 읽기·카드 규격을 유지한다 (${width}px)`, async ({ page, baseURL }, info) => {
  await page.setViewportSize({ width, height: 700 });
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
  await page.goto('/social-callback');
  await expect(page.locator('#statusMsg')).toContainText('파라미터 누락');
  await expect(page.getByRole('link', { name: '로그인 페이지로 돌아가기' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('font-family', /Paperlogy/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.social-callback-status')).toHaveCSS('border-radius', '10px');
  await expect(page.locator('#statusMsg')).toHaveCSS('font-size', '16px');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath(`callback-${width}.png`), animations: 'disabled' });
});
