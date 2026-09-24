import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const stages = [1, 7, 15, 30, 50, 100];
async function setup(page, days = 30) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { initialGameProfile: { streakDays: 200 } });
  const fish = api.state.fishCatalog.slice(0, 3).map((species, index) => ({ fishId: `growth-fish-${index}`, speciesId: species.speciesId, name: `친구 ${index + 1}`, level: 2, exp: 30, progressPct: 25, growthStage: 'growing', rarity: 'common' }));
  api.state.activeFish = fish; api.state.fishInventory = fish;
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: fish.map(item => item.fishId) };
  const state = { days, fail: false, disabled: false, reads: 0 };
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.type !== 'planner_sync_v1' || payload.operation !== 'get_aquarium_growth') return route.fallback();
    state.reads++;
    if (payload.owner !== 'e2e-student') return route.fulfill({ status: 409, json: { code: 'PLANNER_ACCOUNT_CHANGED' } });
    expect(payload.data).toEqual({});
    if (state.fail) return route.abort('failed');
    if (state.disabled) return route.fulfill({ status: 503, json: { code: 'PLANNER_SYNC_DISABLED' } });
    const next = stages.find(day => day > state.days);
    return route.fulfill({ json: { success: true, plannerOwner: payload.owner, plannerProtocol: 1, data: { growth: {
      supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-01-01', revision: state.days,
      asOf: '2026-09-12T03:00:00.000Z', historyStatus: 'not_available', validDayCount: state.days,
      highestUnlockedStage: state.days ? `day${stages.filter(day => day <= state.days).at(-1)}` : null, nextStageDays: next ? next - state.days : null
    } } } });
  });
  return state;
}

for (const days of stages) test(`서버 DAY${days} 배경과 공유 미리보기 일치`, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await setup(page, days);
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('.aquarium-scene')).toHaveAttribute('data-background-key', `day${days}`);
  await expect(page.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
  await expect(page.locator('.aquarium-growth-caption')).toContainText(`성장 인정 ${days}일`);
  await expect(page.locator('.aquarium-day-badge')).toContainText(`DAY ${days}`);
  await expect(page.locator('.aquarium-habitat-header .aquarium-wallet')).toHaveCount(0);
  await page.locator('.aquarium-scene-wrap').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.locator('.aquarium-scene-wrap').screenshot({ path: info.outputPath(`day-${days}-full.png`) });
  await page.locator('[data-action="openAquariumShare"]').click();
  await expect(page.locator('.aquarium-scene')).toHaveAttribute('data-background-key', `day${days}`);
  await expect(page.locator('.aquarium-growth-caption')).toContainText(`성장 인정 ${days}일`);
  expect(state.reads).toBe(1); await expectNoHorizontalOverflow(page);
});

test('헤더 성장 일수와 배경 단계를 구분하고 출처는 펼쳐서 확인한다', async ({ page }) => {
  await setup(page, 12);
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('.aquarium-day-badge')).toContainText('DAY 12');
  await expect(page.locator('.aquarium-day-badge')).not.toContainText('200');
  await expect(page.locator('.aquarium-scene')).toHaveAttribute('data-background-key', 'day7');
  const caption = page.locator('.aquarium-growth-caption');
  await expect(caption).toContainText('3일 더 공부하면 다음 수조가 열려요');
  await expect(caption.getByRole('button', { name: '성장 기록 다시 확인' })).not.toBeVisible();
  await caption.locator('summary').click();
  await expect(caption.getByRole('button', { name: '성장 기록 다시 확인' })).toBeVisible();
  await expect(page.getByRole('region', { name: '수조 돌봄과 재화' }).getByRole('group', { name: '수조 재화' })).toBeVisible();
});

for (const width of [320, 360, 430]) test(`홈·사용법도 같은 성장 배경 (${width}px)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await setup(page, 50);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.home-aquarium-preview .aquarium-scene')).toHaveAttribute('data-background-key', 'day50');
  await page.locator('.home-aquarium-preview').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.locator('.home-aquarium-preview').screenshot({ path: info.outputPath(`home-${width}.png`) });
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await page.getByRole('button', { name: /사용법 다시 보기/ }).click();
  const dialog = page.getByRole('dialog', { name: 'StudyCrack 사용법' });
  for (let step = 0; step < 2; step++) await dialog.locator('[data-action="nextProductGuide"]').click();
  await expect(dialog.locator('.aquarium-scene')).toHaveAttribute('data-background-key', 'day50');
  const caption = await dialog.locator('.aquarium-growth-caption').boundingBox();
  const note = await dialog.locator('.product-guide-scene > span').boundingBox();
  expect(caption.y + caption.height).toBeLessThanOrEqual(note.y);
  await dialog.screenshot({ path: info.outputPath(`guide-${width}.png`) });
  expect(state.reads).toBe(1); await expectNoHorizontalOverflow(page);
});

test('성장 조회 실패 유지·다시 확인·비활성 롤백', async ({ page }) => {
  const state = await setup(page); await page.goto('/studycrack-mobile.html?screen=aquarium');
  const caption = page.locator('.aquarium-growth-caption'), scene = page.locator('.aquarium-scene');
  await expect(caption).toHaveAttribute('data-growth-status', 'ready');
  await expect(caption.getByRole('button', { name: '성장 기록 다시 확인' })).not.toBeVisible();
  await caption.locator('summary').click();
  state.fail = true; await caption.getByRole('button', { name: '성장 기록 다시 확인' }).click();
  await expect(caption).toHaveAttribute('data-growth-status', 'stale'); await expect(scene).toHaveAttribute('data-background-key', 'day30');
  state.fail = false; state.days = 50; await caption.getByRole('button', { name: '성장 기록 다시 확인' }).click();
  await expect(scene).toHaveAttribute('data-background-key', 'day50');
  await caption.locator('summary').click();
  state.disabled = true; await caption.getByRole('button', { name: '성장 기록 다시 확인' }).click();
  await expect(scene).toHaveAttribute('data-background-key', 'day1'); await expect(caption).not.toContainText('성장 인정');
});

test('이미지 실패는 해금값을 바꾸지 않고 기본 배경 후 재시도한다', async ({ page }, info) => {
  await setup(page); let failed = true;
  await page.route('**/day-30-*.png', route => failed ? route.abort() : route.continue());
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'fallback');
  await expect(page.locator('.aquarium-scene')).toHaveAttribute('data-background-key', 'day30');
  await expect(page.locator('.aquarium-growth-caption')).toContainText('성장 인정 30일');
  await page.screenshot({ path: info.outputPath('image-fallback.png'), fullPage: true });
  failed = false; await page.getByRole('button', { name: '배경 다시 보기' }).click();
  await expect(page.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
});

test('다른 계정 전환 즉시 이전 성장 기록 제거', async ({ page }) => {
  await setup(page, 100); await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('.aquarium-growth-caption')).toContainText('성장 인정 100일');
  await page.evaluate(() => {
    localStorage.setItem('userId', 'another-student');
    window.dispatchEvent(new StorageEvent('storage', { key: 'userId', oldValue: 'e2e-student', newValue: 'another-student' }));
  });
  await expect(page.locator('.aquarium-scene')).toHaveAttribute('data-background-key', 'day1');
  await expect(page.locator('.aquarium-growth-caption')).not.toContainText('성장 인정 100일');
});

const seenKey = 'studycrackAquariumSeen_v1:e2e-student:planner-days-v1:2026-01-01';
const showCaption = async page => {
  const caption = page.locator('.aquarium-growth-caption');
  await expect(caption).toHaveAttribute('data-growth-status', 'ready');
  await caption.evaluate(el => el.scrollIntoView({ block: 'center' }));
};

test('해금은 수조에서 한 번만 안내하고 재조회·재진입·재로드에는 반복하지 않는다', async ({ page }) => {
  const state = await setup(page, 7); await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.home-aquarium-preview .aquarium-scene')).toHaveAttribute('data-background-key', 'day7');
  await expect(page.locator('.home-aquarium-preview .aquarium-growth-caption')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), seenKey)).toBeNull();
  await page.locator('.home-aquarium-preview [data-target="aquarium"]').first().click(); await showCaption(page);
  const notice = page.locator('.aquarium-unlock-notice');
  await expect(notice).toContainText('DAY 7 배경을 열었어요');
  await expect(notice.locator('button')).not.toBeFocused();
  await notice.getByRole('button', { name: '해금 안내 닫기' }).click();
  await page.locator('.aquarium-growth-details summary').click();
  await page.getByRole('button', { name: '성장 기록 다시 확인' }).click(); await showCaption(page);
  await expect(notice).toHaveCount(0);
  await page.locator('[data-action="openAquariumShare"]').click(); await expect(notice).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: '홈', exact: true }).click();
  await page.locator('.home-aquarium-preview [data-target="aquarium"]').first().click(); await showCaption(page);
  await expect(notice).toHaveCount(0);
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.reload(); await showCaption(page); await expect(notice).toHaveCount(0);
  await page.locator('.aquarium-growth-details summary').click();
  state.days = 15; await page.getByRole('button', { name: '성장 기록 다시 확인' }).click(); await showCaption(page);
  await expect(notice).toContainText('DAY 15 배경을 열었어요');
  expect(await page.evaluate(key => localStorage.getItem(key), seenKey)).toBe('day15');
});

for (const width of [320, 430]) test(`움직임 줄이기에서는 정적인 해금 카드·닫기 제공 (${width}px)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page, 100); await page.goto('/studycrack-mobile.html?screen=aquarium'); await showCaption(page);
  const notice = page.locator('.aquarium-unlock-notice'); await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS('animation-name', 'none');
  await notice.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await expect(notice.getByRole('button')).toBeInViewport({ ratio: 1 });
  const bounds = await notice.getByRole('button').boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44);
  await page.locator('.aquarium-growth-caption').screenshot({ path: info.outputPath(`unlock-${width}.png`) });
  await expectNoHorizontalOverflow(page);
});

test('가려진 문서에서는 소비하지 않고 복귀 후 표시하며 다시 숨기면 모션을 멈춘다', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); });
  await setup(page, 30); await page.goto('/studycrack-mobile.html?screen=aquarium'); await showCaption(page);
  await expect(page.locator('.aquarium-unlock-notice')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), seenKey)).toBeNull();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.aquarium-unlock-notice')).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.aquarium-unlock-notice')).toHaveCSS('animation-play-state', 'paused');
});

test('확인 기록 저장 실패는 반복 연출 없이 성장 표시를 유지한다', async ({ page }) => {
  await setup(page, 50);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('studycrackAquariumSeen_v1:')) throw new DOMException('quota', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.goto('/studycrack-mobile.html?screen=aquarium'); await showCaption(page);
  await expect(page.locator('.aquarium-unlock-notice')).toHaveCount(0);
  await expect(page.locator('.aquarium-growth-caption')).toContainText('성장 인정 50일');
  await page.reload(); await showCaption(page); await expect(page.locator('.aquarium-unlock-notice')).toHaveCount(0);
});

test('같은 브라우저의 두 탭은 같은 단계 안내를 중복 표시하지 않는다', async ({ page, context }) => {
  await setup(page, 30); await page.goto('/studycrack-mobile.html?screen=aquarium'); await showCaption(page);
  await expect(page.locator('.aquarium-unlock-notice')).toBeVisible();
  const other = await context.newPage(); await setup(other, 30);
  await other.goto('/studycrack-mobile.html?screen=aquarium'); await showCaption(other);
  await expect(other.locator('.aquarium-unlock-notice')).toHaveCount(0);
  await expect(other.locator('.aquarium-growth-caption')).toContainText('성장 인정 30일'); await other.close();
});

test('다른 안내로 비활성화된 수조는 해금을 소비하지 않고 계정 변경 때 안내도 제거한다', async ({ page }) => {
  await setup(page, 50); await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('.aquarium-growth-caption')).toHaveAttribute('data-growth-status', 'ready');
  await page.locator('.aquarium-scene-wrap').evaluate(el => el.setAttribute('inert', ''));
  await showCaption(page); await expect(page.locator('.aquarium-unlock-notice')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), seenKey)).toBeNull();
  await page.locator('.aquarium-scene-wrap').evaluate(el => el.removeAttribute('inert'));
  await expect(page.locator('.aquarium-unlock-notice')).toBeVisible();
  await page.evaluate(() => { localStorage.setItem('userId', 'another-student'); dispatchEvent(new StorageEvent('storage', { key: 'userId', oldValue: 'e2e-student', newValue: 'another-student' })); });
  await expect(page.locator('.aquarium-unlock-notice')).toHaveCount(0);
  await expect(page.locator('.aquarium-growth-caption')).not.toContainText('성장 인정 50일');
});
