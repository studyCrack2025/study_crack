import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';

test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

for (const width of [390, 1440]) {
  test(`웹 튜토리얼 단계와 성적 박스는 중앙과 화면 경계를 유지한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await installAuthenticatedSession(page);
    await installApiMock(page);
    await page.route('**/api/user', route => {
      const { type } = route.request().postDataJSON();
      if (['get_login_profile', 'get_user_analysis'].includes(type)) return route.fulfill({ json: {
        ...mockUser, role: 'student', phone: '010-1234-5678', tutorialRewardClaimed: false, tutorialStatus: 0
      } });
      return route.fallback();
    });
    await page.goto('/tutorial.html');
    await expect(page.locator('#stepContent .tut-step-card')).toBeVisible();
    for (const step of [0, 1, 2, 3, 5]) {
      // Render each real template without submitting registration or score data.
      await page.evaluate(index => { currentStepIdx = index; return renderStep(); }, step);
      const card = page.locator('#stepContent .tut-step-card');
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
      await expectNoHorizontalOverflow(page);
      if (step === 2) {
        for (const input of await card.locator('.score-input-card').all()) {
          const inner = await input.boundingBox();
          expect(inner.x).toBeGreaterThanOrEqual(box.x);
          expect(inner.x + inner.width).toBeLessThanOrEqual(box.x + box.width + 1);
        }
        await page.locator('#tutExamMonth').selectOption('jul');
        await expect(page.locator('#tutExamEstimateNotice')).toBeHidden();
      }
    }
  });

  for (const file of ['mypage.html', 'mypage_tutor.html', 'analysis.html']) {
    test(`웹 공통 마이페이지 CSS의 ${file} 배치는 화면 안에 유지된다 (${width}px)`, async ({ browser, baseURL }) => {
      // These consumers share CSS; authentication behavior has separate browser coverage.
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 1000 } });
      try {
        const page = await context.newPage();
        await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
        await page.goto(`${baseURL}/${file}`);
        const layout = page.locator('.mypage-container');
        await expect(layout).toBeVisible();
        const box = await layout.boundingBox();
        expect(box.width).toBeGreaterThan(width / 2);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        const profile = await page.locator('.profile-summary').boundingBox();
        expect(profile.x).toBeGreaterThanOrEqual(box.x);
        expect(profile.x + profile.width).toBeLessThanOrEqual(box.x + box.width + 1);
      } finally { await context.close(); }
    });
  }
}
