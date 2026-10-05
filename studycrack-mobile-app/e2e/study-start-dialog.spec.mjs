import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const dialogFor = page => page.getByRole('dialog', { name: '공부 시작', exact: true });
async function setup(page, options = {}) {
  await page.clock.setFixedTime(new Date('2026-10-06T03:00:00Z'));
  await installAuthenticatedSession(page, { now: new Date('2026-10-06T03:00:00Z').getTime() });
  return installApiMock(page, options);
}
async function open(page) {
  const trigger = page.locator('.home-active-study');
  await trigger.focus(); await trigger.press('Enter');
  const dialog = dialogFor(page);
  await expect(dialog).toBeVisible();
  return dialog;
}
async function choose(page, subject = '국어', activity = '팝업에서 시작한 공부') {
  const dialog = dialogFor(page);
  await dialog.locator(`[data-study-subject="${subject}"]`).last().click();
  await dialog.getByLabel('학습 내용', { exact: true }).fill(activity);
}
const starts = api => api.requests.filter(row => row.payload.type === 'start_study_session');

for (const width of [320, 360, 390, 430]) test(`시작 팝업은 홈 크기를 늘리지 않고 입력·취소·초점과 키보드 높이를 지킨다 (${width}px)`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const api = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.sc-study-headline b')).toHaveText('00:00:00');
  const height = await page.locator('.home-study-highlight').evaluate(element => element.offsetHeight);
  const dialog = await open(page);
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
  await expect(page.locator('.app-content')).toHaveAttribute('inert', '');
  await expect(page.locator('.tabbar')).toHaveAttribute('inert', '');
  await expect(page.locator('.app-content')).toHaveClass(/modal-lock/);
  expect(await page.locator('.home-study-highlight').evaluate(element => element.offsetHeight)).toBe(height);
  await expect(page.locator('.home-study-highlight .home-study-form')).toHaveCount(0);
  const start = dialog.getByRole('button', { name: '공부 시작', exact: true });
  await expect(start).toBeDisabled();
  await choose(page, '기타', '한글 학습 내용');
  await expect(start).toBeDisabled();
  await dialog.getByLabel('과목 또는 영역', { exact: true }).fill('  ');
  await expect(start).toBeDisabled();
  await dialog.getByLabel('과목 또는 영역', { exact: true }).fill('가'.repeat(30));
  await expect(start).toBeEnabled();
  await expect(dialog.getByLabel('과목 또는 영역', { exact: true })).toHaveAttribute('maxlength', '30');
  await expect(dialog.getByLabel('학습 내용', { exact: true })).toHaveAttribute('maxlength', '80');
  await dialog.getByRole('button', { name: '닫기', exact: true }).focus();
  await page.keyboard.press('Shift+Tab'); await expect(start).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 400 });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await dialog.getByLabel('학습 내용', { exact: true }).focus();
  await expect.poll(async () => { const box = await dialog.boundingBox(); return box.y >= 0 && box.y + box.height <= 401; }).toBe(true);
  await expect(start).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath(`study-start-${width}-keyboard.png`), animations: 'disabled' });
  await dialog.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(page.locator('.home-active-study')).toBeFocused();
  await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
  await open(page);
  await page.locator('.sc-overlay--modal').click({ position: { x: 2, y: 2 } });
  await expect(dialog).toHaveCount(0); await expect(page.locator('.home-active-study')).toBeFocused();
  await open(page); await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0); await open(page);
  await expect(dialog.getByLabel('학습 내용', { exact: true })).toHaveCount(0);
  await dialog.evaluate(element => { const back = document.createElement('button'); back.type = 'button'; back.dataset.action = 'back'; back.textContent = '검사 뒤로가기'; element.append(back); });
  await dialog.getByRole('button', { name: '검사 뒤로가기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(starts(api)).toHaveLength(0);
});

test('요청 중 닫기·뒤로가기·중복 시작을 막고 응답 성공 후 홈의 실제 타이머로 복귀한다', async ({ page }) => {
  const api = await setup(page);
  let release; const calls = [];
  await page.route('**/api/user', async route => {
    const payload = route.request().postDataJSON();
    if (payload.type !== 'start_study_session') return route.fallback();
    calls.push(payload.data);
    await new Promise(resolve => { release = resolve; });
    return route.fallback();
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  const dialog = await open(page); await choose(page);
  await dialog.getByRole('button', { name: '공부 시작', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('시작 확인 중…');
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '나중에 확인', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '시작 확인 중…', exact: true })).toBeDisabled();
  await expect(dialog.locator('[data-action="selectStudySubject"]')).toHaveCount(0);
  await dialog.press('Escape');
  await page.locator('.sc-overlay--modal').click({ position: { x: 2, y: 2 } });
  await dialog.evaluate(element => { const back = document.createElement('button'); back.type = 'button'; back.dataset.action = 'back'; back.textContent = '검사 뒤로가기'; element.append(back); });
  await dialog.getByRole('button', { name: '검사 뒤로가기', exact: true }).click();
  await expect(dialog).toBeVisible(); expect(calls).toHaveLength(1);
  await expect(page.locator('.sc-study-headline')).not.toContainText('현재 집중 시간');
  release();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.sc-study-headline')).toContainText('국어 · 현재 집중 시간');
  await expect(page.locator('.home-active-study')).toBeFocused();
  await expect(page.locator('.home-study-complete[data-action="stopStudyTimer"]')).toBeEnabled();
  expect(starts(api)).toHaveLength(1);
});

test('미확정 시작은 닫기·새로고침 뒤 같은 ID와 입력으로 복구하며 새 요청을 만들지 않는다', async ({ page }) => {
  const api = await setup(page, { loseResponseOnceTypes: ['start_study_session'] });
  await page.goto('/studycrack-mobile.html?screen=timer');
  const dialog = await open(page); await choose(page, '기타', '네트워크가 끊겨도 보존할 공부');
  await dialog.getByLabel('과목 또는 영역', { exact: true }).fill('정치와법');
  await dialog.getByRole('button', { name: '공부 시작', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '시작 다시 확인', exact: true })).toBeEnabled();
  await expect(dialog.locator('[data-field]')).toHaveCount(0);
  const candidate = starts(api)[0].payload.data;
  await dialog.getByRole('button', { name: '나중에 확인', exact: true }).click();
  await expect(dialog).toHaveCount(0); await page.reload();
  await expect(page.locator('.home-study-body [data-action="retryStudyStart"]')).toBeVisible();
  await page.locator('.home-study-body [data-action="retryStudyStart"]').click();
  await expect(page.locator('.home-study-complete[data-action="stopStudyTimer"]')).toBeEnabled();
  await expect(dialog).toHaveCount(0);
  expect(starts(api).map(row => row.payload.data)).toEqual([candidate, candidate]);
  expect(candidate).toMatchObject({ subject: '정치와법', activity: '네트워크가 끊겨도 보존할 공부', plannerItemId: '' });
});

test('이미 완료된 시작 응답은 공부 완료·보상 복구로 이어지고 가짜 타이머를 시작하지 않는다', async ({ page }) => {
  const api = await setup(page);
  const calls = [];
  await page.route('**/api/user', route => {
    const payload = route.request().postDataJSON();
    if (payload.type !== 'start_study_session') return route.fallback();
    calls.push(payload.data);
    const completed = { ...payload.data, status: 'completed', startedAt: '2026-10-06T02:30:00Z', endedAt: '2026-10-06T03:00:00Z', durationSeconds: 1800, rewardEligible: true, alreadyStarted: true };
    api.state.completedStudySessions.set(completed.sessionId, completed);
    api.state.studySeconds = 1800;
    return route.fulfill({ status: 200, json: completed });
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  const dialog = await open(page); await choose(page);
  await dialog.getByRole('button', { name: '공부 시작', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.sc-study-headline b')).toHaveText('00:30:00');
  await expect(page.locator('.sc-study-headline')).not.toContainText('현재 집중 시간');
  await expect(page.locator('.home-study-complete[data-action="stopStudyTimer"]')).toHaveCount(0);
  await expect(page.getByRole('status', { name: '보상 복구' })).toContainText('1건');
  await page.getByRole('button', { name: '보상 다시 확인', exact: true }).click();
  await expect(page.locator('.timer-reward-values')).toBeVisible();
  expect(calls).toHaveLength(1); expect(api.state.studyRewardReceipts.size).toBe(1);
  expect(api.requests.filter(row => row.payload.type === 'complete_study_session')).toHaveLength(0);
});

test('긴 계획과 기타 과목은 320px·200%에서도 잘리지 않고 계획 ID와 제한 길이를 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const api = await setup(page);
  await page.addInitScript(() => localStorage.setItem('plannerItems', JSON.stringify([
    { id: 'long-start-plan', date: '2026-10-06', subject: '기타', content: '나'.repeat(100), minutes: 30 }
  ])));
  await page.goto('/studycrack-mobile.html?screen=timer');
  const trigger = page.locator('.timer-v2-plan-list > button').first();
  await trigger.focus(); await trigger.press('Enter');
  const dialog = dialogFor(page);
  await expect(dialog.getByLabel('학습 내용', { exact: true })).toHaveValue('나'.repeat(80));
  await expect(dialog.getByLabel('과목 또는 영역', { exact: true })).toHaveCount(0);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await expectNoHorizontalOverflow(page);
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '공부 시작', exact: true })).toBeInViewport();
  await dialog.getByLabel('학습 내용', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('study-start-long-plan-expanded.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await dialog.getByRole('button', { name: '공부 시작', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.home-active-study')).toBeFocused();
  expect(starts(api)).toHaveLength(1);
  expect(starts(api)[0].payload.data).toMatchObject({ subject: '기타', activity: '나'.repeat(80), plannerItemId: 'long-start-plan' });
});
