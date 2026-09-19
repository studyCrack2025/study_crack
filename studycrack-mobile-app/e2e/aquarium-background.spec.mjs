import { expect, test } from '@playwright/test';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

test.use({ deviceScaleFactor: 1 });
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const siteRoot = process.env.STUDYCRACK_PREVIEW_ROOT || resolve(appRoot, '..');
const dist = resolve(siteRoot, 'studycrack-mobile-app/dist');
const base = '/studycrack-mobile-app/dist/';
const backgrounds = /\/day-\d+-[^/]+\.png(?:\?|$)/;
const fixturePages = new Map();

test.beforeAll(async () => {
  const assets = await readdir(resolve(dist, 'assets'));
  const css = (await readdir(resolve(dist, 'chunks'))).find(file => /^screen-registry-app-.*\.css$/.test(file));
  const vite = await createServer({ root: appRoot, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
  try {
    const { AquariumScene } = await vite.ssrLoadModule('/src/components/aquarium/AquariumScene.jsx');
    const { aquariumBackground } = await vite.ssrLoadModule('/src/components/aquarium/aquarium-backgrounds.js');
    for (const day of [1, 7, 15, 30, 50, 100]) {
      const key = `day${day}`;
      const asset = aquariumBackground(key);
      const file = assets.find(file => file.startsWith(`day-${String(day).padStart(2, '0')}-`) && file.endsWith('.png'));
      expect(file).toBeTruthy();
      const scene = variant => renderToStaticMarkup(createElement(AquariumScene, { variant, backgroundKey: key })).replaceAll(asset.src, `${base}assets/${file}`);
      fixturePages.set(day, `<!doctype html><html lang="ko"><meta charset="UTF-8"><link rel="stylesheet" href="${base}studycrack-mobile.css"><link rel="stylesheet" href="${base}chunks/${css}"><style>html,body{height:auto;overflow:auto;}body{margin:0;padding:20px;background:var(--sc-surface-canvas);}main{display:grid;grid-template-columns:repeat(4,358px);gap:16px;}h1{font-size:18px;}h2{font-size:14px;margin:12px 0;}</style><h1>${key} · 구도 검수 전용 (제품 해금 아님)</h1><main><div><h2>전체 · 원본 전체 표시</h2>${scene('full')}</div><div><h2>원본 비율 비교 · 공유 화면 기준</h2>${scene('share')}</div><div><h2>홈 · 96px 하단 미리보기</h2>${scene('home')}<h2>안내 · 210px 하단 미리보기</h2>${scene('guide')}</div><div><h2>공유 · 원본 비율</h2>${scene('share')}</div></main></html>`);
    }
  } finally { await vite.close(); }
});

async function setup(page) {
  await installAuthenticatedSession(page);
  const api = await installApiMock(page);
  const fish = api.state.fishCatalog.slice(0, 3).map((species, index) => ({ fishId: `background-fish-${index}`, speciesId: species.speciesId, name: `친구 ${index + 1}`, level: 2, exp: 30, progressPct: 25, growthStage: 'growing' }));
  api.state.fishInventory = fish;
  api.state.activeFish = fish;
  api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: fish.map(fish => fish.fishId), streakDays: 200, backgroundKey: 'day100' };
  return api;
}

async function captureScene(scene, path) {
  await scene.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect.poll(() => scene.evaluate(element => {
    const box = element.getBoundingClientRect();
    const owner = element.closest('.home-aquarium-link') || element;
    return [box.top + 5, box.bottom - 5].every(y => owner.contains(document.elementFromPoint(box.left + box.width / 2, y)));
  })).toBe(true);
  await scene.screenshot({ path, animations: 'disabled' });
}

for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932], [568, 320]]) {
  test(`기본 배경을 홈·전체·공유에서 사용하고 성장일을 추정하지 않는다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const urls = new Set();
    page.on('request', request => { if (backgrounds.test(request.url())) urls.add(request.url()); });
    const api = await setup(page);
    await page.goto('/studycrack-mobile.html?screen=timer');
    const scene = page.locator('.aquarium-scene');
    await expect(scene.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
    await expect(scene).toHaveAttribute('data-background-key', 'day1');
    await expect(scene).toHaveCSS('height', '96px');
    await captureScene(scene, testInfo.outputPath(`background-home-${width}.png`));
    await page.getByRole('button', { name: /수조 전체 보기/ }).click();
    await expect(scene).toHaveAttribute('data-scene-variant', 'full');
    await expect(scene.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
    await expect(scene).toHaveAttribute('data-background-key', 'day1');
    const box = await scene.boundingBox();
    expect(Math.abs(box.height - box.width * 502 / 377)).toBeLessThan(.1);
    await expect(scene.locator('.aquarium-scene-background')).toHaveCSS('object-fit', 'contain');
    await expect(scene.locator('.aquarium-scene-background')).toHaveCSS('object-position', '50% 50%');
    await expect(scene.locator('.aquarium-fish')).toHaveCount(3);
    await expect(scene.locator('.aquarium-plants,.aquarium-ground,.aquarium-rays,.aquarium-bubbles,.aquarium-water-line')).toHaveCount(0);
    await scene.getByRole('button', { name: '친구 1 선택' }).click();
    await expect(scene.getByRole('button', { name: '친구 1 선택' })).toHaveClass(/is-selected/);
    if (height >= box.height + 100) await captureScene(scene, testInfo.outputPath(`background-full-${width}.png`));
    const shareButton = page.locator('[data-action="openAquariumShare"]');
    await shareButton.scrollIntoViewIfNeeded();
    await expect(shareButton).toBeInViewport();
    await shareButton.click();
    await expect(scene).toHaveAttribute('data-scene-variant', 'share');
    const shareBox = await scene.boundingBox();
    expect(Math.abs(shareBox.height / shareBox.width - 502 / 377)).toBeLessThan(.01);
    await expect(scene.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
    await expect(scene.locator('button')).toHaveCount(0);
    await expect(scene).toHaveAttribute('data-background-key', 'day1');
    if (height >= shareBox.height + 100) await captureScene(scene, testInfo.outputPath(`background-share-${width}.png`));
    expect([...urls]).toHaveLength(1);
    expect([...urls][0]).toMatch(/day-01-/);
    expect(api.requests.filter(({ payload }) => /^(feed_fish|draw_fish|set_active_fish|claim_study_reward)$/.test(payload.type))).toHaveLength(0);
    await expectNoHorizontalOverflow(page);
  });
}

for (const day of [1, 7, 15, 30, 50, 100]) {
  test(`배경 ${day}의 전체 원본 비율과 preview 구도를 검수한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1540, height: 660 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/aquarium-background-fixture', route => route.fulfill({ contentType: 'text/html', body: fixturePages.get(day) }));
    await page.goto('/aquarium-background-fixture');
    await expect(page.locator('.aquarium-scene-background')).toHaveCount(5);
    await expect.poll(() => page.locator('.aquarium-scene-background').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    const images = await page.locator('.aquarium-scene-background').evaluateAll(images => images.map(image => ({ src: image.currentSrc, fit: getComputedStyle(image).objectFit })));
    expect(new Set(images.map(image => image.src)).size).toBe(1);
    expect(images.map(image => image.fit)).toEqual(['contain', 'cover', 'cover', 'cover', 'cover']);
    const full = await page.locator('.aquarium-scene').first().boundingBox();
    expect(Math.abs(full.height - full.width * 502 / (day === 100 ? 376 : 377))).toBeLessThan(.1);
    await page.screenshot({ path: testInfo.outputPath(`background-stage-${day}.png`), animations: 'disabled' });
  });
}

test('배경 로드 실패 중에도 물고기 선택을 유지하고 명시적으로 재시도한다', async ({ page }) => {
  const api = await setup(page);
  let fail = true;
  let attempts = 0;
  await page.route(backgrounds, route => { attempts++; return fail ? route.abort() : route.continue(); });
  await page.goto('/studycrack-mobile.html?screen=aquarium');
  const scene = page.locator('.aquarium-scene');
  await expect(scene.getByRole('status')).toHaveText('배경 이미지를 불러오지 못했어요.');
  await expect(scene.locator('.aquarium-scene-background')).toHaveCount(0);
  await scene.getByRole('button', { name: '친구 2 선택' }).click();
  await expect(scene.getByRole('button', { name: '친구 2 선택' })).toHaveClass(/is-selected/);
  expect(attempts).toBe(1);
  fail = false;
  await scene.getByRole('button', { name: '배경 다시 보기' }).click();
  await expect(scene.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
  await expect(scene.getByRole('status')).toHaveCount(0);
  expect(attempts).toBe(2);
  expect(api.requests.filter(({ payload }) => /^(feed_fish|draw_fish|set_active_fish)$/.test(payload.type))).toHaveLength(0);
});

test('이미지가 늦어도 수조 크기를 예약하고 슬롯을 이동시키지 않는다', async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(backgrounds, async route => { await gate; await route.continue(); });
  await page.goto('/studycrack-mobile.html?screen=aquarium', { waitUntil: 'domcontentloaded' });
  const scene = page.locator('.aquarium-scene');
  await expect(scene.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'loading');
  const before = await scene.boundingBox();
  release();
  await expect(scene.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
  const after = await scene.boundingBox();
  expect(after.width).toBeCloseTo(before.width, 2);
  expect(after.height).toBeCloseTo(before.height, 2);
});

test('홈 배경 실패는 수조 진입을 막거나 미리보기에 관리 버튼을 만들지 않는다', async ({ page }) => {
  await setup(page);
  await page.route(backgrounds, route => route.abort());
  await page.goto('/studycrack-mobile.html?screen=timer');
  const scene = page.locator('.aquarium-scene');
  await expect(scene.getByRole('status')).toHaveText('배경 이미지를 불러오지 못했어요.');
  await expect(scene.locator('button')).toHaveCount(0);
  await page.getByRole('button', { name: /수조 전체 보기/ }).click();
  await expect(scene).toHaveAttribute('data-scene-variant', 'full');
  await expect(scene.getByRole('button', { name: '배경 다시 보기' })).toBeVisible();
});

test('로그인 화면은 수조 배경을 미리 요청하지 않는다', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (backgrounds.test(request.url())) requests.push(request.url()); });
  await page.goto('/studycrack-mobile.html?screen=authLogin');
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
});
