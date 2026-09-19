import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

const at = (screen) => `/studycrack-mobile.html?screen=${screen}`;
const count = (api, type) => api.requests.filter(({ payload }) => payload.type === type).length;

for (const [status, copy] of [[403, '권한이 없어요'], [404, '정보를 찾을 수 없어요'], [409, '현재 상태에서는 처리할 수 없어요'], [500, '서버 응답을 확인하지 못했어요']]) {
  test(`목록 ${status} 오류는 빈 목록·로그아웃으로 바뀌지 않고 명시적 재시도로 복구한다`, async ({ page }) => {
    await installAuthenticatedSession(page);
    await installApiMock(page);
    let fail = true;
    await page.route('**/api/**', async (route) => {
      if (route.request().postDataJSON()?.type !== 'student_get_notifications' || !fail) return route.fallback();
      await route.fulfill({ status, json: { error: 'internal-private-detail' } });
    });
    await page.goto(at('notificationList'));
    await expect(page.getByRole('alert')).toContainText(copy);
    await expect(page.getByText('받은 알림이 없습니다.')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('e2e-student');
    fail = false;
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.locator('.noti-list-row')).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('리포트·주간·문의 재시도는 현재 화면에서 실패한 읽기를 복구한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro', failOnceTypes: ['get_pro_reports', 'get_weekly_reports', 'get_qna_list'] });
  for (const [screen, recovered] of [['proElite', '아직 발행된 PRO 리포트가 없어요'], ['weekly', '주간 점검 기록이 없습니다.'], ['customerSupport', '분석 결과 문의']]) {
    await page.goto(at(screen));
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByText(recovered, { exact: true })).toBeVisible();
  }
});

test('느린 응답은 로딩이며 마지막 목록은 재조회 실패·오프라인에도 최신 여부를 명시한다', async ({ page, context }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  let release;
  let phase = 'slow';
  await page.route('**/api/**', async (route) => {
    if (route.request().postDataJSON()?.type !== 'student_get_notifications') return route.fallback();
    if (phase === 'slow') await new Promise((resolve) => { release = resolve; });
    if (phase === 'error') return route.fulfill({ status: 500, json: {} });
    return route.fallback();
  });
  await page.goto(at('notificationList'));
  await expect(page.getByText('알림을 불러오는 중...', { exact: true })).toBeVisible();
  await expect(page.getByText('받은 알림이 없습니다.')).toHaveCount(0);
  phase = 'ready';
  release();
  await expect(page.locator('.noti-list-row')).toHaveCount(1);
  await page.getByRole('button', { name: '설정', exact: true }).click();
  phase = 'error';
  await page.locator('[data-action="back"]').click();
  await expect(page.getByRole('alert')).toContainText('마지막으로 확인한 정보');
  await expect(page.locator('.noti-list-row')).toHaveCount(1);
  await context.setOffline(true);
  await expect(page.locator('.sc-network-status')).toContainText('최신 상태가 아닐 수 있어요');
  await expect(page.locator('.noti-list-row')).toHaveCount(1);
  await context.setOffline(false);
  phase = 'ready';
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('오프라인 첫 사용자 조회는 실패를 알리고 복구 전까지 가짜 학습 수치를 만들지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await page.goto(at('timer'));
  await expect(page.getByRole('alert')).toContainText('오프라인 상태예요');
  await expect(page.locator('.timer-v2-clock')).toHaveCount(0);
  expect(count(api, 'get_user_analysis')).toBe(0);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); window.dispatchEvent(new Event('online')); });
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('.timer-v2-clock')).toHaveText('00:00:00');
  expect(count(api, 'get_user_analysis')).toBe(1);
});

test('공부·수조 보조 조회 실패는 0시간·0마리로 표시하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { failGameTypes: ['get_study_summary', 'get_game_profile'] });
  await page.goto(at('timer'));
  await expect(page.locator('.timer-v2-clock')).toHaveText('확인 필요');
  await expect(page.locator('.timer-v2-status-rail')).not.toContainText('0일');
  await expect(page.locator('.timer-v2-status-rail')).not.toContainText('0종');
});

test('문의 전송 실패 뒤 재연결은 입력을 보존하고 저장을 자동 재전송하지 않는다', async ({ page, context }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { failOnceTypes: ['save_qna'] });
  const alerts = [];
  page.on('dialog', async (dialog) => { alerts.push(dialog.message()); await dialog.accept(); });
  await page.goto(at('customerSupport'));
  await page.getByRole('button', { name: /일반 문의/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-field="qnaDraftTitle"]').fill('연결 확인 문의');
  await dialog.locator('[data-field="qnaDraftContent"]').fill('입력한 한글 내용은 남아 있어야 합니다.');
  await dialog.getByRole('button', { name: '문의 접수' }).click();
  await expect.poll(() => alerts.length).toBe(1);
  await expect(dialog.locator('[data-field="qnaDraftContent"]')).toHaveValue('입력한 한글 내용은 남아 있어야 합니다.');
  expect(count(api, 'save_qna')).toBe(1);
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.locator('.sc-network-status')).toBeHidden({ timeout: 5000 });
  expect(count(api, 'save_qna')).toBe(1);
  await dialog.getByRole('button', { name: '문의 접수' }).click();
  await expect(dialog).toHaveCount(0);
  expect(count(api, 'save_qna')).toBe(2);
});

test('만료된 세션은 개인정보를 정리하고 로그인 화면으로 돌아간다', async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ sub: 'p4-student', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  await page.addInitScript((token) => {
    if (window.name === 'p4-seeded') return;
    window.name = 'p4-seeded';
    localStorage.setItem('userId', 'p4-student');
    sessionStorage.setItem('accessToken', token);
  }, `e2e.${payload}.signature`);
  await installApiMock(page);
  await page.route('**/api/**', async (route) => {
    if (route.request().postDataJSON()?.type === 'get_user_analysis') return route.fulfill({ status: 401, json: {} });
    return route.fallback();
  });
  await page.goto(at('timer'));
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
  await expect(page.getByText('테스트학생')).toHaveCount(0);
});

test('서버가 완료·보상한 뒤 응답만 끊겨도 재연결과 재시도로 중복 지급하지 않는다', async ({ page, context }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, {
    loseResponseOnceTypes: ['complete_study_session', 'claim_study_reward'],
    studyDurationSeconds: 1500, studyReward: { shells: 2, food: 2 },
    initialGameProfile: { shellBalance: 0, foodBalance: 0, starterState: 'locked' }
  });
  await page.goto(at('timer'));
  await page.getByRole('button', { name: '공부 시작', exact: true }).click();
  await page.locator('[data-study-subject="국어"]').last().click();
  await page.locator('[data-field="studyStartActivity"]').fill('연결 복구 학습');
  await page.locator('[data-action="confirmStudyStart"]').click();
  await expect(page.getByRole('button', { name: '공부 완료', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '공부 완료', exact: true }).click();
  await expect(page.locator('.timer-v2-actions').getByRole('button', { name: '완료 다시 확인', exact: true })).toBeEnabled();
  expect(api.state.completedStudySessions.size).toBe(1);
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.locator('.sc-network-status')).toBeHidden({ timeout: 5000 });
  expect(count(api, 'complete_study_session')).toBe(1);
  await page.locator('.timer-v2-actions').getByRole('button', { name: '완료 다시 확인', exact: true }).click();
  await expect(page.locator('[data-action="retryStudyReward"]')).toBeVisible();
  expect(count(api, 'complete_study_session')).toBe(2);
  expect(api.state.completedStudySessions.size).toBe(1);
  expect(api.state.gameProfile.shellBalance).toBe(2);
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.locator('.sc-network-status')).toBeHidden({ timeout: 5000 });
  expect(count(api, 'claim_study_reward')).toBe(1);
  await page.locator('[data-action="retryStudyReward"]').click();
  await expect(page.locator('[data-action="retryStudyReward"]')).toHaveCount(0);
  expect(count(api, 'claim_study_reward')).toBe(2);
  expect(api.state.gameProfile.shellBalance).toBe(2);
  expect(api.state.gameProfile.foodBalance).toBe(2);
  const ids = api.requests.filter(({ payload }) => ['complete_study_session', 'claim_study_reward'].includes(payload.type)).map(({ payload }) => payload.data.sessionId);
  expect(new Set(ids).size).toBe(1);
});

test('화면 파일 실패는 재시도와 명시적 새로고침을 제공한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  let fail = true;
  await page.route('**/chunks/screen-registry-app-*.js', (route) => fail ? route.abort() : route.continue());
  await page.goto(at('timer'));
  await expect(page.getByRole('alert')).toContainText('화면 파일을 불러오지 못했어요');
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '페이지 새로고침' }).click();
  await expect(page.locator('.timer-v2-clock')).toHaveText('00:00:00');
});

test('초기 실행 파일 실패는 공개 오류 화면과 44px 재시도 버튼으로 복구한다', async ({ page }) => {
  await installApiMock(page);
  await page.clock.install();
  let fail = true;
  await page.route('**/dist/studycrack-mobile.bundle.js', (route) => fail ? route.abort() : route.continue());
  await page.goto(at('authLogin'));
  await page.clock.fastForward(12001);
  await expect(page.getByRole('alert')).toContainText('앱을 불러오지 못했습니다');
  const retry = page.getByRole('button', { name: '다시 불러오기' });
  expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
  fail = false;
  await retry.click();
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
});

test('네 viewport의 키보드 축소·복귀에서 문의 입력과 제출 버튼을 사용할 수 있다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await page.goto(at('customerSupport'));
    await page.getByRole('button', { name: /일반 문의/ }).click();
    const field = page.getByRole('dialog').locator('[data-field="qnaDraftContent"]');
    await field.fill('키보드 복귀 확인');
    await field.focus();
    await page.evaluate((height) => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => height - 300 });
      visualViewport.dispatchEvent(new Event('resize'));
    }, height);
    await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'true');
    const dialog = page.getByRole('dialog');
    const bounds = await dialog.boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height - 300 + 1);
    await expect(field).toBeFocused();
    await dialog.getByRole('button', { name: '문의 접수' }).scrollIntoViewIfNeeded();
    const submit = await dialog.getByRole('button', { name: '문의 접수' }).boundingBox();
    expect(submit.y + submit.height).toBeLessThanOrEqual(height - 300 + 1);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`keyboard-${width}.png`) });
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'false');
    await expect(field).toHaveValue('키보드 복귀 확인');
  }
});
