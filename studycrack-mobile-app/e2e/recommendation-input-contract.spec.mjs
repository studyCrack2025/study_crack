import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';

for (const stream of ['의치한약수', '상경계열']) {
  test(`추천 요청은 저장된 세부 희망 계열을 유지한다: ${stream}`, async ({ page }) => {
    await installAuthenticatedSession(page);
    const api = await installApiMock(page, { userOverrides: { qualitative: { stream } } });
    await page.goto('/studycrack-mobile.html?screen=addUniversity');
    await expect(page.locator('.add-univ-grid')).toContainText('성균관대학교');
    const request = api.requests.find(item => item.payload.type === 'get_tutorial_recommendations');
    expect(request?.payload.stream).toBe(stream);
    expect(request.payload.userScores.math.opt).toBe('미적분');
  });
}

test('저장 계열이 없으면 화면 기본값을 희망 계열로 보내지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { userOverrides: { qualitative: {} } });
  await page.goto('/studycrack-mobile.html?screen=addUniversity');
  await expect(page.locator('.add-univ-grid')).toContainText('성균관대학교');
  const request = api.requests.find(item => item.payload.type === 'get_tutorial_recommendations');
  expect(request?.payload.stream).toBe('');
  expect(request.payload.userScores.math.opt).toBe('미적분');
});

test('잘못된 계열 오류를 조건에 맞는 추천이 없는 상태와 구분한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { userOverrides: { qualitative: { stream: '확인이필요한계열' } } });
  await page.route('**/api/**', route => {
    const payload = route.request().postDataJSON();
    if (payload?.type !== 'get_tutorial_recommendations') return route.fallback();
    expect(payload.stream).toBe('확인이필요한계열');
    return route.fulfill({ status: 400, json: { code: 'RECOMMENDATION_STREAM_INVALID', error: '희망 계열을 다시 확인해 주세요.' } });
  });
  await page.goto('/studycrack-mobile.html?screen=addUniversity');
  await expect(page.locator('.add-univ-page')).toContainText('희망 계열을 다시 확인해 주세요.');
  await expect(page.locator('.add-univ-page')).not.toContainText('현재 조건에 맞는 추천이 없어요');
});

test('기존 약칭 성적을 다시 열어도 선택과목과 원점수 0이 보존된다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { userOverrides: { quantitative: { mar: {
    kor: { opt: '언매', common: 0, elective: 24, raw: 24, std: 80, pct: 30, grd: 6 },
    math: { opt: '미적', common: 0, elective: 26, raw: 26, std: 80, pct: 30, grd: 6 },
    eng: { grade: 2 }, hist: { grade: 1 },
    inq1: { name: '물1', raw: 0, std: 40, pct: 1, grd: 9 }, inq2: { name: '화학2', raw: 0, std: 40, pct: 1, grd: 9 }
  } } } });
  await page.goto('/studycrack-mobile.html?screen=scoreInfo');
  await page.getByRole('button', { name: '입력·수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '성적 수정', exact: true });
  await expect(dialog.locator('[data-field="v2e-korean-type"]')).toHaveValue('언어와매체');
  await expect(dialog.locator('[data-field="v2e-korean-common"]')).toHaveValue('0');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.locator('[data-field="v2e-math-type"]')).toHaveValue('미적분');
  await expect(dialog.locator('[data-field="v2e-math-common"]')).toHaveValue('0');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.locator('[data-field="v2e-english"]')).toHaveValue('2');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.locator('[data-field="v2e-history"]')).toHaveValue('1');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.locator('[data-field="v2e-inq1-subject"]')).toHaveValue('물리학Ⅰ');
  await expect(dialog.locator('[data-field="v2e-inq1-score"]')).toHaveValue('0');
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
  await expect(dialog.locator('[data-field="v2e-inq2-subject"]')).toHaveValue('화학Ⅱ');
});

test('웹 추천은 서버의 계열 오류를 빈 추천 메시지로 바꾸지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'basic', userOverrides: { qualitative: { stream: '상경계열' } } });
  await page.route('**/api/**', route => {
    const payload = route.request().postDataJSON();
    if (['get_login_profile', 'get_user'].includes(payload?.type)) return route.fulfill({ json: { ...mockUser, tutorialRewardClaimed: true, qualitative: { stream: '상경계열' } } });
    if (payload?.type !== 'get_tutorial_recommendations') return route.fallback();
    expect(payload.stream).toBe('상경계열');
    return route.fulfill({ status: 400, json: { code: 'RECOMMENDATION_STREAM_INVALID', error: '희망 계열을 다시 확인해 주세요.' } });
  });
  await page.goto('/analysis.html');
  await expect(page.locator('#pageLoadingOverlay')).toBeHidden();
  await page.evaluate(() => window.openUnivSelectModal(2));
  const messages = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
  await page.locator('#recommendBtn').click();
  await expect.poll(() => messages).toEqual(['희망 계열을 다시 확인해 주세요.']);
  await expect(page.locator('#recommendBtn')).toBeEnabled();
});
