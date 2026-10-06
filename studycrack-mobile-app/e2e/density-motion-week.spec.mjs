import { test, expect } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const timezoneId of ['Asia/Seoul', 'UTC']) test.describe(`주간 상세 ${timezoneId}`, () => {
  test.use({ timezoneId });
  test('홈 주간 상세는 모달 없이 펼쳐지고 플래너의 큰 상세는 제거된다', async ({ page }) => {
    const now = new Date('2026-10-04T16:30:00Z');
    await page.clock.install({ time: now });
    await installAuthenticatedSession(page);
    const api = await installApiMock(page);
    api.state.studyNow = now.getTime();
    api.state.studySeconds = 3600;
    await page.goto('/studycrack-mobile.html?screen=timer');
    const week = page.locator('.home-week-flow');
    const toggle = week.getByRole('button', { name: /이번 주 공부 흐름/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(week.locator('.timer-day-subjects')).toBeHidden();
    await toggle.click();
    await expect(week.locator('.timer-day-subjects')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await toggle.click();
    await week.locator('.timer-week-day').first().click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.tabbar [data-tab="planner"]').click();
    await expect(page.locator('.sc-study-details')).toHaveCount(0);
    await expect(page.locator('.planner-study-status')).toContainText(`${timezoneId === 'Asia/Seoul' ? '오늘' : '2026-10-05'} 실제 공부 01:00:00`);
    await expectNoHorizontalOverflow(page);
  });
});

test('MY 패널과 하위 페이지는 오른쪽 퇴장 후 한 번만 복귀한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  const drawer = page.getByRole('dialog', { name: '프로필 메뉴', exact: true });
  await expect(drawer).toHaveCSS('animation-duration', '0.38s');
  await drawer.getByRole('button', { name: '프로필 메뉴 닫기' }).click();
  await expect(drawer).toHaveAttribute('data-my-exit', 'true');
  await expect(drawer).toHaveCSS('animation-name', 'myDrawerOut');
  await expect(drawer).toHaveCount(0);
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await drawer.locator('[data-target="ranking"]').click();
  const ranking = page.locator('[data-screen="ranking"]');
  await page.locator('[data-action="back"]').first().evaluate(button => { button.click(); button.click(); });
  await expect(ranking).toHaveAttribute('data-my-exit', 'true');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS('animation-name', 'none');
  await drawer.locator('[data-target="ranking"]').click();
  await expect(ranking).toBeVisible();
  await page.evaluate(() => history.back());
  await expect(drawer).toBeVisible();
  await page.evaluate(() => history.back());
  await expect(drawer).toHaveCount(0);
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
});

test('획득 후 수조 관리 상세는 기본 접힘이며 도감과 뽑기권이 두 영역에 모인다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page, { initialGameProfile: { starterState: 'claimed' } });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('.aquarium-discovery-card .aquarium-wallet')).toBeVisible();
  await expect(page.locator('.aquarium-journey')).toHaveCount(0);
  await expect(page.locator('.aquarium-management')).not.toHaveAttribute('open', '');
  await page.locator('.aquarium-management summary').click();
  await expect(page.locator('.aquarium-management')).toHaveAttribute('open', '');
  await expectNoHorizontalOverflow(page);
});

test('MY 하위 패널은 Escape 퇴장 중에도 유지되고 종료 후 입력 버튼으로 초점을 돌린다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
  await page.locator('[data-target="accountInfo"]').click();
  const trigger = page.locator('[data-action="openMyProfileEdit"]');
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  const panel = page.getByRole('dialog', { name: '이름 변경', exact: true });
  await expect(panel).toHaveCSS('animation-duration', '0.38s');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveAttribute('data-my-exit', 'true');
  await expect(panel).toHaveCSS('animation-name', 'myDrawerOut');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
