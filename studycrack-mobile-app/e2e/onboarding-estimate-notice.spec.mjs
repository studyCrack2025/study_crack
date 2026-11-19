import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const width of [320, 390]) {
  test(`온보딩 9월·10월은 원점수를 입력하고 수능은 성적표를 직접 입력한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installAuthenticatedSession(page);
    await installApiMock(page);
    await page.goto('/studycrack-mobile.html?screen=ob2');
    const select = page.locator('[data-field="scoreExamType"]');
    for (const month of ['9월 평가원', '10월 모의고사']) {
      await select.selectOption(month);
      await expect(page.locator('[data-field="v2e-korean-common"]')).toBeVisible();
      await expect(page.locator('[data-screen="ob2"]')).not.toContainText('임시 추정치');
      await expectNoHorizontalOverflow(page);
    }
    await select.selectOption('수능');
    await expect(page.locator('[data-field="v2e-korean-std"]')).toBeVisible();
    await page.locator('[data-field="v2e-korean-type"]').selectOption('언어와매체');
    await expect(page.locator('[data-field="v2e-korean-type"]')).toHaveValue('언어와매체');
    await page.locator('[data-field="v2e-math-type"]').selectOption('미적분');
    await expect(page.locator('[data-field="v2e-math-type"]')).toHaveValue('미적분');
    const inquiry = page.locator('[data-field="v2e-inq1-subject"]');
    await expect(inquiry.locator('optgroup[label="사회탐구"] option')).toHaveCount(9);
    await expect(inquiry.locator('optgroup[label="과학탐구"] option')).toHaveCount(8);
    await inquiry.selectOption('생명과학Ⅱ');
    await expect(inquiry).toHaveValue('생명과학Ⅱ');
  });
}
