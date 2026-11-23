import { expect, test } from '@playwright/test';
import { calculatorAccessFixture, calculatorEmptyStorage, calculatorScoreFixture } from './support/calculator-fixture.mjs';

const path = '/2027-jungsi-consulting/calculator';
const box = (page, title, label) => page.getByRole('textbox', { name: `${title} ${label}`, exact: true });
const estimate = (page, title) => page.getByLabel(`${title} 예상 성적`, { exact: true });
async function setup(page) {
  const state = { calls: [], mode: 'ready', pending: [], allowed: true };
  await page.addInitScript(() => { localStorage.setItem('userId', 'score-entry-student'); localStorage.setItem('userRole', 'student'); });
  await page.route('https://www.googletagmanager.com/**', route => route.abort());
  await page.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.IS_LOCAL=false;window.CONFIG={api:{analysis:'/__score-analysis',consulting:'/__score-core',auth:'/__score-auth'}};` }));
  await page.route('**/__score-auth', route => route.fulfill({ json: { success: true } }));
  await page.route('**/__score-core', route => route.fulfill({ json: calculatorEmptyStorage() }));
  await page.route('**/__score-analysis', async route => {
    const body = route.request().postDataJSON(); state.calls.push(body);
    if (body.type === 'get_calculator_access') return route.fulfill({ json: calculatorAccessFixture({ allowed: state.allowed }) });
    if (body.type === 'get_univ_list_only') return route.fulfill({ json: [{ univName: '예시대학교', majors: ['예시학과'] }] });
    expect(body.type).toBe('get_calculator_score_conversion');
    const response = calculatorScoreFixture(body.data.records);
    if (state.mode === 'error') return route.fulfill({ status: 503, json: { code: 'CALCULATOR_SCORE_UNAVAILABLE' } });
    if (state.mode === 'defer') await new Promise(resolve => state.pending.push(resolve));
    try { await route.fulfill({ json: response }); } catch (_) {}
  });
  await page.goto(path); return state;
}
async function korean(page, common = '60', elective = '20') {
  await page.getByRole('combobox', { name: '국어 선택과목', exact: true }).selectOption('언어와매체');
  await box(page, '국어', '공통 원점수').fill(common); await box(page, '국어', '선택 원점수').fill(elective);
}
const metric = (page, title, index = 0) => estimate(page, title).locator('dd').nth(index);

test('첫 진입은 가채점 단일 폼이고 과목별 예상값을 표시한 뒤 후보 선택을 연다', async ({ page }, testInfo) => {
  const state = await setup(page);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /지원 후보/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '계산기 자료 서버 저장', exact: true })).toHaveCount(0);
  await korean(page); await expect(metric(page, '국어')).toHaveText('120');
  await expect(page.getByRole('textbox', { name: /표준점수|백분위/ })).toHaveCount(0);
  for (const [title, option] of [['수학', '미적분'], ['탐구 1', '사회·문화'], ['탐구 2', '생활과 윤리']]) {
    await page.getByRole('combobox', { name: `${title} 선택과목`, exact: true }).selectOption(option);
    if (title === '수학') { await box(page, title, '공통 원점수').fill('60'); await box(page, title, '선택 원점수').fill('14'); }
    else await box(page, title, '원점수').fill('44');
  }
  await page.getByRole('combobox', { name: '영어 등급', exact: true }).selectOption('2');
  await page.getByRole('combobox', { name: '한국사 등급', exact: true }).selectOption('1');
  await expect(page.getByRole('button', { name: '이 성적으로 시작하기', exact: true })).toBeEnabled();
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: testInfo.outputPath('raw-estimated-scores.png'), fullPage: true });
  await page.getByRole('button', { name: '이 성적으로 시작하기', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: '대학명 검색', exact: true })).toBeVisible();
  expect(state.calls.filter(row => row.type === 'get_calculator_conversion')).toHaveLength(0);
});

test('0점은 예상값을 만들고 공통 범위 오류와 중복 탐구는 진행을 막는다', async ({ page }) => {
  const state = await setup(page); await korean(page, '0', '0');
  await expect(metric(page, '국어', 2)).toHaveText('9등급');
  expect(state.calls.find(row => row.type === 'get_calculator_score_conversion').data.records[0].raw).toBe(0);
  await box(page, '국어', '공통 원점수').fill('77');
  await expect(box(page, '국어', '공통 원점수')).toHaveAttribute('aria-invalid', 'true');
  await expect(estimate(page, '국어').locator('dd')).toHaveCount(0);
  for (const title of ['탐구 1', '탐구 2']) { await page.getByRole('combobox', { name: `${title} 선택과목`, exact: true }).selectOption('사회·문화'); await box(page, title, '원점수').fill('40'); }
  await expect(page.getByRole('combobox', { name: '탐구 2 선택과목', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: '이 성적으로 시작하기', exact: true })).toBeDisabled();
});

test('수정 과목의 이전 값은 즉시 숨기고 늦은 응답을 폐기하며 다른 과목은 유지한다', async ({ page }) => {
  const state = await setup(page); await korean(page); await expect(metric(page, '국어')).toHaveText('120');
  await page.getByRole('combobox', { name: '탐구 1 선택과목', exact: true }).selectOption('사회·문화'); await box(page, '탐구 1', '원점수').fill('44');
  await expect(metric(page, '탐구 1')).toHaveText('64');
  state.mode = 'defer'; await box(page, '국어', '공통 원점수').fill('59');
  await expect.poll(() => state.pending.length).toBe(1);
  await box(page, '국어', '공통 원점수').fill('58');
  await expect(estimate(page, '국어').locator('dd')).toHaveCount(0); await expect(metric(page, '탐구 1')).toHaveText('64');
  state.mode = 'ready'; state.pending[0](); await expect(metric(page, '국어')).toHaveText('118');
  const calls = state.calls.filter(row => row.type === 'get_calculator_score_conversion');
  expect(calls.at(-1).data.records.map(row => row.key)).toEqual(['kor']);
});

test('변환 실패는 원점수를 유지하고 과목 안에서 재시도할 수 있다', async ({ page }) => {
  const state = await setup(page); state.mode = 'error'; await korean(page);
  await expect(estimate(page, '국어')).toContainText('예상 성적을 확인하지 못했습니다');
  await expect(box(page, '국어', '공통 원점수')).toHaveValue('60');
  state.mode = 'ready'; await estimate(page, '국어').getByRole('button', { name: '다시 계산', exact: true }).click();
  await expect(metric(page, '국어')).toHaveText('120');
});
