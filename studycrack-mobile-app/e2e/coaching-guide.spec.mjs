import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const tier of ['standard', 'basic']) {
  test(`코칭 단계 안내와 원래 화면 복귀 (${tier})`, async ({ page }) => {
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier });
    const writes = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) writes.push(request.postData());
    });
    await page.goto(`/studycrack-mobile.html?screen=${tier === 'basic' ? 'home' : 'strategy'}`);
    if (tier === 'basic') await page.locator('.tabbar [data-tab="strategy"]').click();
    const trigger = page.locator(tier === 'basic' ? '.locked-coaching-actions .coaching-process' : '.coach-page .coaching-process');
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '코칭 진행 방식' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.coaching-guide-progress')).toContainText('1 / 3');
    await expect(dialog.getByRole('button', { name: '이전' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '닫기' })).toBeFocused();
    await expect(page.locator('.app-content')).toHaveAttribute('inert', '');
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: '다음' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: '닫기' })).toBeFocused();
    const before = writes.length;
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.locator('.coaching-guide-progress')).toContainText('1 / 3');
    await dialog.getByRole('button', { name: '다음' }).click();
    await expect(dialog).toContainText('목표 대학과 현재 성적 비교');
    await expect(dialog).toContainText('합격을 보장하지');
    await page.keyboard.press('ArrowRight');
    await expect(dialog).toContainText('실행하고 피드백 받기');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('.coaching-guide-progress')).toContainText('3 / 3');
    await dialog.getByRole('button', { name: '확인했어요' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator('.sc-overlay--modal').click({ position: { x: 3, y: 3 } });
    await expect(dialog).toHaveCount(0);
    expect(writes.slice(before).filter(value => /save_|submit_|update_|payment/.test(value || ''))).toEqual([]);
    await trigger.click();
    await expect(dialog.locator('.coaching-guide-progress')).toContainText('1 / 3');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

for (const viewport of [{ width: 320, height: 700 }, { width: 740, height: 360 }]) {
  test(`안내창 크기·스와이프·확대 (${viewport.width}x${viewport.height})`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier: 'standard' });
    await page.goto('/studycrack-mobile.html?screen=strategy');
    await page.locator('.coaching-process').click();
    const dialog = page.getByRole('dialog', { name: '코칭 진행 방식' });
    const swipe = async (x, y) => dialog.locator('.coaching-guide-body').evaluate((node, delta) => {
      node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 1, button: 0, clientX: 180, clientY: 140 }));
      node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, isPrimary: true, pointerId: 1, button: 0, clientX: 180 + delta.x, clientY: 140 + delta.y }));
    }, { x, y });
    await swipe(-70, 100);
    await expect(dialog.locator('.coaching-guide-progress')).toContainText('1 / 3');
    await swipe(-70, 4);
    await expect(dialog.locator('.coaching-guide-progress')).toContainText('2 / 3');
    await swipe(70, 4);
    await expect(dialog.locator('.coaching-guide-progress')).toContainText('1 / 3');
    await page.screenshot({ path: info.outputPath('coaching-guide-normal.png'), animations: 'disabled' });
    await dialog.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    const height = await dialog.evaluate(node => node.getBoundingClientRect().height);
    await dialog.getByRole('button', { name: '다음' }).click();
    expect(await dialog.evaluate(node => node.getBoundingClientRect().height)).toBeCloseTo(height, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await dialog.locator('.coaching-guide-step').evaluate(node => parseFloat(getComputedStyle(node).animationDuration))).toBeLessThan(0.001);
    await page.addStyleTag({ content: '.coaching-guide h3,.coaching-guide h4,.coaching-guide p,.coaching-guide b,.coaching-guide span,.coaching-guide button{font-size:200% !important;}' });
    await expectNoHorizontalOverflow(page);
    const bounds = await dialog.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, bottom: node.getBoundingClientRect().bottom }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
    await expect(dialog.getByRole('button', { name: '다음' })).toBeInViewport();
    await page.screenshot({ path: info.outputPath('coaching-guide.png'), animations: 'disabled' });
  });
}
