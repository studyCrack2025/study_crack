import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
const longTitle = '긴 한글 과제 제목도 생략하지 않고 여러 줄에 걸쳐 읽으며 오늘의 학습 내용을 충분히 확인할 수 있어요';
async function setup(page) {
  await page.clock.setFixedTime(new Date('2026-09-07T03:00:00Z'));
  await installAuthenticatedSession(page);
  await page.addInitScript(({ longTitle }) => {
    if (sessionStorage.getItem('__plannerPresentationSeed')) return;
    sessionStorage.setItem('__plannerPresentationSeed', '1');
    localStorage.setItem('plannerItems', JSON.stringify([
      { id: 'planner-a', date: '2026-09-07', subject: '수학', content: longTitle, detailSubject: '미적분', activityType: '오답 정리', minutes: 90, start: '09:00', end: '10:30' },
      { id: 'planner-b', date: '2026-09-07', subject: '국어', content: '비문학 완료 기록', minutes: 30, done: true },
      { id: 'planner-c', date: '2026-09-08', subject: '영어', content: '다른 날짜의 계획', minutes: 60, done: false }
    ]));
  }, { longTitle });
  return installApiMock(page, { tier: 'pro', initialGameProfile: { streakDays: 9 } });
}

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`플래너 완료·편집·삭제는 독립적이며 긴 제목을 표시한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const api = await setup(page);
    await page.goto('/studycrack-mobile.html?screen=planner');
    const row = page.locator('article[data-planner-id="planner-a"]');
    const done = row.getByRole('button', { name: '계획 완료', exact: true });
    const edit = row.getByRole('button', { name: '계획 편집', exact: true });
    await expect(edit).toHaveAccessibleDescription(longTitle);
    await expect(row).not.toHaveAttribute('data-action', 'openPlannerEdit');
    await expect(row.locator('button button')).toHaveCount(0);
    const [doneBox, editBox, removeBox] = await Promise.all([done.boundingBox(), edit.boundingBox(), row.locator('.planner-item-remove').boundingBox()]);
    expect(doneBox.width).toBeGreaterThanOrEqual(44);
    expect(doneBox.height).toBeGreaterThanOrEqual(44);
    expect(editBox.height).toBeGreaterThanOrEqual(44);
    expect(doneBox.x + doneBox.width).toBeLessThanOrEqual(editBox.x);
    expect(editBox.x + editBox.width).toBeLessThanOrEqual(removeBox.x);
    await expect(done.locator('i')).toHaveCSS('width', '28px');
    expect((await edit.locator('b').boundingBox()).height).toBeGreaterThan(40);
    await done.focus();
    await page.keyboard.press('Space');
    await expect(row.locator('.planner-item-done')).toHaveAttribute('aria-pressed', 'true');
    await expect(row.locator('.planner-item-main b')).toHaveCSS('text-decoration-line', 'line-through');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('progressbar', { name: '플래너 완료율' })).toHaveAttribute('aria-valuenow', '100');
    await row.getByRole('button', { name: '완료 취소' }).click();
    await expect(page.getByRole('progressbar', { name: '플래너 완료율' })).toHaveAttribute('aria-valuenow', '50');
    await page.locator('.app-content').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(`planner-${width}.png`), animations: 'disabled' });
    await edit.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog', { name: '플래너 항목 수정' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel('세부 내용', { exact: true })).toHaveValue(longTitle);
    await sheet.getByLabel('세부 내용', { exact: true }).fill('수정한 첫 줄\n수정한 둘째 줄');
    await sheet.getByLabel('메모', { exact: true }).fill('메모도 여러 줄\n입력 가능');
    await sheet.getByRole('button', { name: '수정 저장' }).scrollIntoViewIfNeeded();
    await expect(sheet.getByRole('button', { name: '수정 저장' })).toBeInViewport();
    const editMemoBox = await sheet.getByLabel('메모', { exact: true }).boundingBox();
    const editSaveBox = await sheet.getByRole('button', { name: '수정 저장' }).boundingBox();
    expect(editMemoBox.y + editMemoBox.height).toBeLessThanOrEqual(editSaveBox.y);
    await page.screenshot({ path: testInfo.outputPath(`planner-edit-${width}.png`), animations: 'disabled' });
    await sheet.getByRole('button', { name: '수정 저장' }).click();
    await expect(sheet).not.toBeVisible();
    await expect(edit).toBeFocused();
    await expect(edit).toContainText('수정한 둘째 줄');
    await row.getByRole('button', { name: '계획 삭제' }).click();
    await expect(row).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('article[data-planner-id="planner-b"]')).toHaveCount(1);
    expect(api.requests.filter(({ payload }) => /study_session|claim_study_reward|feed_fish/.test(payload.type))).toHaveLength(0);
    const feedback = await page.locator('.planner-feedback-card').evaluate(el => el.offsetTop);
    const calendar = await page.locator('.planner-calendar-section').evaluate(el => el.offsetTop);
    expect(calendar).toBeGreaterThan(feedback);
    await expectNoHorizontalOverflow(page);
  });
}

test('날짜 이동과 주·월 키보드 전환은 선택한 날짜의 기록만 표시한다', async ({ page }) => {
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  await page.locator('.planner-date-strip [data-planner-date="2026-09-08"]').click();
  await expect(page.getByRole('heading', { name: '선택한 날의 플래너', exact: true })).toBeVisible();
  await expect(page.locator('.planner-progress-head')).toContainText('선택한 날의 계획 진행률');
  await expect(page.locator('article.planner-item')).toHaveCount(1);
  await expect(page.locator('article.planner-item')).toContainText('다른 날짜의 계획');
  await page.getByRole('button', { name: '계획 완료', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: '플래너 완료율' })).toHaveAttribute('aria-valuenow', '100');
  const mode = page.getByRole('group', { name: '달력 보기 방식' });
  await mode.getByRole('button', { name: '주', exact: true }).press('ArrowRight');
  await expect(mode.getByRole('button', { name: '월', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await expect(page.locator('article.planner-item')).toHaveCount(2);
  await expect(page.getByRole('progressbar', { name: '플래너 완료율' })).toHaveAttribute('aria-valuenow', '50');
  await page.locator('.tabbar [data-tab="timer"]').click();
  await expect(page.getByRole('progressbar', { name: '과제 완료율' })).toHaveAttribute('aria-valuenow', '50');
  await expect(page.locator('.sc-study-metrics dd').first()).toHaveText('00:00:00');
});

test('작은 화면에서 여러 줄 계획 추가와 IME 입력·단계 복귀를 보존한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  await page.getByRole('button', { name: '계획 추가', exact: true }).click();
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '다음', exact: true }).click();
  const content = page.getByLabel('계획 제목', { exact: true });
  await content.fill('긴 제목 첫 줄');
  await content.press('Enter');
  await content.pressSequentially('둘째 줄');
  await expect(page.locator('[data-screen="plannerAdd"]')).toBeVisible();
  await content.dispatchEvent('compositionstart');
  await content.dispatchEvent('compositionend');
  await page.getByLabel('메모 (선택)', { exact: true }).fill('메모 첫 줄\n메모 둘째 줄');
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(content).toHaveValue('긴 제목 첫 줄\n둘째 줄');
  await page.getByRole('button', { name: '계획 저장하기' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: '계획 저장하기' })).toBeInViewport();
  const addMemoBox = await page.getByLabel('메모 (선택)', { exact: true }).boundingBox();
  const addSaveBox = await page.getByRole('button', { name: '계획 저장하기' }).boundingBox();
  expect(addMemoBox.y + addMemoBox.height).toBeLessThanOrEqual(addSaveBox.y);
  await page.screenshot({ path: testInfo.outputPath('planner-add-320.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '계획 저장하기' }).click();
  await expect(page.locator('article.planner-item').filter({ hasText: '긴 제목 첫 줄' })).toContainText('둘째 줄');
  await page.reload();
  await expect(page.locator('article.planner-item').filter({ hasText: '긴 제목 첫 줄' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('계정 변경 후 서버 지표·권한을 새 계정으로 읽고 기기 계획은 보존한다', async ({ page }) => {
  const api = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.timer-v2-status-rail')).toContainText('9일');
  api.state.userTier = 'free';
  api.state.userOverrides = { name: '다른계정', targetUnivs: [], quantitative: {} };
  api.state.gameProfile.streakDays = 0;
  await page.evaluate(() => {
    localStorage.setItem('userId', 'e2e-other-student');
    const payload = btoa(JSON.stringify({ sub: 'e2e-other-student', exp: Math.floor(Date.now() / 1000) + 3600 })).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    sessionStorage.setItem('accessToken', `e2e.${payload}.signature`);
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('.timer-v2-brand-head')).toContainText('다른계정');
  await expect(page.locator('.timer-v2-status-rail')).toContainText('0일');
  await expect(page.locator('.timer-v2-plan')).toContainText('Basic 이상');
  await expect(page.locator('.timer-v2-plan-list > button')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plannerItems')).length)).toBe(3);
  await page.locator('.tabbar [data-tab="planner"]').click();
  await expect(page.locator('[data-screen="lockedFeature"]')).toBeVisible();
});
