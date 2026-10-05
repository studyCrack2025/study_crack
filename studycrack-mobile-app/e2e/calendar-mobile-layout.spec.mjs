import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

async function setup(page, now = '2026-10-01T03:00:00Z') {
  await page.clock.setFixedTime(new Date(now));
  await installAuthenticatedSession(page, { now: new Date(now).getTime() });
  await installApiMock(page, { tier: 'pro' });
  const state = { events: [{ id: 'personal-interview', title: '개인 면접 준비', date: '2026-10-02', category: 'personal' }], saves: 0, fail: false, unknown: false };
  await page.route('**/api/user', async route => {
    const payload = route.request().postDataJSON();
    if (payload.type === 'get_admission_calendar') return route.fulfill({ json: { events: state.events, supportsClientRequestId: true } });
    if (payload.type === 'upsert_admission_calendar_event') {
      state.saves++;
      if (state.fail) return route.fulfill({ status: 400, json: { error: '검증 실패' } });
      const event = { ...payload.data, id: payload.data.id || payload.data.clientRequestId };
      state.events = [...state.events.filter(row => row.id !== event.id), event];
      if (state.unknown) return route.fulfill({ status: 500, json: { error: 'response interrupted' } });
      return route.fulfill({ json: { events: state.events, event } });
    }
    if (payload.type === 'delete_admission_calendar_event') {
      state.events = state.events.filter(row => row.id !== payload.data.id);
      return route.fulfill({ json: { events: state.events } });
    }
    return route.fallback();
  });
  return state;
}

async function expectContained(locator) {
  expect(await locator.evaluateAll(inputs => inputs.every(input => {
    const rect = input.getBoundingClientRect();
    const parent = input.parentElement.getBoundingClientRect();
    return rect.x >= parent.x - 1 && rect.right <= parent.right + 1 && input.scrollWidth <= input.clientWidth + 1;
  }))).toBe(true);
}

for (const width of [320, 390, 430]) {
  test(`inline calendar entry, CRUD, drafts and native inputs (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await setup(page);
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/studycrack-mobile.html?screen=timer');
    const upcoming = page.getByRole('button', { name: '다가오는 일정 확인 및 추가' });
    await expect(upcoming).toContainText('D-1');
    await upcoming.click();
    const calendar = page.getByRole('region', { name: '일정 달력', exact: true });
    await expect(page.locator('[data-screen="planner"]')).toBeVisible();
    await expect(calendar.getByLabel('선택한 날의 일정')).toContainText('개인 면접 준비');
    await expect(page.locator('.calendar-cell[data-planner-date="2026-10-02"]')).toHaveAttribute('aria-pressed', 'true');
    await calendar.getByRole('button', { name: '+ 내 일정 추가', exact: true }).click();
    const form = page.getByRole('region', { name: '내 일정 추가', exact: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await form.getByLabel('일정 제목', { exact: true }).fill('오늘의 면접');
    await form.getByLabel('시작일', { exact: true }).fill('2026-10-01');
    await form.locator('summary').click();
    await form.getByLabel('메모', { exact: true }).fill('준비물 확인');
    await expectContained(form.locator('input[type="date"]'));
    const start = await form.getByLabel('시작일', { exact: true }).boundingBox();
    const end = await form.getByLabel('종료일 (선택)', { exact: true }).boundingBox();
    expect(start.y + start.height).toBeLessThan(end.y);
    await calendar.getByRole('button', { name: '월', exact: true }).click();
    await expect(form.getByLabel('일정 제목', { exact: true })).toHaveValue('오늘의 면접');
    await page.locator('.tabbar [data-tab="timer"]').click();
    await page.locator('.tabbar [data-tab="planner"]').click();
    await expect(form.getByLabel('메모', { exact: true })).toHaveValue('준비물 확인');
    await expect(page.locator('.app-content')).not.toHaveClass(/modal-lock/);
    state.fail = true;
    await form.getByRole('button', { name: '저장', exact: true }).click();
    await expect(form.getByRole('alert')).toBeVisible();
    await expect(form.getByLabel('일정 제목', { exact: true })).toHaveValue('오늘의 면접');
    state.fail = false;
    await form.screenshot({ path: testInfo.outputPath(`calendar-form-${width}.png`), animations: 'disabled' });
    await form.getByRole('button', { name: '저장', exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(calendar.getByLabel('선택한 날의 일정')).toContainText('오늘의 면접');
    await page.locator('.tabbar [data-tab="timer"]').click();
    await expect(upcoming).toContainText('D-DAY');
    await expect(upcoming).toContainText('오늘의 면접');
    await upcoming.click();
    await calendar.getByRole('button', { name: '오늘의 면접 수정' }).click();
    const edit = page.getByRole('region', { name: '내 일정 수정', exact: true });
    await edit.getByLabel('일정 제목', { exact: true }).fill('수정된 면접');
    await edit.getByRole('button', { name: '저장', exact: true }).click();
    await expect(edit).toHaveCount(0);
    await calendar.getByRole('button', { name: '수정된 면접 수정' }).click();
    await edit.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(edit).toHaveCount(0);
    await expect(calendar.getByRole('button', { name: '수정된 면접 수정' })).toHaveCount(0);
    await page.getByRole('button', { name: '계획 추가', exact: true }).click();
    const times = page.locator('.planner-time-input-grid input');
    await expect(times).toHaveCount(2);
    await expectContained(times);
    const first = await times.nth(0).boundingBox();
    const last = await times.nth(1).boundingBox();
    expect(first.y + first.height).toBeLessThan(last.y);
    await times.nth(0).fill('10:00');
    await times.nth(1).fill('11:30');
    await expect(page.locator('[data-planner-duration-preview]')).toHaveText('1시간 30분');
    await expectNoHorizontalOverflow(page);
  });
}

test('week swipes, cancellation and month clamp preserve the selected date', async ({ page }) => {
  await setup(page, '2028-01-31T03:00:00Z');
  await page.goto('/studycrack-mobile.html?screen=planner');
  const calendar = page.getByRole('region', { name: '일정 달력', exact: true });
  const selected = () => calendar.locator('.calendar-cell[aria-pressed="true"]');
  await expect(selected()).toHaveAttribute('data-planner-date', '2028-01-31');
  const hint = calendar.locator('.calendar-weekdays');
  const box = await hint.boundingBox();
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.up();
  await expect(selected()).toHaveAttribute('data-planner-date', '2028-02-07');
  await calendar.getByRole('button', { name: '이전 주', exact: true }).click();
  await expect(selected()).toHaveAttribute('data-planner-date', '2028-01-31');
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  await hint.dispatchEvent('pointercancel');
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.up();
  await expect(selected()).toHaveAttribute('data-planner-date', '2028-01-31');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 45, box.y + box.height / 2 + 70);
  await page.mouse.up();
  await expect(selected()).toHaveAttribute('data-planner-date', '2028-01-31');
  await expect(calendar.locator('.calendar-swipe-area')).toHaveCSS('touch-action', 'pan-y pinch-zoom');
  await calendar.getByRole('button', { name: '주', exact: true }).press('ArrowRight');
  await expect(calendar.locator('.calendar-grid .calendar-cell')).toHaveCount(31);
  await calendar.getByRole('button', { name: '다음 달', exact: true }).click();
  await expect(selected()).toHaveAttribute('data-planner-date', '2028-02-29');
  await expect(calendar.locator('.calendar-grid .calendar-cell')).toHaveCount(29);
  await expectNoHorizontalOverflow(page);
});

test('an interrupted save recovers exactly one event without another write', async ({ page }) => {
  const state = await setup(page);
  state.unknown = true;
  await page.goto('/studycrack-mobile.html?screen=planner');
  const calendar = page.getByRole('region', { name: '일정 달력', exact: true });
  await expect(calendar.getByRole('status')).toHaveCount(0);
  await calendar.getByRole('button', { name: '+ 내 일정 추가', exact: true }).click();
  const form = page.getByRole('region', { name: '내 일정 추가', exact: true });
  await form.getByLabel('일정 제목', { exact: true }).fill('중복 없는 일정');
  await form.getByRole('button', { name: '저장', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(calendar.getByRole('button', { name: '중복 없는 일정 수정' })).toHaveCount(1);
  expect(state.saves).toBe(1);
});
