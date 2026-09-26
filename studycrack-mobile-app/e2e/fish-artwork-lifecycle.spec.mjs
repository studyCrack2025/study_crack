import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

async function prepare(page) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  const keys = ['fishdex-045-percula-clownfish', 'fishdex-051-purple-tang', 'fishdex-052-powder-blue-tang'];
  api.state.activeFish = api.state.fishCatalog.slice(0, 3).map((s, i) => ({ fishId: `lifecycle-${i}`, speciesId: s.speciesId, assetKey: keys[i], name: `친구 ${i}`, level: 2, exp: 30, growthStage: 'growing' }));
  api.state.fishInventory = api.state.activeFish;
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: api.state.activeFish.map(f => f.fishId) };
  await page.route('**/api/**', route => route.request().postDataJSON()?.type === 'get_product_guide'
    ? route.fulfill({ json: { supported: true, version: 'ob_2026_09', status: 'completed', lastStep: 5, revision: 1 } }) : route.fallback());
  return api;
}

for (const rate of [4, 12]) test(`cached fish remain visible after home to aquarium on slow CPU (${rate}x)`, async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page);
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate });
  try {
    await page.goto('/studycrack-mobile.html?screen=aquarium');
    await expect(page.locator('.aquarium-scene-wrap .aquarium-fish-artwork.is-loaded')).toHaveCount(3);
    await page.locator('.tabbar [data-tab="timer"]').click();
    await expect(page.locator('.home-aquarium-preview')).toHaveCount(0);
    await page.locator('.timer-v2-status-rail [data-target="aquarium"]').click();
    const scene = page.locator('.aquarium-scene-wrap');
    await expect(scene.locator('.aquarium-fish-image')).toHaveCount(3);
    await expect.poll(() => scene.locator('.aquarium-fish-image').evaluateAll(es => es.every(e => e.complete && e.naturalWidth > 0))).toBe(true);
    await expect(scene.locator('.aquarium-fish-artwork.is-loaded')).toHaveCount(3);
    for (const img of await scene.locator('.aquarium-fish-image').all()) await expect(img).toHaveCSS('opacity', '1');
  } finally {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await client.detach();
  }
});

test('failed fish images use the existing SVG fallback', async ({ page }) => {
  await prepare(page);
  await page.route('**/*.webp', route => route.abort());
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  const scene = page.locator('.aquarium-scene-wrap');
  await expect(scene.locator('.aquarium-fish-svg')).toHaveCount(3);
  await expect(scene.locator('.aquarium-fish-artwork')).toHaveCount(0);
});

test('changing artwork for the same fish resets a previous failure and allows returning to it', async ({ page }) => {
  const api = await prepare(page);
  const blocked = '**/*fishdex-045-percula-clownfish*.webp';
  await page.route(blocked, route => route.abort());
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  const fish = page.locator('.aquarium-scene-wrap [data-fish-id="lifecycle-0"]');
  await expect(fish.locator('.aquarium-fish-svg')).toHaveCount(1);
  for (const key of ['fishdex-051-purple-tang', 'fishdex-045-percula-clownfish']) {
    await page.unroute(blocked);
    api.state.activeFish[0].assetKey = key;
    await page.locator('[data-action="retryGameResources"]').first().evaluate(el => el.click());
    await expect(fish.locator('.aquarium-fish-image')).toHaveAttribute('src', new RegExp(key));
    await expect(fish.locator('.aquarium-fish-artwork.is-loaded')).toHaveCount(1);
    await expect(fish.locator('.aquarium-fish-image')).toHaveCSS('opacity', '1');
  }
});
