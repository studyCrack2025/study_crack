import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { installApiMock, installAuthenticatedSession } from '../e2e/support/mock-api.mjs';

// Local, synthetic renderer captures only. No live account or service is used.
const baseURL = 'http://127.0.0.1:4177';
const output = fileURLToPath(new URL('../src/assets/game-rules/', import.meta.url));
const temporary = process.env.GUIDE_CAPTURE_TMP;
if (!temporary?.startsWith('/private/tmp/')) throw new Error('Set GUIDE_CAPTURE_TMP to a fresh /private/tmp directory');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await context.newPage();
await page.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
});
await page.clock.setFixedTime(new Date('2026-10-06T03:00:00.000Z'));
await installAuthenticatedSession(page, { now: Date.parse('2026-10-06T03:00:00.000Z') });
const api = await installApiMock(page);
const item = { id: 'example-plan', date: '2026-10-06', subject: '국어', title: '독서 문제 풀기', plannedMinutes: 30,
  completed: false, deleted: false, revision: 1, firstCompletedAt: null, growthDate: null, completionSnapshot: null, updatedAt: '2026-10-06T03:00:00.000Z' };
const growth = { supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-10-01', revision: 0,
  asOf: '2026-10-06T03:00:00.000Z', historyStatus: 'not_available', validDayCount: 0, highestUnlockedStage: null, nextStageDays: 1 };
await page.route('**/api/**', async route => {
  const payload = route.request().postDataJSON();
  if (!['planner_sync_v1', 'planner_sync_v2'].includes(payload?.type)) return route.fallback();
  const protocol = payload.type === 'planner_sync_v2' ? 2 : 1;
  let data;
  if (payload.operation === 'get_server_planner') data = { items: [{ ...item, ...(protocol === 1 ? { plannedMinutes: undefined, completionSnapshot: undefined } : {}) }], cursor: null, growth };
  else if (payload.operation === 'get_aquarium_growth') data = { growth };
  else if (payload.operation === 'complete_server_planner') {
    Object.assign(item, { completed: true, revision: 2, firstCompletedAt: growth.asOf, growthDate: item.date,
      completionSnapshot: { date: item.date, subject: item.subject, plannedMinutes: 30, revision: 1, completedAt: growth.asOf, policyVersion: 'planner-ticket-v1', status: 'issued' } });
    data = { item, growth, rewardStatus: 'issued', replayed: false };
  } else throw new Error(`Unexpected synthetic planner operation: ${payload.operation}`);
  return route.fulfill({ json: { success: true, plannerOwner: payload.owner, plannerProtocol: protocol,
    data: { ...data, capabilities: { protocols: [1, 2], rewardPolicy: 'planner-ticket-v1' } } } });
});
async function capture(name, locator) {
  await expect(locator).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const png = join(temporary, `${name}.png`);
  await locator.screenshot({ path: png, animations: 'disabled' });
  execFileSync('cwebp', ['-quiet', '-q', '88', '-m', '6', png, '-o', join(output, `${name}.webp`)]);
  console.log(`${name}: ${JSON.stringify(await locator.boundingBox())}`);
}
try {
  await page.goto(`${baseURL}/studycrack-mobile.html?screen=planner`);
  await page.addStyleTag({ content: '.tabbar { visibility: hidden; }' });
  await page.getByLabel('달력 더보기', { exact: true }).click();
  await page.getByRole('button', { name: '계획 보관 설정', exact: true }).click();
  await page.getByRole('button', { name: '계정 기록 확인', exact: true }).click();
  await page.getByRole('button', { name: '계정 계획으로 전환', exact: true }).click();
  await page.getByRole('button', { name: '계획 시간도 계정에 저장', exact: true }).click();
  await page.getByRole('dialog', { name: '계획 보관 설정', exact: true }).getByRole('button', { name: '닫기', exact: true }).click();
  const row = page.locator('article[data-planner-id="example-plan"]');
  await expect(row).toContainText('30분');
  await capture('plan', row);
  await row.getByRole('button', { name: '계획 완료', exact: true }).click();
  await expect(row.locator('.planner-item-done')).toHaveAttribute('aria-pressed', 'true');
  await capture('plan-confirmed', page.getByRole('region', { name: '계정 저장 상태', exact: true }));

  await page.goto(`${baseURL}/studycrack-mobile.html?screen=timer`);
  await page.getByRole('button', { name: '공부 시작', exact: true }).click();
  await page.locator('.study-plan-options button').filter({ hasText: '독서' }).click();
  await page.locator('.study-start-confirm').click();
  await page.getByRole('button', { name: '공부 완료', exact: true }).click();
  await expect(page.locator('.timer-journey-steps [data-step="reward"]')).toHaveAttribute('data-state', 'complete');
  await capture('study-confirmed', page.locator('.timer-journey-steps'));
  await page.goto(`${baseURL}/studycrack-mobile.html?screen=aquarium`);
  api.state.gameProfile.ticketProgressSeconds = 7200;
  await page.reload();
  // The example interval is not a rule: only the remaining progress is captured.
  await capture('study-progress', page.locator('.aquarium-wallet'));

  const fish = { fishId: 'example-fish', speciesId: 'guppy', speciesName: '구피', rarity: 'common', name: '구피', level: 2, exp: 30, progressPct: 0, growthStage: 'young', source: 'draw' };
  for (const [name, duplicate, plan] of [['discovery', false, true], ['duplicate-plan', true, true], ['duplicate-study', true, false]]) {
    api.state.fishInventory = [fish]; api.state.activeFish = [fish];
    api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: [fish.fishId, null, null], activeDrawRequestId: 'example-receipt',
      ticketPolicyVersion: plan ? 'planner-ticket-v1' : 'study-ticket-v1', ticketIntervalSeconds: plan ? null : 18000,
      ...(plan ? { legacyTicketBalance: 2, planTicketCounts: { base: 0, h2: 0, h4: 0 } } : {}) };
    api.state.pendingDraw = { fish, result: { requestId: 'example-receipt', speciesId: 'guppy', rarity: 'common', duplicate,
      duplicateEffect: plan ? 'none' : 'growth', drawPolicyVersion: plan ? 'draw-plan-v1' : 'draw-ticket-v1', expGranted: duplicate && !plan ? 30 : 0,
      shellsRefunded: 0, ticketsRefunded: 0, cost: 1, costUnit: 'ticket', createdAt: growth.asOf } };
    await page.goto(`${baseURL}/studycrack-mobile.html?screen=aquarium`);
    await expect(page.getByRole('dialog', { name: '물고기 발견 결과' })).toBeVisible();
    await capture(name, page.locator(duplicate ? '.aquarium-result-reward' : '.aquarium-result-halo'));
  }
} finally { await browser.close(); }
