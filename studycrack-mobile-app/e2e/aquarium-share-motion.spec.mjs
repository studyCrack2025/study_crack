import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

async function setup(page) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  const fish = Array.from({ length: 3 }, (_, index) => ({ fishId: `motion-${index}`, speciesId: api.state.fishCatalog[0].speciesId, name: `개인별명${index}`, growthStage: 'young', level: 1, exp: 0, progressPct: 0 }));
  api.state.activeFish = fish;
  api.state.fishInventory = fish;
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', streakDays: 7, activeFishIds: fish.map(item => item.fishId) };
}

for (const mode of ['native', 'cancel', 'failure', 'clipboard', 'copy-failure', 'legacy-copy-failure']) {
  test(`기록·링크 공유 결과를 구분한다: ${mode}`, async ({ page }) => {
    await setup(page);
    await page.addInitScript(mode => {
      window.__shareCalls = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value: mode.includes('copy') || mode === 'clipboard' ? undefined : async payload => {
        window.__shareCalls.push(payload);
        if (mode === 'cancel') throw new DOMException('cancel', 'AbortError');
        if (mode === 'failure') throw new Error('failed');
      } });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'legacy-copy-failure' ? undefined : { writeText: async text => {
        window.__shareCalls.push(text);
        if (mode === 'copy-failure') throw new Error('denied');
      } } });
      if (mode === 'legacy-copy-failure') document.execCommand = () => { throw new Error('denied'); };
    }, mode);
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    await page.locator('[data-action="openAquariumShare"]').click();
    const button = page.getByRole('button', { name: '기록과 링크 공유', exact: true });
    await button.click();
    if (mode === 'cancel') {
      await expect(button).toBeEnabled();
      await expect(page.locator('.aquarium-share-result, .aquarium-action-error')).toHaveCount(0);
    } else if (mode.includes('failure')) {
      await expect(page.locator('.aquarium-action-error')).toBeVisible();
      await expect(page.locator('.aquarium-share-result')).toHaveCount(0);
      await expect(page.locator('textarea[readonly]')).toHaveCount(0);
      if (mode === 'legacy-copy-failure') await expect(button).toBeFocused();
    } else {
      await expect(page.locator('.aquarium-share-result')).toContainText(mode === 'native' ? '기록과 링크 공유를 완료' : '문구와 링크를 복사');
      const calls = await page.evaluate(() => window.__shareCalls);
      expect(calls).toHaveLength(1);
      expect(JSON.stringify(calls)).not.toMatch(/개인별명|예시학생|files|email|phone/);
      expect(JSON.stringify(calls)).toContain('/studycrack-mobile.html');
    }
  });
}

test('공유 창이 닫히기 전 중복 요청은 한 번만 전달한다', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => {
    window.__shareCount = 0;
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => {
      window.__shareCount += 1;
      return new Promise(resolve => { window.__finishShare = resolve; });
    } });
  });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  await page.locator('[data-action="openAquariumShare"]').click();
  await page.locator('[data-action="shareAquarium"]').evaluate(el => { el.click(); el.click(); });
  await expect(page.locator('[data-action="shareAquarium"]')).toBeDisabled();
  expect(await page.evaluate(() => window.__shareCount)).toBe(1);
  await page.evaluate(() => window.__finishShare());
  await expect(page.locator('.aquarium-share-result')).toBeVisible();
});

test('개별 위상·깊이·회전은 이름과 분리되고 화면·탭 상태와 줄인 동작 설정을 따른다', async ({ page }) => {
  await setup(page);
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  const scene = page.locator('.aquarium-scene');
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute('data-motion-paused', 'false');
  const phases = await scene.locator('.aquarium-fish').evaluateAll(items => items.map(el => el.style.getPropertyValue('--fish-phase')));
  expect(new Set(phases).size).toBe(3);
  const depths = await scene.locator('.aquarium-fish-depth').evaluateAll(items => items.map(el => getComputedStyle(el).transform));
  expect(new Set(depths).size).toBe(3);
  await expect(scene.locator('.aquarium-fish-turn').first()).toHaveCSS('animation-name', 'aquariumFishTurn');
  await expect(scene.locator('.aquarium-fish-turn .aquarium-fish-name')).toHaveCount(0);
  await scene.locator('.aquarium-fish-turn').first().evaluate(el => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = animation.effect.getTiming().duration * .75 + animation.effect.getTiming().delay;
  });
  await expect(scene.locator('.aquarium-fish-turn').first()).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(scene).toHaveAttribute('data-motion-paused', 'true');
  await expect(scene.locator('.aquarium-fish-path').first()).toHaveCSS('animation-play-state', 'paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(scene).toHaveAttribute('data-motion-paused', 'false');
  await scene.evaluate(el => { el.style.marginTop = '2000px'; });
  await expect(scene).toHaveAttribute('data-motion-paused', 'true');
  await scene.evaluate(el => { el.style.marginTop = ''; });
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute('data-motion-paused', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const selector of ['.aquarium-fish-path', '.aquarium-fish-bob', '.aquarium-fish-turn']) await expect(scene.locator(selector).first()).toHaveCSS('animation-name', 'none');
  expect(await scene.locator('.aquarium-fish').evaluateAll(items => items.map(el => el.style.getPropertyValue('--fish-phase')))).toEqual(phases);
});
