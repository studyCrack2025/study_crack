import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
async function setup(page) {
  await page.clock.setFixedTime(new Date('2026-09-07T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
}

test('일정 수정은 키보드로 열고 앱 뒤로가기 계약은 중첩 창부터 닫는다', async ({ page }) => {
  await setup(page);
  await page.route('**/api/**', route => {
    if (route.request().postDataJSON()?.type !== 'get_admission_calendar') return route.fallback();
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ events: [{ id: 'event-1', title: '수정할 일정', date: '2026-09-07', category: 'personal', source: 'personal', note: '남겨둔 메모' }] }) });
  });
  await page.goto('/studycrack-mobile.html?screen=planner');
  const trigger = page.getByRole('button', { name: '수험 일정', exact: true });
  await trigger.click();
  const calendar = page.getByRole('dialog', { name: '수험 일정', exact: true });
  const edit = calendar.getByRole('button', { name: /수정할 일정/ });
  await edit.focus();
  await page.keyboard.press('Enter');
  const form = page.getByRole('dialog', { name: '내 일정 수정', exact: true });
  await checkCycle(page, form, '저장');
  await expect(form.getByLabel('메모', { exact: true })).toHaveValue('남겨둔 메모');
  // Inject only a test action probe; use the application's existing delegated back handler.
  await form.evaluate(element => {
    const probe = document.createElement('button');
    probe.dataset.action = 'back';
    element.append(probe);
    probe.click();
    probe.remove();
  });
  await expect(form).toHaveCount(0);
  await expect(edit).toBeFocused();
  await expect(calendar).toBeVisible();
  await expect(page.locator('[data-screen="planner"]')).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(form).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(edit).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
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
  test(`캘린더 중첩 포커스·저장 실패 초안·키보드 높이를 보존한다 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    let saves = 0;
    page.on('dialog', dialog => dialog.accept());
    await page.route('**/api/**', async route => {
      const body = route.request().postDataJSON();
      if (body?.type !== 'upsert_admission_calendar_event') return route.fallback();
      saves++;
      return route.fulfill({ status: saves === 1 ? 409 : 200, contentType: 'application/json', body: JSON.stringify(saves === 1 ? { error: '저장 충돌 테스트' } : { events: [] }) });
    });
    await page.goto('/studycrack-mobile.html?screen=planner');
    const trigger = page.getByRole('button', { name: '수험 일정', exact: true });
    await trigger.click();
    const calendar = page.getByRole('dialog', { name: '수험 일정', exact: true });
    await checkCycle(page, calendar, '+ 내 일정 추가');
    await checkKeyboardHeight(page, calendar, info, `calendar-${width}`);
    const add = calendar.getByRole('button', { name: '+ 내 일정 추가', exact: true });
    await add.click();
    const form = page.getByRole('dialog', { name: '내 일정 추가', exact: true });
    await checkCycle(page, form, '저장');
    await expect(page.locator('.calendar-sheet-overlay')).toHaveAttribute('inert', '');
    await expect(page.locator('.calendar-sheet-overlay')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    const layers = await page.evaluate(() => ['.calendar-sheet-overlay', '.calendar-event-overlay'].map(selector => Number(getComputedStyle(document.querySelector(selector)).zIndex)));
    expect(layers[1]).toBeGreaterThan(layers[0]);
    const title = form.getByLabel('일정 제목', { exact: true });
    await title.fill('한글 조합과 실패 초안');
    await title.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true, bubbles: true });
    await expect(form).toBeVisible();
    await form.getByLabel('메모', { exact: true }).fill('첫째 줄\n둘째 줄');
    await checkKeyboardHeight(page, form, info, `calendar-form-${width}`);
    await form.getByRole('button', { name: '저장', exact: true }).click();
    await expect.poll(() => saves).toBe(1);
    await expect(title).toHaveValue('한글 조합과 실패 초안');
    await expect(form.getByLabel('메모', { exact: true })).toHaveValue('첫째 줄\n둘째 줄');
    await expect(form.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    await expect.poll(() => form.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: info.outputPath(`calendar-draft-${width}.png`), animations: 'disabled' });
    await form.getByRole('button', { name: '저장', exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(add).toBeFocused();
    await expect(page.locator('.calendar-sheet-overlay')).not.toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(page.locator('.app-content')).not.toHaveAttribute('inert', '');
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
