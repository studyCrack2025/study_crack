import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
const dialog = page => page.getByRole('dialog', { name: '물고기 발견 결과' });
const requests = (api, type) => api.requests.filter(({ payload }) => payload.type === type);

async function setup(page, { rarity = 'rare', duplicate = false, refund = 0, pending = true, ...options } = {}) {
  await page.clock.setFixedTime(new Date('2026-09-07T03:00:00Z'));
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, options);
  const fish = { fishId: 'discovery-fish', speciesId: 'butterflyfish', name: '나비', level: refund ? 10 : 2, exp: 30, currentLevelExp: 0, nextLevelExp: 90, progressPct: 25, growthStage: 'growing' };
  api.state.fishInventory = [fish];
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeDrawRequestId: pending ? 'discovery-confirmed-1' : null };
  if (pending) api.state.pendingDraw = { fish, result: { requestId: 'discovery-confirmed-1', speciesId: fish.speciesId, rarity, duplicate, expGranted: duplicate && !refund ? 20 : 0, shellsRefunded: refund, cost: 30, createdAt: '2026-09-07T03:00:00Z' } };
  await page.addInitScript(() => {
    window.__discoveryAudio = { opened: 0, closed: 0, reject: false };
    window.AudioContext = class {
      constructor() { window.__discoveryAudio.opened++; this.currentTime = 0; this.destination = {}; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { return { frequency: { setValueAtTime() {} }, connect(target) { return target; }, start() {}, stop() {} }; }
      resume() { return window.__discoveryAudio.reject ? Promise.reject(new Error('audio blocked')) : Promise.resolve(); }
      close() { window.__discoveryAudio.closed++; return Promise.resolve(); }
    };
  });
  return api;
}

for (const [width, height] of [[320, 600], [360, 800], [390, 844], [430, 932]]) {
  test(`발견 결과는 중앙 창에서 바로 보이며 나중에 보기로 보존된다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const api = await setup(page);
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    const result = dialog(page);
    await expect(result).toBeVisible();
    await expect(page.getByRole('button', { name: /상자 열기/ })).toHaveCount(0);
    await expect(result).toContainText('보관함에 등록됐어요');
    await expect(result).not.toContainText('수조에 합류');
    await expect(page.locator('.app-content')).toHaveAttribute('inert', '');
    const box = await result.boundingBox();
    expect(Math.round(box.width)).toBe(Math.min(348, width - 40));
    await expect(result).toHaveCSS('border-radius', '30px');
    await expect(result).toHaveCSS('animation-name', 'none');
    await page.screenshot({ path: testInfo.outputPath(`discovery-${width}.png`), animations: 'disabled' });
    const later = result.getByRole('button', { name: '나중에 볼게요', exact: true });
    await later.scrollIntoViewIfNeeded();
    await expect(later).toBeInViewport();
    expect((await later.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`discovery-actions-${width}.png`), animations: 'disabled' });
    await later.click();
    await expect(result).toHaveCount(0);
    const reopen = page.locator('[data-action="openAquariumDraw"]');
    await expect(reopen).toBeFocused();
    await reopen.click();
    await expect(result).toBeVisible();
    await result.press('Escape');
    await expect(result).toHaveCount(0);
    await page.reload();
    await expect(result).toBeVisible();
    expect(requests(api, 'acknowledge_fish_draw')).toHaveLength(0);
    expect(requests(api, 'draw_fish')).toHaveLength(0);
    expect(requests(api, 'set_active_fish')).toHaveLength(0);
    expect(await page.evaluate(() => window.__discoveryAudio.opened)).toBe(0);
    await result.getByRole('button', { name: '도감에서 확인하기' }).click();
    await expect(result).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '물고기 도감' })).toBeVisible();
    expect(requests(api, 'acknowledge_fish_draw')).toHaveLength(1);
    await expectNoHorizontalOverflow(page);
  });
}

for (const [rarity, count, duplicate, refund] of [['common', 12, false, 0], ['rare', 22, true, 0], ['epic', 34, true, 15], ['legendary', 48, false, 0], ['special', 10, false, 0]]) {
  test(`희귀도와 중복·환급 결과는 별도로 표시한다 (${rarity})`, async ({ page }, testInfo) => {
    const api = await setup(page, { rarity, duplicate, refund });
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toHaveClass(new RegExp(`rarity-${rarity}`));
    await expect(page.locator('.aquarium-result-burst i')).toHaveCount(count);
    await expect(page.locator('.aquarium-result-ring')).toHaveCount(2);
    await expect(page.locator('.aquarium-result-ring').first()).toHaveCSS('animation-iteration-count', '1');
    await expect(page.locator('.aquarium-result-burst i').first()).toHaveCSS('animation-iteration-count', '1');
    await expect(page.locator('.aquarium-result-rays')).toHaveCount(rarity === 'legendary' ? 1 : 0);
    await expect(dialog(page)).toContainText(refund ? '조개 15개 환급' : duplicate ? 'EXP +20' : '보관함에 등록됐어요');
    if (duplicate) await expect(dialog(page)).not.toContainText('도감 등록 완료');
    await expect(dialog(page)).not.toContainText('MYTHIC');
    await page.screenshot({ path: testInfo.outputPath(`discovery-${rarity}.png`), animations: 'disabled' });
    await dialog(page).getByRole('button', { name: '나중에 보기', exact: true }).click();
    expect(requests(api, 'acknowledge_fish_draw')).toHaveLength(0);
  });
}

test('확인 실패는 결과를 남기고 재시도만 같은 결과를 확인한다', async ({ page }) => {
  const api = await setup(page, { failOnceTypes: ['acknowledge_fish_draw'] });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  const confirm = dialog(page).getByRole('button', { name: '도감에서 확인하기' });
  await confirm.click();
  await expect(dialog(page).getByRole('alert')).toBeVisible();
  await expect(dialog(page)).toContainText('보관함에 등록됐어요');
  await confirm.click();
  await expect(dialog(page)).toHaveCount(0);
  const acks = requests(api, 'acknowledge_fish_draw');
  expect(acks).toHaveLength(2);
  expect(acks[0].payload.data.requestId).toBe(acks[1].payload.data.requestId);
  expect(requests(api, 'draw_fish')).toHaveLength(0);
});

test('효과음은 직접 요청할 때만 재생하고 숨김·닫기·재생 거절을 정리한다', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(dialog(page)).toBeVisible();
  expect(await page.evaluate(() => window.__discoveryAudio.opened)).toBe(0);
  await dialog(page).getByRole('button', { name: '축하 효과음 듣기' }).click();
  expect(await page.evaluate(() => window.__discoveryAudio.opened)).toBe(1);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.aquarium-discovery-art')).toHaveAttribute('data-effects-active', 'false');
  expect(await page.evaluate(() => window.__discoveryAudio.closed)).toBe(1);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await dialog(page).getByRole('button', { name: '축하 효과음 듣기' }).click();
  await dialog(page).getByRole('button', { name: '나중에 보기', exact: true }).click();
  expect(await page.evaluate(() => window.__discoveryAudio.closed)).toBe(2);
  await page.locator('[data-action="openAquariumDraw"]').click();
  await page.evaluate(() => { window.__discoveryAudio.reject = true; });
  await dialog(page).getByRole('button', { name: '축하 효과음 듣기' }).click();
  await expect(dialog(page).getByRole('button', { name: '축하 효과음 듣기' })).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
  await dialog(page).getByRole('button', { name: '도감에서 확인하기' }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test('응답을 잃은 뽑기는 새 결과를 만들지 않고 기존 결과를 복구한다', async ({ page }) => {
  const api = await setup(page, { pending: false, loseResponseOnceTypes: ['draw_fish'] });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.locator('[data-action="openAquariumDraw"]').click();
  await page.getByRole('button', { name: '조개 30개로 만나기' }).click();
  await expect(page.locator('.aquarium-draw-ready .aquarium-action-error')).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  const balance = api.state.gameProfile.shellBalance;
  await page.reload();
  await expect(dialog(page)).toBeVisible();
  expect(api.state.gameProfile.shellBalance).toBe(balance);
  expect(requests(api, 'draw_fish')).toHaveLength(1);
  expect(requests(api, 'acknowledge_fish_draw')).toHaveLength(0);
});
