import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';
import { writeFile } from 'node:fs/promises';

test.use({ deviceScaleFactor: 1 });
const stages = [1, 7, 15, 30, 50, 100];

for (const day of stages) for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
  test(`성장 배경 실화면 검수 DAY${day} ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    const api = await installApiMock(page);
    const assetKeys = ['fishdex-045-percula-clownfish', 'fishdex-051-purple-tang', 'fishdex-052-powder-blue-tang'];
    const fish = api.state.fishCatalog.slice(0, 3).map((species, index) => ({ fishId: `matrix-${index}`, speciesId: species.speciesId,
      assetKey: assetKeys[index], name: `친구 ${index + 1}`, level: 2, exp: 30, progressPct: 25, growthStage: 'growing', rarity: 'common' }));
    api.state.activeFish = fish; api.state.fishInventory = fish;
    api.state.gameProfile = { ...api.state.gameProfile, starterState: 'claimed', activeFishIds: fish.map(row => row.fishId), streakDays: 200 };
    const requests = [], captures = [];
    page.on('request', request => { if (/\/day-\d+-[^/]+\.png/.test(request.url())) requests.push(request.url()); });
    await page.route('**/api/**', async route => {
      const payload = route.request().postDataJSON();
      if (payload?.type === 'get_product_guide') return route.fulfill({ json: { supported: true, version: 'ob_2026_09', status: 'completed', lastStep: 5, revision: 1 } });
      if (payload?.type !== 'planner_sync_v1' || payload.operation !== 'get_aquarium_growth') return route.fallback();
      const next = stages.find(value => value > day);
      return route.fulfill({ json: { success: true, plannerOwner: 'e2e-student', plannerProtocol: 1, data: { growth: {
        supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-01-01', revision: day, asOf: '2026-09-13T03:00:00.000Z',
        historyStatus: 'not_available', validDayCount: day, highestUnlockedStage: `day${day}`, nextStageDays: next ? next - day : null
      } } } });
    });
    const capture = async (variant, owner) => {
      const scene = owner.locator('.aquarium-scene');
      await expect(scene).toHaveAttribute('data-scene-variant', variant);
      await expect(scene).toHaveAttribute('data-background-key', `day${day}`);
      if (variant !== 'home') await expect(scene.locator('.aquarium-background-layer')).toHaveAttribute('data-background-status', 'ready');
      else await expect(scene.locator('.aquarium-background-layer')).toHaveCount(0);
      await owner.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await expect(scene.locator('.aquarium-fish-image')).toHaveCount(3);
      await expect(scene.locator('.aquarium-fish-artwork.is-loaded')).toHaveCount(3);
      if (variant !== 'home') await expect(owner.locator('.aquarium-growth-caption')).toContainText(`성장 인정 ${day}일`);
      else await expect(owner.locator('.aquarium-growth-caption')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      const metrics = await scene.evaluate(el => {
        const box = el.getBoundingClientRect(), img = el.querySelector('.aquarium-scene-background');
        const hud = [...el.querySelectorAll('.aquarium-scene-hud > span')].map(node => node.getBoundingClientRect());
        const fish = [...el.querySelectorAll('.aquarium-fish')].map(node => node.getBoundingClientRect());
        return { width: box.width, height: box.height, naturalWidth: img?.naturalWidth, naturalHeight: img?.naturalHeight,
          fit: img ? getComputedStyle(img).objectFit : null, position: img ? getComputedStyle(img).objectPosition : null,
          overlaps: fish.some(a => hud.some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)) };
      });
      if (variant !== 'home') {
        expect(metrics.naturalWidth).toBe(day === 100 ? 376 : 377); expect(metrics.naturalHeight).toBe(502);
        expect(metrics.fit).toBe('cover'); expect(metrics.position).toBe('50% 100%');
      }
      expect(metrics.overlaps).toBe(false);
      if (variant === 'share') expect(Math.abs(metrics.height - metrics.width * 502 / metrics.naturalWidth)).toBeLessThan(.1);
      else expect(metrics.height).toBeCloseTo(variant === 'full' ? Math.min(326, Math.max(294, width * .8)) : variant === 'home' ? 96 : 210, 1);
      if (variant === 'full') {
        await expect(scene).toHaveCSS('border-top-width', '1px');
        await expect(scene).toHaveCSS('border-radius', '24px');
        await expect(scene.locator('.aquarium-scene-depth')).not.toHaveCSS('box-shadow', 'none');
      }
      if (variant !== 'full') await expect(scene.locator('button')).toHaveCount(0);
      const caption = owner.locator('.aquarium-growth-caption');
      if (variant !== 'home') expect((await caption.boundingBox()).y).toBeGreaterThanOrEqual((await scene.boundingBox()).y + metrics.height - 1);
      const screenshot = `day-${day}-${width}-${variant}.png`;
      await owner.screenshot({ path: info.outputPath(screenshot), animations: 'disabled' });
      captures.push({ day, width, variant, screenshot, ...metrics });
    };
    await page.goto('/studycrack-mobile.html?screen=timer');
    await capture('home', page.locator('.home-aquarium-preview'));
    await page.getByRole('button', { name: '프로필 메뉴 열기' }).click();
    await page.getByRole('button', { name: /사용법 다시 보기/ }).click();
    const dialog = page.getByRole('dialog', { name: 'StudyCrack 사용법' });
    for (let step = 0; step < 2; step++) await dialog.locator('[data-action="nextProductGuide"]').click();
    await capture('guide', dialog.locator('.product-guide-scene'));
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: '프로필 메뉴 닫기' }).click();
    await expect(page.getByRole('dialog', { name: '프로필 메뉴' })).not.toBeVisible();
    await page.locator('.home-aquarium-preview [data-target="aquarium"]').first().click();
    await page.locator('.aquarium-growth-caption').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await expect(page.locator('.aquarium-unlock-notice')).toBeVisible();
    await page.getByRole('button', { name: '해금 안내 닫기' }).click();
    await capture('full', page.locator('.aquarium-scene-wrap'));
    await page.locator('[data-action="openAquariumShare"]').click();
    await capture('share', page.locator('.aquarium-share-card'));
    const share = page.getByRole('button', { name: '기록과 링크 공유', exact: true });
    await share.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await expect(share).toBeInViewport({ ratio: 1 }); await share.focus(); await expect(share).toBeFocused();
    const requestedDays = [...new Set(requests.map(url => Number(url.match(/\/day-(\d+)-/)[1])))];
    expect(requestedDays.every(value => value === 1 || value === day)).toBe(true);
    expect(requestedDays).toContain(day);
    await writeFile(info.outputPath('matrix.json'), JSON.stringify({ captures, requestedDays }, null, 2));
  });
}
