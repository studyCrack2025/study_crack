import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`플랜 확인과 웹 결제 안내는 완료를 만들지 않는다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await installAuthenticatedSession(page);
    const api = await installApiMock(page, { tier: 'standard', userOverrides: { pendingSubscription: { tier: 'pro', startDate: '2026-10-10T00:00:00Z' } } });
    const capture = name => page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.goto('/studycrack-mobile.html?screen=proIntro');
    await expect(page.locator('.service-plan-card')).toHaveCount(4);
    await capture('plans');
    await page.locator('[data-plan="Pro"]').click();
    const detail = page.getByRole('region', { name: '선택한 플랜 상세' });
    await expect(detail).toContainText('149,000원 / 4주');
    await expect(detail.getByRole('listitem')).toHaveCount(7);
    await detail.scrollIntoViewIfNeeded();
    await capture('plan-detail');
    await detail.locator('[data-target="payment"]').click();
    await expect(page.locator('.payment-progress li[aria-current="step"]')).toHaveText('01플랜 확인');
    const choices = page.getByRole('group', { name: '플랜 선택', exact: true });
    await expect(choices.getByRole('button')).toHaveCount(4);
    await expect(choices.locator('b').first()).toBeVisible();
    const cells = await choices.getByRole('button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { y: r.y, height: r.height }; }));
    expect(cells[0].y).toBe(cells[1].y);
    expect(cells[2].y).toBeGreaterThan(cells[0].y);
    expect(cells.every(cell => cell.height >= 44)).toBe(true);
    await choices.scrollIntoViewIfNeeded();
    await capture('checkout');
    for (const [plan, term] of [['Starter', '1회 진단'], ['Basic', '4주 이용']]) {
      await choices.locator(`[data-plan="${plan}"]`).click();
      await expect(page.locator('.payment-fixed-term')).toContainText(term);
      await expect(page.getByRole('group', { name: '이용 기간 선택' })).toHaveCount(0);
    }
    await choices.locator('[data-plan="Standard"]').click();
    const duration = page.getByRole('button', { name: '4주', exact: true });
    await expect(duration).toHaveAttribute('aria-pressed', 'true');
    expect((await duration.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
    await page.goto('/studycrack-mobile.html?screen=paymentComplete');
    await expect(page.locator('.payment-complete-sub')).toHaveText('이 안내 화면은 결제 완료를 의미하지 않습니다.');
    await capture('handoff');
    expect(api.requests.some(({ payload }) => payload.type === 'create_payment_intent')).toBe(false);
    await page.getByRole('button', { name: '계정에서 구독 확인' }).click();
    await expect(page.locator('.account-subscription-summary')).toContainText('Standard');
    await expect(page.locator('.account-pending-plan')).toContainText('다음 플랜 Pro');
    await capture('subscription');
    await expectNoHorizontalOverflow(page);
  });
}
