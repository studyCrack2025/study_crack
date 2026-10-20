import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';

for (const width of [390, 1440]) {
  test(`Basic web ${width}px can read every target regardless of score`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await installAuthenticatedSession(page);
    const targets = [0, 1, 2].map(index => ({ univ: `테스트대학교${index}`, major: '경영학과' }));
    const scores = [0, 65, 150];
    const api = await installApiMock(page, { tier: 'basic', userOverrides: { targetUnivs: targets, univChangeRemaining: 0 } });
    await page.route('**/api/**', route => {
      const payload = route.request().postDataJSON();
      if (['get_login_profile', 'get_user'].includes(payload.type)) return route.fulfill({ json: { ...mockUser, tutorialRewardClaimed: true, computedTier: 'basic' } });
      if (payload.type === 'simulate_score_rise') return route.fulfill({ json: targets.map((target, index) => ({ ...target, base_ui_score: scores[index], sim_data: Object.fromEntries(['kor', 'math', 'inq1', 'inq2'].map(key => [key, { name: key, uiDiff: 2 }])) })) });
      if (payload.type !== 'backtrace_required_raw') return route.fallback();
      api.requests.push({ payload });
      const index = targets.findIndex(target => target.univ === payload.targetUniv.univ);
      return route.fulfill({ json: { result: { reachable: true, minTotalRaw: index === 2 ? 0 : 4, bySubject: index === 2 ? {} : { kor: 4 }, expected: { uiScore: index === 2 ? 150 : 105 } } } });
    });
    await page.goto('/analysis.html');
    await expect(page.locator('#pageLoadingOverlay')).toBeHidden();
    await page.getByRole('button', { name: /점수 시뮬레이션/ }).click();
    await expect(page.locator('.sim-backtrace-cta').first()).toBeVisible();
    for (let index = 0; index < targets.length; index++) {
      if (width > 768) await page.locator('.sim-label-item').nth(index).click();
      const card = width <= 768 ? page.locator('#simDetailCard .swipe-univ-card').nth(index) : page.locator('#simDetailCard');
      await card.locator('.sim-backtrace-cta').click();
      await expect(card.locator('.sim-backtrace-result')).toBeVisible();
      await expect(card).toContainText(index === 2 ? '추가 필요 원점수는 0점' : '원점수 +4점');
      await expect(card).not.toContainText('멤버십 둘러보기');
    }
    expect(api.requests.filter(({ payload }) => payload.type === 'backtrace_required_raw').map(({ payload }) => payload.targetUniv.univ)).toEqual(targets.map(target => target.univ));
    await page.locator('#simDetailCard').screenshot({ path: info.outputPath(`web-basic-backtrace-${width}.png`) });
  });
}
