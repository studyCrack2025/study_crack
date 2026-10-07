import { test, expect } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';
import { buildAquariumWalletPresentation } from '../src/screens/aquarium/presentation.js';

test('지표는 미확인 수치를 0장이나 기본 시간으로 만들지 않는다', () => {
  for (const profile of [null, {}, { ticketPolicyVersion: 'future', ticketBalance: 9 }, { ticketPolicyVersion: 'study-ticket-v1', ticketBalance: -1 }]) {
    const view = buildAquariumWalletPresentation(profile);
    expect(view.balance).toBe('확인 필요');
    expect(view.progress).toBeNull();
    expect(view.value).toBe('확인 필요');
  }
  for (const progress of [undefined, null, -1, 18000, Infinity]) {
    const view = buildAquariumWalletPresentation({ ticketPolicyVersion: 'study-ticket-v1', ticketBalance: 0, ticketIntervalSeconds: 18000, ticketProgressSeconds: progress });
    expect(view.balance).toBe('0장');
    expect(view.value).toBe('확인 필요');
    expect(view.progress).toBeNull();
  }
  expect(buildAquariumWalletPresentation({ ticketPolicyVersion: 'study-ticket-v1', ticketBalance: 1, ticketIntervalSeconds: 18000, ticketProgressSeconds: 17999 }).value).toBe('1분');
  for (const balance of [0, 1, 999, 999999999999]) {
    expect(buildAquariumWalletPresentation({ ticketPolicyVersion: 'planner-ticket-v1', ticketBalance: balance }).balance).toBe(`${balance}장`);
  }
  expect(buildAquariumWalletPresentation({ ticketPolicyVersion: 'study-ticket-v1', ticketBalance: 999, ticketIntervalSeconds: 60000000, ticketProgressSeconds: 0 }).value).toBe('1000000분');
});

test('긴 잔액도 잘리지 않고 지표 안에서 읽을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedSession(page);
  await installApiMock(page, { initialGameProfile: { ticketBalance: 999999999999, starterState: 'claimed' } });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  const wallet = page.getByRole('group', { name: '뽑기권', exact: true });
  await expect(wallet).toContainText('999999999999장');
  const metrics = wallet.locator('.aquarium-wallet-metric');
  const overflow = await metrics.evaluateAll(nodes => nodes.map(node => node.scrollWidth - node.clientWidth));
  expect(Math.max(...overflow)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
});

for (const width of [320, 390, 430]) {
  for (const plan of [false, true]) {
    test(`두 지표는 전체 너비를 균형 있게 사용한다 (${width}px/${plan ? '계획' : '시간'})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await installAuthenticatedSession(page);
      await installApiMock(page, { initialGameProfile: {
        ticketPolicyVersion: plan ? 'planner-ticket-v1' : 'study-ticket-v1',
        ticketBalance: 0, ticketIntervalSeconds: plan ? null : 18000,
        ticketProgressSeconds: 3600, legacyTicketBalance: 0,
        planTicketCounts: { base: 0, h2: 0, h4: 0 }
      } });
      await page.goto('/studycrack-mobile.html?screen=aquarium');
      const wallet = page.getByRole('group', { name: '뽑기권', exact: true });
      await expect(wallet).toContainText('0장');
      const cells = wallet.locator('.aquarium-wallet-metric');
      await expect(cells).toHaveCount(2);
      if (plan) {
        await expect(cells.last()).toContainText('계획 완료 보상');
        await expect(cells.last()).toContainText('30분 이상');
        await expect(wallet.locator('progress')).toHaveCount(0);
        await expect(wallet.locator('.aquarium-wallet-note')).toContainText('계정 계획 · 첫 완료마다 1장');
      } else {
        await expect(cells.last()).toContainText('240분');
        await expect(wallet.locator('progress')).toHaveAttribute('value', '3600');
        await expect(wallet.locator('progress')).toHaveAttribute('max', '18000');
      }
      await wallet.scrollIntoViewIfNeeded();
      const boxes = await cells.evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      expect(boxes[0].width).toBeCloseTo(boxes[1].width, 0);
      if (width >= 390) {
        expect(boxes[0].y).toBeCloseTo(boxes[1].y, 0);
        expect(boxes[0].height).toBeCloseTo(boxes[1].height, 0);
        const bounds = await wallet.boundingBox();
        expect(boxes[1].x + boxes[1].width).toBeCloseTo(bounds.x + bounds.width, 0);
      }
      await expectNoHorizontalOverflow(page);
      await wallet.screenshot({ path: info.outputPath('wallet.png') });
      await page.addStyleTag({ content: 'html{font-size:200% !important;}.aquarium-wallet small,.aquarium-wallet b,.aquarium-wallet-note{font-size:200% !important;}' });
      await expectNoHorizontalOverflow(page);
      expect(await wallet.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      const enlarged = await cells.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y));
      expect(enlarged[1]).toBeGreaterThan(enlarged[0]);
    });
  }
}
