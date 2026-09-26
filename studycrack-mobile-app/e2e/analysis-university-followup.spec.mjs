import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

async function setup(page, options = {}) {
  await installAuthenticatedSession(page);
  return installApiMock(page, { tier: 'basic', ...options });
}

async function openMajor(page) {
  await page.getByRole('button', { name: '직접 추가하기 →' }).click();
  const dialog = page.getByRole('dialog', { name: '대학·학과 직접 추가' });
  await dialog.getByRole('textbox', { name: '대학명 검색' }).fill('연세');
  await dialog.getByRole('button', { name: '검색', exact: true }).click();
  await dialog.getByRole('button', { name: /연세대학교/ }).click();
  await dialog.getByRole('textbox', { name: '학과명 검색' }).fill('경제');
  await dialog.getByRole('button', { name: '검색', exact: true }).click();
  return dialog;
}

for (const width of [320, 390, 430]) {
  test(`대학 목록은 모달 안에서만 보이고 검색·뒤로·닫기가 작동한다 (${width})`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, { userOverrides: { univChangeRemaining: 3 } });
    await page.goto('/studycrack-mobile.html?screen=addUniversity');
    await expect(page.locator('.analysis-target-allowance')).toContainText('대학 변경 3회 남음');
    await expect(page.locator('[data-field="analysisSearchTerm"]')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`university-${width}.png`), animations: 'disabled' });
    const dialog = await openMajor(page);
    await expect(dialog.locator('.add-univ-row')).toContainText('연세대학교 경제학과');
    await dialog.getByRole('textbox').fill('없는학과');
    await dialog.getByRole('button', { name: '검색', exact: true }).click();
    await expect(dialog).toContainText('검색 결과가 없어요');
    await dialog.getByRole('button', { name: '← 대학 다시 선택' }).click();
    await expect(dialog.getByRole('textbox', { name: '대학명 검색' })).toHaveValue('');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: info.outputPath(`university-modal-${width}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: '직접 추가하기 →' })).toBeFocused();
  });
}

test('변경 횟수 0은 직접 추가를 비활성화하고 플랜 선택으로 안내한다', async ({ page }) => {
  const api = await setup(page, { userOverrides: { univChangeRemaining: 0 } });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await expect(page.locator('.analysis-target-allowance')).toContainText('대학 변경 0회 남음');
  await page.locator('[data-field="analysisTargetMajor"]').selectOption('__add_university__');
  await expect(page.locator('.add-univ-page')).toContainText('변경 횟수를 모두 사용');
  await expect(page.getByRole('button', { name: '직접 추가하기 →' })).toBeDisabled();
  await expect(page.getByRole('dialog', { name: '대학·학과 직접 추가' })).toHaveCount(0);
  expect(api.requests.filter(({ payload }) => payload.type === 'update_target_univs')).toHaveLength(0);
  await page.getByRole('button', { name: '플랜 선택하기 →' }).click();
  await expect(page.locator('[data-screen="proIntro"]')).toBeVisible();
  await expect(page.getByRole('region', { name: '현재 멤버십' })).toContainText('대학 변경 0회 남음');
});

test('저장 400의 변경 한도는 화면에 표시하고 선택을 유지한다', async ({ page }) => {
  await setup(page, { userOverrides: { univChangeRemaining: 1 } });
  let saves = 0;
  await page.route('**/api/**', route => {
    if (route.request().postDataJSON()?.type !== 'update_target_univs') return route.fallback();
    saves++;
    return route.fulfill({ status: 400, json: { error: '남은 변경 횟수(0회)가 부족합니다.' } });
  });
  await page.goto('/studycrack-mobile.html?screen=addUniversity');
  const dialog = await openMajor(page);
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('남은 대학 변경 횟수가 0회');
  await expect(dialog.locator('.add-univ-selection')).toContainText('연세대학교');
  await expect(dialog.getByRole('button', { name: '추가', exact: true })).toBeDisabled();
  expect(saves).toBe(1);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('button', { name: '직접 추가하기 →' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '플랜 선택하기 →' })).toBeVisible();
});

test('마지막 1회 저장은 응답 후 닫고 잔여를 갱신하며 슬롯을 유지한다', async ({ page }) => {
  await setup(page, { userOverrides: { univChangeRemaining: 1 } });
  let saves = 0;
  let saved;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.type !== 'update_target_univs') return route.fallback();
    saves++;
    saved = payload.data;
    await gate;
    return route.fulfill({ json: { message: 'Saved', changedCount: 1, remainCount: 0 } });
  });
  await page.goto('/studycrack-mobile.html?screen=addUniversity');
  const dialog = await openMajor(page);
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '저장 중', exact: true })).toBeDisabled();
  await expect(dialog).toBeVisible();
  release();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.analysis-target-allowance')).toContainText('대학 변경 0회 남음');
  await expect(page.locator('.analysis-target-allowance')).toContainText('등록 3/6');
  await expect(page.getByRole('button', { name: '직접 추가하기 →' })).toBeDisabled();
  expect(saves).toBe(1);
  expect(saved).toHaveLength(6);
  expect(saved[0].major).toBe('정치외교학과');
  expect(saved[2].major).toBe('경제학과');
});

test('Standard는 숫자 잔여 0이어도 변경 무제한으로 안내한다', async ({ page }) => {
  await setup(page, { tier: 'standard', userOverrides: { univChangeRemaining: 0 } });
  await page.goto('/studycrack-mobile.html?screen=addUniversity');
  await expect(page.locator('.analysis-target-allowance')).toContainText('대학 변경 무제한');
  const dialog = await openMajor(page);
  await expect(dialog.getByRole('button', { name: '추가', exact: true })).toBeEnabled();
});

test('추천과 대학 목록 실패는 정상 빈 결과와 구분하고 재시도로 복구한다', async ({ page }) => {
  await setup(page, { failOnceTypes: ['get_tutorial_recommendations', 'get_univ_list_only'] });
  await page.goto('/studycrack-mobile.html?screen=addUniversity');
  await expect(page.locator('.add-univ-page')).toContainText('추천을 불러오지 못했어요');
  await expect(page.locator('.add-univ-page')).not.toContainText('현재 조건에 맞는 추천이 없어요');
  await page.getByRole('button', { name: '새로고침' }).click();
  await expect(page.locator('.add-univ-grid')).toContainText('성균관대학교');
  await page.getByRole('button', { name: '직접 추가하기 →' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('대학·학과 목록을 불러오지 못했어요');
  await dialog.getByRole('button', { name: '다시 시도' }).click();
  await expect(dialog.getByRole('button', { name: /연세대학교/ })).toBeVisible();
});

test('시뮬레이션의 최초 상승·무변화·데이터 오류·만점을 구분한다', async ({ page }, info) => {
  await setup(page);
  await page.route('**/api/**', route => {
    const data = route.request().postDataJSON();
    if (data?.type !== 'simulate_score_rise') return route.fallback();
    return route.fulfill({ json: data.targetUnivs.map(target => ({ ...target, base_ui_score: 142, sim_data: {
      kor: { name: '국어', uiDiff: 0, afterUiScore: 142, rawNeeded: 3, firstPositiveUiDiff: 2 },
      math: { name: '수학', uiDiff: 0, afterUiScore: 142, msg: '변동 없음 (증발 구간)' },
      inq1: { name: '물리', uiDiff: 0, afterUiScore: 142, msg: '시뮬레이션 불가 (데이터 오류)' },
      inq2: { name: '화학', uiDiff: 0, afterUiScore: 142, msg: '이미 만점입니다.' }
    } })) });
  });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await page.getByRole('button', { name: '점수 계산하기', exact: true }).click();
  const rows = page.locator('.analysis-sim-row');
  await expect(rows.filter({ hasText: '국어' })).toContainText('원점수 +3점에서 처음 상승');
  await expect(rows.filter({ hasText: '수학' })).toContainText('+1점에서는 변화 없음');
  await expect(rows.filter({ hasText: '물리' })).toBeDisabled();
  await expect(rows.filter({ hasText: '물리' })).not.toContainText('+0.0점');
  await expect(rows.filter({ hasText: '화학' })).toContainText('이미 원점수 만점');
  await expect(page.locator('.analysis-boost-card')).not.toContainText('변동 대기');
  await page.locator('.analysis-boost-card').screenshot({ path: info.outputPath('simulation-states.png'), animations: 'disabled' });
});
