import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
async function setup(page, options = {}) {
  await installAuthenticatedSession(page);
  return installApiMock(page, { tier: 'standard', ...options });
}
async function calculate(page) {
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
}

for (const width of [320, 360, 390, 430]) {
  test(`분석은 실제 점수·비교·대학 거리·2×2 효율 순서를 유지한다 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 932 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const api = await setup(page);
    await calculate(page);
    const grid = page.getByRole('list', { name: '과목별 원점수 1점 상승의 환산점수 효과' });
    await expect(grid.getByRole('button')).toHaveCount(4);
    await expect(page.locator('.analysis-score-card strong')).toHaveText('142점');
    await expect(page.locator('[data-field="scoreExamType"]')).toHaveValue('6월 평가원');
    await expect(page.locator('.analysis-score-card-head')).toContainText('6월 평가원');
    await expect(page.locator('.analysis-score-card .analysis-main-gauge')).toHaveCount(1);
    await page.screenshot({ path: info.outputPath(`analysis-top-${width}.png`), animations: 'disabled' });
    const children = await page.locator('.analysis-unified').evaluate(el => [...el.children].map(child => child.className));
    expect(children.indexOf('card analysis-score-card ')).toBeLessThan(children.indexOf('card analysis-preview-card'));
    expect(children.indexOf('analysis-comparison')).toBeLessThan(children.indexOf('card analysis-boost-card'));
    await page.locator('.analysis-preview-card').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.locator('.analysis-preview-card').screenshot({ path: info.outputPath(`analysis-preview-${width}.png`), animations: 'disabled' });
    await page.locator('.analysis-comparison').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.locator('.analysis-comparison').screenshot({ path: info.outputPath(`analysis-comparison-${width}.png`), animations: 'disabled' });
    await expect(page.locator('.analysis-comparison-row').first()).toContainText('+42점 여유');
    await expect(page.locator('.analysis-comparison-row').nth(1)).toContainText('+31점 여유');
    await grid.evaluate(el => el.scrollIntoView({ block: 'center' }));
    const boxes = await grid.getByRole('button').evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    await grid.screenshot({ path: info.outputPath(`analysis-efficiency-${width}.png`), animations: 'disabled' });
    const before = api.requests.filter(item => item.payload.type === 'simulate_score_rise').length;
    await grid.getByRole('button', { name: /수학/ }).focus();
    await page.keyboard.press('Space');
    await expect(grid.getByRole('button', { name: /수학/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.analysis-preview-values')).toContainText('144.4점');
    expect(api.requests.filter(item => item.payload.type === 'simulate_score_rise').length).toBe(before);
    await expect(page.locator('.analysis-score-summary')).toContainText('1등급');
    await expect(page.locator('.analysis-unified')).not.toContainText('합격확률');
    await expect(page.locator('input[type="range"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
}

test('부분 응답은 네 효율 칸을 유지하되 없는 과목은 선택·0점 효과로 꾸미지 않는다', async ({ page }) => {
  await setup(page);
  await page.route('**/api/**', async route => {
    const data = route.request().postDataJSON();
    if (data?.type !== 'simulate_score_rise') return route.fallback();
    await route.fulfill({ json: data.targetUnivs.map(target => ({ ...target, base_ui_score: 142, sim_data: { kor: { name: '국어', uiDiff: 2, afterUiScore: 144 } } })) });
  });
  await calculate(page);
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await expect(page.locator('.analysis-sim-row:disabled')).toHaveCount(3);
  await expect(page.locator('.analysis-sim-row:disabled').first()).toContainText('확인 필요');
  await expect(page.locator('.analysis-sim-row:disabled').first()).not.toContainText('+0.0점');
});

test('지원 불가 대학의 0 응답은 실제 0점과 구분한다', async ({ page }) => {
  await setup(page);
  await page.route('**/api/**', async route => {
    const data = route.request().postDataJSON();
    if (data?.type !== 'analyze_my_targets') return route.fallback();
    await route.fulfill({ json: data.targetUnivs.map((target, index) => ({ ...target, converted_score: 0, score_available: index === 0, is_eligible: index === 0, status: index === 0 ? '위험' : '지원 불가', msg: index === 0 ? '' : '선택 과목 조건 확인' })) });
  });
  await page.route('**/api/**', async route => {
    if (route.request().postDataJSON()?.type === 'simulate_score_rise') return route.fulfill({ json: [] });
    return route.fallback();
  });
  await calculate(page);
  await expect(page.locator('.analysis-comparison-row').first()).toContainText('100점 필요');
  await expect(page.locator('.analysis-comparison-row').nth(1)).toContainText('선택 과목 조건 확인');
  await expect(page.locator('.analysis-comparison-row').nth(1)).not.toContainText('환산 0점');
});

test('대학 버튼 선택은 이전 효율을 지우고 명시적 재계산 후 새 기준을 표시한다', async ({ page }) => {
  await setup(page);
  await calculate(page);
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await page.locator('.analysis-sim-row').nth(1).click();
  const target = page.locator('.analysis-comparison-row').nth(1);
  await target.click();
  await expect(page.locator('[data-field="analysisTargetMajor"]')).toHaveValue('고려대학교 경영학과');
  await expect(page.locator('.analysis-sim-row')).toHaveCount(0);
  await expect(page.locator('.analysis-reverse-plan')).toHaveCount(0);
  await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await expect(page.locator('.analysis-sim-row').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.analysis-comparison-row').nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('늦은 이전 시험의 시뮬레이션은 새 시험에 표시되지 않는다', async ({ page }) => {
  await setup(page);
  let oldStarted = false;
  await page.route('**/api/**', async route => {
    const data = route.request().postDataJSON();
    if (data?.type !== 'simulate_score_rise' || data.examMode !== 'jun') return route.fallback();
    oldStarted = true;
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ json: data.targetUnivs.map(target => ({ ...target, base_ui_score: 142, sim_data: { kor: { name: '이전시험과목', uiDiff: 50, afterUiScore: 192 } } })) });
  });
  await calculate(page);
  await expect.poll(() => oldStarted).toBe(true);
  await page.locator('[data-field="scoreExamType"]').selectOption('3월 모의고사');
  await expect(page.locator('.analysis-sim-row')).toHaveCount(0);
  await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await expect(page.locator('.analysis-score-card strong')).toHaveText('126점');
  await page.waitForTimeout(550);
  await expect(page.locator('.analysis-unified')).not.toContainText('이전시험과목');
  await expect(page.locator('.analysis-preview-values')).toContainText('129.2점');
});

test('시뮬레이션 실패는 점수·대학 결과를 유지하고 명시적 재조회로 복구한다', async ({ page }) => {
  await setup(page);
  let failed = false;
  await page.route('**/api/**', async route => {
    if (route.request().postDataJSON()?.type === 'simulate_score_rise' && !failed) {
      failed = true;
      return route.fulfill({ status: 503, json: { error: 'temporary' } });
    }
    return route.fallback();
  });
  await calculate(page);
  await expect(page.locator('.analysis-preview-card')).toContainText('과목별 결과를 불러오지 못했어요.');
  await expect(page.locator('.analysis-score-card strong')).toHaveText('142점');
  await expect(page.locator('.analysis-comparison-row').first()).toContainText('+42점 여유');
  await expect(page.locator('.analysis-sim-row')).toHaveCount(0);
  await page.getByRole('button', { name: '과목 결과 다시 확인' }).click();
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '과목 결과 다시 확인' })).toHaveCount(0);
});
