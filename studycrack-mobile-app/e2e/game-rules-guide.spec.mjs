import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const rules = {
  ticketPolicy: { version: 'study-ticket-v1', intervalSeconds: 18000, drawCost: 1 },
  starterPolicy: { version: 'starter-study-v1', minimumSessionSeconds: 600, choiceCount: 3 },
  dailyCaps: {}, rewardTiers: [], habitatStages: [{ minimumMinutes: 180, label: '풍성한 서식지' }], fishCare: { enabled: false }, drawCostShells: 0,
  drawPolicy: { version: 'draw-ticket-v1', oddsBasisPoints: { common: 7000, rare: 2500, epic: 400, legendary: 100 },
    pityLimits: { rare: 10, epic: 30, legendary: 100 }, duplicateExp: { common: 30, rare: 80, epic: 180, legendary: 400 },
    protectedDrawCount: 3, maxLevelRefund: { tickets: 1 }, specialAcquisition: 'achievement_or_event' }
};

async function setup(page, { missingRules = false, failGrowth = false } = {}) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  const state = { missingRules, failGrowth };
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.type === 'get_game_profile') return route.fulfill({ json: { profile: api.state.gameProfile, activeFish: api.state.activeFish, fishCount: api.state.fishInventory.length, rules: state.missingRules ? null : rules } });
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
  await expect(dialog).toContainText('10분 이상 공부 완료');
  await expect(dialog).toContainText('확정 공부 5시간마다 1장');
  await expect(dialog).toContainText('하루 최대 1일');
  await expect(dialog).toContainText('성장 인정 12일');
  await expect(dialog).not.toContainText('180분');
  await dialog.screenshot({ path: info.outputPath(`rules-guide-${width}-initial.png`) });
  await dialog.locator('.game-rules-details').first().locator('summary').click();
  await expect(dialog).toContainText('70%');
  await expect(dialog).toContainText('해당 등급 이상을 확정');
  await expect(dialog).toContainText('첫 3회는 뽑힌 등급');
  await expect(dialog).toContainText('Lv.10');
  await expect(dialog.getByRole('button', { name: '확인', exact: true })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  await dialog.screenshot({ path: info.outputPath(`rules-guide-${width}.png`) });
  expect(api.requests.some(({ payload }) => /^(draw_fish|claim_study_reward|set_active_fish)$/.test(payload.type))).toBe(false);
  await dialog.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('규칙이 없으면 시간이나 확률을 추정하지 않고 다시 확인한다', async ({ page }) => {
  const { state } = await setup(page, { missingRules: true, failGrowth: true });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await expect(dialog).toContainText('공부 보상 규칙 확인 필요');
  await expect(dialog).toContainText('성장 기록 확인 필요');
  await expect(dialog).not.toContainText('5시간');
  await expect(dialog).not.toContainText('70%');
  state.missingRules = false;
  await dialog.getByRole('button', { name: '규칙 다시 확인' }).click();
  await expect(dialog).toContainText('확정 공부 5시간마다 1장');
});

test('그림 실패와 글자 확대에서도 배경 목표와 닫기 버튼을 읽을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await setup(page);
  await page.route('**/*day-07*.png', route => route.abort('failed'));
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.getByRole('button', { name: '수조 이용법', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '수조 성장 규칙' });
  await dialog.locator('.game-rules-growth').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await expect(dialog.locator('.game-rules-background-pair')).toContainText('배경 이미지 확인 필요');
  await expect(dialog.locator('.game-rules-background-pair')).toContainText('DAY 7');
  await page.addStyleTag({ content: '.game-rules-modal { --sc-type-body:32px; --sc-type-caption:28px; --sc-type-section:40px; --sc-type-title:48px; --sc-type-micro:24px; }' });
  await expectNoHorizontalOverflow(page);
  await expect(dialog.getByRole('button', { name: '확인', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: '수조 이용법 닫기' }).click();
  await expect(dialog).toHaveCount(0);
});
