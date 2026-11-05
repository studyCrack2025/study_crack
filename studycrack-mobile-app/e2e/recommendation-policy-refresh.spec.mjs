import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';

const candidate = (index) => ({ school: `후보${index}대학교`, major: '추천학과', currentScore: 110, simScore: 130 });
const snapshot = { version: 'tutorial-all-majors-v1|academic-input-v1|strict-pages-v1', fingerprint: 'a'.repeat(64), dataVersion: 'b'.repeat(64), generatedAt: '2026-11-04T01:02:03.000Z' };
const pageResult = (index, hasMore = true) => ({ selected: [candidate(index)], page: { nextCursor: hasMore ? `page-${index + 1}` : null, hasMore, exhausted: !hasMore }, snapshot });
const recommendationRequests = api => api.requests.filter(item => item.payload.type === 'get_tutorial_recommendations');

async function mobile(page, responder) {
  page.on('dialog', dialog => dialog.accept());
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { tier: 'basic', userOverrides: { targetUnivs: [{ univ: '기존대학교', major: '목표학과' }], univChangeRemaining: 5 } });
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.type !== 'get_tutorial_recommendations') return route.fallback();
    api.requests.push({ payload });
    return responder(route, payload, recommendationRequests(api).length);
  });
  await page.goto('/studycrack-mobile.html?screen=addUniversity', { waitUntil: 'domcontentloaded' });
  return api;
}

test('모바일 다른 후보 보기는 다음 페이지와 마지막 안내를 구분한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const api = await mobile(page, (route, payload) => route.fulfill({ json: payload.cursor ? pageResult(2, false) : pageResult(1) }));
  await expect(page.locator('.add-univ-grid')).toContainText('후보1대학교');
  await page.getByRole('button', { name: '다른 후보 보기', exact: true }).click();
  await expect(page.locator('.add-univ-grid')).toContainText('후보2대학교');
  await expect(page.locator('.add-univ-grid')).not.toContainText('후보1대학교');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.locator('.add-univ-section').first().screenshot({ path: info.outputPath('recommendation-last-page-320.png') });
  expect(recommendationRequests(api)[1].payload.cursor).toBe('page-2');
  await page.getByRole('button', { name: '처음 추천 다시 보기', exact: true }).click();
  await expect(page.locator('.add-univ-grid')).toContainText('후보1대학교');
  expect(recommendationRequests(api)[2].payload.cursor).toBeUndefined();
});

test('모바일 다음 페이지 실패는 같은 cursor로 재시도한다', async ({ page }) => {
  const api = await mobile(page, (route, payload, count) => count === 2
    ? route.fulfill({ status: 503, json: { error: 'temporary' } }) : route.fulfill({ json: payload.cursor ? pageResult(2, false) : pageResult(1) }));
  await expect(page.locator('.add-univ-grid')).toContainText('후보1대학교');
  await page.getByRole('button', { name: '다른 후보 보기', exact: true }).click();
  await expect(page.locator('.add-univ-grid')).toContainText('추천을 불러오지 못했어요');
  await page.getByRole('button', { name: '다시 시도', exact: true }).first().click();
  await expect(page.locator('.add-univ-grid')).toContainText('후보2대학교');
  expect(recommendationRequests(api).slice(1).map(item => item.payload.cursor)).toEqual(['page-2', 'page-2']);
});

test('모바일 만료된 cursor는 안내 후 첫 페이지부터 확인한다', async ({ page }) => {
  const api = await mobile(page, (route, payload, count) => count === 2
    ? route.fulfill({ status: 409, json: { code: 'RECOMMENDATION_CURSOR_STALE' } }) : route.fulfill({ json: pageResult(1) }));
  await expect(page.locator('.add-univ-grid')).toContainText('후보1대학교');
  await page.getByRole('button', { name: '다른 후보 보기', exact: true }).click();
  await expect(page.locator('.add-univ-grid')).toContainText('성적이나 추천 기준이 변경되었습니다');
  await page.getByRole('button', { name: '다시 시도', exact: true }).first().click();
  await expect(page.locator('.add-univ-grid')).toContainText('후보1대학교');
  expect(recommendationRequests(api).at(-1).payload.cursor).toBeUndefined();
});

test('모바일 목표 추가 후 제외 조건과 추천 페이지를 갱신한다', async ({ page }) => {
  const api = await mobile(page, (route, payload) => route.fulfill({ json: pageResult(payload.excludeUnivs.some(item => item.univ === '후보1대학교') ? 2 : 1) }));
  await expect(page.locator('.add-univ-grid')).toContainText('후보1대학교');
  expect(recommendationRequests(api)[0].payload.excludeUnivs).toContainEqual(expect.objectContaining({ univ: '기존대학교', major: '목표학과' }));
  await page.locator('.add-univ-grid').getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.locator('.add-univ-grid')).toContainText('후보2대학교');
  const last = recommendationRequests(api).at(-1).payload;
  expect(last.cursor).toBeUndefined();
  expect(last.excludeUnivs).toContainEqual(expect.objectContaining({ univ: '후보1대학교', major: '추천학과' }));
});

async function web(page, responder) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic', userOverrides: { targetUnivs: [{ univ: '기존대학교', major: '목표학과' }], univChangeRemaining: 5 } });
  const requests = [];
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (['get_login_profile', 'get_user'].includes(payload?.type)) return route.fulfill({ json: { ...mockUser, tutorialRewardClaimed: true } });
    if (payload?.type !== 'get_tutorial_recommendations') return route.fallback();
    requests.push(payload); return responder(route, payload, requests.length);
  });
  await page.goto('/analysis.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#pageLoadingOverlay')).toBeHidden();
  await page.evaluate(() => window.openUnivSelectModal(2));
  return requests;
}

test('웹 추천은 저장 목표를 제외하고 다음 후보를 표시한다', async ({ page }) => {
  const requests = await web(page, (route, payload) => route.fulfill({ json: payload.cursor ? pageResult(2, false) : pageResult(1) }));
  await page.locator('#recommendBtn').click();
  await expect(page.locator('#stepUnivList')).toContainText('후보1대학교');
  expect(requests[0].excludeUnivs).toContainEqual({ univ: '기존대학교', major: '목표학과' });
  await page.getByRole('button', { name: '다른 후보 보기', exact: true }).click();
  await expect(page.locator('#stepUnivList')).toContainText('후보2대학교');
  await expect(page.locator('#stepUnivList')).not.toContainText('후보1대학교');
  expect(requests[1].cursor).toBe('page-2');
  await expect(page.getByRole('button', { name: '처음 추천 다시 보기', exact: true })).toBeVisible();
});

test('웹 빈 추천을 기존 목표로 다시 채우지 않는다', async ({ page }) => {
  await web(page, route => route.fulfill({ json: { ...pageResult(1, false), selected: [] } }));
  await page.locator('#recommendBtn').click();
  await expect(page.locator('#stepUnivList')).toContainText('현재 조건에 맞는 남은 후보가 없습니다');
  await expect(page.locator('#stepUnivList .selection-item-recommend')).toHaveCount(0);
});

async function tutorial(page, responder, { saveConflict = false } = {}) {
  await installAuthenticatedSession(page);
  await page.addInitScript(() => localStorage.setItem('tut_selectedUnivs', JSON.stringify([{ school: '다른계정과거대학', major: '옛학과', currentScore: 250, simScore: 250 }])));
  await installApiMock(page);
  const requests = [], saves = [];
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (['get_user_analysis', 'get_login_profile', 'get_user'].includes(payload?.type)) return route.fulfill({ json: {
      ...mockUser, qualitative: { stream: '자연/공학', tutorialUniv: { univ: '확정목표대학교', major: '목표학과' } },
      tutorialRewardClaimed: false, tutorialStatus: 4, recommendationInputRevision: 7,
      tut_selectedUnivs: [{ school: '서버과거대학', major: '옛학과', currentScore: 250, simScore: 250 }]
    } });
    if (payload?.type === 'get_tutorial_recommendations') { requests.push(payload); return responder(route, payload, requests.length); }
    if (payload?.type === 'update_tutorial_status' && payload.data.selectedUnivs) {
      saves.push(payload.data);
      return saveConflict ? route.fulfill({ status: 409, json: { code: 'RECOMMENDATION_INPUT_CHANGED' } }) : route.fulfill({ json: { success: true } });
    }
    if (['update_qual', 'update_quan'].includes(payload?.type)) return route.fulfill({ json: { success: true, recommendationInputRevision: 8 } });
    return route.fallback();
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/tutorial.html', { waitUntil: 'domcontentloaded' });
  return { requests, saves };
}

test('튜토리얼 재진입은 오래된 저장 추천 대신 현재 추천과 revision을 저장한다', async ({ page }) => {
  const api = await tutorial(page, (route, payload) => route.fulfill({ json: payload.cursor ? pageResult(2, false) : pageResult(1) }));
  await expect(page.locator('#univCardList')).toContainText('후보1대학교');
  await expect(page.locator('#univCardList')).not.toContainText('과거대학');
  expect(await page.evaluate(() => localStorage.getItem('tut_selectedUnivs'))).toBeNull();
  expect(api.saves[0]).toMatchObject({ expectedRecommendationRevision: 7, recommendationSnapshot: snapshot, selectedUnivs: [candidate(1)] });
  expect(api.requests[0]).toMatchObject({ examMode: 'jun', minCurrentScore: 100, minSimScore: 125 });
  await page.getByRole('button', { name: '다른 후보 보기', exact: true }).click();
  await expect(page.locator('#univCardList')).toContainText('후보2대학교');
  expect(api.requests[1].cursor).toBe('page-2');
  await page.locator('.univ-card').click();
  await expect(page.locator('#tutNextBtn')).toBeEnabled();
});

test('튜토리얼 후보 부족은 조건을 자동 완화하지 않고 명시적인 선택만 허용한다', async ({ page }) => {
  const api = await tutorial(page, (route, payload) => route.fulfill({ json: payload.minCurrentScore === 0 ? pageResult(1, false) : { ...pageResult(1, false), selected: [] } }));
  await expect(page.locator('#univCardList')).toContainText('현재 조건에 맞는 남은 후보가 없습니다');
  expect(api.requests).toHaveLength(1);
  await expect(page.locator('#tutNextBtn')).toBeDisabled();
  await page.getByRole('button', { name: '점수 제한 없이 다시 추천', exact: true }).click();
  await expect(page.locator('#univCardList')).toContainText('후보1대학교');
  expect(api.requests[1]).toMatchObject({ examMode: 'jun', minCurrentScore: 0, minSimScore: 0 });
});

test('튜토리얼 저장 충돌은 과거 카드로 덮어쓰지 않고 입력 변경을 알린다', async ({ page }) => {
  const api = await tutorial(page, route => route.fulfill({ json: pageResult(1, false) }), { saveConflict: true });
  await expect(page.locator('#univCardList')).toContainText('성적 또는 희망 계열이 변경되었습니다');
  await expect(page.locator('.univ-card')).toHaveCount(0);
  expect(api.saves).toHaveLength(1);
});

test('튜토리얼 추천 대기 중 입력이 변경되면 오래된 응답을 저장하지 않는다', async ({ page }) => {
  let release;
  const api = await tutorial(page, async route => { await new Promise(resolve => { release = resolve; }); return route.fulfill({ json: pageResult(1, false) }); });
  await expect.poll(() => typeof release).toBe('function');
  await page.evaluate(() => apiCall('update_quan', tutorialData.quan));
  const completed = page.waitForResponse(response => {
    try { return response.request().postDataJSON()?.type === 'get_tutorial_recommendations'; } catch { return false; }
  });
  release();
  await (await completed).finished();
  await expect(page.locator('#univCardList')).toContainText('입력 정보가 변경되었습니다');
  await expect.poll(() => page.evaluate(() => tutorialData.selectedUnivs)).toBeNull();
  expect(api.saves).toHaveLength(0);
  await expect(page.locator('.univ-card')).toHaveCount(0);
});
