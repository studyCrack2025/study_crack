import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
];

const SURFACES = [
  ['analysis', '[data-screen="analysis"]'],
  ['add-university', '[data-screen="addUniversity"]'],
  ['score-info', '[data-screen="scoreInfo"]'],
  ['qual-info', '[data-screen="qualInfo"]'],
  ['ranking', '[data-screen="ranking"]']
];

test('빠른 목표·시험 변경은 늦게 도착한 이전 분석으로 현재 결과를 덮지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { analysisDelayByExam: { jun: 400 } });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await page.getByRole('button', { name: '점수 계산하기' }).click();
  await expect.poll(() => api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'jun')).toBe(true);
  await page.locator('[data-field="analysisTargetMajor"]').selectOption({ label: '고려대학교 경영학과' });
  await page.locator('[data-field="scoreExamType"]').selectOption('3월 모의고사');
  await page.getByRole('button', { name: '점수 계산하기' }).click();
  await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText('118점');
  await page.waitForTimeout(500);
  await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText('118점');
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'mar')).toBe(true);
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'jun')).toBe(true);
});

test('랭킹 오류는 같은 기간을 명시적으로 다시 요청해 복구한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { failOnceTypes: ['get_study_ranking'] });
  await page.goto('/studycrack-mobile.html?screen=ranking');
  await expect(page.getByText('랭킹을 불러오지 못했어요')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByText('전체 순위')).toBeVisible();
  expect(api.requests.filter(({ payload }) => payload.type === 'get_study_ranking')).toHaveLength(2);
});

test('Phase 3 분석·프로필 입력 화면은 네 viewport에서 경계를 지킨다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const [name, selector] of SURFACES) {
      const screen = selector.match(/data-screen="([^"]+)/)?.[1];
      await page.goto(`/studycrack-mobile.html?screen=${screen}`);
      await expect(page.locator(selector)).toBeVisible();
      if (screen === 'addUniversity') await expect(page.getByText('성균관대학교 글로벌경영학과')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const frame = await page.locator('.app-frame').boundingBox();
      expect(frame).not.toBeNull();
      expect(frame.width).toBeLessThanOrEqual(viewport.width);
      expect(Math.abs(frame.height - viewport.height)).toBeLessThanOrEqual(1);
      const screenshotPath = testInfo.outputPath(`phase-three-${name}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach(`phase-three-${name}-${viewport.width}x${viewport.height}.png`, { path: screenshotPath, contentType: 'image/png' });
    }
  }
});
