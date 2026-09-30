import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const width of [320, 360, 390, 430]) {
  test(`브랜드 헤더와 탭별 요약·우측 MY·상품 총액 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier: 'standard' });
    await page.goto('/studycrack-mobile.html?screen=timer');
    await expect(page.locator('.home-aquarium-preview')).toHaveCount(0);
    const opener = page.getByRole('button', { name: '프로필 메뉴 열기' });
    await opener.click();
    const drawer = page.getByRole('dialog', { name: '프로필 메뉴', exact: true });
    await expect(drawer).toHaveCSS('animation-name', 'myDrawerIn');
    await expect(drawer.locator('.sc-sheet-handle')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`drawer-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(opener).toBeFocused();
    for (const [tab, title] of [['planner', 'Planner of Today'], ['aquarium', 'Fish Tank'], ['analysis', 'Score Analysis'], ['strategy', 'Study Coaching']]) {
      await page.locator(`.tabbar [data-tab="${tab}"]`).click();
      const head = page.locator('.primary-screen-header');
      await expect(head.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(head.locator('img')).toHaveCSS('width', '38px');
      expect((await head.boundingBox()).height).toBeLessThan(110);
      await expect(page.locator('.sc-study-score')).toHaveCount(0);
      if (tab === 'analysis') await expect(page.getByRole('button', { name: '플랜별 기능 보기 →' })).toHaveCount(1);
      if (['aquarium', 'strategy'].includes(tab)) await expect(page.locator('.sc-study-details')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: info.outputPath(`${tab}-${width}.png`), animations: 'disabled' });
    }
    await expect(page.locator('.service-plan-card')).toHaveCount(0);
    await page.getByRole('button', { name: '플랜별 기능 보기 →' }).click();
    const choices = page.getByRole('group', { name: '플랜 선택', exact: true });
    for (const [plan, total] of [['Basic', '25,000원'], ['Starter', '39,000원'], ['Standard', '49,000원 / 4주'], ['Pro', '149,000원 / 4주']]) {
      await choices.locator(`[data-plan="${plan}"]`).click();
      await expect(page.locator('.plan-console-price b')).toHaveText(total);
      await expect(choices.locator(`[data-plan="${plan}"] b`)).toHaveText(total);
      await expectNoHorizontalOverflow(page);
    }
    await page.screenshot({ path: info.outputPath(`price-${width}.png`), animations: 'disabled' });
  });
}

test('분석의 상품 홍보는 기능 보기 버튼만 남기고 결제로 연결한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic' });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await expect(page.locator('.analysis-reverse-card.locked')).toHaveCount(0);
  await expect(page.getByText('나에게 맞는 플랜')).toHaveCount(0);
  await page.getByRole('button', { name: '플랜별 기능 보기 →' }).click();
  await expect(page.locator('[data-screen="proIntro"]')).toBeVisible();
});

test('웹 결제 카드와 구형 이체 화면도 현재 총액을 표시한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic' });
  await page.goto('/payment.html');
  for (const [tier, total, weekly] of [['standard', '49,000', '12,250'], ['pro', '149,000', '37,250']]) {
    const card = page.locator(`.price-row[data-tier="${tier}"]`);
    await expect(card.locator('.price-sale-line strong')).toHaveText(total);
    await expect(card.locator('.price-sale-line span')).toHaveText('원 / 4주');
    await expect(card.locator('.price-weekly-note')).toHaveText(`주당 환산 ${weekly}원`);
  }
  for (const [tier, total] of [['starter', '39,000원'], ['standard', '49,000원'], ['pro', '149,000원']]) {
    await page.evaluate(tier => localStorage.setItem('checkoutData', JSON.stringify({ tier, productName: tier, name: '검수용' })), tier);
    await page.goto('/checkout-transfer.html');
    await expect(page.locator('#chkPrice')).toHaveText(total);
  }
});
