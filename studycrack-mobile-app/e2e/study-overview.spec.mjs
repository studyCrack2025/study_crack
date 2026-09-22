import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });

function summary(date = '2026-09-07') {
  const days = Array.from({ length: 7 }, (_, index) => ({ date: `2026-09-${String(7 + index).padStart(2, '0')}`, totalSeconds: index ? 0 : 1800, sessionCount: index ? 0 : 1, subjects: index ? [] : [{ subject: '국어', seconds: 1800 }] }));
  return { available: true, today: { ...days[0], date }, week: { startDate: days[0].date, endDate: days[6].date, totalSeconds: 1800, sessionCount: 1, subjects: days[0].subjects, days } };
}

async function setup(page, options = {}) {
  await page.clock.setFixedTime(new Date('2026-09-07T03:00:00Z'));
  await installAuthenticatedSession(page);
  await page.addInitScript(() => localStorage.setItem('plannerItems', JSON.stringify([
    { id: 'overview-done', date: '2026-09-07', subject: '국어', category: '국어', content: '독서', minutes: 30, done: true, start: '09:00', end: '09:30' },
    { id: 'overview-next', date: '2026-09-07', subject: '수학', category: '수학', content: '기출', minutes: 90, done: false, start: '10:00', end: '11:30' }
  ])));
  const api = await installApiMock(page, { tier: 'standard', ...options });
  api.state.studySummaryOverride = summary();
  return api;
}

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`홈·수조·플래너·코칭은 같은 학습 배너를 재사용한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const api = await setup(page);
    await page.goto('/studycrack-mobile.html?screen=timer');
    const card = page.getByRole('region', { name: '학습 현황 요약' });
    const summaryRequests = () => api.requests.filter(({ payload }) => payload.type === 'get_study_summary').length;
    for (const screen of ['timer', 'aquarium', 'planner', 'strategy']) {
      if (screen !== 'timer') await page.locator(`.tabbar [data-tab="${screen}"]`).click();
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('data-variant', 'banner');
      await expect(card.locator('.sc-study-score')).toContainText('저장 성적 기반 환산점수');
      await expect(card.locator('.sc-study-score')).not.toContainText('%');
      await expect(card.locator('.sc-study-banner')).toHaveCSS('border-radius', '16px');
      await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
      await expect(card).toContainText('1/2');
      await expect(card).toContainText('과제 50% 완료');
      {
        const detail = card.locator('details.sc-study-details');
        await expect(detail).not.toHaveAttribute('open', '');
        await expect(card.locator('dd').first()).not.toBeVisible();
        await detail.locator('summary').click();
        await expect(card.locator('dd').first()).toBeVisible();
      }
      await expect(card.locator('dd').nth(0)).toHaveText('00:30:00');
      await expect(card.locator('dd').nth(1)).toHaveText('25%');
      await expect(card.locator('[data-study-base-seconds]')).toHaveCount(0);
      await expect(card.locator('.sc-study-source')).toHaveText('계획 2026-09-07 · 기기 기준공부 2026-09-07 · 한국 시간 기준');
      await page.evaluate(() => document.fonts.ready);
      const file = `${screen}-${width}.png`;
      await card.screenshot({ path: process.env.STUDYCRACK_OVERVIEW_CAPTURE_DIR ? resolve(process.env.STUDYCRACK_OVERVIEW_CAPTURE_DIR, file) : testInfo.outputPath(file), animations: 'disabled' });
      const fullFile = `${screen}-${width}-page.png`;
      await page.screenshot({ path: process.env.STUDYCRACK_OVERVIEW_CAPTURE_DIR ? resolve(process.env.STUDYCRACK_OVERVIEW_CAPTURE_DIR, fullFile) : testInfo.outputPath(fullFile), fullPage: true, animations: 'disabled' });
      await expectNoHorizontalOverflow(page);
    }
    await expect.poll(summaryRequests).toBe(1);
    await page.locator('.tabbar [data-tab="planner"]').click();
    await expect(page.getByRole('progressbar', { name: '플래너 완료율' })).toHaveAttribute('aria-valuenow', '50');
  });
}

test('기록 날짜 불일치·조회 실패·재시도를 구분한다', async ({ page }) => {
  const failures = [];
  const api = await setup(page, { failGameTypes: failures });
  api.state.studySummaryOverride = summary('2026-09-08');
  await page.goto('/studycrack-mobile.html?screen=timer');
  const card = page.getByRole('region', { name: '학습 현황 요약' });
  await expect(card).toContainText('2026-09-08 확정 공부');
  await expect(card).toContainText('기록 날짜가 달라');
  await expect(card.locator('details')).toHaveCount(0);
  await expect(card.locator('dd').nth(1)).toHaveText('산정 전');
  failures.push('get_study_summary');
  await page.locator('.tabbar [data-tab="analysis"]').click();
  await page.locator('.tabbar [data-tab="timer"]').click();
  await expect(card.getByRole('button', { name: '다시 확인' })).toBeVisible();
  await expect(card).toContainText('마지막 확인 기록');
  await expect(card.locator('dd').nth(0)).toHaveText('00:30:00');
  failures.length = 0;
  api.state.studySummaryOverride = summary();
  await card.getByRole('button', { name: '다시 확인' }).click();
  await expect(card.locator('dd').nth(1)).toHaveText('25%');
  await expect(card).not.toContainText('마지막 확인 기록');
  await expect(card).not.toContainText('기록 날짜가 달라');
});

test('미확정 타이머를 확정 일간·주간 기록에 더하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  api.state.studySeconds = 1800;
  await page.goto('/studycrack-mobile.html?screen=timer');
  const card = page.getByRole('region', { name: '학습 현황 요약' });
  await expect(card.locator('dd').first()).toHaveText('00:30:00');
  const week = page.locator('.timer-v2-week');
  const openRecords = async () => {
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    await page.locator('[data-action="openStudyRecords"]').click();
  };
  await openRecords();
  await expect(week).toContainText('이번 주 확정 누적');
  const before = await week.innerText();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '공부 시작', exact: true }).click();
  await page.locator('.study-plan-options button').filter({ hasText: '독서' }).click();
  await page.locator('.study-start-confirm').click();
  await page.getByRole('button', { name: '타이머 닫기' }).click();
  await expect(card).toContainText('진행 중 · 아직 미확정');
  await expect(card.locator('details')).toHaveCount(0);
  await expect(card.locator('[data-study-base-seconds]')).toHaveAttribute('data-study-base-seconds', '0');
  await expect(card.locator('[data-study-base-seconds]')).not.toHaveText('00:00:00');
  await expect(card.locator('dd').first()).toHaveText('00:30:00');
  await openRecords();
  await expect(week).toHaveText(before, { useInnerText: true });
});

test('첫 조회 실패는 공부 0분으로 꾸미지 않는다', async ({ page }) => {
  await setup(page, { failGameTypes: ['get_study_summary'] });
  await page.goto('/studycrack-mobile.html?screen=strategy');
  const card = page.getByRole('region', { name: '학습 현황 요약' });
  await expect(card.getByRole('button', { name: '다시 확인' })).toBeVisible();
  await expect(card.locator('dd').first()).toHaveText('확인 필요');
  await expect(card).not.toContainText('00:00:00');
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
});

test('플래너 직접 진입도 학습 기록을 조회하고 배너에서 성적 화면을 연다', async ({ page }) => {
  const api = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  const card = page.getByRole('region', { name: '학습 현황 요약' });
  await expect(card.locator('summary')).toContainText('00:30:00');
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_study_summary').length).toBe(1);
  await card.locator('.sc-study-score').click();
  await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
});
