import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
async function setup(page) {
  await page.clock.setFixedTime(new Date('2026-09-07T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
}

test('일정 입력은 키보드로 열고 접어도 초안을 보존한다', async ({ page }) => {
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  const add = page.getByRole('button', { name: '+ 내 일정 추가', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  const form = page.getByRole('region', { name: '내 일정 추가', exact: true });
  await expect(form).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const title = form.getByLabel('일정 제목', { exact: true });
  await title.fill('키보드로 작성한 일정');
  await title.press('Escape');
  await expect(form).toBeVisible();
  await page.getByRole('button', { name: '일정 입력 접기' }).click();
  await expect(form).toHaveCount(0);
  await page.getByRole('button', { name: '작성하던 일정 이어쓰기' }).click();
  await expect(title).toHaveValue('키보드로 작성한 일정');
  await expect(page.locator('.app-content')).not.toHaveClass(/modal-lock/);
});

test('일정 입력은 기존 추가 버튼의 포커스를 가로채지 않는다', async ({ page, browserName }) => {
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=planner');
  const add = page.getByRole('button', { name: '+ 내 일정 추가', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: '내 일정 추가', exact: true })).toBeVisible();
  await expect(add).toBeFocused();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByRole('button', { name: '주', exact: true })).toBeFocused();
});

test('코칭 제출 실패 후 입력과 포커스를 유지하고 재시도한다', async ({ page }) => {
  await setup(page);
  let submissions = 0;
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/api/**', route => {
    if (route.request().postDataJSON()?.type !== 'save_weekly_check') return route.fallback();
    submissions++;
    return route.fulfill({ status: submissions === 1 ? 400 : 200, contentType: 'application/json', body: JSON.stringify(submissions === 1 ? { error: '제출 실패 테스트' } : { message: 'Saved successfully' }) });
  });
  await page.goto('/studycrack-mobile.html?screen=strategy');
  const trigger = page.getByRole('button', { name: '이번 주 코칭 신청하기', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '주간 학습 점검', exact: true });
  const next = dialog.getByRole('button', { name: '다음 단계', exact: true });
  await dialog.locator('[data-coach-actual]').fill('0.5');
  await next.click();
  await next.click();
  await dialog.getByRole('button', { name: '미응시', exact: true }).click();
  await next.click();
  await dialog.getByRole('button', { name: '유지', exact: true }).click();
  await next.click();
  await dialog.locator('[data-coach-answer="step5"]').fill('실패해도 보존할 한글 답변');
  for (let step = 5; step < 8; step++) await next.click();
  const submit = dialog.getByRole('button', { name: '작성 완료 및 제출', exact: true });
  await submit.click();
  await expect.poll(() => submissions).toBe(1);
  await expect(submit).toBeEnabled();
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const prev = dialog.getByRole('button', { name: '이전', exact: true });
  for (let step = 8; step > 5; step--) await prev.click();
  await expect(dialog.locator('[data-coach-answer="step5"]')).toHaveValue('실패해도 보존할 한글 답변');
  for (let step = 5; step < 8; step++) await next.click();
  await submit.click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(submissions).toBe(2);
});

async function checkCycle(page, dialog, lastName) {
  const close = dialog.getByRole('button', { name: '닫기', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: lastName, exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
}

async function checkKeyboardHeight(page, dialog, info, name) {
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 400 });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    return box.y >= 0 && box.y + box.height <= 401;
  }).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}-keyboard.png`), animations: 'disabled' });
  await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
}

for (const width of [320, 360, 390, 430]) {
  test(`인라인 일정의 실패 초안과 좁은 화면을 보존한다 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    let saves = 0;
    let events = [];
    await page.route('**/api/user', async route => {
      const body = route.request().postDataJSON();
      if (body.type === 'get_admission_calendar') return route.fulfill({ json: { events, supportsClientRequestId: true } });
      if (body.type !== 'upsert_admission_calendar_event') return route.fallback();
      saves++;
      if (saves === 1) return route.fulfill({ status: 400, json: { error: '검증 실패' } });
      const event = { ...body.data, id: body.data.clientRequestId };
      events = [event];
      return route.fulfill({ json: { events, event } });
    });
    await page.goto('/studycrack-mobile.html?screen=planner');
    await page.getByRole('button', { name: '+ 내 일정 추가', exact: true }).click();
    const form = page.getByRole('region', { name: '내 일정 추가', exact: true });
    const title = form.getByLabel('일정 제목', { exact: true });
    await title.fill('한글 조합과 실패 초안');
    await title.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true, bubbles: true });
    await form.locator('summary').click();
    await form.getByLabel('메모', { exact: true }).fill('첫째 줄\n둘째 줄');
    await form.getByRole('button', { name: '저장', exact: true }).click();
    await expect.poll(() => saves).toBe(1);
    await expect(form.getByRole('alert')).toBeVisible();
    await expect(title).toHaveValue('한글 조합과 실패 초안');
    await expect(form.getByLabel('메모', { exact: true })).toHaveValue('첫째 줄\n둘째 줄');
    await page.setViewportSize({ width, height: 400 });
    await form.getByRole('button', { name: '저장', exact: true }).scrollIntoViewIfNeeded();
    await expect(form.getByRole('button', { name: '저장', exact: true })).toBeInViewport();
    await expect(page.locator('.app-content')).not.toHaveClass(/modal-lock/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`calendar-draft-${width}.png`), animations: 'disabled' });
    await form.getByRole('button', { name: '저장', exact: true }).click();
    await expect(form).toHaveCount(0);
    expect(saves).toBe(2);
    await expectNoHorizontalOverflow(page);
  });

  test(`코칭 팝업의 이름·포커스·한글 Escape·가시 높이를 보장한다 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.goto('/studycrack-mobile.html?screen=strategy');
    const trigger = page.getByRole('button', { name: '이번 주 코칭 신청하기', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '주간 학습 점검', exact: true });
    await checkCycle(page, dialog, '다음 단계');
    await dialog.locator('[data-coach-actual]').fill('0.5');
    await dialog.locator('[data-coach-actual]').dispatchEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true });
    await expect(dialog).toBeVisible();
    await checkKeyboardHeight(page, dialog, info, `coaching-${width}`);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });
}
