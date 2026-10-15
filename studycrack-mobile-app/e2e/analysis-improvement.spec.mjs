import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

async function setup(page, options = {}) {
  const { baseUiScore = 44.5, ...apiOptions } = options;
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { tier: 'standard', ...apiOptions });
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (apiOptions.failGameTypes?.includes(payload?.type)) return route.fallback();
    if (payload?.type === 'simulate_score_rise') {
      api.requests.push({ payload });
      return route.fulfill({ json: payload.targetUnivs.map(target => ({ ...target, base_ui_score: baseUiScore, sim_data: Object.fromEntries(['kor', 'math', 'inq1', 'inq2'].map((key, index) => [key, { name: ['국어', '수학', '탐구1', '탐구2'][index], uiDiff: 2, afterUiScore: baseUiScore + 2, rawNeeded: 1 }])) })) });
    }
    if (payload?.type === 'backtrace_required_raw') {
      api.requests.push({ payload });
      return route.fulfill({ json: { result: {
        reachable: true,
        reason: 'min_raw_above_pass_overshoot',
        minTotalRaw: 6,
        bySubject: { kor: 3, math: 2, inq1: 1, inq2: 0 },
        expected: { uiScore: 151.2 },
        base: { uiScore: baseUiScore },
        target: { uiMin: 100, uiMax: 150 },
        maxTotalRaw: 20
      } } });
    }
    if (payload?.type !== 'analyze_my_targets') return route.fallback();
    return route.fulfill({ json: payload.targetUnivs.map(target => ({ ...target, converted_score: baseUiScore, score_available: true, status: baseUiScore >= 100 ? '합격권' : '위험' })) });
  });
  return api;
}

test('지연된 시뮬레이션·역산은 실제 요청 중만 움직이고 전환은 재요청하지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await setup(page);
  let releaseSimulation, releaseReverse;
  const simulationGate = new Promise(resolve => { releaseSimulation = resolve; });
  const reverseGate = new Promise(resolve => { releaseReverse = resolve; });
  let reverseStarted = false;
  await page.route('**/api/**', async route => {
    const type = route.request().postDataJSON()?.type;
    if (type === 'simulate_score_rise') await simulationGate;
    if (type === 'backtrace_required_raw') { reverseStarted = true; await reverseGate; }
    return route.fallback();
  });
  try {
    await page.goto('/studycrack-mobile.html?screen=analysis');
    const switcher = page.getByRole('group', { name: '계산 결과 선택' });
    await switcher.getByRole('button', { name: '합격권 도달 조합' }).click();
    await expect(page.locator('.analysis-reverse-card [aria-busy="true"]')).toBeVisible();
    releaseSimulation();
    await expect.poll(() => reverseStarted).toBe(true);
    await expect(page.locator('.analysis-reverse-card [aria-busy="true"]')).toBeVisible();
    releaseReverse();
    await expect(page.locator('.analysis-reverse-card')).toContainText('+6점');
    await expect(page.locator('.analysis-reverse-plan')).toContainText('국어 +3점');
    await expect(page.locator('.analysis-reverse-plan')).toContainText('생명과학I +1점');
    await expect(page.locator('.analysis-reverse-plan')).not.toContainText('탐구1');
    await expect(page.locator('.analysis-reverse-card [aria-busy]')).toHaveCount(0);
    await page.locator('.analysis-improvement').screenshot({ path: info.outputPath('reverse-result.png') });
    const requestCount = () => api.requests.filter(({ payload }) => ['simulate_score_rise', 'backtrace_required_raw'].includes(payload.type)).length;
    const before = requestCount();
    await switcher.getByRole('button', { name: '과목별 +1점' }).click();
    await expect(page.locator('.analysis-sim-row')).toHaveCount(4);
    await expect(page.locator('.analysis-reverse-card')).toHaveCount(0);
    await switcher.getByRole('button', { name: '합격권 도달 조합' }).click();
    await expect(page.locator('.analysis-reverse-plan')).toContainText('수학 +2점');
    expect(requestCount()).toBe(before);
    await expectNoHorizontalOverflow(page);
  } finally { releaseSimulation(); releaseReverse(); }
});

for (const type of ['simulate_score_rise', 'backtrace_required_raw']) {
  test(`${type} 실패는 무한 계산 중이 아니라 재시도로 표시한다`, async ({ page }) => {
    await setup(page, { failGameTypes: [type] });
    await page.goto('/studycrack-mobile.html?screen=analysis');
    await page.getByRole('group', { name: '계산 결과 선택' }).getByRole('button', { name: '합격권 도달 조합' }).click();
    if (type === 'simulate_score_rise') {
      await page.getByRole('button', { name: '과목별 +1점', exact: true }).click();
      await expect(page.locator('.analysis-boost-card')).toContainText('불러오지 못했어요');
    } else await expect(page.locator('.analysis-reverse-card')).toContainText('못했');
    await expect(page.getByRole('button', { name: '분석 새로고침', exact: true })).toBeEnabled();
    await expect(page.locator('.analysis-reverse-card [aria-busy]')).toHaveCount(0);
  });
}

for (const tier of ['basic', 'starter', 'standard', 'pro']) {
  test(`${tier}는 모든 목표 대학의 역산을 계산하고 결과를 확인한다`, async ({ page }) => {
    const api = await setup(page, { tier, userOverrides: { univChangeRemaining: 0 } });
    await page.goto('/studycrack-mobile.html?screen=analysis');
    await page.getByRole('group', { name: '계산 결과 선택' }).getByRole('button', { name: '합격권 도달 조합' }).click();
    await expect(page.locator('.analysis-reverse-card')).toContainText('+6점');
    await expect.poll(() => new Set(api.requests.filter(({ payload }) => payload.type === 'backtrace_required_raw').map(({ payload }) => payload.targetUniv.univ)).size).toBe(2);
    await page.locator('.analysis-target-select').selectOption('고려대학교 경영학과');
    await expect(page.locator('.analysis-reverse-card')).toContainText('+6점');
    await expect(page.locator('.analysis-reverse-card')).not.toContainText('Standard 이상');
  });
}

test('Free는 역산을 요청하거나 결과 전환을 표시하지 않는다', async ({ page }) => {
  const api = await setup(page, { tier: 'free' });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await expect(page.locator('.analysis-boost-card')).toBeVisible();
  await expect(page.getByRole('group', { name: '계산 결과 선택' })).toHaveCount(0);
  expect(api.requests.filter(({ payload }) => payload.type === 'backtrace_required_raw')).toHaveLength(0);
});

for (const scenario of ['already-passing', 'unreachable']) {
  test(`Basic 역산은 ${scenario} 결과를 구분한다`, async ({ page }) => {
    const baseUiScore = scenario === 'already-passing' ? 150 : 44.5;
    await setup(page, { tier: 'basic', baseUiScore });
    await page.route('**/api/**', route => {
      const payload = route.request().postDataJSON();
      if (payload.type !== 'backtrace_required_raw') return route.fallback();
      return route.fulfill({ json: { result: scenario === 'already-passing'
        ? { reachable: true, reason: 'already_above_min', minTotalRaw: 0, bySubject: { kor: 0, math: 0, inq1: 0, inq2: 0 }, expected: { uiScore: baseUiScore }, base: { uiScore: baseUiScore }, target: { uiMin: 100, uiMax: 150 }, maxTotalRaw: 20 }
        : { reachable: false, reason: 'unreachable_within_limit', base: { uiScore: baseUiScore }, target: { uiMin: 100, uiMax: 150 }, maxTotalRaw: 20 } } });
    });
    await page.goto('/studycrack-mobile.html?screen=analysis');
    await page.getByRole('group', { name: '계산 결과 선택' }).getByRole('button', { name: '합격권 도달 조합' }).click();
    await expect(page.locator('.analysis-score-card-head > div:first-child strong')).toHaveText(`${baseUiScore}점`);
    await expect(page.locator('.analysis-reverse-card')).toContainText(scenario === 'already-passing' ? '추가 필요 원점수 0점' : '조합을 찾지 못했어요');
  });
}
