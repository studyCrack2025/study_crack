import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';

const candidate = { school: '시험기준대학교', major: '검증학과', currentScore: 108.7, simScore: 111.2,
  recommendation: { band: 'match', basis: 'display_score', convertedScore: 708.7, estimatedCut: 700, marginToCut: 8.7 },
  simulation: { status: 'available', subject: 'math', rawIncrease: 2, originalRaw: 70, projectedRaw: 72,
    rawSource: 'recorded', combinationEstimated: false, uiGain: 2.5, onePointUiGain: 0 } };
const snapshot = { version: 'tutorial-all-majors-v1|academic-input-v1|portfolio-v1|exam-basis-v1', fingerprint: 'a'.repeat(64), dataVersion: 'b'.repeat(64), generatedAt: '2026-11-04T01:02:03.000Z' };
const recommendation = selected => ({ selected: [selected], page: { hasMore: false, nextCursor: null }, snapshot });
async function prepare(page, selected = candidate, { tutorial = false, csat = false } = {}) {
  await installAuthenticatedSession(page);
  const user = { ...mockUser, tutorialRewardClaimed: !tutorial, tutorialStatus: tutorial ? 4 : null, recommendationInputRevision: 4,
    ...(csat ? { quantitative: { csat: mockUser.quantitative.jun } } : {}) };
  await installApiMock(page, { tier: 'basic', userOverrides: user });
  await page.route('**/api/**', route => {
    const payload = route.request().postDataJSON();
    if (['get_login_profile', 'get_user', 'get_user_analysis'].includes(payload?.type)) return route.fulfill({ json: user });
    if (payload?.type === 'get_tutorial_recommendations') {
      if (csat) expect(payload.examMode).toBe('csat');
      return route.fulfill({ json: recommendation(selected) });
    }
    if (payload?.type === 'update_tutorial_status') return route.fulfill({ json: { success: true } });
    if (payload?.type === 'update_qual') return route.fulfill({ json: { success: true, recommendationInputRevision: 5 } });
    return route.fallback();
  });
  page.on('dialog', dialog => dialog.accept());
}

test('모바일 추천은 실제 +2점 경로와 표시 점수 상승을 구분한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await prepare(page);
  await page.goto('/studycrack-mobile.html?screen=addUniversity', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.add-univ-card')).toContainText('수학 원점수 +2점 → 표시 점수 +2.5점');
  await expect(page.locator('.add-univ-card')).not.toContainText('원점수 +1점');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.locator('.add-univ-section').first().screenshot({ path: info.outputPath('simulation-evidence-320.png') });
});

test('수능 추천은 현재 점수를 보여주면서 원점수 상승 자료 부족을 표시한다', async ({ page }) => {
  await prepare(page, { ...candidate, simScore: candidate.currentScore, simulation: { status: 'unavailable', code: 'RAW_SCORE_DATA_UNAVAILABLE' } }, { csat: true });
  await page.goto('/studycrack-mobile.html?screen=addUniversity', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.add-univ-card')).toContainText('시험기준대학교');
  await expect(page.locator('.add-univ-card')).toContainText('원점수 상승 자료 없음 · 현재 점수 기준 추천');
  await expect(page.locator('.add-univ-card')).not.toContainText('원점수 +1점');
});

test('추정 원점수나 공통·선택 조합은 추정 기준으로 표시한다', async ({ page }) => {
  await prepare(page, { ...candidate, simulation: { ...candidate.simulation, rawSource: 'percentile_estimate' } });
  await page.goto('/studycrack-mobile.html?screen=addUniversity', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.add-univ-card')).toContainText('추정 기준 · 수학 원점수 +2점');
});

test('웹 추천도 실제 상승 과목과 원점수 증가량을 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page);
  await page.goto('/analysis.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#pageLoadingOverlay')).toBeHidden();
  await page.evaluate(() => window.openUnivSelectModal(2));
  await page.locator('#recommendBtn').click();
  await expect(page.locator('.selection-item-recommend')).toContainText('수학 원점수 +2점 → 표시 점수 +2.5점');
});

test('튜토리얼은 소수 점수를 보존하고 1점 고정 문구를 표시하지 않는다', async ({ page }) => {
  await prepare(page, candidate, { tutorial: true });
  await page.goto('/tutorial.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.univ-card')).toHaveCount(1);
  await page.locator('.univ-card').click();
  await expect(page.locator('.tutorial-simulation-evidence')).toBeVisible();
  await expect(page.locator('.tutorial-simulation-evidence')).toContainText('수학 원점수 +2점 → 표시 점수 +2.5점');
  await expect(page.locator('.sbc-current-label')).toContainText('108.7점');
  await expect(page.locator('.sbc-current-label')).toContainText('111.2점');
  await expect(page.locator('#univCardList')).not.toContainText('1점 상승 시뮬레이션');
});
