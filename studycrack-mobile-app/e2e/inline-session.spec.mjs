import { test, expect } from '@playwright/test';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test('공부 입력은 팝업으로 열고 진행 타이머만 홈 카드 안에서 펼쳐지고 접어도 유지된다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installAuthenticatedSession(page); const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('.home-active-study').click();
  await expect(page.getByRole('dialog', { name: '공부 시작', exact: true })).toBeVisible();
  await expect(page.locator('.home-study-highlight .home-study-form')).toHaveCount(0);
  await expect(page.locator('.app-screen-overlays .home-study-form')).toHaveCount(1);
  await expect(page.locator('.timer-v2-plan .home-study-form')).toHaveCount(0);
  await page.locator('.home-study-form [data-study-subject="국어"]').last().click();
  await page.locator('[data-field="studyStartActivity"]').fill('인라인 공부');
  await expect(page.locator('.app-content')).toHaveAttribute('inert', '');
  await expect(page.locator('[data-field="studyStartActivity"]')).toHaveValue('인라인 공부');
  await page.locator('.study-start-confirm').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('study-start-dialog-320.png'), animations: 'disabled' });
  await page.locator('.study-start-confirm').click();
  await expect(page.locator('.home-study-body .timer-v2-clock')).toBeVisible();
  await expect(page.locator('.home-study-highlight .home-study-complete')).toBeEnabled();
  await expect(page.locator('.home-study-body [data-action="stopStudyTimer"]')).toHaveCount(0);
  await expect(page.locator('.sc-study-headline')).toContainText('국어 · 현재 집중 시간');
  await page.locator('.home-active-study').click();
  await expect(page.locator('.home-study-body')).toBeHidden();
  await page.locator('.tabbar [data-tab="aquarium"]').click();
  await page.locator('.tabbar [data-tab="timer"]').click();
  await expect(page.locator('.home-study-body .timer-v2-clock')).toBeVisible();
  expect(api.requests.filter(r => r.payload.type === 'start_study_session')).toHaveLength(1);
  expect(api.requests.find(r => r.payload.type === 'start_study_session').payload.data).toMatchObject({ subject: '국어', activity: '인라인 공부', plannerItemId: '' });
  await page.locator('.timer-v2-clock').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('inline-timer-320.png') });
});

test('MY는 하위 화면 왕복 동안 같은 DOM을 유지한다', async ({ page }, info) => {
  await installAuthenticatedSession(page); await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  const my = page.locator('.my-summary-sheet');
  await my.evaluate(el => { window.__mySurface = el; });
  await my.locator('[data-target="ranking"]').click();
  await expect(page.getByRole('dialog', { name: '프로필 메뉴', exact: true })).toHaveCount(0);
  await page.locator('[data-action="back"]').first().click();
  await expect(page.locator('.my-persistent-host')).toHaveAttribute('data-exiting', 'true');
  await expect(page.locator('.my-persistent-host')).toHaveCSS('transform', 'none');
  await expect(page.locator('.app-content[data-my-exit]')).toHaveCSS('opacity', '1');
  await expect(page.locator('.my-persistent-host > .sc-overlay')).toHaveAttribute('inert', '');
  await page.screenshot({ path: info.outputPath('my-return-in-motion.png') });
  await expect(page.getByRole('dialog', { name: '프로필 메뉴', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('my-return-complete.png') });
  expect(await my.evaluate(el => el === window.__mySurface)).toBe(true);
  await expect(my).toHaveCSS('animation-name', 'none');
});

test('분석 최초 자동 계산 후 열 번 왕복해도 추가 요청 없이 과목명을 유지한다', async ({ page }) => {
  await installAuthenticatedSession(page); const api = await installApiMock(page, { tier: 'standard' });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  const refresh = page.getByRole('button', { name: '분석 새로고침', exact: true });
  await expect(page.locator('.analysis-score-card strong')).toHaveText(/점/);
  await expect(refresh).toBeEnabled();
  await expect.poll(() => api.requests.filter(r => r.payload.type === 'backtrace_required_raw').length).toBeGreaterThan(0);
  await expect(page.locator('.analysis-refresh-bar')).toContainText('마지막 계산');
  const count = () => api.requests.filter(r => /^(analyze_my_targets|simulate_score_rise|backtrace_required_raw)$/.test(r.payload.type)).length;
  const before = count();
  for (let i = 0; i < 10; i++) { await page.locator('.tabbar [data-tab="timer"]').click(); await page.locator('.tabbar [data-tab="analysis"]').click(); }
  await expect(page.locator('.analysis-score-card strong')).toHaveText(/점/);
  expect(count()).toBe(before);
  await page.getByRole('button', { name: '합격권 도달 조합', exact: true }).click();
  await expect(page.locator('.analysis-reverse-card')).not.toContainText('탐구2');
  await refresh.click();
  await expect(page.locator('.analysis-refresh-bar')).toContainText('마지막 계산');
  await expect.poll(count).toBeGreaterThan(before);
});

test('분석 중 다른 탭에 가도 작업을 마치고 돌아올 때 재요청하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page); const api = await installApiMock(page, { tier: 'standard', analysisDelayByExam: { jun: 200 } });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await expect.poll(() => api.requests.filter(r => r.payload.type === 'analyze_my_targets').length).toBe(1);
  await page.locator('.tabbar [data-tab="timer"]').click();
  await expect.poll(() => api.requests.filter(r => r.payload.type === 'backtrace_required_raw').length).toBe(2);
  await page.locator('.tabbar [data-tab="analysis"]').click();
  await expect(page.getByRole('button', { name: '분석 새로고침', exact: true })).toBeEnabled();
  await expect(page.locator('.analysis-score-card strong')).toHaveText('142점');
  expect(api.requests.filter(r => r.payload.type === 'analyze_my_targets')).toHaveLength(1);
});

for (const failure of [false, true]) test(`정성 저장 ${failure ? '실패는 입력을 유지' : '성공은 MY로 자동 복귀'}한다`, async ({ page }) => {
  await installAuthenticatedSession(page); const api = await installApiMock(page, { failGameTypes: failure ? ['update_qual'] : [], userOverrides: { qualitative: { status: '고3', stream: 'natural' } } });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await page.locator('.my-summary-checklist summary').click();
  await page.locator('.my-summary-sheet [data-target="qualInfo"]').first().click();
  await page.locator('[data-ob-grade]').first().click();
  await page.locator('#qual-school').fill('테스트 고등학교');
  await page.locator('#qual-track').selectOption({ index: 1 });
  await page.locator('#qual-goal').fill('내 학습 계획 세우기');
  await page.getByRole('button', { name: '정성조사서 저장', exact: true }).click();
  await expect.poll(() => api.requests.filter(r => r.payload.type === 'update_qual').length).toBe(1);
  if (failure) { await expect(page.locator('#qual-goal')).toHaveValue('내 학습 계획 세우기'); await expect(page.locator('.qual-save-btn')).toBeEnabled(); }
  else { await expect(page.getByRole('dialog', { name: '프로필 메뉴', exact: true })).toBeVisible(); await expect(page.locator('.profile-save-notice')).toContainText('저장했어요'); }
});
