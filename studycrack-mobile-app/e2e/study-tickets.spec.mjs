import { test, expect } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test('5시간 경계의 확정 공부는 뽑기권과 잔여초로 표시되고 한 장만 사용한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { initialGameProfile: { ticketBalance: 0, ticketProgressSeconds: 17999 }, studyDurationSeconds: 2 });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await page.getByRole('button', { name: '공부 시작', exact: true }).click();
  await page.locator('.study-plan-options button').filter({ hasText: '독서' }).click();
  await page.locator('.study-start-confirm').click();
  await page.getByRole('button', { name: '공부 완료', exact: true }).click();
  await expect(page.locator('.timer-reward-values')).toContainText('뽑기권 +1장');
  expect(api.state.gameProfile.ticketProgressSeconds).toBe(1);
  await page.getByRole('button', { name: '수조에서 확인', exact: true }).click();
  await page.locator('[data-action="selectStarterCandidate"]').first().click();
  await page.getByRole('button', { name: '이 물고기와 시작하기' }).click();
  await expect(page.locator('.aquarium-wallet')).toContainText('뽑기권 1장');
  await expect(page.locator('[data-action="feedAquariumFish"]')).toHaveCount(0);
  await page.locator('[data-action="openAquariumDraw"]').click();
  await page.getByRole('button', { name: '뽑기권 1장으로 만나기' }).evaluate(button => { button.click(); button.click(); });
  await expect(page.getByRole('dialog', { name: '물고기 발견 결과' })).toBeVisible();
  expect(api.state.gameProfile.ticketBalance).toBe(0);
  expect(api.state.gameProfile.ticketProgressSeconds).toBe(1);
  const requests = api.requests.filter(({ payload }) => payload.type === 'draw_fish');
  expect(requests).toHaveLength(1);
  expect(requests[0].payload.data.ticketPolicyVersion).toBe('study-ticket-v1');
  await expectNoHorizontalOverflow(page);
});

test('구버전 서버의 조개 잔액으로 새 뽑기를 실행하지 않는다', async ({ page }) => {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, { initialGameProfile: { ticketPolicyVersion: undefined, starterState: 'claimed', shellBalance: 999 } });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await expect(page.locator('.aquarium-wallet')).toContainText('확인 필요');
  await page.locator('[data-action="openAquariumDraw"]').click();
  await expect(page.getByRole('button', { name: '사용 가능한 뽑기권이 필요해요' })).toBeDisabled();
  expect(api.requests.filter(({ payload }) => payload.type === 'draw_fish')).toHaveLength(0);
});
