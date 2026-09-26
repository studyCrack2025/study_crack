import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

async function setup(page, options = {}) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { tier: 'standard', ...options });
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.type === 'simulate_score_rise' && !options.failGameTypes?.includes(payload.type)) {
      api.requests.push({ payload });
      return route.fulfill({ json: payload.targetUnivs.map(target => ({ ...target, base_ui_score: 44.5, sim_data: Object.fromEntries(['kor', 'math', 'inq1', 'inq2'].map((key, index) => [key, { name: ['국어', '수학', '탐구1', '탐구2'][index], uiDiff: 2, afterUiScore: 46.5, rawNeeded: 1 }])) })) });
    }
    if (payload?.type !== 'analyze_my_targets') return route.fallback();
    return route.fulfill({ json: payload.targetUnivs.map(target => ({ ...target, converted_score: 44.5, score_available: true, status: '위험' })) });
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
    await expect(page.locator('.analysis-reverse-card [aria-busy]')).toHaveCount(0);
    await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
    await expect(page.locator('.analysis-reverse-card [aria-busy="true"]')).toBeVisible();
    releaseSimulation();
    await expect.poll(() => reverseStarted).toBe(true);
    await expect(page.locator('.analysis-reverse-card [aria-busy="true"]')).toBeVisible();
    releaseReverse();
    await expect(page.locator('.analysis-reverse-card')).toContainText('+6점');
    await expect(page.locator('.analysis-reverse-plan')).toContainText('국어 +3점');
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
    await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
    await page.getByRole('group', { name: '계산 결과 선택' }).getByRole('button', { name: '합격권 도달 조합' }).click();
    await expect(page.locator('.analysis-reverse-card').getByRole('button', { name: '결과 다시 확인' })).toBeVisible();
    await expect(page.locator('.analysis-reverse-card [aria-busy]')).toHaveCount(0);
  });
}

test('Basic에는 역산 전환을 표시하지 않는다', async ({ page }) => {
  await setup(page, { tier: 'basic' });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await expect(page.locator('.analysis-boost-card')).toBeVisible();
  await expect(page.getByRole('group', { name: '계산 결과 선택' })).toHaveCount(0);
});
