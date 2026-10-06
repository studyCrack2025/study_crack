import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
async function setup(page, { count = 4, tier = 'basic', ...options } = {}) {
  await page.clock.setFixedTime(new Date('2026-09-07T03:00:00Z'));
  await installAuthenticatedSession(page);
  await page.addInitScript(({ count }) => localStorage.setItem('plannerItems', JSON.stringify(Array.from({ length: count }, (_, index) => ({
    id: `home-plan-${index}`, date: '2026-09-07', subject: ['국어', '수학', '영어', '생명과학'][index % 4], category: '학습',
    content: index === 1 ? '긴 한글 과제 제목도 생략하지 않고 여러 줄로 표시하며 학습 내용을 확인할 수 있어요' : `오늘 공부 ${index + 1}`,
    minutes: index ? 90 : 30, done: index === 0, start: '09:00', end: '10:00'
  })))), { count });
  const api = await installApiMock(page, { tier, ...options });
  api.state.studySeconds = 0;
  return api;
}

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`홈은 학습 카드에서 시작하고 미완료 계획 2개 뒤에 주간 흐름을 표시한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const api = await setup(page, { count: 5 });
    api.state.fishInventory = [{ fishId: 'home-fish-1', speciesId: 'blue_damsel', name: '마루', growthStage: 'baby', rarity: 'common' }];
    api.state.activeFish = [null, api.state.fishInventory[0], null];
    await page.goto('/studycrack-mobile.html?screen=timer');
    await expect(page.locator('.timer-session-panel')).toHaveCount(0);
    await expect(page.locator('.timer-v2-clock')).not.toBeVisible();
    await expect(page.locator('.home-study-highlight .home-active-study')).toBeEnabled();
    await expect(page.locator('.home-active-study')).toHaveAccessibleName('공부 시작');
    await expect(page.locator('.home-active-study')).toHaveCSS('border-radius', '4px');
    await expect(page.locator('.timer-v2-plan')).toHaveCSS('box-shadow', 'none');
    await expect(page.locator('.timer-v2-plan-list > button').first()).toHaveCSS('border-radius', '4px');
    await expect(page.locator('.home-study-highlight [data-action="startPlannedStudy"]')).toHaveAttribute('data-study-item-id', 'home-plan-1');
    await expect(page.locator('.timer-v2-plan-list > button')).toHaveCount(2);
    await expect(page.locator('.home-plan-more')).toContainText('+2개');
    await expect(page.getByRole('progressbar', { name: '과제 완료율' })).toHaveAttribute('aria-valuenow', '20');
    await expect(page.locator('.sc-study-headline b').first()).toHaveText('00:00:00');
    await expect(page.locator('.timer-v2-plan-list > button').first()).toHaveAttribute('data-study-item-id', 'home-plan-1');
    await expect(page.locator('.timer-v2-plan-list > button').first()).toHaveAttribute('data-done', 'false');
    await expect(page.locator('.timer-v2-plan-list > button').first().locator('b')).toHaveCSS('text-decoration-line', 'none');
    const title = page.locator('.timer-v2-plan-list > button').first().locator('b');
    expect((await title.boundingBox()).height).toBeGreaterThan(30);
    await expect(page.locator('.home-aquarium-preview')).toHaveCount(0);
    await expect(page.locator('[data-scene-variant="home"] button')).toHaveCount(0);

    await expect(page.getByRole('region', { name: '학습 현황 바로가기' })).toHaveCount(0);
    await expect(page.locator('.timer-v2-status-rail')).toHaveCount(0);
    await expect(page.locator('.home-study-highlight .home-study-streak')).toHaveAccessibleName(/연속 학습/);
    expect((await page.locator('.home-study-streak').boundingBox()).height).toBeGreaterThanOrEqual(44);
    const selectors = ['.timer-v2-brand-head', '.home-study-highlight', '.timer-v2-target-summary', '.timer-v2-plan', '.home-week-flow'];
    const tops = await Promise.all(selectors.map(selector => page.locator(selector).evaluate(el => el.offsetTop)));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    await expectNoHorizontalOverflow(page);
    await page.locator('.app-content').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(`home-${width}-top.png`), animations: 'disabled' });
    await page.locator('.timer-v2-plan').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`home-${width}-preview.png`), animations: 'disabled' });
    await expect(page.locator('main.timer-screen-v2 > :last-child')).toHaveClass(/home-week-flow/);
    await expect(page.locator('main .timer-v2-week, main .timer-v2-quick')).toHaveCount(0);
    await expect(page.locator('.sc-study-details')).toHaveCount(0);
    await expect(page.locator('.home-week-flow .timer-week-day')).toHaveCount(7);
    await page.getByRole('button', { name: /이번 주 공부 흐름/ }).click();
    await expect(page.locator('.home-week-flow .timer-day-subjects')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '공부 기록', exact: true })).toHaveCount(0);
    await page.locator('.home-active-study').click();
    await expect(page.locator('.home-study-form')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '공부 시작', exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: '공부 시작', exact: true }).getByRole('button', { name: '닫기', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '공부 시작', exact: true })).toHaveCount(0);
    await expect(page.locator('#home-timer-detail')).toHaveCount(0);
    expect(api.requests.filter(({ payload }) => payload.type === 'get_game_profile')).toHaveLength(1);
    expect(api.requests.filter(({ payload }) => payload.type === 'get_fish_catalog')).toHaveLength(0);
    expect(api.requests.filter(({ payload }) => /simulate|backtrace/.test(payload.type))).toHaveLength(0);
  });
}

for (const [tier, count] of [['free', 4], ['trial', 4], ['basic', 0], ['standard', 1], ['pro', 4]]) {
  test(`${tier} 홈의 과제 ${count}개와 직접 공부 접근을 보존한다`, async ({ page }) => {
    await setup(page, { tier, count });
    await page.goto('/studycrack-mobile.html?screen=timer');
    await expect(page.locator('.home-active-study')).toBeEnabled();
    await expect(page.locator('.timer-v2-plan-list > button')).toHaveCount(Math.min(2, Math.max(0, count - 1)));
    await expect(page.locator('.timer-v2-plan')).not.toContainText('Basic 이상');
    if (count === 0) await expect(page.locator('.timer-v2-plan')).toContainText('아직 등록한 계획이 없어요');
    if (count === 1) await expect(page.locator('.timer-v2-plan')).toContainText('오늘 계획 완료');
    await page.locator('.timer-v2-plan [data-target="planner"]').first().click();
    await expect(page.locator('[data-screen="planner"]')).toBeVisible();
    await expect(page.locator('.locked-feature-screen')).toHaveCount(0);
    await page.locator('.tabbar [data-tab="timer"]').click();
    if (count === 4 && tier === 'pro') {
      await expect(page.getByRole('progressbar', { name: '과제 완료율' })).toHaveAttribute('aria-valuenow', '25');
      await expect(page.locator('.sc-study-headline b').first()).toHaveText('00:00:00');
    }
  });
}

test('수조와 공부 기록이 각각 실패해도 계획과 직접 공부를 유지한다', async ({ page }) => {
  const failures = ['get_game_profile', 'get_study_summary'];
  await setup(page, { failGameTypes: failures });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.home-study-streak')).toContainText('확인 필요');
  await expect(page.locator('.home-aquarium-count')).toHaveCount(0);
  await expect(page.locator('.sc-study-headline b').first()).toHaveText('기록 확인 필요');
  await expect(page.locator('.timer-v2-plan-list > button')).toHaveCount(2);
  await expect(page.locator('.home-active-study')).toBeEnabled();
  failures.length = 0;
  await page.locator('.tabbar [data-tab="aquarium"]').click();
  await expect(page.getByRole('region', { name: '수조 성장 요약' })).toContainText('0마리');
});

test('타이머를 접어도 공부가 유지되고 새로고침·보상 오류에서 다시 열 수 있다', async ({ page }, testInfo) => {
  const api = await setup(page, { failOnceTypes: ['claim_study_reward'], studyDurationSeconds: 1500 });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('.timer-v2-plan-list > button').first().click();
  await page.locator('.study-start-confirm').click();
  const dialog = page.locator('.home-study-body');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: '공부 영역 접기' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.home-active-study')).toContainText('수학');
  await page.locator('.home-active-study').click();
  await expect(page.locator('.timer-v2-clock')).toBeInViewport();
  await page.getByRole('button', { name: '공부 영역 접기' }).click();
  await expect(page.locator('.home-active-study')).toBeFocused();
  await page.locator('.tabbar [data-tab="planner"]').click();
  await page.locator('.tabbar [data-tab="timer"]').click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('.home-active-study')).toContainText('수학');
  await page.reload();
  await expect(dialog).toBeVisible();
  expect(api.requests.filter(({ payload }) => payload.type === 'start_study_session')).toHaveLength(1);
  await page.getByRole('button', { name: '공부 완료', exact: true }).click();
  await expect(page.locator('[data-action="retryStudyReward"]')).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.locator('.study-start-confirm')).toHaveCount(0);
  await page.locator('.timer-session-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('home-reward-error.png'), animations: 'disabled' });
  await page.locator('[data-action="retryStudyReward"]').click();
  await expect(page.locator('.timer-reward-values')).toBeVisible();
  await page.locator('[data-action="dismissRewardResult"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.home-active-study')).toHaveAccessibleName('공부 시작');
  await expect(page.locator('.home-active-study')).toBeEnabled();
});

test('공부 시작 실패는 팝업에서 동일 세션으로 재시도하고 닫아도 복구를 유지한다', async ({ page }) => {
  const api = await setup(page, { failOnceTypes: ['start_study_session'] });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('.timer-v2-plan-list > button').first().click();
  await page.locator('.study-start-confirm').click();
  const dialog = page.getByRole('dialog', { name: '공부 시작', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-action="retryStudyStart"]')).toBeVisible();
  await dialog.getByRole('button', { name: '나중에 확인', exact: true }).click();
  await expect(page.locator('main.timer-screen-v2 > :last-child')).toHaveClass(/home-week-flow/);
  await page.locator('.home-study-body [data-action="retryStudyStart"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.home-study-highlight .home-study-complete')).toBeEnabled();
  const requests = api.requests.filter(({ payload }) => payload.type === 'start_study_session');
  expect(requests).toHaveLength(2);
  expect(requests[0].payload.data.sessionId).toBe(requests[1].payload.data.sessionId);
});

test('무료 계정도 학습 카드의 다음 공부를 바로 시작하고 카드에서 완료한다', async ({ page }) => {
  const api = await setup(page, { tier: 'free', studyDurationSeconds: 1500 });
  await page.goto('/studycrack-mobile.html?screen=timer');
  const start = page.locator('.sc-study-banner-actions [data-action="startPlannedStudy"]');
  await expect(start).toHaveAttribute('data-study-item-id', 'home-plan-1');
  await expect(page.locator('.home-active-study')).toHaveAccessibleName('공부 시작');
  await start.click();
  await expect(page.locator('.home-study-body .timer-v2-clock')).toBeVisible();
  await expect(page.locator('.home-study-form')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.sc-study-headline')).toContainText('수학 · 현재 집중 시간');
  const requests = api.requests.filter(({ payload }) => payload.type === 'start_study_session');
  expect(requests).toHaveLength(1);
  expect(requests[0].payload.data).toMatchObject({ subject: '수학', plannerItemId: 'home-plan-1', activity: '긴 한글 과제 제목도 생략하지 않고 여러 줄로 표시하며 학습 내용을 확인할 수 있어요' });
  await expect(page.locator('.home-next-study')).toHaveCount(0);
  await page.getByRole('button', { name: '공부 영역 접기' }).click();
  await expect(page.locator('.home-study-body')).toBeHidden();
  const complete = page.locator('.sc-study-banner-actions .home-study-complete');
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.locator('.timer-reward-values')).toBeVisible();
  const sessionId = requests[0].payload.data.sessionId;
  expect(api.requests.filter(({ payload }) => payload.type === 'complete_study_session').map(({ payload }) => payload.data.sessionId)).toEqual([sessionId]);
  expect(api.requests.filter(({ payload }) => payload.type === 'claim_study_reward').map(({ payload }) => payload.data.sessionId)).toEqual([sessionId]);
  await page.locator('.timer-reward-close').click();
  await expect(page.locator('.home-active-study')).toHaveAttribute('data-action', 'openStudySubjectSheet');
  await page.locator('.home-active-study').click();
  await expect(page.locator('.home-study-form')).toBeVisible();
  await page.locator('[data-study-subject="국어"]').last().click();
  await page.locator('[data-field="studyStartActivity"]').fill('홈에서 두 번째 공부');
  await page.locator('[data-action="confirmStudyStart"]').click();
  await expect(complete).toBeEnabled();
  const nextSession = api.requests.filter(({ payload }) => payload.type === 'start_study_session');
  expect(nextSession).toHaveLength(2);
  expect(nextSession[1].payload.data.sessionId).not.toBe(sessionId);
});

test('공부 기록은 주간 흐름에서 열고 MY에서는 제거된다', async ({ page }) => {
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=my');
  await expect(page.locator('[data-action="openStudyRecords"]')).toHaveCount(0);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: /이번 주 공부 흐름/ }).click();
  await expect(page.locator('.home-week-flow .timer-day-subjects')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '공부 기록', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await page.locator('[data-target="ranking"]').click();
  await expect(page.locator('[data-screen="ranking"]')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
