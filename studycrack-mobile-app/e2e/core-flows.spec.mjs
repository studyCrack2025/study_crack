import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  installApiMock,
  installAuthenticatedSession
} from './support/mock-api.mjs';

test('로그인 입력과 계정 복구 모달이 모바일 화면에서 동작한다', async ({ page }) => {
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=authLogin');

  const email = page.locator('[data-field="loginEmail"]');
  await email.fill('student@example.com');
  await expect(email).toHaveValue('student@example.com');

  await page.getByRole('button', { name: '이메일 찾기' }).click();
  const findDialog = page.getByRole('dialog', { name: '이메일 찾기' });
  await expect(findDialog).toBeVisible();
  const box = await findDialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs((box.y + box.height / 2) - viewport.height / 2)).toBeLessThan(viewport.height * 0.2);
  await findDialog.getByRole('button', { name: '닫기' }).click();

  await page.getByRole('button', { name: '비밀번호 찾기' }).click();
  await expect(page.getByRole('dialog', { name: '비밀번호 재설정' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('로그인 세션의 사용자와 최초 환산점수가 홈에서 함께 로드된다', async ({ page }, testInfo) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  const startedAt = Date.now();
  await page.goto('/studycrack-mobile.html?screen=home');

  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.getByText('안녕하세요, 테스트학생님')).toBeVisible();
  await expect(page.locator('.home-result-score strong').first()).toHaveText('142점');
  expect(api.requests.some(({ payload }) => payload.type === 'get_user_analysis')).toBe(true);
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'jun')).toBe(true);
  await page.waitForTimeout(100);
  await testInfo.attach('home-initial-load-baseline.json', {
    body: Buffer.from(JSON.stringify({
      readyMs: Date.now() - startedAt,
      requestCount: api.requests.length,
      requestTypes: api.requests.map(({ payload }) => payload.type || 'unknown')
    }, null, 2)),
    contentType: 'application/json'
  });
  await expectNoHorizontalOverflow(page);
});

test('대학 검색은 한글 입력 후 대학과 학과를 순서대로 선택한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=addUniversity');

  const search = page.locator('[data-field="analysisSearchTerm"]');
  await expect(search).toBeVisible();
  await search.fill('연세');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('button', { name: /연세대학교/ }).click();
  await expect(page.getByRole('heading', { name: '연세대학교 학과' })).toBeVisible();

  const majorSearch = page.locator('[data-field="analysisSearchTerm"]');
  await majorSearch.fill('경제');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const resultRow = page.locator('.add-univ-row').filter({ hasText: '연세대학교 경제학과' });
  await expect(resultRow).toBeVisible();
  await expect(resultRow.getByRole('button', { name: '추가', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('공부 타이머 저장 뒤 랭킹 데이터가 다시 조회된다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=home');
  await expect(page.getByText('안녕하세요, 테스트학생님')).toBeVisible();

  await page.getByRole('button', { name: '공부 시작' }).click();
  await page.getByRole('button', { name: '국어 - 독서', exact: true }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: '정지', exact: true }).click();

  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'record_study_session').length).toBe(1);
  await expect.poll(() => api.requests.filter(({ payload }) => payload.type === 'get_study_ranking').length).toBeGreaterThan(1);
});

test('분석 시험과 대학 선택은 같은 결과 카드에 즉시 반영된다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=analysis');

  const examSelect = page.locator('[data-field="scoreExamType"]');
  const targetSelect = page.locator('[data-field="analysisTargetMajor"]');
  await expect(examSelect).toBeVisible();
  await expect(page.locator('.analysis-result-overview strong')).toHaveText('142점');

  await targetSelect.selectOption({ label: '고려대학교 경영학과' });
  await expect(page.locator('.analysis-result-overview strong')).toHaveText('131점');
  await examSelect.selectOption({ label: '6월 평가원' });
  await examSelect.selectOption({ label: '3월 모의고사' });
  await expect(page.locator('.analysis-result-overview strong')).toHaveText('118점');
  expect(api.requests.some(({ payload }) => payload.type === 'analyze_my_targets' && payload.examMode === 'mar')).toBe(true);
  await expectNoHorizontalOverflow(page);
});
