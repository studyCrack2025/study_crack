import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });

async function setup(page, options) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, options);
  api.state.fishInventory = api.state.fishCatalog.slice(0, 2).map((species, index) => ({ fishId: `fish_care_${index}`, speciesId: species.speciesId, name: index ? '마루' : '코랄', level: 1, exp: 0, currentLevelExp: 0, nextLevelExp: 30, progressPct: 0, growthStage: 'young' }));
  api.state.activeFish = [api.state.fishInventory[0], null, null];
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: ['fish_care_0', null, null] };
  return api;
}
const requestCount = (api, type) => api.requests.filter(({ payload }) => payload.type === type).length;
const openManagement = page => page.locator('.aquarium-management > summary').click();
const effect = page => page.locator('[data-care-effect]');

for (const width of [320, 360, 390, 430]) {
  test(`관리 패널을 접고 이름 draft·선택 상태를 보존한다 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 932 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const api = await setup(page);
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    await expect(page.getByRole('button', { name: '먹이 주기', exact: true })).toBeVisible();
    await expect(page.locator('.aquarium-management')).not.toHaveAttribute('open');
    await page.screenshot({ path: info.outputPath(`care-top-${width}.png`), animations: 'disabled' });
    await page.locator('.aquarium-scene').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.locator('.aquarium-scene').screenshot({ path: info.outputPath(`care-scene-${width}.png`), animations: 'disabled' });
    await page.locator('.aquarium-care').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: info.outputPath(`care-collapsed-${width}.png`), animations: 'disabled' });
    await openManagement(page);
    const input = page.getByLabel('이름 변경', { exact: true });
    await input.fill('작성중');
    await openManagement(page);
    await openManagement(page);
    await expect(input).toHaveValue('작성중');
    await page.getByRole('button', { name: '마루 관리' }).click();
    await expect(input).toHaveValue('마루');
    await page.getByRole('button', { name: '코랄 관리' }).click();
    await expect(input).toHaveValue('작성중');
    await page.getByRole('button', { name: /물고기 도감/ }).click();
    await page.getByRole('button', { name: '수조로 돌아가기' }).click();
    await expect(input).toHaveValue('작성중');
    await input.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: info.outputPath(`care-expanded-${width}.png`), animations: 'disabled' });
    expect(requestCount(api, 'rename_fish')).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
}

test('급식 응답 전에는 효과·선택 전환이 없고 확정 후 한 번만 반응한다', async ({ page }, info) => {
  const api = await setup(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/**', async route => {
    if (route.request().postDataJSON()?.type === 'feed_fish') await gate;
    await route.fallback();
  });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '먹이 주기', exact: true }).click();
  await expect(page.getByRole('button', { name: '먹이를 주는 중...' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '코랄 선택' })).toBeDisabled();
  await expect(effect(page)).toHaveCount(0);
  release();
  await expect(effect(page)).toHaveAttribute('data-care-effect', 'feed');
  await expect(page.locator('.aquarium-care-result')).toContainText('EXP +10');
  await page.locator('.aquarium-scene').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.locator('.aquarium-scene').screenshot({ path: info.outputPath('care-feed.png') });
  await expect(effect(page)).toHaveCount(0);
  await page.locator('.aquarium-offline-state [data-action="retryGameResources"]').evaluate(el => el.click());
  await expect(page.locator('.aquarium-scene')).toBeVisible();
  await expect(effect(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.aquarium-scene')).toBeVisible();
  await expect(effect(page)).toHaveCount(0);
  expect(requestCount(api, 'feed_fish')).toBe(1);
});

for (const type of ['feed_fish', 'set_active_fish']) {
  test(`${type} 응답 유실은 상태 조회만 하며 자동 재전송·성공 효과가 없다`, async ({ page }) => {
    const api = await setup(page, { loseResponseOnceTypes: [type] });
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    if (type === 'feed_fish') await page.getByRole('button', { name: '먹이 주기', exact: true }).click();
    else {
      await openManagement(page);
      await page.getByRole('button', { name: '마루 관리' }).click();
      await page.locator('[data-action="setAquariumFishSlot"][data-slot="center"]').click();
    }
    await expect(page.getByText('처리 결과 확인이 필요해요')).toBeVisible();
    await expect(effect(page)).toHaveCount(0);
    await expect(page.locator('[data-action="feedAquariumFish"]')).toBeDisabled();
    await page.getByRole('button', { name: '현재 상태 확인' }).click();
    await expect(page.getByText('현재 먹이와 물고기 상태를 불러왔어요')).toBeVisible();
    await expect(effect(page)).toHaveCount(0);
    if (type === 'feed_fish') await expect(page.locator('.aquarium-feed-row b')).toHaveText('2개');
    else await expect(page.locator('.aquarium-fish.slot-center')).toHaveAttribute('aria-label', '마루 선택');
    expect(requestCount(api, type)).toBe(1);
    expect(requestCount(api, 'get_game_profile')).toBeGreaterThan(1);
    expect(requestCount(api, 'get_fish_catalog')).toBeGreaterThan(1);
  });
}

test('재조회 실패·잘못된 성공 응답은 잠금을 풀거나 급식을 반복하지 않는다', async ({ page }) => {
  const api = await setup(page);
  let failedRead = true;
  let feedRequests = 0;
  await page.route('**/api/**', async route => {
    const type = route.request().postDataJSON()?.type;
    if (type === 'feed_fish') { feedRequests++; return route.fulfill({ json: { success: true } }); }
    if (feedRequests && failedRead && type === 'get_fish_catalog') return route.fulfill({ status: 503, json: {} });
    await route.fallback();
  });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '먹이 주기', exact: true }).click();
  await page.getByRole('button', { name: '현재 상태 확인' }).click();
  await expect(page.getByText(/최신 상태를 확인하지 못했어요/)).toBeVisible();
  await expect(page.locator('[data-action="feedAquariumFish"]')).toBeDisabled();
  failedRead = false;
  await page.getByRole('button', { name: '현재 상태 확인' }).click();
  await expect(page.getByText('현재 먹이와 물고기 상태를 불러왔어요')).toBeVisible();
  expect(feedRequests).toBe(1);
  expect(requestCount(api, 'feed_fish')).toBe(0);
});

test('미확인 상태로 탭 왕복 후 본체 조회가 실패해도 상태 확인으로 복구한다', async ({ page }) => {
  const api = await setup(page, { loseResponseOnceTypes: ['feed_fish'] });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '먹이 주기', exact: true }).click();
  await expect(page.getByText('처리 결과 확인이 필요해요')).toBeVisible();
  await page.getByRole('button', { name: /공부해서 먹이 모으기/ }).click();
  await expect(page.locator('.home-aquarium-preview')).toBeVisible();
  let failProfile = true;
  await page.route('**/api/**', async route => {
    if (failProfile && route.request().postDataJSON()?.type === 'get_game_profile') return route.fulfill({ status: 503, json: {} });
    await route.fallback();
  });
  await page.getByRole('button', { name: /수조 전체 보기/ }).click();
  await expect(page.getByText('수조를 불러오지 못했어요', { exact: true })).toBeVisible();
  failProfile = false;
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.getByText('현재 먹이와 물고기 상태를 불러왔어요')).toBeVisible();
  await expect(page.locator('.aquarium-feed-row b')).toHaveText('2개');
  expect(requestCount(api, 'feed_fish')).toBe(1);
});

test('보관 물고기의 실제 합류만 반응하고 이동·해제는 합류로 꾸미지 않는다', async ({ page }, info) => {
  const api = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await openManagement(page);
  await page.getByRole('button', { name: '마루 관리' }).click();
  await page.locator('[data-action="setAquariumFishSlot"][data-slot="center"]').click();
  await expect(effect(page)).toHaveAttribute('data-care-effect', 'arrival');
  await expect(page.locator('.aquarium-manage-result')).toContainText('수조에 합류');
  await page.locator('.aquarium-scene').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.locator('.aquarium-scene').screenshot({ path: info.outputPath('care-arrival.png') });
  await expect(effect(page)).toHaveCount(0);
  await page.locator('[data-action="setAquariumFishSlot"][data-slot="right"]').click();
  await expect(page.locator('.aquarium-manage-result')).toContainText('선택한 위치');
  await expect(effect(page)).toHaveCount(0);
  await page.locator('[data-action="setAquariumFishSlot"][data-slot="right"]').click();
  await expect(page.locator('.aquarium-manage-result')).toContainText('잠시 쉬도록');
  await expect(effect(page)).toHaveCount(0);
  expect(requestCount(api, 'set_active_fish')).toBe(3);
});

test('감속 모드는 효과 이동 없이 결과를 제공하고 hidden 뒤 재생하지 않는다', async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '먹이 주기', exact: true }).click();
  await expect(effect(page).locator('.aquarium-fish-body')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.aquarium-care-result')).toContainText('EXP +10');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(effect(page)).toHaveCount(0);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(effect(page)).toHaveCount(0);
});
