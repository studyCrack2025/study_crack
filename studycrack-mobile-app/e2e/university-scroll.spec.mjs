import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession, expectNoHorizontalOverflow } from './support/mock-api.mjs';

for (const [width, height] of [[320, 568], [390, 844]]) {
  test(`긴 대학·학과 목록은 모달 본문에서 끝까지 스크롤된다 (${width})`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installAuthenticatedSession(page);
    await installApiMock(page, { tier: 'basic', userOverrides: { univChangeRemaining: 0 } });
    const universities = Array.from({ length: 40 }, (_, i) => ({ univName: `테스트${String(i + 1).padStart(2, '0')}대학교`, majors: Array.from({ length: 40 }, (_, j) => `학과${String(j + 1).padStart(2, '0')}`) }));
    await page.route('**/api/**', route => route.request().postDataJSON()?.type === 'get_univ_list_only' ? route.fulfill({ json: universities }) : route.fallback());
    await page.goto('/studycrack-mobile.html?screen=addUniversity');
    await page.getByRole('button', { name: '직접 추가하기 →' }).click();
    const dialog = page.getByRole('dialog', { name: '대학·학과 직접 추가' });
    const body = dialog.locator('.analysis-search-body');
    const rows = dialog.locator('.add-univ-university-row');
    await expect(rows).toHaveCount(40);
    const initialPanel = await dialog.boundingBox();
    const search = dialog.getByRole('textbox', { name: '대학명 검색' });
    for (const [term, count] of [['테', 40], ['테스트4', 1], ['테스트40', 1], ['없는대학', 0], ['', 40]]) {
      await search.fill(term);
      await expect(rows).toHaveCount(count);
      const current = await dialog.boundingBox();
      expect(Math.abs(current.y - initialPanel.y)).toBeLessThan(1);
      expect(Math.abs(current.height - initialPanel.height)).toBeLessThan(1);
    }
    const geometry = await body.evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight, list: el.querySelector('.add-univ-results').clientHeight, listScroll: el.querySelector('.add-univ-results').scrollHeight }));
    expect(geometry.scroll).toBeGreaterThan(geometry.client + 500);
    expect(geometry.listScroll - geometry.list).toBeLessThanOrEqual(2);
    const box = await body.boundingBox();
    const touch = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height - 30;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 10; step++) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 18 }] });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(50);
    await touch.detach();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 30);
    // A preceding touch swipe can still have momentum when wheel input begins.
    await expect(async () => {
      await page.mouse.wheel(0, 10000);
      await expect(rows.last()).toBeInViewport({ timeout: 500 });
    }).toPass({ timeout: 5000 });
    await rows.last().click();
    await expect(dialog.locator('.add-univ-selection')).toContainText('테스트40대학교');
    await expect(dialog.locator('.add-univ-row')).toHaveCount(40);
    const majorPanel = await dialog.boundingBox();
    expect(Math.abs(majorPanel.y - initialPanel.y)).toBeLessThan(1);
    expect(Math.abs(majorPanel.height - initialPanel.height)).toBeLessThan(1);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 30);
    await page.mouse.wheel(0, 10000);
    await expect(dialog.locator('.add-univ-row').last()).toBeInViewport();
    await expect(dialog.locator('.add-univ-row').last()).toContainText('학과40');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: info.outputPath(`long-list-${width}.png`), animations: 'disabled' });
    await page.setViewportSize({ width, height: 380 });
    await dialog.getByRole('textbox', { name: '학과명 검색' }).fill('없는학과');
    await expect(dialog.locator('.add-univ-row')).toHaveCount(0);
    await expect.poll(async () => { const panel = await dialog.boundingBox(); return panel.y + panel.height; }).toBeLessThanOrEqual(381);
    await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport({ ratio: 1 });
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}
