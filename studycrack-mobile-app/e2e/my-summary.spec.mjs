import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`MY 하단 요약과 전체 MY는 같은 저장 정보로 연결된다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    const api = await installApiMock(page, { tier: 'standard', initialGameProfile: { streakDays: 7 } });
    api.state.studySeconds = 3600;
    api.state.userOverrides = { name: '긴 이름과 여러 단어를 가진 검수 학생' };
    await page.goto('/studycrack-mobile.html?screen=timer');
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    const dialog = page.getByRole('dialog', { name: '프로필 메뉴' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('border-top-left-radius', '30px');
    await expect(dialog).toContainText('연세대학교 정치외교학과');
    const summaryStats = dialog.getByRole('region', { name: '공부와 수조 요약' });
    await expect(summaryStats).toHaveCount(1);
    await expect(summaryStats).toHaveClass('my-summary-hero-stats');
    await expect(summaryStats).toContainText('1시간');
    await expect(summaryStats).toContainText('0마리');
    await expect(summaryStats).toContainText('7일');
    await expect(dialog.locator('.my-summary-checklist summary')).toContainText('2/4');
    const box = await dialog.boundingBox();
    const frame = await page.locator('.app-frame').boundingBox();
    expect(Math.abs(box.y + box.height - frame.y - frame.height)).toBeLessThan(2);
    expect(box.height).toBeLessThanOrEqual(height * .88 + 1);
    await page.evaluate(() => document.fonts.ready);
    const capture = async name => page.screenshot({ path: process.env.STUDYCRACK_MY_CAPTURE_DIR ? resolve(process.env.STUDYCRACK_MY_CAPTURE_DIR, `${name}-${width}.png`) : testInfo.outputPath(`${name}-${width}.png`), animations: 'disabled' });
    await capture('sheet');
    const before = await summaryStats.innerText();
    await dialog.locator('.my-summary-checklist summary').click();
    await expect(dialog.getByRole('button', { name: /학습유형 MBTI 설정하기/ })).toBeVisible();
    await capture('checklist');
    const last = dialog.getByRole('button', { name: /약관 · 설정/ });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await dialog.getByRole('button', { name: '마이페이지 전체 보기' }).click();
    await expect(page.locator('[data-screen="my"]')).toBeVisible();
    await expect(page.locator('.my-study-stats')).toHaveText(before, { useInnerText: true });
    await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_study_summary').length).toBe(1);
    await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_game_profile').length).toBe(1);
    expect(api.requests.filter(({ payload }) => payload.type === 'get_fish_catalog')).toHaveLength(0);
    await capture('full-my');
    await expectNoHorizontalOverflow(page);
  });
}

test('전체 MY 직접 진입은 조회 실패를 0으로 표시하지 않고 다시 확인한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const failures = ['get_study_summary', 'get_game_profile'];
  await installApiMock(page, { failGameTypes: failures, initialGameProfile: { streakDays: 0 } });
  await page.goto('/studycrack-mobile.html?screen=my');
  await expect(page.locator('.my-study-stats')).toContainText('확인 필요');
  await expect(page.locator('.my-study-stats')).not.toContainText('0분');
  await expect(page.locator('.my-study-stats')).not.toContainText('0일');
  failures.length = 0;
  await page.getByRole('button', { name: '공부 기록 다시 확인' }).click();
  await page.getByRole('button', { name: '수조 정보 다시 확인' }).click();
  await expect(page.locator('.my-study-stats')).toContainText('0분');
  await expect(page.locator('.my-study-stats')).toContainText('0일');
});

test('학습 프로필 저장 실패는 체크리스트를 완료시키지 않고 입력을 보존한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { failOnceTypes: ['update_qual'] });
  const messages = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
  await page.goto('/studycrack-mobile.html?screen=my');
  const checklist = page.locator('.my-summary-checklist');
  await checklist.locator('summary').click();
  await checklist.getByRole('button', { name: /학년 · 계열 설정하기/ }).click();
  await page.getByRole('button', { name: '고3 재학' }).click();
  await page.locator('[data-field="obSchoolName"]').fill('검수고등학교');
  await page.locator('[data-field="obGoalText"]').fill('꾸준하게 공부하고 싶어요.');
  await page.getByRole('button', { name: '저장하고 성적 입력으로' }).click();
  await expect.poll(() => messages.length).toBe(1);
  await expect(page.locator('[data-screen="ob1"]')).toBeVisible();
  await page.locator('[data-action="back"]').first().click();
  await expect(checklist.locator('summary')).toContainText('2/4');
  await checklist.locator('summary').click();
  await checklist.getByRole('button', { name: /학년 · 계열 설정하기/ }).click();
  await expect(page.locator('[data-field="obSchoolName"]')).toHaveValue('검수고등학교');
  await page.getByRole('button', { name: '저장하고 성적 입력으로' }).click();
  await expect(page.locator('[data-screen="ob2"]')).toBeVisible();
  await page.locator('[data-action="back"]').first().click();
  await expect(page.locator('[data-screen="ob1"]')).toBeVisible();
  await page.locator('[data-action="back"]').first().click();
  await expect(checklist.locator('summary')).toContainText('3/4');
});

test('MBTI는 저장 실패 후 같은 답변으로 재시도하고 성공한 결과만 MY에 반영한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { failOnceTypes: ['update_qual'] });
  api.state.userOverrides = { qualitative: { status: '고3', stream: 'natural' } };
  const messages = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
  await page.goto('/studycrack-mobile.html?screen=my');
  await expect(page.locator('.my-summary-checklist summary')).toContainText('3/4');
  await page.locator('[data-action="openMbtiModal"]').click();
  await page.locator('[data-action="startMbti"]').click();
  for (let index = 0; index < 36; index++) {
    await page.locator('[data-action="answerMbti"][data-mbti-choice="1"]').click();
    await page.locator('[data-action="mbtiNext"]').click();
  }
  await expect.poll(() => messages.length).toBe(1);
  await expect(page.locator('.mbti-result-code')).toHaveCount(0);
  await expect(page.locator('.mbti-survey-progress')).toContainText('36 / 36');
  await page.locator('[data-action="mbtiNext"]').click();
  await expect(page.locator('.mbti-result-code')).toBeVisible();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.locator('.my-summary-checklist summary')).toContainText('4/4');
  expect(api.requests.filter(({ payload }) => payload.type === 'update_qual')).toHaveLength(2);
});

test('목표 대학 설정은 실제 선택 화면으로 연결되고 저장 실패 후 재시도할 수 있다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { failOnceTypes: ['update_target_univs'], userOverrides: { targetUnivs: [] } });
  const messages = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
  await page.goto('/studycrack-mobile.html?screen=my');
  const checklist = page.locator('.my-summary-checklist');
  await expect(checklist.locator('summary')).toContainText('1/4');
  await checklist.locator('summary').click();
  await checklist.getByRole('button', { name: /목표 대학 설정하기/ }).click();
  await expect(page.locator('[data-screen="addUniversity"]')).toBeVisible();
  await page.locator('[data-field="analysisSearchTerm"]').fill('연세');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('button', { name: /연세대학교/ }).click();
  await page.locator('[data-field="analysisSearchTerm"]').fill('경제');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const row = page.locator('.add-univ-row').filter({ hasText: '연세대학교 경제학과' });
  await row.getByRole('button', { name: '추가', exact: true }).click();
  await expect.poll(() => messages.length).toBe(1);
  await expect(row.getByRole('button', { name: '추가', exact: true })).toBeEnabled();
  await page.locator('[data-action="back"]').first().click();
  await expect(checklist.locator('summary')).toContainText('1/4');
  await checklist.locator('summary').click();
  await checklist.getByRole('button', { name: /목표 대학 설정하기/ }).click();
  await row.getByRole('button', { name: '추가', exact: true }).click();
  await expect(row.getByRole('button', { name: '추가됨', exact: true })).toBeDisabled();
  await page.locator('[data-action="back"]').first().click();
  await expect(checklist.locator('summary')).toContainText('2/4');
  await checklist.locator('summary').click();
  await expect(checklist.getByRole('button', { name: /목표 대학 설정됨/ })).toBeVisible();
  expect(api.requests.filter(({ payload }) => payload.type === 'update_target_univs')).toHaveLength(2);
});
