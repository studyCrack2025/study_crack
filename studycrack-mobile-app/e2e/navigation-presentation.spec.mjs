import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });

const viewports = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
];

function contrast(foreground, background) {
  const luminance = color => {
    const channels = color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
}

async function readIconStyle(icon) {
  return icon.evaluate(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundImage, color: style.color, stroke: getComputedStyle(element.querySelector('svg')).stroke, width: style.width, height: style.height };
  });
}

for (const viewport of viewports) {
  test(`수조 탭의 선택 표현은 현재 화면과 일치한다 (${viewport.width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    await installApiMock(page);
    await page.goto('/studycrack-mobile.html?screen=timer');
    const nav = page.getByRole('navigation', { name: '주요 메뉴', includeHidden: true });
    const home = nav.locator('[data-tab="timer"]');
    const aquarium = nav.locator('[data-tab="aquarium"]');
    const icon = aquarium.locator('.tabbar-icon');
    await expect(home).toHaveAttribute('aria-current', 'page');
    await expect(aquarium).not.toHaveAttribute('aria-current', 'page');
    const idleStyle = await readIconStyle(icon);
    expect(idleStyle.background).toBe('linear-gradient(135deg, rgb(231, 238, 248), rgb(212, 226, 243))');
    expect(idleStyle.stroke).toBe('rgb(99, 112, 131)');
    expect(idleStyle.width).toBe('48px');
    expect(idleStyle.height).toBe('48px');
    await expect(aquarium.locator('.tabbar-label')).toHaveCSS('color', 'rgb(99, 112, 131)');
    await expect(nav).toHaveCSS('height', '72px');
    await expect(icon).toHaveCSS('border-top-width', '2px');
    await expect(icon).toHaveCSS('border-radius', '16px');
    await expect(icon).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -9)');
    await expect(icon.locator('svg')).toHaveCSS('width', '21px');
    await expect(icon.locator('svg')).toHaveCSS('stroke-width', '1.75px');
    await expect(icon.locator('svg path').first()).toHaveAttribute('d', 'M3 20h18M5 20V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12');
    await expect(home.locator('svg')).toHaveCSS('stroke-width', '2.15px');
    await expect(home.locator('.tabbar-label')).toHaveCSS('font-weight', '700');
    await expect(aquarium.locator('.tabbar-label')).toHaveCSS('font-weight', '500');
    await expect(aquarium.locator('.tabbar-label')).toHaveCSS('font-size', '10px');
    await expect(nav.getByRole('button', { name: '학습 코칭', exact: true })).toHaveText('코칭');
    for (const endpoint of idleStyle.background.match(/rgb\([^)]+\)/g)) expect(contrast(idleStyle.stroke, endpoint)).toBeGreaterThanOrEqual(3);
    expect(contrast(idleStyle.color, 'rgb(247, 249, 252)')).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath('home-navigation.png'), animations: 'disabled' });
    await aquarium.click();
    await expect(aquarium).toHaveAttribute('aria-current', 'page');
    const activeStyle = await readIconStyle(icon);
    expect(activeStyle.background).toBe('linear-gradient(135deg, rgb(10, 86, 178), rgb(15, 127, 117))');
    expect(activeStyle.stroke).toBe('rgb(255, 255, 255)');
    expect(activeStyle.width).toBe('48px');
    expect(activeStyle.height).toBe('48px');
    await expect(icon).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -9)');
    await expect(icon.locator('svg')).toHaveCSS('stroke-width', '2.15px');
    await expect(home.locator('svg')).toHaveCSS('stroke-width', '1.75px');
    await expect(aquarium.locator('.tabbar-label')).toHaveCSS('font-weight', '700');
    await expect(aquarium.locator('.tabbar-label')).toHaveCSS('color', 'rgb(10, 86, 178)');
    for (const endpoint of activeStyle.background.match(/rgb\([^)]+\)/g)) expect(contrast(activeStyle.stroke, endpoint)).toBeGreaterThanOrEqual(3);
    expect(contrast('rgb(10, 86, 178)', 'rgb(247, 249, 252)')).toBeGreaterThanOrEqual(4.5);
    expect(activeStyle.background).not.toBe(idleStyle.background);
    expect(activeStyle.color).not.toBe(idleStyle.color);
    await expect(home).not.toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('button')).toHaveCount(5);
    for (const button of await nav.locator('button').all()) {
      const bounds = await button.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('aquarium-navigation.png'), animations: 'disabled' });
    await home.click();
    await expect(home).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => icon.evaluate(element => getComputedStyle(element).backgroundImage)).toBe(idleStyle.background);
    expect(await home.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');

    const profileTrigger = page.getByRole('button', { name: '프로필 메뉴 열기' });
    await profileTrigger.click();
    const profile = page.getByRole('dialog', { name: '프로필 메뉴' });
    await expect(profile).toBeVisible();
    await expect(nav).toHaveAttribute('inert', '');
    await expect(nav).toHaveAttribute('aria-hidden', 'true');
    await profile.press('Escape');
    await expect(profile).toBeHidden();
    await expect(profileTrigger).toBeFocused();
    await expect(nav).not.toHaveAttribute('inert', '');

    await page.getByRole('button', { name: '공부 시작', exact: true }).click();
    await page.locator('.study-subject-grid [data-study-subject="수학"]').click();
    const activity = page.locator('[data-field="studyStartActivity"]');
    await activity.focus();
    await page.evaluate(() => {
      const height = visualViewport.height;
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => height - 300 });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'true');
    await expect(nav).toHaveCSS('visibility', 'hidden');
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'false');
    await activity.press('Escape');
    await expect(nav).not.toHaveAttribute('inert', '');
    await expect(nav).toBeVisible();
  });
}
