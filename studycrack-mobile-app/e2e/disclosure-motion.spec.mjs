import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const reducedMotion of ['reduce', 'no-preference']) {
  test(`학습 프로필 양방향·반전·닫힌 포커스 차단 ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier: 'pro' });
    await page.goto('/studycrack-mobile.html?screen=my');
    const details = page.locator('[data-screen="my"] .my-summary-checklist');
    const summary = details.locator('summary');
    const body = details.locator('.sc-disclosure-body');
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    const closed = await details.evaluate(el => el.getBoundingClientRect().height);
    await summary.click();
    await expect(summary).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => details.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(closed + 100);
    await details.locator('button').first().focus();
    await summary.evaluate(el => el.click());
    await expect(summary).toBeFocused();
    await expect(body).toHaveAttribute('inert', '');
    await summary.evaluate(el => el.click());
    await expect(summary).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => details.evaluate(el => el.getAnimations().length)).toBe(0);
    await expect(details).toHaveAttribute('open', '');
    await summary.click();
    await expect.poll(() => details.evaluate(el => el.open)).toBe(false);
    expect(await details.evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(closed, 0);
    await expectNoHorizontalOverflow(page);
  });
}

test('달력 추가 정보 입력은 접힘·재열림과 중간 반전에서 보존한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
  await page.goto('/studycrack-mobile.html?screen=planner');
  await page.locator('.planner-admission-trigger').click();
  const details = page.locator('.calendar-form-details');
  const summary = details.locator('summary');
  await summary.click();
  await page.locator('#calendar-event-note').fill('초안 유지 테스트');
  await summary.evaluate(el => el.click());
  await expect(summary).toBeFocused();
  await summary.evaluate(el => el.click());
  await expect(page.locator('#calendar-event-note')).toHaveValue('초안 유지 테스트');
  await expect.poll(() => details.evaluate(el => el.getAnimations().length)).toBe(0);
  await expectNoHorizontalOverflow(page);
});

test('MY drawer의 펼침은 중간 높이를 거치며 동적 본문도 잘리지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  const details = page.getByRole('dialog', { name: '프로필 메뉴', exact: true }).locator('.my-summary-checklist');
  await page.evaluate(() => document.fonts.ready);
  const heights = await details.evaluate(async node => {
    const values = [node.getBoundingClientRect().height];
    node.querySelector('summary').click();
    const start = performance.now();
    let added = false;
    await new Promise(resolve => {
      const frame = () => {
        values.push(node.getBoundingClientRect().height);
        if (!added && performance.now() - start > 80) {
          const p = document.createElement('p');
          p.textContent = '긴 내용이 추가되어도 모두 읽을 수 있어요. '.repeat(12);
          node.querySelector('.sc-disclosure-body').append(p);
          added = true;
        }
        if (performance.now() - start < 650) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    return values;
  });
  expect(new Set(heights.map(value => Math.round(value))).size).toBeGreaterThan(4);
  expect(heights.at(-1)).toBeGreaterThan(heights[0] + 100);
  expect(await details.evaluate(node => node.scrollHeight <= node.clientHeight + 2)).toBe(true);
  await details.locator('summary').focus();
  await page.keyboard.press('Space');
  await expect(details.locator('summary')).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => details.evaluate(node => node.open)).toBe(false);
});
