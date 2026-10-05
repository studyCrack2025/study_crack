import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const rules = {
  ticketPolicy: { version: 'study-ticket-v1', intervalSeconds: 18000, drawCost: 1 },
  starterPolicy: { version: 'starter-study-v1', minimumSessionSeconds: 600, choiceCount: 3 },
  dailyCaps: {}, rewardTiers: [], habitatStages: [{ minimumMinutes: 180, label: '풍성한 서식지' }], fishCare: { enabled: false }, drawCostShells: 0,
  drawPolicy: { version: 'draw-ticket-v1', randomSelection: true, duplicateEffect: 'growth', duplicateExp: { common: 30, rare: 80, epic: 180, legendary: 400 },
    protectedDrawCount: 3, maxLevelRefund: { tickets: 1 }, specialAcquisition: 'achievement_or_event' }
};
const planRules = { ...rules, ticketPolicy: { version: 'planner-ticket-v1', minimumPlanMinutes: 30, boostPlanMinutes: [120, 240], drawCost: 1, completionMode: 'server_check', grantPerPlan: 1 },
  drawPolicy: { version: 'draw-plan-v1', randomSelection: true, duplicateEffect: 'none', protectedDrawCount: 3, specialAcquisition: 'achievement_or_event' } };

async function setup(page, { missingRules = false, failGrowth = false, planPolicy = false, off = false, partial = false, delay = false } = {}) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  if (planPolicy) api.state.gameProfile = { ...api.state.gameProfile, ticketPolicyVersion: 'planner-ticket-v1', ticketIntervalSeconds: null, legacyTicketBalance: 2, planTicketCounts: { base: 0, h2: 0, h4: 0 } };
  const state = { missingRules, failGrowth, off, partial, delay };
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.type === 'get_game_profile') {
      if (state.delay) await new Promise(resolve => setTimeout(resolve, 500));
      if (state.off) return route.fulfill({ status: 503, json: { code: 'GAME_DISABLED' } });
      return route.fulfill({ json: { profile: api.state.gameProfile, activeFish: api.state.activeFish, fishCount: api.state.fishInventory.length, rules: state.missingRules ? null : state.partial ? { ...planRules, drawPolicy: rules.drawPolicy } : planPolicy ? planRules : rules } });
    }
    if (payload?.type === 'planner_sync_v1' && payload.operation === 'get_aquarium_growth') {
      if (state.failGrowth) return route.abort('failed');
      return route.fulfill({ json: { success: true, plannerOwner: payload.owner, plannerProtocol: 1, data: { growth: {
        supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-01-01', revision: 12,
        asOf: '2026-10-03T03:00:00.000Z', historyStatus: 'not_available', validDayCount: 12, highestUnlockedStage: 'day7', nextStageDays: 3
      } } } });
    }
    return route.fallback();
  });
  return { api, state };
}

for (const { width, fallbackFont } of [{ width: 320 }, { width: 390 }, { width: 320, fallbackFont: true }]) test(`계획 달성형 안내는 시간형 지급과 중복 성장을 표시하지 않는다 (${width}px${fallbackFont ? ', 대체 글꼴' : ''})`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 }); await setup(page, { planPolicy: true });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  if (fallbackFont) await page.addStyleTag({ content: 'body { font-family: Arial, sans-serif; letter-spacing: .035em; }' });
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await expect(dialog).toContainText('30분 이상 계획을 세워요');
  const height = await dialog.evaluate(el => el.offsetHeight);
  for (let index = 1; index <= 4; index++) {
    await expect(dialog.locator('.game-rules-step')).toHaveCount(1);
    await expect(dialog.locator('.game-rules-progress span')).toHaveText(`${index}/4`);
    await expect(dialog.locator('.game-rules-example-frame img')).toBeVisible();
    await expect(dialog.locator('.game-rules-example-frame img')).toHaveAttribute('alt', /예시/);
    await expect(dialog.locator('.game-rules-example figcaption')).toContainText('화면 예시 · 실제 수량·결과와 달라요');
    expect(await dialog.evaluate(el => el.offsetHeight)).toBe(height);
    const body = await dialog.locator('.game-rules-body').evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }));
    expect(body.scroll).toBeLessThanOrEqual(body.height + 1);
    if (index === 2) {
      await expect(dialog).toContainText('완료 취소·재완료로는 다시 지급되지');
      await dialog.getByText('첫 물고기는 어떻게 만나나요?', { exact: true }).click();
      await expect(dialog).toContainText('10분 이상 공부 완료');
      await dialog.getByText('첫 물고기는 어떻게 만나나요?', { exact: true }).click();
    }
    if (index === 3) await expect(dialog).toContainText('2시간·4시간 이상 계획');
    if (index < 4) await dialog.getByRole('button', { name: '다음', exact: true }).click();
  }
  await expect(dialog).toContainText('경험치·배치는 그대로');
  await expect(dialog).not.toContainText('%'); await expect(dialog).not.toContainText('확정 공부 5시간'); await expect(dialog).not.toContainText('돌려받아요');
  await expectNoHorizontalOverflow(page);
  await dialog.screenshot({ path: info.outputPath(`plan-rules-${width}.png`) });
});

test('전환 계정의 새 중복 결과와 구 영수증은 당시 효과를 표시하고 재복구로 물고기를 바꾸지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const { api } = await setup(page, { planPolicy: true });
  const fish = { fishId: 'fish_existing', speciesId: 'guppy', speciesName: '구피', rarity: 'common', name: '원래 친구', level: 3, exp: 90, progressPct: 0, growthStage: 'young', source: 'draw' };
  api.state.gameProfile.starterState = 'claimed'; api.state.gameProfile.activeFishIds = [fish.fishId, null, null];
  api.state.activeFish = [fish]; api.state.fishInventory = [fish];
  const before = structuredClone(fish);
  for (const legacy of [false, true]) {
    const requestId = legacy ? 'legacy_receipt_1' : 'plan_receipt_1';
    api.state.gameProfile.activeDrawRequestId = requestId;
    api.state.pendingDraw = { fish, result: { requestId, speciesId: 'guppy', rarity: 'common', duplicate: true,
      duplicateEffect: legacy ? 'growth' : 'none', drawPolicyVersion: legacy ? 'draw-ticket-v1' : 'draw-plan-v1',
      expGranted: legacy ? 30 : 0, shellsRefunded: 0, ticketsRefunded: 0, cost: 1, costUnit: 'ticket', createdAt: '2026-10-04T01:00:00.000Z' } };
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    const result = page.getByRole('dialog', { name: '물고기 발견 결과' });
    await expect(result).toBeVisible();
    await expect(result).toContainText(legacy ? 'EXP +30' : '경험치·배치는 그대로');
    if (!legacy) await expect(result).not.toContainText('EXP +');
    await page.reload(); await expect(result).toBeVisible();
    expect(api.state.fishInventory).toEqual([before]);
    await expectNoHorizontalOverflow(page);
    await result.getByRole('button', { name: '도감에서 확인하기' }).click();
    await expect(result).toHaveCount(0);
    expect(api.state.gameProfile.ticketBalance).toBe(2);
    expect(api.state.gameProfile.activeFishIds).toEqual(['fish_existing', null, null]);
  }
  expect(api.requests.filter(row => row.payload.type === 'draw_fish')).toHaveLength(0);
});

for (const width of [320, 360, 390, 430]) test(`수조에서 그림 안내를 열고 두 성장 기준을 확인한다 (${width}px)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 });
  const { api } = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  const trigger = page.getByRole('button', { name: '수조 이용법', exact: true });
  // Keyboard activation preserves the focused origin; Safari pointer clicks blur buttons.
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('확정 공부 5시간마다 1장');
  await expect(dialog.getByRole('button', { name: '이전', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await dialog.getByText('첫 물고기는 어떻게 만나나요?', { exact: true }).click();
  await expect(dialog).toContainText('10분 이상 공부 완료');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog).not.toContainText('180분');
  await dialog.screenshot({ path: info.outputPath(`rules-guide-${width}-initial.png`) });
  await dialog.getByText('만날 수 있는 친구', { exact: true }).click();
  await expect(dialog).toContainText('무작위 친구');
  await expect(dialog).not.toContainText('%');
  await expect(dialog).not.toContainText('회 안에는');
  await expect(dialog).toContainText('첫 3회는 뽑힌 등급');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog).toContainText('Lv.10');
  await expect(dialog).toContainText('하루 최대 1일');
  await expect(dialog).toContainText('성장 인정 12일');
  await expect(dialog.getByRole('button', { name: '완료', exact: true })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  await dialog.screenshot({ path: info.outputPath(`rules-guide-${width}.png`) });
  expect(api.requests.some(({ payload }) => /^(draw_fish|claim_study_reward|set_active_fish)$/.test(payload.type))).toBe(false);
  await dialog.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await expect(dialog.locator('.game-rules-progress span')).toHaveText('1/4');
  await dialog.getByRole('button', { name: '수조 이용법 닫기' }).click();
});

test('규칙이 없으면 시간이나 확률을 추정하지 않고 다시 확인한다', async ({ page }) => {
  const { state } = await setup(page, { missingRules: true, failGrowth: true });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await expect(dialog).toContainText('공부 보상 규칙 확인 필요');
  await expect(dialog).not.toContainText('5시간');
  await expect(dialog).not.toContainText('70%');
  state.missingRules = false;
  await dialog.getByRole('button', { name: '규칙 다시 확인' }).click();
  await expect(dialog).toContainText('확정 공부 5시간마다 1장');
  for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog).toContainText('성장 기록 확인 필요');
  await expect(dialog).not.toContainText('DAY 7');
  state.failGrowth = false;
  await dialog.getByRole('button', { name: '성장 기록 다시 확인' }).click();
  await expect(dialog).toContainText('성장 인정 12일');
});

test('그림 실패와 글자 확대에서도 배경 목표와 닫기 버튼을 읽을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await setup(page);
  await page.route('**/*day-07*.png', route => route.abort('failed'));
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await dialog.getByText('배경 목표 보기', { exact: true }).click();
  await expect(dialog.locator('.game-rules-background-pair')).toContainText('배경 이미지 확인 필요');
  await expect(dialog.locator('.game-rules-background-pair')).toContainText('DAY 7');
  await page.addStyleTag({ content: '.game-rules-modal { --sc-type-body:32px; --sc-type-caption:28px; --sc-type-section:40px; --sc-type-title:48px; --sc-type-micro:24px; }' });
  await expectNoHorizontalOverflow(page);
  await expect(dialog.getByRole('button', { name: '완료', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: '수조 이용법 닫기' }).click();
  await expect(dialog).toHaveCount(0);
});

test('비활성·부분 규칙에서는 새 지급이나 중복 효과를 추정하지 않는다', async ({ page }) => {
  const { state } = await setup(page, { off: true });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await expect(dialog).toContainText('수조 기능을 준비하고 있어요');
  await expect(dialog.locator('.game-rules-step')).toHaveCount(0);
  await expect(dialog).not.toContainText('30분 이상');
  state.off = false; state.partial = true;
  await dialog.getByRole('button', { name: '규칙 다시 확인' }).click();
  await expect(dialog).toContainText('30분 이상 계획을 세워요');
  for (let i = 0; i < 2; i++) await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog).toContainText('만남 규칙 확인이 필요');
  await expect(dialog.locator('.game-rules-example')).toHaveCount(0);
  await expect(dialog).not.toContainText('무작위 친구');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog).toContainText('중복 규칙 확인이 필요');
  await expect(dialog.locator('.game-rules-example')).toHaveCount(0);
  await expect(dialog).not.toContainText('경험치·배치는 그대로');
  await expect(dialog).not.toContainText('성장 경험치');
});

test('단계 이동·이전·키보드와 작은 화면에서도 안내만 동작한다', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { api } = await setup(page, { planPolicy: true, delay: true });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await expect(dialog.locator('.game-rules-progress span')).toHaveText('1/4');
  await dialog.getByRole('button', { name: '다음', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog.locator('.game-rules-progress span')).toHaveText('2/4');
  await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await expect(dialog.locator('.game-rules-progress span')).toHaveText('1/4');
  const close = dialog.getByRole('button', { name: '수조 이용법 닫기' });
  await close.focus(); await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
  await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeFocused();
  await page.addStyleTag({ content: '.game-rules-modal { --sc-type-body:32px; --sc-type-caption:28px; --sc-type-section:40px; --sc-type-title:48px; }' });
  await expectNoHorizontalOverflow(page);
  await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeInViewport();
  await expect(close).toBeInViewport();
  await close.click();
  expect(api.requests.some(({ payload }) => /^(draw_fish|claim_study_reward|set_active_fish)$/.test(payload.type))).toBe(false);
});

test('화면 예시는 열 때 현재 단계만 요청하고 지연·실패에도 크기와 조작을 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page, { planPolicy: true });
  const requested = [];
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(/\/assets\/(?:plan(?:-confirmed)?|study-(?:progress|confirmed)|discovery|duplicate-(?:plan|study))-[\w-]{8}\.webp$/, async route => {
    requested.push(new URL(route.request().url()).pathname);
    if (/\/plan-confirmed-/.test(route.request().url())) return route.abort();
    if (/\/plan-/.test(route.request().url())) await held;
    return route.continue();
  });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  expect(requested).toHaveLength(0);
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await expect.poll(() => requested.length).toBe(1);
  const frame = dialog.locator('.game-rules-example-frame');
  const height = await frame.evaluate(el => el.offsetHeight);
  const titleY = await dialog.locator('.game-rules-copy').evaluate(el => el.offsetTop);
  release();
  await expect.poll(() => frame.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(await frame.evaluate(el => el.offsetHeight)).toBe(height);
  expect(await dialog.locator('.game-rules-copy').evaluate(el => el.offsetTop)).toBe(titleY);
  await dialog.screenshot({ path: info.outputPath('screenshot-example-320.png') });
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.getByRole('status', { name: /화면 예시를 불러오지 못했어요/ })).toContainText('예시 이미지 없음');
  await expect(dialog).toContainText('서버에서 첫 완료가 확인되면');
  expect(await frame.evaluate(el => el.offsetHeight)).toBe(height);
  const largeFont = await page.addStyleTag({ content: '.game-rules-modal { --sc-type-body:32px; --sc-type-caption:28px; --sc-type-section:40px; --sc-type-title:48px; }' });
  const fallbackBox = await frame.getByRole('status').boundingBox(), frameBox = await frame.boundingBox();
  expect(fallbackBox.height).toBeLessThanOrEqual(frameBox.height);
  await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  await largeFont.evaluate(el => el.remove());
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(frame.locator('img')).toHaveAttribute('alt', /무작위.*예시/);
  await expect.poll(() => frame.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(frame.locator('img')).toHaveAttribute('alt', /유지되는.*예시/);
  await page.addStyleTag({ content: '.game-rules-modal { --sc-type-body:32px; --sc-type-caption:28px; --sc-type-section:40px; --sc-type-title:48px; }' });
  await expectNoHorizontalOverflow(page);
  await expect(dialog.getByRole('button', { name: '완료', exact: true })).toBeInViewport();
  await dialog.screenshot({ path: info.outputPath('screenshot-example-320-large.png') });
  await dialog.getByRole('button', { name: '완료', exact: true }).click();
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  await expect(dialog.locator('.game-rules-progress span')).toHaveText('1/4');
  await expect(frame.locator('img')).toHaveAttribute('alt', /완료 체크/);
});

test('이전 공부 보상의 예시도 정책을 구분하고 실제 지급 간격은 서버 값을 따른다', async ({ page }) => {
  const { api } = await setup(page);
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.type !== 'get_game_profile') return route.fallback();
    return route.fulfill({ json: { profile: api.state.gameProfile, activeFish: [], fishCount: 0,
      rules: { ...rules, ticketPolicy: { ...rules.ticketPolicy, intervalSeconds: 7200 } } } });
  });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await expect(dialog).toContainText('확정 공부 2시간마다 1장');
  await expect(dialog.locator('.game-rules-example img')).toHaveAttribute('alt', /남은 시간 예시/);
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.locator('.game-rules-example img')).toHaveAttribute('alt', /공부 기록과 성장 보상/);
  for (let i = 0; i < 2; i++) await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.locator('.game-rules-example img')).toHaveAttribute('alt', /성장에 반영되는/);
  await expect(dialog).not.toContainText('확정 공부 5시간');
});
