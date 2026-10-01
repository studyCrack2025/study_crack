import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

async function setup(page) {
  await page.clock.setFixedTime(new Date('2026-10-01T03:00:00Z'));
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro' });
  let events = [{ id: 'personal-interview', title: '개인 면접 준비', date: '2026-10-02', category: 'personal' }];
  await page.route('**/api/user', async route => {
    const payload = route.request().postDataJSON();
    if (payload.type === 'get_admission_calendar') return route.fulfill({ json: { events } });
    if (payload.type === 'upsert_admission_calendar_event') {
      const event = { ...payload.data, id: payload.data.id || 'new-event' };
      events = [...events.filter(row => row.id !== event.id), event];
      return route.fulfill({ json: { events, event } });
    }
    return route.fallback();
  });
}

async function expectContained(locator) {
  expect(await locator.evaluateAll(inputs => inputs.every(input => {
    const rect = input.getBoundingClientRect();
    const parent = input.parentElement.getBoundingClientRect();
    return rect.x >= parent.x - 1 && rect.right <= parent.right + 1 && input.scrollWidth <= input.clientWidth + 1;
  }))).toBe(true);
}

for (const width of [320, 390, 430]) {
  test(`home calendar entry, weekly marks and native inputs remain usable (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.goto('/studycrack-mobile.html?screen=timer');
    const upcoming = page.getByRole('button', { name: '다가오는 일정 확인 및 추가' });
    await expect(upcoming).toContainText('D-1');
    await expect(upcoming).toContainText('개인 면접 준비');
    await expect(upcoming).not.toContainText('D+');
    await upcoming.click();
    const calendar = page.getByRole('dialog', { name: '수험 일정', exact: true });
    await expect(calendar).toBeVisible();
    await expect(calendar.locator('.calendar-selected')).toContainText('개인 면접 준비');
    await calendar.getByRole('button', { name: '+ 내 일정 추가', exact: true }).click();
    const form = page.getByRole('dialog', { name: '내 일정 추가', exact: true });
    await form.getByLabel('일정 제목', { exact: true }).fill('오늘의 면접');
    await form.getByLabel('시작일', { exact: true }).fill('2026-10-01');
    await expectContained(form.locator('input[type="date"]'));
    const start = await form.getByLabel('시작일', { exact: true }).boundingBox();
    const end = await form.getByLabel('종료일 (선택)', { exact: true }).boundingBox();
    expect(start.y + start.height).toBeLessThan(end.y);
    await page.screenshot({ path: testInfo.outputPath(`calendar-form-${width}.png`), animations: 'disabled' });
    await form.getByRole('button', { name: '저장', exact: true }).click();
    await expect(form).not.toBeVisible();
    await calendar.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(upcoming).toContainText('D-DAY');
    await expect(upcoming).toContainText('오늘의 면접');
    await page.locator('.tabbar [data-tab="planner"]').click();
    const tomorrow = page.locator('.planner-date-strip [data-planner-date="2026-10-02"]');
    await expect(tomorrow.locator('.planner-date-events')).toHaveText('●');
    await tomorrow.click();
    await expect(page.getByLabel('선택한 날의 일정')).toContainText('개인 면접 준비');
    await page.getByRole('button', { name: '일정 더보기', exact: true }).click();
    await expect(calendar).toBeVisible();
    await expect(calendar.locator('.calendar-selected')).toContainText('개인 면접 준비');
    await calendar.getByRole('button', { name: '닫기', exact: true }).click();
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
    await page.screenshot({ path: testInfo.outputPath(`planner-time-${width}.png`), animations: 'disabled' });
    await expectNoHorizontalOverflow(page);
  });
}
