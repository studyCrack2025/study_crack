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
  test(`홈은 내 물고기에서 끝나고 공부 기록은 프로필에서 연다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const api = await setup(page, { count: 5 });
    api.state.fishInventory = [{ fishId: 'home-fish-1', speciesId: 'blue_damsel', name: '마루', growthStage: 'baby', rarity: 'common' }];
    api.state.activeFish = [null, api.state.fishInventory[0], null];
    await page.goto('/studycrack-mobile.html?screen=timer');
    await expect(page.locator('.timer-session-panel')).toHaveCount(0);
    await expect(page.locator('.timer-v2-clock')).not.toBeVisible();
    await expect(page.getByRole('button', { name: '공부 시작', exact: true })).toBeEnabled();
    await expect(page.locator('.timer-v2-plan-list > button')).toHaveCount(4);
    await expect(page.locator('.home-plan-more')).toContainText('+1개');
    await expect(page.getByRole('progressbar', { name: '과제 완료율' })).toHaveAttribute('aria-valuenow', '20');
    await expect(page.locator('.sc-study-metrics dd').first()).toHaveText('00:00:00');
    await expect(page.locator('.timer-v2-plan-list > button').first()).toHaveAttribute('data-done', 'true');
    await expect(page.locator('.timer-v2-plan-list > button').first().locator('b')).toHaveCSS('text-decoration-line', 'line-through');
    const title = page.locator('.timer-v2-plan-list > button').nth(1).locator('b');
    expect((await title.boundingBox()).height).toBeGreaterThan(30);
    await expect(page.locator('[data-scene-variant="home"]')).toHaveCSS('height', '96px');
    await expect(page.locator('[data-scene-variant="home"] button')).toHaveCount(0);
    await expect(page.locator('.home-aquarium-count')).toHaveText('물고기 1마리');
    const rail = page.getByRole('region', { name: '학습 현황 바로가기' });
    await expect(rail.getByRole('button')).toHaveCount(4);
    await expect(rail.locator('[data-target="aquarium"]')).toHaveText('물고기 1마리');
    await expect(rail.locator('[data-target="analysis"]')).toHaveAccessibleName(/목표 대학/);
    for (const button of await rail.getByRole('button').all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(button).toHaveCSS('grid-template-rows', /24px /);
    }
    const selectors = ['.timer-v2-brand-head', '.timer-v2-status-rail', '.timer-v2-target-summary', '.home-study-highlight', '.timer-v2-plan', '.home-aquarium-preview'];
    const tops = await Promise.all(selectors.map(selector => page.locator(selector).evaluate(el => el.offsetTop)));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    await expectNoHorizontalOverflow(page);
    await page.locator('.app-content').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(`home-${width}-top.png`), animations: 'disabled' });
    await page.locator('.home-aquarium-preview').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`home-${width}-preview.png`), animations: 'disabled' });
    await expect(page.locator('main.timer-screen-v2 > :last-child')).toHaveClass(/home-aquarium-preview/);
    await expect(page.locator('main .timer-v2-week, main .timer-v2-quick')).toHaveCount(0);
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    await page.getByRole('button', { name: '공부 기록 주간·과목별 기록과 수조 성장 규칙' }).click();
    await expect(page.getByRole('dialog', { name: '공부 기록', exact: true })).toBeVisible();
    await expect(page.locator('.timer-v2-week')).toBeVisible();
    await page.getByRole('button', { name: '타이머 열기', exact: true }).click();
    await expect(page.locator('.timer-v2-clock')).toBeVisible();
    await page.getByRole('button', { name: '타이머 닫기' }).click();
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
    await expect(page.getByRole('button', { name: '공부 시작', exact: true })).toBeEnabled();
    await expect(page.locator('.timer-v2-plan-list > button')).toHaveCount(['free', 'trial'].includes(tier) ? 0 : count);
    if (['free', 'trial'].includes(tier)) await expect(page.locator('.timer-v2-plan')).toContainText('Basic 이상');
    if (count === 0) await expect(page.locator('.timer-v2-plan')).toContainText('아직 등록한 계획이 없어요');
    if (count === 4 && tier === 'pro') {
      await expect(page.getByRole('progressbar', { name: '과제 완료율' })).toHaveAttribute('aria-valuenow', '25');
      await expect(page.locator('.sc-study-metrics dd').first()).toHaveText('00:00:00');
    }
  });
}

test('수조와 공부 기록이 각각 실패해도 계획과 직접 공부를 유지한다', async ({ page }) => {
  const failures = ['get_game_profile', 'get_study_summary'];
  await setup(page, { failGameTypes: failures });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.home-aquarium-state')).toContainText('수조를 불러오지 못했어요');
  await expect(page.locator('.home-aquarium-count')).toHaveCount(0);
  await expect(page.locator('.sc-study-metrics dd').first()).toHaveText('확인 필요');
  await expect(page.locator('.timer-v2-plan-list > button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '공부 시작', exact: true })).toBeEnabled();
  failures.length = 0;
  await page.getByRole('button', { name: '수조 다시 확인' }).click();
  await expect(page.locator('.home-aquarium-count')).toHaveText('물고기 0마리');
});

test('타이머 창을 닫아도 공부가 유지되고 새로고침·보상 오류에서 다시 열 수 있다', async ({ page }, testInfo) => {
  const api = await setup(page, { failOnceTypes: ['claim_study_reward'], studyDurationSeconds: 1500 });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('.timer-v2-plan-list > button').nth(1).click();
  await page.locator('.study-start-confirm').click();
  const dialog = page.getByRole('dialog', { name: '공부 타이머', exact: true });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: '타이머 닫기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.home-active-study')).toContainText('공부 기록 중');
  await page.locator('.home-active-study').click();
  await expect(page.locator('.timer-v2-clock')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.locator('.home-active-study')).toBeFocused();
  await page.locator('.tabbar [data-tab="planner"]').click();
  await page.locator('.tabbar [data-tab="timer"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.home-active-study')).toContainText('공부 기록 중');
  await page.reload();
  await page.locator('.home-active-study').filter({ hasText: '타이머 열기' }).click();
  await expect(dialog).toBeVisible();
  expect(api.requests.filter(({ payload }) => payload.type === 'start_study_session')).toHaveLength(1);
  await page.getByRole('button', { name: '공부 완료', exact: true }).click();
  await expect(page.locator('[data-action="retryStudyReward"]')).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: '공부 시작', exact: true })).toBeDisabled();
  await page.locator('.timer-session-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('home-reward-error.png'), animations: 'disabled' });
  await page.locator('[data-action="retryStudyReward"]').click();
  await expect(page.locator('.timer-reward-values')).toBeVisible();
  await page.locator('[data-action="dismissRewardResult"]').click();
  await page.getByRole('button', { name: '타이머 닫기' }).click();
  await expect(page.getByRole('button', { name: '공부 시작', exact: true })).toBeEnabled();
});

test('공부 시작 실패는 별도 타이머 창에서 재시도하고 홈 아래에 패널을 남기지 않는다', async ({ page }) => {
  const api = await setup(page, { failOnceTypes: ['start_study_session'] });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('.timer-v2-plan-list > button').nth(1).click();
  await page.locator('.study-start-confirm').click();
  const dialog = page.getByRole('dialog', { name: '공부 타이머', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog', { name: '공부 시작', exact: true })).toHaveCount(0);
  await expect(dialog.locator('[data-action="retryStudyStart"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('main.timer-screen-v2 > :last-child')).toHaveClass(/home-aquarium-preview/);
  await page.locator('.home-active-study').click();
  await dialog.locator('[data-action="retryStudyStart"]').click();
  await expect(dialog.getByRole('button', { name: '공부 완료', exact: true })).toBeEnabled();
  const requests = api.requests.filter(({ payload }) => payload.type === 'start_study_session');
  expect(requests).toHaveLength(2);
  expect(requests[0].payload.data.sessionId).toBe(requests[1].payload.data.sessionId);
});

test('전체 MY에서도 공부 기록과 랭킹으로 이동한다', async ({ page }) => {
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=my');
  await page.locator('[data-action="openStudyRecords"]').click();
  await expect(page.getByRole('dialog', { name: '공부 기록', exact: true })).toBeVisible();
  await page.locator('[data-action="openGameRules"]').click();
  await expect(page.getByRole('dialog', { name: '수조 성장 규칙', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '공부 기록', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await page.locator('[data-target="ranking"]').click();
  await expect(page.locator('[data-screen="ranking"]')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
