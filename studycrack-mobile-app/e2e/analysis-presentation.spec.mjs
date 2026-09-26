import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow, mockUser } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
async function setup(page, options = {}) {
  await installAuthenticatedSession(page);
  return installApiMock(page, { tier: 'standard', ...options });
}
async function calculate(page) {
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
}

test('분석 상단 성적 입력 안내는 기존 성적 정보로 이동하고 돌아온다', async ({ page }) => {
  const api = await setup(page);
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await page.getByRole('button', { name: '성적 입력·수정', exact: true }).click();
  await expect(page.locator('[data-screen="scoreInfo"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '입력·수정', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '뒤로가기', exact: true }).click();
  await expect(page.getByRole('region', { name: '분석 전 성적 확인' })).toBeVisible();
  expect(api.requests.some(({ payload }) => payload.type === 'update_quan')).toBe(false);
});

for (const width of [320, 360, 390, 430]) {
  test(`맞춤 솔루션은 확인된 0점·영어 등급과 미확인 목표를 분리한다 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 932 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const saved = mockUser.quantitative.jun;
    await setup(page, { userOverrides: { quantitative: { ...mockUser.quantitative, jun: { ...saved, kor: { ...saved.kor, raw: 0 }, math: { ...saved.math, raw: 80 }, eng: { ...saved.eng, raw: 90, grade: 1, grd: 1 }, inq1: { ...saved.inq1, raw: 49 }, inq2: { ...saved.inq2, raw: 50 } } } } });
    await page.route('**/api/**', route => {
      const data = route.request().postDataJSON();
      if (data?.type === 'simulate_score_rise') return route.fulfill({ json: [] });
      if (data?.type !== 'analyze_my_targets') return route.fallback();
      return route.fulfill({ json: data.targetUnivs.map(target => ({ ...target, converted_score: 0, score_available: true, status: '위험' })) });
    });
    await calculate(page);
    await expect(page.locator('.analysis-score-card strong')).toHaveText('0점');
    // Exercise the normal delegated navigation without reloading the confirmed result.
    await page.locator('[data-screen="analysis"]').evaluate(element => {
      const button = document.createElement('button'); button.dataset.action = 'goto'; button.dataset.target = 'ob5';
      element.append(button); button.click(); button.remove();
    });
    const card = page.locator('.score-journey-card');
    const assertVisiblePanel = async view => {
      await expect(card.getByRole('button', { name: view === 'current' ? '현재 성적' : '도달 성적', exact: true })).toHaveClass('active');
      await expect.poll(() => card.evaluate((element, selected) => {
        const scroll = element.querySelector('.score-journey-scroll').getBoundingClientRect();
        const panel = element.querySelector('.score-journey-col.' + selected).getBoundingClientRect();
        return Math.abs(panel.left - scroll.left) < 2 && panel.width > scroll.width * 0.9;
      }, view)).toBe(true);
    };
    await expect(card).toBeVisible();
    await expect(card.getByText('목표 성적 미확인', { exact: true })).toBeVisible();
    await assertVisiblePanel('target');
    await card.screenshot({ path: info.outputPath(`score-target-${width}.png`), animations: 'disabled' });
    await card.getByRole('button', { name: '현재 성적', exact: true }).click();
    await assertVisiblePanel('current');
    const current = card.locator('.score-journey-col.current');
    await expect(current.locator('.score-journey-total')).toContainText('0점');
    await expect(current.locator('.score-row').filter({ hasText: '국어' })).toContainText('0점');
    await expect(current.locator('.score-row').filter({ hasText: '영어' })).toContainText('1등급');
    await expect(card).not.toContainText('100점');
    await card.screenshot({ path: info.outputPath(`score-current-${width}.png`), animations: 'disabled' });
    await expectNoHorizontalOverflow(page);
    await card.getByRole('button', { name: '도달 성적', exact: true }).click();
    await assertVisiblePanel('target');
    await card.getByRole('button', { name: '역산 결과 확인하기' }).click();
    await expect(page.locator('[data-screen="analysis"]')).toBeVisible();
  });
}

for (const width of [320, 360, 390, 430]) {
  test(`분석은 성적·시험, 대학·환산점수, 통합 시뮬레이션 순서를 유지한다 (${width}px)`, async ({ page }, info) => {
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
    expect(children[0]).toBe('analysis-input-entry');
    expect(children.indexOf('card analysis-score-card ')).toBeLessThan(children.indexOf('analysis-improvement'));
    await expect(page.locator('.analysis-input-entry [data-field="scoreExamType"]')).toHaveCount(1);
    await expect(page.locator('.analysis-input-entry .analysis-score-summary')).toHaveCount(1);
    await expect(page.locator('.analysis-score-card [data-field="analysisTargetMajor"]')).toHaveCount(1);
    await expect(page.locator('.analysis-comparison,.analysis-target-card,.analysis-preview-subjects')).toHaveCount(0);
    await expect(page.locator('.analysis-score-summary')).toHaveCount(1);
    await expect(page.locator('.analysis-boost-card')).toHaveCount(1);
    await page.locator('.analysis-boost-card').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.locator('.analysis-boost-card').screenshot({ path: info.outputPath(`analysis-preview-${width}.png`), animations: 'disabled' });
    await page.locator('.analysis-score-card').screenshot({ path: info.outputPath(`analysis-score-${width}.png`), animations: 'disabled' });
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

for (const base of [44.5, 249.9]) {
  test(`환산점수 소수·상한 게이지가 좁은 화면에서도 겹치지 않는다 (${base}점)`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await setup(page);
    await page.route('**/api/**', route => {
      const data = route.request().postDataJSON();
      if (data?.type === 'analyze_my_targets') return route.fulfill({ json: data.targetUnivs.map(target => ({ ...target, converted_score: base, score_available: true, status: base < 100 ? '고위험 (F)' : '안정' })) });
      if (data?.type === 'simulate_score_rise') return route.fulfill({ json: data.targetUnivs.map(target => ({ ...target, base_ui_score: base, sim_data: { kor: { name: '국어', uiDiff: 17.8, afterUiScore: base + 17.8 } } })) });
      return route.fallback();
    });
    await calculate(page);
    await expect(page.locator('.analysis-score-card strong')).toHaveText(`${base}점`);
    await expect(page.locator('.analysis-main-gauge-preview-label')).toContainText(base < 100 ? '62.3점' : '250점');
    const labels = await page.locator('.analysis-main-gauge-top span').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
    expect(labels[0].right <= labels[1].left || labels[0].bottom <= labels[1].top).toBe(true);
    await page.locator('.analysis-score-card').screenshot({ path: info.outputPath(`analysis-reference-${base}.png`), animations: 'disabled' });
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
    await route.fulfill({ json: data.targetUnivs.map(target => ({ ...target, converted_score: 0, score_available: !target.univ.includes('고려'), is_eligible: !target.univ.includes('고려'), status: !target.univ.includes('고려') ? '위험' : '지원 불가', msg: !target.univ.includes('고려') ? '' : '선택 과목 조건 확인' })) });
  });
  await page.route('**/api/**', async route => {
    if (route.request().postDataJSON()?.type === 'simulate_score_rise') return route.fulfill({ json: [] });
    return route.fallback();
  });
  await calculate(page);
  await expect(page.locator('.analysis-score-card strong')).toHaveText('0점');
  await expect(page.locator('.analysis-score-facts')).toContainText('+100점');
  await page.locator('[data-field="analysisTargetMajor"]').selectOption('고려대학교 경영학과');
  await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
  await expect(page.locator('.analysis-score-prompt')).toContainText('선택 과목 조건 확인');
  await expect(page.locator('.analysis-score-card strong')).toHaveText('—');
});

test('환산점수 카드의 대학 선택은 이전 효율을 지우고 명시적 재계산 후 새 기준을 표시한다', async ({ page }) => {
  await setup(page);
  await calculate(page);
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await page.locator('.analysis-sim-row').nth(1).click();
  await page.locator('[data-field="analysisTargetMajor"]').selectOption('고려대학교 경영학과');
  await expect(page.locator('[data-field="analysisTargetMajor"]')).toHaveValue('고려대학교 경영학과');
  await expect(page.locator('.analysis-sim-row')).toHaveCount(0);
  await expect(page.locator('.analysis-reverse-plan')).toHaveCount(0);
  await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await expect(page.locator('.analysis-sim-row').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.analysis-score-card-head')).toContainText('고려대학교 경영학과');
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
  await expect(page.locator('.analysis-boost-card')).toContainText('과목별 결과를 불러오지 못했어요.');
  await expect(page.locator('.analysis-score-card strong')).toHaveText('142점');
  await expect(page.locator('.analysis-score-facts')).toContainText('도달');
  await expect(page.locator('.analysis-sim-row')).toHaveCount(0);
  await page.getByRole('button', { name: '과목 결과 다시 확인' }).click();
  await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '과목 결과 다시 확인' })).toHaveCount(0);
});
