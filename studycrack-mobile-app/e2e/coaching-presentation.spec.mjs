import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

const reports = [
  { weekId: '260801', date: '2026-08-03', tutorName: '이전 튜터', tutorFeedback: { submitted: true, tutorComment: '지난주 피드백도 확인할 수 있어요.' } },
  { weekId: '260901', date: '2026-09-07', tutorName: '담당 튜터', tutorFeedback: { submitted: true, weeklyPlanner: '긴 한글 계획을 차분하게 읽고 직접 플래너에 정리해주세요. '.repeat(6), tutorComment: '실제 피드백 내용', priorityCheck: '우선순위도 확인해요.' } },
  { weekId: '260804', date: '2026-08-24', tutorFeedback: { submitted: false, tutorComment: '노출하면 안 되는 초안' } }
];
async function setup(page, { tier = 'standard', response = reports } = {}) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { tier });
  await page.route('**/api/**', async route => {
    const payload = route.request().postDataJSON() || {};
    if (payload.type !== 'get_weekly_reports') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ weeklyReports: response }) });
  });
  return api;
}

for (const width of [320, 360, 390, 430]) {
  test(`코칭·주간·상품은 실제 기록과 원본 카드 순서를 유지한다 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 932 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page);
    await page.goto('/studycrack-mobile.html?screen=strategy');
    await expect(page.locator('.coaching-hero')).toContainText('피드백 도착');
    await expect(page.locator('.coaching-week-status')).toContainText('2026년 9월 1주차');
    await expect(page.locator('.coaching-week-days li')).toHaveCount(7);
    await expect(page.locator('.coaching-week-preview')).toContainText('등록 1개 · 계획 30분');
    const order = await page.locator('.coach-page').evaluate(el => [...el.children].map(child => child.className));
    for (const [before, after] of [['coaching-hero', 'coaching-process'], ['coaching-process', 'coaching-week-preview'], ['coaching-week-preview', 'btn btn-primary coaching-request-cta'], ['coaching-history', 'service-plan-comparison']]) expect(order.indexOf(before)).toBeLessThan(order.indexOf(after));
    await page.screenshot({ path: info.outputPath(`coaching-top-${width}.png`), animations: 'disabled' });
    await expect(page.locator('.service-plan-card')).toHaveCount(4);
    await page.locator('.service-plan-comparison').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.locator('.service-plan-comparison').screenshot({ path: info.outputPath(`coaching-plans-${width}.png`), animations: 'disabled' });
    await expectNoHorizontalOverflow(page);
    await page.goto('/studycrack-mobile.html?screen=weekly');
    await expect(page.locator('.weekly-feedback')).toHaveCount(3);
    await expect(page.locator('.weekly-feedback').first()).toContainText('실제 피드백 내용');
    await expect(page.locator('.weekly-feedback').first()).toContainText('우선순위도 확인해요');
    await expect(page.getByText('노출하면 안 되는 초안')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`coaching-weekly-${width}.png`), animations: 'disabled' });
    await page.locator('.weekly-feedback').last().locator('summary').click();
    await expect(page.getByText('지난주 피드백도 확인할 수 있어요.')).toBeVisible();
    await expect(page.locator('.coaching-week-list li')).toHaveCount(7);
    await page.locator('.coaching-week-preview').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.locator('.coaching-week-preview').screenshot({ path: info.outputPath(`coaching-week-plan-${width}.png`), animations: 'disabled' });
    await expectNoHorizontalOverflow(page);
  });
}

test('BASIC 잠금 미리보기는 수치나 신청 권한을 만들지 않는다', async ({ page }, info) => {
  await setup(page, { tier: 'basic' });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.locator('.tabbar [data-tab="strategy"]').click();
  await expect(page.locator('[data-screen="lockedFeature"]')).toBeVisible();
  await expect(page.locator('.coach-preview .coaching-week-days b')).toHaveText(Array(7).fill('—'));
  await expect(page.locator('[data-action="openCoachingSheet"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('coaching-basic-390.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'STANDARD 플랜 보기' }).click();
  for (const [plan, price] of [['Basic', '25,000원 / 4주'], ['Starter', '39,000원'], ['Standard', '49,000원 / 4주'], ['Pro', '149,000원 / 4주']]) {
    await page.locator(`.service-plan-card[data-plan="${plan}"]`).click();
    await expect(page.locator(`.service-plan-card[data-plan="${plan}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.plan-console-detail')).toContainText(price);
  }
  await expect(page.locator('.plan-benefit-row')).toHaveCount(7);
  await page.locator('.plan-console-cta').click();
  await expect(page.locator('[data-screen="payment"]')).toBeVisible();
  await expect(page.locator('.plan-console-detail')).toContainText('149,000원 / 4주');
});

test('주간 조회 실패는 기기 계획과 분리되고 명시적 재조회로 복구된다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro', failOnceTypes: ['get_weekly_reports'] });
  await page.goto('/studycrack-mobile.html?screen=weekly');
  await expect(page.getByText('주간 점검을 불러오지 못했어요', { exact: true })).toBeVisible();
  await expect(page.getByText('주간 점검 기록이 없습니다.', { exact: true })).toHaveCount(0);
  await expect(page.locator('.coaching-week-preview')).toContainText('등록 1개 · 계획 30분');
  await page.locator('[data-action="retryReportResources"]').click();
  await expect(page.getByText('주간 점검 기록이 없습니다.', { exact: true })).toBeVisible();
});

test('PRO 신청은 8단계와 한글 입력·제출 잠금을 유지한다', async ({ page }) => {
  await setup(page, { tier: 'pro', response: [] });
  let submitted = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/**', async route => {
    if (route.request().postDataJSON()?.type !== 'save_weekly_check') return route.fallback();
    submitted += 1;
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Saved successfully' }) });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/studycrack-mobile.html?screen=strategy');
  await page.getByRole('button', { name: '이번 주 코칭 신청하기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-coach-actual]').fill('0.5');
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click();
  await expect(dialog.locator('.coach-step-progress')).toContainText('2 / 8');
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click();
  await dialog.getByRole('button', { name: '미응시', exact: true }).click();
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click();
  await dialog.getByRole('button', { name: '유지', exact: true }).click();
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click();
  await dialog.locator('[data-coach-answer="step5"]').evaluate(element => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = '계획을 조정하고 싶어요';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: '계획을 조정하고 싶어요', inputType: 'insertCompositionText', isComposing: true }));
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '계획을 조정하고 싶어요' }));
  });
  await dialog.getByRole('button', { name: '다음 단계', exact: true }).click();
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await expect(dialog.locator('[data-coach-answer="step5"]')).toHaveValue('계획을 조정하고 싶어요');
  for (let step = 5; step < 8; step += 1) await dialog.getByRole('button', { name: '다음 단계', exact: true }).click();
  await expect(dialog.locator('.coach-step-progress')).toContainText('8 / 8');
  await dialog.getByRole('button', { name: '작성 완료 및 제출', exact: true }).click();
  try {
    await expect.poll(() => submitted).toBe(1);
    await expect(dialog.getByRole('button', { name: '제출 중', exact: true })).toBeDisabled();
  } finally { release(); }
  await expect(dialog).toHaveCount(0);
  expect(submitted).toBe(1);
});
