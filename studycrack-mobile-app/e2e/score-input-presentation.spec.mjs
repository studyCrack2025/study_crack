import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

const savedExam = {
  kor: { opt: '언어와매체', common: 0, elective: 24, raw: 24, std: 80, pct: 30, grd: 6 },
  math: { opt: '미적분', common: 58, elective: 20, raw: 78, std: 120, pct: 85, grd: 2 },
  eng: { grd: 2 }, hist: { grd: 1 },
  inq1: { name: '생활과 윤리', raw: 45, std: 60, pct: 80, grd: 3 },
  inq2: { name: '사회·문화', raw: 43, std: 58, pct: 75, grd: 3 }
};

async function setup(page, options = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installAuthenticatedSession(page);
  return installApiMock(page, { userOverrides: { quantitative: { mar: savedExam } }, ...options });
}

async function openScore(page, my = false) {
  await page.goto(`/studycrack-mobile.html?screen=${my ? 'timer' : 'scoreInfo'}`);
  if (my) {
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    await page.getByRole('dialog', { name: '프로필 메뉴', exact: true }).getByRole('button', { name: '마이페이지 전체 보기' }).click();
    const myScreen = page.locator('[data-screen="my"]');
    await expect(myScreen).toBeVisible();
    await myScreen.locator('[data-target="scoreInfo"]').click();
    await expect(page.locator('[data-screen="scoreInfo"]')).toHaveAttribute('data-my-flow', 'true');
  }
  const trigger = page.getByRole('button', { name: '입력·수정', exact: true });
  // Keyboard activation preserves the focused origin; Safari pointer clicks blur buttons.
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: '성적 수정', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.score-step-save')).toHaveCSS('border-radius', '4px');
  await expect(dialog.locator('input.planner-input').first()).toHaveCSS('border-radius', '8px');
  return { dialog, trigger };
}

async function next(dialog) {
  await dialog.getByRole('button', { name: '다음', exact: true }).click();
}

for (const width of [320, 360, 390, 430]) {
  for (const my of [false, true]) {
    test(`성적 입력은 큰 필드와 한 단계 진행, 키보드·초점 복귀를 유지한다 (${width}px, ${my ? 'MY' : '일반'})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await setup(page);
      const { dialog, trigger } = await openScore(page, my);
      await expect(dialog).toHaveClass(my ? /sc-side-panel/ : /score-stepper-modal/);
      await expect(dialog.locator('.score-onepage-metric,.score-step-rail,.score-direct-help,.score-step-confirm,.score-step-warn')).toHaveCount(0);
      await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
      const common = dialog.locator('[data-field="v2e-korean-common"]');
      await expect(common).toHaveValue('0');
      const labelSize = await dialog.locator('.score-field-line').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      const inputLayout = await common.evaluate(el => ({ height: el.getBoundingClientRect().height, font: parseFloat(getComputedStyle(el).fontSize) }));
      expect(labelSize).toBeGreaterThanOrEqual(16);
      expect(inputLayout.height).toBeGreaterThanOrEqual(56);
      expect(inputLayout.font).toBeGreaterThanOrEqual(20);
      const initialFrame = await dialog.boundingBox();
      await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
      await next(dialog);
      await expect(dialog.locator('[data-field="v2e-math-common"]')).toHaveValue('58');
      await next(dialog);
      await expect(dialog.locator('[data-field="v2e-english"]')).toHaveValue('2');
      const gradeFrame = await dialog.boundingBox();
      expect(Math.abs(initialFrame.y - gradeFrame.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(initialFrame.height - gradeFrame.height)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`score-input-${my ? 'my' : 'modal'}-${width}.png`), animations: 'disabled' });
      const grade = dialog.locator('[data-field="v2e-english"]');
      await grade.focus();
      await page.evaluate(() => {
        Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 400 });
        visualViewport.dispatchEvent(new Event('resize'));
      });
      await expect.poll(async () => {
        const box = await dialog.boundingBox();
        const button = await dialog.getByRole('button', { name: '다음', exact: true }).boundingBox();
        return box.y >= 0 && box.y + box.height <= 401 && button.y >= 0 && button.y + button.height <= 401;
      }).toBe(true);
      await grade.dispatchEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true });
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: info.outputPath(`score-keyboard-${my ? 'my' : 'modal'}-${width}.png`), animations: 'disabled' });
      await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expectNoHorizontalOverflow(page);
    });
  }
}

test('빈 값·불가능한 점수는 입력 아래에 표시하고 실제 0점과 이전·다음 초안을 보존한다', async ({ page }) => {
  await setup(page);
  const { dialog } = await openScore(page);
  const common = dialog.locator('[data-field="v2e-korean-common"]');
  await common.fill('');
  await next(dialog);
  await expect(common).toBeFocused();
  await expect(common).toHaveAttribute('aria-invalid', 'true');
  await expect(common).toHaveAttribute('aria-describedby', 'v2e-korean-common-error');
  await expect(dialog.locator('#v2e-korean-common-error')).toContainText('입력해 주세요');
  await common.fill('1');
  await next(dialog);
  await expect(dialog.locator('#v2e-korean-common-error')).toContainText('문항 배점상 1점');
  await common.fill('77');
  await next(dialog);
  await expect(dialog.locator('#v2e-korean-common-error')).toContainText('0~76점');
  await common.fill('0');
  await next(dialog);
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  await dialog.locator('[data-field="v2e-math-common"]').fill('60');
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await expect(common).toHaveValue('0');
  await expect(dialog.locator('.score-field-error')).toHaveCount(0);
  await next(dialog);
  await expect(dialog.locator('[data-field="v2e-math-common"]')).toHaveValue('60');
});

test('전체 성적 저장 실패는 초안과 시험을 유지하고 재시도 시 한 번만 저장한다', async ({ page }) => {
  const api = await setup(page, { failOnceTypes: ['update_quan'] });
  const { dialog, trigger } = await openScore(page);
  for (let step = 1; step < 6; step++) await next(dialog);
  await expect(dialog.locator('[data-field="v2e-inq2-subject"]')).toHaveValue('사회·문화');
  const save = dialog.getByRole('button', { name: '전체 성적 저장', exact: true });
  await save.click();
  await expect(dialog.locator('.score-save-error')).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-field="v2e-inq2-score"]')).toHaveValue('43');
  await expect(page.locator('[data-field="scoreExamType"]')).toHaveValue('3월 모의고사');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const writes = api.requests.filter(item => item.payload.type === 'update_quan');
  expect(writes).toHaveLength(2);
  expect(writes[1].payload.data.mar.kor.common).toBe(0);
  const conversions = api.requests.filter(item => item.payload.type === 'convert_score');
  expect(conversions).toHaveLength(8);
});

test('9월 추정 고지와 긴 기존 탐구 과목을 읽고 큰 글자에서도 입력과 버튼에 접근한다', async ({ page }) => {
  const longSubject = '윤리와 사상 (기존에 저장된 선택 과목)';
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page, { userOverrides: { quantitative: { sep: { ...savedExam, inq1: { ...savedExam.inq1, name: longSubject } } } } });
  const { dialog } = await openScore(page);
  await expect(dialog.locator('.score-edit-estimate-notice')).toContainText('실제 성적표');
  await page.addStyleTag({ content: `
    .score-onepage-head .sc-modal-padded-title,.score-step-panel-head b{font-size:40px;}
    .score-field-line,.score-stepper-progress span,.score-inquiry-field > span:not(.score-field-error),.score-step-panel .planner-input,.score-stepper-actions .btn{font-size:32px;}
    .score-step-panel .score-direct-input,.score-grade-input{font-size:40px;}
    .score-field-line small,.score-stepper-progress b,.score-onepage-head .sub,.score-onepage-close,.score-edit-estimate-notice{font-size:28px;}
  ` });
  for (let step = 1; step < 5; step++) await next(dialog);
  const inquiry = dialog.locator('[data-field="v2e-inq1-subject"]');
  expect(await inquiry.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(32);
  await expect(inquiry).toHaveValue(longSubject);
  await inquiry.scrollIntoViewIfNeeded();
  await expect(inquiry).toBeVisible();
  await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
