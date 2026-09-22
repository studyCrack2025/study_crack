import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`수조와 공유 미리보기는 같은 세 슬롯을 유지한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-09-06T03:00:00Z'));
    await installAuthenticatedSession(page);
    const api = await installApiMock(page);
    const fish = api.state.fishCatalog.slice(0, 3).map((species, index) => ({
      fishId: `scene-${index}`, speciesId: species.speciesId, name: `친구 ${index + 1}`,
      level: 2, exp: 30, progressPct: 25, growthStage: 'growing', rarity: 'common'
    }));
    api.state.activeFish = fish;
    api.state.fishInventory = fish;
    api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: fish.map(item => item.fishId), streakDays: 12 };
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    const scene = page.locator('.aquarium-scene');
    await expect(scene.locator('.aquarium-fish')).toHaveCount(3);
    await expect(scene.locator('.aquarium-fish-artwork')).toHaveClass(/is-loaded/);
    await expect(scene).toHaveCSS('border-radius', '24px');
    await expect(scene).toHaveCSS('border-top-width', '1px');
    await expect(scene).toHaveCSS('height', '278px');
    await page.evaluate(() => document.fonts.ready);
    const capture = async (mode) => {
      const file = `${mode}-${width}.png`;
      await scene.screenshot({ path: process.env.STUDYCRACK_SCENE_CAPTURE_DIR ? resolve(process.env.STUDYCRACK_SCENE_CAPTURE_DIR, file) : testInfo.outputPath(file), animations: 'disabled' });
    };
    await capture('full');
    await page.locator('[data-action="openAquariumShare"]').click();
    await expect(page.locator('.aquarium-share-card')).toBeVisible();
    await expect(scene.locator('.aquarium-fish')).toHaveCount(3);
    await expect(scene.locator('.aquarium-scene-hud')).toContainText('12일');
    await expect(scene.locator('.aquarium-scene-hud')).toContainText('0/1');
    await expect(scene.locator('button')).toHaveCount(0);
    await expect(scene).toHaveCSS('border-radius', '24px');
    await expect(scene.locator('.aquarium-fish-name')).toHaveCount(0);
    await expect(page.locator('.aquarium-share-stats')).toContainText('3 / 12종');
    await expect(scene.locator('.aquarium-fish-artwork')).toHaveClass(/is-loaded/);
    await capture('share');
    await page.screenshot({ path: testInfo.outputPath(`share-page-${width}.png`), fullPage: true, animations: 'disabled' });
    const submit = page.locator('[data-action="shareAquarium"]');
    await submit.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await expect(submit).toBeInViewport({ ratio: 1 });
    const buttonBox = await submit.boundingBox();
    const navBox = await page.getByRole('navigation').boundingBox();
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(navBox.y);
    await page.screenshot({ path: testInfo.outputPath(`share-controls-${width}.png`), animations: 'disabled' });
    await expectNoHorizontalOverflow(page);
  });
}

test('보유 세 마리와 수집 한 종을 구분하고 공유에서도 같은 기록을 쓴다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.addInitScript(() => {
    window.__aquariumSharePayloads = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => window.__aquariumSharePayloads.push(payload) });
  });
  const api = await installApiMock(page);
  api.state.fishCatalog = api.state.fishCatalog.slice(0, 2);
  const fish = Array.from({ length: 3 }, (_, index) => ({ fishId: `same-species-${index}`, speciesId: api.state.fishCatalog[0].speciesId, name: `친구 ${index + 1}`, level: 1, exp: 0, progressPct: 0, growthStage: 'young', rarity: 'common' }));
  api.state.activeFish = fish;
  api.state.fishInventory = fish;
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: fish.map(item => item.fishId), streakDays: 7 };
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('[data-action="openAquariumCatalog"]')).toContainText('1 / 2종');
  const resourceRequests = () => api.requests.filter(({ payload }) => ['get_game_profile', 'get_fish_catalog', 'get_pending_draw'].includes(payload.type)).map(({ payload }) => payload.type);
  await expect.poll(resourceRequests).toHaveLength(3);
  const before = resourceRequests();
  await page.locator('[data-action="openAquariumShare"]').click();
  await expect(page.locator('.aquarium-share-stats')).toContainText('1 / 2종');
  await expect(page.locator('.aquarium-share-stats')).toContainText('3마리');
  await expect(page.locator('.aquarium-scene-hud')).toContainText('7일');
  await page.locator('[data-action="shareAquarium"]').click();
  await expect(page.getByText('기록과 링크 공유를 완료했어요.')).toBeVisible();
  const payloads = await page.evaluate(() => window.__aquariumSharePayloads);
  expect(payloads).toHaveLength(1);
  expect(payloads[0].text).toBe('공부로 키운 나의 수조: 물고기 1/2종 · 연속 학습 7일');
  expect(payloads[0].url).toMatch(/\/studycrack-mobile\.html$/);
  expect(payloads[0].text).not.toMatch(/친구|예시학생|3\/12/);
  expect(resourceRequests()).toEqual(before);
});

test('도감 조회 실패를 가짜 수집 수로 표시하지 않고 확인된 0일은 유지한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { failGameTypes: ['get_fish_catalog'], initialGameProfile: { streakDays: 0 } });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('.aquarium-resource-notice')).toBeVisible();
  await expect(page.locator('[data-action="openAquariumCatalog"]')).toContainText('수집 정보 확인 필요');
  await expect(page.locator('[data-action="openAquariumCatalog"]')).not.toContainText('/ 12');
  await expect(page.locator('.aquarium-scene-hud')).toContainText('성장 기록 확인 필요');
  await expect(page.locator('.aquarium-scene-hud')).not.toContainText('0일');
});
