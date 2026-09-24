import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
async function setup(page, options = {}) {
  await page.clock.setFixedTime(new Date('2026-09-07T03:00:00Z'));
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, options);
  const species = api.state.fishCatalog[0];
  const fish = { fishId: 'dex-owned', speciesId: species.speciesId, name: '첫 친구', level: 2, exp: 30, currentLevelExp: 0, nextLevelExp: 90, progressPct: 25, growthStage: 'young', acquiredAt: '2026-09-05T16:00:00Z' };
  api.state.fishInventory = [fish];
  api.state.activeFish = [null, fish, null];
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: [null, fish.fishId, null] };
  return api;
}

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`도감은 전폭·독립 탐색과 획득일을 표시한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const api = await setup(page);
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    const trigger = page.locator('[data-action="openAquariumCatalog"]');
    await trigger.scrollIntoViewIfNeeded();
    await expect(trigger).toBeInViewport();
    await trigger.click();
    await expect(page.locator('.tabbar')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '물고기 도감' })).toBeFocused();
    const hero = await page.locator('.aquarium-catalog-hero').boundingBox();
    expect(hero.x).toBe(0);
    expect(hero.width).toBe(width);
    const card = page.locator('.aquarium-catalog-group article[data-state="owned"]').first();
    await expect(card).toContainText('획득일 · 2026. 09. 06.');
    const box = await card.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(174);
    await expect(card.locator('.aquarium-catalog-sprite')).toHaveCSS('width', '80px');
    await expect(card.locator('.aquarium-catalog-card-meta')).toContainText('일반');
    await expect(page.locator('.aquarium-catalog-group article[data-state="locked"]').first()).toContainText('공부로 모은 조개');
    await page.screenshot({ path: testInfo.outputPath(`fishdex-${width}.png`), animations: 'disabled' });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`fishdex-cards-${width}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: '획득', exact: true }).click();
    await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(1);
    await page.getByRole('button', { name: '수조로 돌아가기' }).click();
    await expect(trigger).toBeFocused();
    await expect(trigger).toBeInViewport();
    await expect(page.locator('.tabbar')).toHaveCount(1);
    await trigger.click();
    await expect(page.getByRole('button', { name: '획득', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(1);
    expect(api.requests.filter(({ payload }) => ['draw_fish', 'feed_fish', 'acknowledge_fish_draw', 'set_active_fish', 'rename_fish'].includes(payload.type))).toHaveLength(0);
    expect(api.requests.filter(({ payload }) => payload.type === 'get_fish_catalog')).toHaveLength(1);
    await expectNoHorizontalOverflow(page);
  });
}

test('생태 필터는 접힌 상태를 알리고 선택·키보드·스크롤을 보존한다', async ({ page }) => {
  const catalog = Array.from({ length: 18 }, (_, i) => ({ speciesId: `dex_${i}`, displayName: `긴 한글 물고기 이름 ${i}`, defaultName: '친구', colors: ['#3F6FD9', '#9DD9F2'], rarity: i < 16 ? 'common' : 'special', category: i % 2 ? 'marine_fish' : 'freshwater' }));
  await setup(page, { fishCatalog: catalog });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.locator('[data-action="openAquariumCatalog"]').click();
  const disclosure = page.getByRole('button', { name: /생태 분류 ·/ });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await disclosure.press('Enter');
  await page.getByRole('button', { name: '민물', exact: true }).click();
  await disclosure.click();
  await expect(disclosure).toContainText('민물');
  await expect(page.getByRole('group', { name: '생태 분류' })).toBeHidden();
  const all = page.getByRole('button', { name: '전체', exact: true });
  await all.press('ArrowRight');
  await expect(page.getByRole('button', { name: '획득', exact: true })).toBeFocused();
  await expect(page.locator('.aquarium-catalog-group article')).toHaveCount(1);
  await expect(page.locator('.aquarium-catalog-group article')).toContainText('획득일 ·');
  await all.click();
  const content = page.locator('.app-content');
  await content.evaluate(el => { el.scrollTop = 550; });
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBe(550);
  // Activate the visible mode control without scrolling the catalog back to its header.
  await page.locator('[data-action="closeAquariumMode"]').evaluate(el => el.click());
  await page.locator('[data-action="openAquariumCatalog"]').click();
  await expect(disclosure).toContainText('민물');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBe(550);
  await expectNoHorizontalOverflow(page);
});

test('도감 실패·재시도·빈 목록·누락 획득일은 임의 기록으로 바뀌지 않는다', async ({ page }) => {
  const api = await setup(page, { failOnceTypes: ['get_fish_catalog'] });
  delete api.state.fishInventory[0].acquiredAt;
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.locator('[data-action="openAquariumCatalog"]').click();
  await expect(page.locator('.aquarium-catalog-status')).toContainText('불러오지 못했어요');
  await expect(page.locator('.tabbar')).toHaveCount(0);
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.locator('.aquarium-catalog-group article[data-state="owned"]')).toContainText('획득일 확인 필요');
  api.state.fishCatalog = [];
  await page.reload();
  await page.locator('[data-action="openAquariumCatalog"]').click();
  await expect(page.locator('.aquarium-catalog-status')).toContainText('아직 비어 있어요');
  await expect(page.locator('.aquarium-collection-summary')).toHaveCount(0);
});
