import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';

const bands = ['safe', 'match', 'reach', 'safe', 'match', 'reach'];
const candidates = bands.map((band, index) => {
  const score = [160, 110, 90, 165, 115, 95][index];
  const convertedScore = 700 + (score - 100);
  return { school: `구성${index + 1}대학교`, major: '추천학과', currentScore: score, simScore: Math.max(170, score),
    recommendation: { band, basis: 'display_score', convertedScore, estimatedCut: 700, marginToCut: convertedScore - 700,
      normalizedDistance: (score - 100) / 50, reasonCodes: ['ELIGIBILITY_CONFIRMED'] } };
});
function response(selected = candidates, more = true, missing = { safe: 0, match: 0, reach: 0 }) {
  return { selected, page: { hasMore: more, nextCursor: more ? 'next-portfolio' : null },
    selectionSummary: { mode: 'balanced', requestedCount: 6, returnedCount: selected.length, requested: { safe: 2, match: 2, reach: 2 }, missing } };
}
async function prepare(page, responder) {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic', userOverrides: { targetUnivs: [{ univ: '기존대학교', major: '목표학과' }], univChangeRemaining: 3 } });
  const requests = [];
  await page.route('**/api/**', route => {
    const payload = route.request().postDataJSON();
    if (['get_login_profile', 'get_user'].includes(payload?.type)) return route.fulfill({ json: { ...mockUser, tutorialRewardClaimed: true } });
    if (payload?.type !== 'get_tutorial_recommendations') return route.fallback();
    requests.push(payload); return responder(route, payload);
  });
  return requests;
}

test('모바일 320px에서 균형 후보6개와 환산 근거를 표시한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 850 });
  const requests = await prepare(page, (route, payload) => route.fulfill({ json: payload.cursor
    ? response(candidates.map(item => ({ ...item, school: `다음${item.school}` })), false) : response() }));
  await page.goto('/studycrack-mobile.html?screen=addUniversity', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.add-univ-card')).toHaveCount(6);
  expect(requests[0]).toMatchObject({ recommendationCount: 6, recommendationMode: 'balanced' });
  expect(requests[0].excludeUnivs).toContainEqual(expect.objectContaining({ univ: '기존대학교' }));
  for (const label of ['안정', '적정', '상향']) await expect(page.locator('.add-univ-card .sc-badge').filter({ hasText: label })).toHaveCount(2);
  await expect(page.locator('.add-univ-card').first()).toContainText('환산점수 760');
  await expect(page.locator('.add-univ-card').first()).toContainText('예상 컷 700 · 차이 +60');
  await expect(page.locator('.add-univ-section').first()).toContainText('합격 확률이 아닙니다');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.locator('.add-univ-section').first().screenshot({ path: info.outputPath('mobile-portfolio-320.png') });
  await page.getByRole('button', { name: '다른 후보 보기', exact: true }).click();
  await expect(page.locator('.add-univ-card').first()).toContainText('다음구성1대학교');
  expect(requests[1].cursor).toBe('next-portfolio');
  await expect(page.getByRole('button', { name: '처음 추천 다시 보기', exact: true })).toBeVisible();
});

test('모바일은 부족한 상향 후보를 다른 분류로 채우지 않았음을 표시한다', async ({ page }) => {
  await prepare(page, route => route.fulfill({ json: response(candidates.filter(item => item.recommendation.band !== 'reach'), false, { safe: 0, match: 0, reach: 2 }) }));
  await page.goto('/studycrack-mobile.html?screen=addUniversity', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.add-univ-card')).toHaveCount(4);
  await expect(page.locator('.add-univ-section').first()).toContainText('후보 부족: 상향 2개');
});

for (const width of [390, 1440]) {
  test(`웹 ${width}px에서6개 후보와 분류·환산 근거를 표시한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const requests = await prepare(page, route => route.fulfill({ json: response() }));
    await page.goto('/analysis.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pageLoadingOverlay')).toBeHidden();
    await page.evaluate(() => window.openUnivSelectModal(2));
    await page.locator('#recommendBtn').click();
    await expect(page.locator('.selection-item-recommend')).toHaveCount(6);
    expect(requests[0]).toMatchObject({ recommendationCount: 6, recommendationMode: 'balanced' });
    await expect(page.locator('.selection-item-recommend').first()).toContainText('안정');
    await expect(page.locator('.selection-item-recommend').first()).toContainText('환산점수 760 · 예상 컷 700 · 차이 +60');
    await expect(page.locator('#stepUnivList')).toContainText('합격 확률이 아닙니다');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.locator('#univSelectModal .modal-content').screenshot({ path: info.outputPath(`web-portfolio-${width}.png`) });
  });
}

test('모바일 온보딩은3개 적합도순 추천을 유지한다', async ({ page }) => {
  const requests = await prepare(page, route => route.fulfill({ json: response(candidates.slice(0, 3), false) }));
  await page.goto('/studycrack-mobile.html?screen=ob4', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0]).toMatchObject({ recommendationCount: 3, recommendationMode: 'fit' });
  await expect(page.locator('.ob-uni-item.recommended')).toHaveCount(3);
});
