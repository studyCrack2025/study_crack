import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';

const candidates = ['safe', 'match', 'reach', 'safe', 'match', 'reach'].map((band, index) => ({
  school: `진단${index + 1}대학교`, major: '추천학과', currentScore: [160, 110, 90, 165, 115, 95][index], simScore: 170,
  recommendation: { band, basis: 'display_score', convertedScore: 700 + index, estimatedCut: 700,
    marginToCut: index, reasonCodes: ['ELIGIBILITY_CONFIRMED'] }
}));
function response({ selected = [], reasons = [], notices = [], more = false, version = 'diagnostics-v1' } = {}) {
  return { selected, page: { hasMore: more, nextCursor: more ? 'diagnostic-next-page' : null },
    selectionSummary: { mode: 'balanced', requestedCount: 6, returnedCount: selected.length,
      missing: { safe: 0, match: 0, reach: selected.length < 6 ? 2 : 0 },
      diagnostics: { version, reasonCodes: reasons, noticeCodes: notices, message: '<img src=x onerror="window.diagnosticInjection=1">PRIVATE_ERROR' } } };
}
async function prepare(page, platform, responder) {
  await page.setViewportSize({ width: platform === 'mobile' ? 320 : 390, height: 850 });
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic', userOverrides: { targetUnivs: [{ univ: '기존대학교', major: '목표학과' }], univChangeRemaining: 3 } });
  const requests = [];
  await page.route('**/api/**', route => {
    const payload = route.request().postDataJSON();
    if (['get_login_profile', 'get_user'].includes(payload?.type)) return route.fulfill({ json: { ...mockUser, tutorialRewardClaimed: true } });
    if (payload?.type !== 'get_tutorial_recommendations') return route.fallback();
    requests.push(payload); return responder(route, payload, requests.length);
  });
  if (platform === 'mobile') await page.goto('/studycrack-mobile.html?screen=addUniversity', { waitUntil: 'domcontentloaded' });
  else {
    await page.goto('/analysis.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pageLoadingOverlay')).toBeHidden();
    await page.evaluate(() => window.openUnivSelectModal(2));
    await page.locator('#recommendBtn').click();
  }
  return {
    requests,
    area: page.locator(platform === 'mobile' ? '.add-univ-section' : '#stepUnivList').first(),
    cards: page.locator(platform === 'mobile' ? '.add-univ-card' : '.selection-item-recommend'),
    refresh: page.locator(platform === 'mobile' ? '[data-action="refreshUniversityRecommendations"]' : '#recommendBtn')
  };
}

for (const platform of ['mobile', 'web']) {
  test(`${platform}: 빈 추천의 과목·계산·최소점수·제외·상승 원인을 구분한다`, async ({ page }, info) => {
    const cases = [
      ['SUBJECT_REQUIREMENTS_NOT_MET', '선택과목 조건으로 후보가 제외되었습니다'],
      ['CANDIDATE_EVALUATION_FAILED', '일부 후보를 계산하지 못했습니다'],
      ['MINIMUM_CURRENT_SCORE_NOT_MET', '설정한 현재 점수 기준으로 후보가 제외되었습니다'],
      ['MATCHES_EXCLUDED_BY_REQUEST', '제외 목록에 포함된 후보는 표시하지 않았습니다'],
      ['MINIMUM_SIMULATION_SCORE_NOT_MET', '설정한 상승 후 점수 기준으로 후보가 제외되었습니다'],
      ['NO_ADMISSION_FILTER_MATCH', '선택한 연도·지역·모집군에 맞는 검수 후보가 없습니다']
    ];
    const ui = await prepare(page, platform, (route, _payload, number) => route.fulfill({ json: response({ reasons: [cases[number - 1][0]], notices: number === 5 ? ['SIMULATION_DATA_UNAVAILABLE'] : [] }) }));
    for (const [index, [code, message]] of cases.entries()) {
      if (index) await ui.refresh.click();
      await expect(ui.area).toContainText(message); await expect(ui.cards).toHaveCount(0);
      if (code === 'CANDIDATE_EVALUATION_FAILED') await expect(ui.area).not.toContainText('선택과목 조건으로');
      if (code === 'MINIMUM_SIMULATION_SCORE_NOT_MET') await expect(ui.area).toContainText('원점수 상승 자료가 없어 현재 점수로 비교했습니다');
      expect(ui.requests[index]).toMatchObject({ recommendationCount: 6, recommendationMode: 'balanced' });
      expect(ui.requests[index].cursor).toBeUndefined();
    }
    const direct = platform === 'mobile' ? page.getByRole('button', { name: '직접 추가하기 →' }) : page.getByRole('button', { name: '← 전체 대학 목록 보기' });
    await expect(direct).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(platform === 'mobile' ? 321 : 391);
    await ui.area.screenshot({ path: info.outputPath(`${platform}-empty-diagnostic.png`) });
  });

  test(`${platform}: 부분 추천과 마지막 페이지 설명을 갱신하고 처음부터 다시 볼 수 있다`, async ({ page }, info) => {
    const partial = candidates.filter(item => item.recommendation.band !== 'reach');
    const ui = await prepare(page, platform, (route, payload) => route.fulfill({ json: payload.cursor
      ? response({ selected: [candidates[2]], reasons: ['PAGE_EXHAUSTED'] })
      : response({ selected: partial, more: true, reasons: ['REQUESTED_BANDS_UNAVAILABLE'] }) }));
    await expect(ui.cards).toHaveCount(4); await expect(ui.area).toContainText('요청한 안정·적정·상향 구성을 채울 후보가 부족합니다');
    await expect(ui.area).toContainText('상향 2개');
    await ui.refresh.click(); await expect(ui.cards).toHaveCount(1); await expect(ui.area).toContainText('현재 조건에 맞는 후보를 모두 확인했습니다');
    await expect(ui.area).not.toContainText('요청한 안정·적정·상향 구성을 채울 후보가 부족합니다');
    expect(ui.requests[1].cursor).toBe('diagnostic-next-page');
    await expect(ui.refresh).toContainText('처음 추천 다시 보기');
    await ui.area.screenshot({ path: info.outputPath(`${platform}-last-page-diagnostic.png`) });
    await ui.refresh.click(); await expect(ui.cards).toHaveCount(4); expect(ui.requests[2].cursor).toBeUndefined();
  });

  test(`${platform}: 정상 후보에서도 자료 누락 안내만 표시하고 원점수 미보유를 부족 원인으로 단정하지 않는다`, async ({ page }) => {
    const ui = await prepare(page, platform, route => route.fulfill({ json: response({ selected: candidates,
      notices: ['CANDIDATE_DATA_GAPS', 'SIMULATION_DATA_UNAVAILABLE'] }) }));
    await expect(ui.cards).toHaveCount(6); await expect(ui.area).toContainText('일부 후보의 자료를 확인하지 못해 확인 가능한 후보만 표시했습니다');
    await expect(ui.area).not.toContainText('원점수 상승 자료가 없어 현재 점수로 비교했습니다');
    await expect(ui.area).not.toContainText('후보 부족');
    await expect(ui.area).toContainText('합격 확률이 아닙니다');
  });

  test(`${platform}: 구버전·잘못된 진단은 기존 안내를 유지하며 응답 원문과 알 수 없는 코드를 출력하지 않는다`, async ({ page }) => {
    const unknown = '<img src=x onerror="window.diagnosticInjection=1">';
    const ui = await prepare(page, platform, (route, _payload, number) => route.fulfill({ json: response({
      reasons: number === 1 ? [unknown, '__proto__', 'constructor'] : number === 2 ? { code: 'SUBJECT_REQUIREMENTS_NOT_MET' } : ['SUBJECT_REQUIREMENTS_NOT_MET'],
      notices: 'CANDIDATE_DATA_GAPS', version: number === 3 ? 'unknown-version' : 'diagnostics-v1'
    }) }));
    for (let number = 1; number <= 3; number++) {
      if (number > 1) await ui.refresh.click();
      await expect(ui.area).toContainText(platform === 'mobile' ? '이미 등록한 대학은 제외돼요' : '현재 조건에 맞는 남은 후보가 없습니다');
      await expect(ui.area).not.toContainText('PRIVATE_ERROR'); await expect(ui.area).not.toContainText('__proto__');
      await expect(ui.area).not.toContainText('선택과목 조건으로 후보가 제외되었습니다');
      await expect(ui.area.locator('img')).toHaveCount(0); expect(await page.evaluate(() => window.diagnosticInjection)).toBeUndefined();
    }
  });
}
