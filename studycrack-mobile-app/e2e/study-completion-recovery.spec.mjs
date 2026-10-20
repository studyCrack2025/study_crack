import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

async function start(page, activity = '기록 분리 확인') {
  await page.locator('[data-action="openStudySubjectSheet"]').first().click();
  await page.locator('.home-study-form [data-study-subject="국어"]').last().click();
  await page.locator('[data-field="studyStartActivity"]').fill(activity);
  await page.locator('.study-start-confirm').click();
  await expect(page.locator('.home-study-complete[data-action="stopStudyTimer"]')).toBeEnabled();
}
async function pendingIds(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.includes('studyRecovery_v2'));
    return key ? JSON.parse(localStorage.getItem(key)).pending.map(row => row.sessionId) : [];
  });
}

function summaryFor(date, seconds = 0, available = true) {
  const now = new Date(`${date}T00:00:00Z`);
  now.setUTCDate(now.getUTCDate() + (now.getUTCDay() === 0 ? -6 : 1 - now.getUTCDay()));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now); day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    return { date: key, totalSeconds: key === date ? seconds : 0, sessionCount: 0, subjects: [] };
  });
  return { available, today: days.find(day => day.date === date), week: { startDate: days[0].date, endDate: days[6].date, totalSeconds: seconds, sessionCount: 0, subjects: [], days } };
}

test('보상이 응답하지 않아도 완료·홈 집계·다음 공부가 먼저 진행되고 두 복구 권리를 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { studyDurationSeconds: 1800 });
  let release;
  let claims = 0;
  await page.route('**/api/game', async route => {
    if (route.request().postDataJSON()?.type !== 'claim_study_reward') return route.fallback();
    claims += 1;
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await start(page);
  await page.locator('.home-study-complete[data-action="stopStudyTimer"]').click();
  await expect(page.locator('.sc-study-headline b')).toHaveText('00:30:00');
  await expect(page.locator('.home-week-flow .timer-week-summary-head b')).toHaveText('00:30:00');
  await expect.poll(() => pendingIds(page)).toHaveLength(1);
  await start(page, '두 번째 공부');
  await page.locator('.home-study-complete[data-action="stopStudyTimer"]').click();
  await expect(page.locator('.sc-study-headline b')).toHaveText('01:00:00');
  await expect.poll(() => pendingIds(page)).toHaveLength(2);
  expect(claims).toBe(1, 'Reward claims must not fan out while one is still pending.');
  await start(page, '세 번째 공부');
  release();
  await expect(page.getByRole('status', { name: '보상 복구' })).toContainText('2건');
  await expect(page.locator('.home-study-complete[data-action="stopStudyTimer"]')).toBeEnabled();
  await expect(page.locator('.sc-study-headline')).toContainText('현재 집중 시간');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath('pending-rewards-and-running-study-320.png'), fullPage: true });
  const ids = await pendingIds(page);
  await page.reload();
  await expect(page.locator('.home-study-complete[data-action="stopStudyTimer"]')).toBeEnabled();
  await expect.poll(() => pendingIds(page)).toEqual(ids);
  expect(api.requests.filter(r => r.payload.type === 'start_study_session')).toHaveLength(3);
  expect(api.state.completedStudySessions.size).toBe(2);
});

test('탭 열 번 왕복은 같은 집계를 재사용하고 완료 저장 시 한 번만 다시 조회한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { studyDurationSeconds: 1800, failGameTypes: ['claim_study_reward'] });
  const reads = () => api.requests.filter(r => r.payload.type === 'get_study_summary').length;
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.sc-study-headline b')).toHaveText('00:00:00');
  for (let i = 0; i < 10; i += 1) {
    await page.locator('.tabbar [data-tab="analysis"]').click();
    await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
    await page.locator('.tabbar [data-tab="timer"]').click();
    await expect(page.locator('.sc-study-headline b')).toHaveText('00:00:00');
  }
  expect(reads()).toBe(1);
  await start(page);
  await page.locator('.home-study-complete[data-action="stopStudyTimer"]').click();
  await expect(page.locator('.sc-study-headline b')).toHaveText('00:30:00');
  await expect.poll(reads).toBe(2);
});

test('늦은 이전 보상은 다음 공부의 결과를 덮어쓰지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { studyDurationSeconds: 1800 });
  let release;
  let delayed = false;
  await page.route('**/api/game', async route => {
    if (route.request().postDataJSON()?.type !== 'claim_study_reward' || delayed) return route.fallback();
    delayed = true;
    await new Promise(resolve => { release = resolve; });
    return route.fallback();
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await start(page, '이전 공부');
  await page.locator('.home-study-complete[data-action="stopStudyTimer"]').click();
  await expect.poll(() => pendingIds(page)).toHaveLength(1);
  await start(page, '현재 공부');
  release();
  await expect.poll(() => pendingIds(page)).toHaveLength(0);
  await expect(page.locator('.timer-reward-values')).toHaveCount(0);
  await expect(page.locator('.timer-journey-copy')).toContainText('현재 공부');
  await expect(page.locator('.home-study-complete[data-action="stopStudyTimer"]')).toBeEnabled();
  await page.locator('.home-study-complete[data-action="stopStudyTimer"]').click();
  await expect(page.locator('.timer-reward-values')).toBeVisible();
  await expect(page.locator('.timer-journey-copy')).toContainText('현재 공부');
  await expect.poll(() => pendingIds(page)).toHaveLength(0);
  expect(api.state.studyRewardReceipts.size).toBe(2);
  expect(api.state.gameProfile.ticketProgressSeconds).toBe(3600);
});

test('손상된 보상 복구 원본은 기존 보상을 다시 확인해도 덮어쓰지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.sc-study-headline b')).toHaveText('00:00:00');
  await page.evaluate(() => {
    const storage = window.getClientAccountStorage();
    storage.setItem('studyRecovery_v2', '{bad');
    storage.setItem('studyRewardPendingSessionId', JSON.stringify('session-legacy-m2'));
  });
  await page.reload();
  const recovery = page.getByRole('status', { name: '보상 복구' });
  await expect(recovery).toContainText('복구 기록을 읽지 못했어요');
  await recovery.getByRole('button', { name: '보상 다시 확인' }).click();
  await expect.poll(() => api.requests.filter(r => r.payload.type === 'claim_study_reward').length).toBe(1);
  await expect(recovery.getByRole('button', { name: '보상 다시 확인' })).toBeEnabled();
  expect(await page.evaluate(() => window.getClientAccountStorage().getItem('studyRecovery_v2'))).toBe('{bad');
  await expect(recovery).toContainText('복구 기록을 읽지 못했어요');
});

test('집계 제공 불가는 실제 0과 구분하고 재조회 실패는 마지막 확인값을 보존한다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T03:00:00Z'));
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  api.state.studySummaryOverride = summaryFor('2026-10-03', 1800);
  let phase = 'unavailable';
  await page.route('**/api/user', async route => {
    if (route.request().postDataJSON()?.type !== 'get_study_summary' || phase === 'ready') return route.fallback();
    return route.fulfill(phase === 'unavailable' ? { status: 200, json: summaryFor('2026-10-03', 0, false) } : { status: 500, json: {} });
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  const card = page.getByRole('region', { name: '학습 현황 요약' });
  await expect(card).toContainText('아직 제공할 수 없어요');
  await expect(card.locator('.sc-study-headline b')).toHaveText('기록 확인 필요');
  phase = 'ready';
  await card.getByRole('button', { name: '다시 확인' }).click();
  await expect(card.locator('.sc-study-headline b')).toHaveText('00:30:00');
  await page.locator('.home-week-flow').getByRole('button', { name: /이번 주 공부 흐름/ }).click();
  phase = 'unavailable';
  await page.locator('.home-week-flow').getByRole('button', { name: '기록 새로고침' }).click();
  await expect(card).toContainText('마지막 확인 기록');
  await expect(card.locator('.sc-study-headline b')).toHaveText('00:30:00');
  phase = 'error';
  await card.getByRole('button', { name: '다시 확인' }).click();
  await expect(card.getByRole('button', { name: '다시 확인' })).toBeVisible();
  await expect(card.locator('.sc-study-headline b')).toHaveText('00:30:00');
  phase = 'ready';
  await card.getByRole('button', { name: '다시 확인' }).click();
  await expect(card).not.toContainText('마지막 확인 기록');
});

test('한국시간 자정 복귀는 집계를 갱신하고 사용자가 고른 미래 일정은 유지한다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T14:59:50Z'));
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  api.state.studySummaryOverride = summaryFor('2026-10-03', 1800);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.sc-study-headline b')).toHaveText('00:30:00');
  await page.locator('.tabbar [data-tab="planner"]').click();
  await expect(page.locator('[data-screen="planner"]')).toBeVisible();
  await page.getByLabel('달력 더보기', { exact: true }).click();
  await page.locator('[data-planner-calendar-mode="month"]').click();
  const selected = '2026-10-10';
  const tomorrow = page.locator(`[data-action="selectPlannerDate"][data-planner-date="${selected}"]`);
  await tomorrow.click();
  await expect(page.locator('[data-action="selectPlannerDate"][aria-pressed="true"]')).toHaveAttribute('data-planner-date', selected);
  api.state.studySummaryOverride = summaryFor('2026-10-04', 0);
  await page.clock.setFixedTime(new Date('2026-10-03T15:00:01Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect.poll(() => api.requests.filter(r => r.payload.type === 'get_study_summary').length).toBe(2);
  await expect(page.locator('[data-action="selectPlannerDate"][aria-pressed="true"]')).toHaveAttribute('data-planner-date', selected);
  await page.locator('.tabbar [data-tab="timer"]').click();
  await expect(page.locator('.sc-study-headline b')).toHaveText('00:00:00');
});
