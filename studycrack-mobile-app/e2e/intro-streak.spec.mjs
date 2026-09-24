import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
const dialog = page => page.getByRole('dialog', { name: '연속 학습 기록', exact: true });
const days = () => {
  const now = new Date(Date.now() + 9 * 3600000);
  const end = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Array.from({ length: 30 }, (_, index) => ({ date: new Date(end + (index - 29) * 86400000).toISOString().slice(0, 10), studySeconds: index % 3 === 0 ? 1200 : index % 3 === 1 ? 300 : 0, stage: index % 3 === 0 ? 1 : 0, validStudyDay: index % 3 === 0 }));
};

async function installRecords(page) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { initialGameProfile: { streakDays: 7 } });
  const state = { rows: days(), fail: false, requests: 0, delay: null };
  await page.route('**/api/**', async route => {
    if (route.request().postDataJSON()?.type !== 'get_study_habitat') return route.fallback();
    state.requests += 1;
    if (state.delay) await state.delay;
    if (state.fail) return route.fulfill({ status: 500, json: { error: 'unavailable' } });
    return route.fulfill({ json: { days: state.rows, streakDays: 7 } });
  });
  return { state, api };
}

test('비회원은 소개를 건너뛰고 다음 root부터 로그인으로 진입하며 소개를 다시 볼 수 있다', async ({ page }, testInfo) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html');
  await expect(page.locator('[data-screen="on1"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('intro-1.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('studycrackIntroSeen_v1'))).toBe('1');
  await page.goto('/studycrack-mobile.html');
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
  await page.getByRole('button', { name: '서비스 소개 다시 보기' }).click();
  await expect(page.locator('[data-screen="on1"]')).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('[data-screen="on2"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('intro-2.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('[data-screen="on3"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('intro-3.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '시작하기', exact: true }).click();
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
});

test('소개 완료는 계정별 사용법이나 보상을 저장하지 않는다', async ({ page }) => {
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=on3');
  await page.getByRole('button', { name: '시작하기', exact: true }).click();
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('studycrackIntroSeen_v1'))).toBe('1');
  expect(api.requests.some(({ payload }) => /tutorial|product_guide/.test(payload.type))).toBe(false);
});

test('기기 저장이 차단되어도 소개 건너뛰기로 로그인에 진입할 수 있다', async ({ page }) => {
  await installApiMock(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'studycrackIntroSeen_v1') throw new DOMException('blocked', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.goto('/studycrack-mobile.html?screen=on2');
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
});

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`홈 연속 기록은 실제 30일과 공유 MY 복귀를 표시한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { state, api } = await installRecords(page);
    await page.goto('/studycrack-mobile.html?screen=timer');
    const trigger = page.locator('[data-action="openStreakSummary"]').first();
    await trigger.click();
    const sheet = dialog(page);
    await expect(sheet.locator('.streak-summary-hero')).toContainText('7일 연속 학습');
    await expect(sheet.locator('[data-status="valid"]')).toHaveCount(10);
    await expect(sheet.locator('[data-status="recorded"]')).toHaveCount(10);
    await expect(sheet.locator('[data-status="empty"]')).toHaveCount(10);
    await expect(sheet.locator('[data-status="unknown"]')).toHaveCount(0);
    await expect(page.locator('[data-screen="timer"]')).toHaveAttribute('inert', '');
    await expect(sheet).toHaveCSS('border-top-left-radius', '30px');
    const box = await sheet.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`streak-${width}.png`), animations: 'disabled' });
    await sheet.locator('.streak-summary-note').scrollIntoViewIfNeeded();
    await expect(sheet.locator('.streak-summary-note')).toBeInViewport();
    await expect(sheet.getByRole('button', { name: '연속 학습 기록 닫기' })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`streak-${width}-scrolled.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    await page.getByRole('button', { name: /연속 학습 기록 최근 30일/ }).click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: '연속 학습 기록 닫기' }).click();
    await expect(page.getByRole('dialog', { name: '프로필 메뉴' })).toBeVisible();
    await page.getByRole('button', { name: /마이페이지 전체 보기/ }).click();
    await page.getByRole('button', { name: /연속 학습 기록 최근 30일/ }).click();
    await expect(sheet).toBeVisible();
    expect(state.requests).toBe(1);
    expect(api.requests.filter(({ payload }) => payload.type === 'get_game_profile')).toHaveLength(1);
  });
}

test('누락 날짜와 처음 조회 실패를 공부하지 않은 날로 칠하지 않고 재시도한다', async ({ page }) => {
  const { state } = await installRecords(page);
  state.fail = true;
  await page.goto('/studycrack-mobile.html?screen=my');
  await page.getByRole('button', { name: /연속 학습 기록 최근 30일/ }).click();
  await expect(dialog(page)).toContainText('공부 기록을 불러오지 못했어요');
  await expect(dialog(page).locator('[data-status="unknown"]')).toHaveCount(30);
  await expect(dialog(page).locator('[data-status="empty"]')).toHaveCount(0);
  state.fail = false;
  state.rows = state.rows.slice(-3);
  await dialog(page).getByRole('button', { name: '기록 다시 확인' }).click();
  await expect(dialog(page)).toContainText('27일의 기록을 확인하지 못했어요');
  await expect(dialog(page).locator('[data-status="unknown"]')).toHaveCount(27);
  await expect(dialog(page).locator('[data-status="empty"]')).toHaveCount(1);
});

test('새로고침 오류는 마지막 기간을 표시하고 자동 재전송하지 않는다', async ({ page }) => {
  const { state } = await installRecords(page);
  state.rows = state.rows.slice(-3);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('[data-action="openStreakSummary"]').first().click();
  await expect(dialog(page).locator('[data-status="valid"]')).toHaveCount(1);
  state.fail = true;
  await dialog(page).getByRole('button', { name: '기록 다시 확인' }).click();
  await expect(dialog(page)).toContainText('공부 기록을 불러오지 못했어요');
  await expect(dialog(page).locator('[data-status="valid"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.locator('[data-action="openStreakSummary"]').first().click();
  expect(state.requests).toBe(2);
});
