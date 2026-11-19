import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sdk = await readFile(require.resolve('amazon-cognito-identity-js/dist/amazon-cognito-identity.min.js'));
const prefix = 'studycrack:promo:jungsi-2027-v1';
const promo = page => page.getByRole('dialog', { name: /지원할 대학,\s*선택할 이유까지\./ });
async function prepare(page, baseURL) {
    const origin = new URL(baseURL).origin;
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        if (url.pathname.endsWith('/amazon-cognito-identity.min.js')) return route.fulfill({ contentType: 'application/javascript', body: sdk });
        if (url.pathname.includes('/api/')) return route.fulfill({ json: { success: true, reviews: [], data: { enrollmentStatus: 'unavailable', campaignSlug: '2027-jungsi-consulting', admissionYear: 2027 } } });
        return route.abort();
    });
}

for (const [width, height] of [[1440, 1000], [390, 844], [320, 568], [740, 360]]) {
    test(`홈 첫 안내는 홈페이지 서체와 화면 경계를 지키고 끝까지 조작된다 (${width}x${height})`, async ({ page, baseURL }, testInfo) => {
        await prepare(page, baseURL); await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const dialog = promo(page); await expect(dialog).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await expect(dialog).toHaveCSS('font-family', /Paperlogy/);
        for (const weight of [400, 700, 800]) expect(await page.evaluate(weight => document.fonts.check(`${weight} 16px Paperlogy`, '정시 지원 보고서'), weight)).toBe(true);
        await expect(dialog.getByRole('link', { name: '컨설팅 자세히 보기' })).toHaveAttribute('href', '/2027-jungsi-consulting#consulting');
        await expect(page.locator('#scoreUpdateBanner-modal')).toHaveCount(0);
        const box = await dialog.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1); expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
        expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
        const dismiss = dialog.getByRole('button', { name: '닫기', exact: true });
        await expect(dismiss).toBeInViewport();
        const scroll = dialog.locator('.home-consulting-promo__scroll');
        await scroll.evaluate(e => { e.scrollTop = e.scrollHeight; });
        await expect(dialog.getByRole('link', { name: '컨설팅 자세히 보기' })).toBeInViewport();
        for (const button of await dialog.locator('button').all()) expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
        const contrast = await dialog.locator('a').evaluate(e => {
            const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
            const light = v => rgb(v).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
            const css = getComputedStyle(e), a = light(css.color), b = light(css.backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
        await scroll.evaluate(e => { e.scrollTop = 0; });
        await page.screenshot({ path: testInfo.outputPath(`homepage-consulting-${width}x${height}.png`) });
        await dismiss.click(); await expect(dialog).toBeHidden();
    });
}

test('키보드 닫기와 일반 닫기는 포커스·스크롤을 복원하고 현재 탭에서만 숨긴다', async ({ page, context, baseURL }) => {
    await prepare(page, baseURL);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const dialog = promo(page), close = dialog.getByRole('button', { name: '정시 컨설팅 안내 닫기' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(close).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe('hidden');
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
    await expect(page.locator('#site-header .logo-link')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(650); await expect(dialog).toBeHidden();
    const next = await context.newPage(); await prepare(next, baseURL);
    await next.goto('/', { waitUntil: 'domcontentloaded' }); await expect(promo(next)).toBeVisible();
    await promo(next).getByRole('button', { name: '정시 컨설팅 안내 닫기' }).click();
    await expect(promo(next)).toBeHidden(); await next.close();
    const backdrop = await context.newPage(); await prepare(backdrop, baseURL);
    await backdrop.goto('/', { waitUntil: 'domcontentloaded' }); await expect(promo(backdrop)).toBeVisible();
    await backdrop.mouse.click(5, 5); await expect(promo(backdrop)).toBeHidden(); await backdrop.close();
});

test.describe('해외 시간대의 날짜 경계', () => {
    test.use({ timezoneId: 'America/Los_Angeles' });
test('오늘 하루는 브라우저 시간대와 무관하게 한국시간 자정에 끝나며 다른 탭에도 적용된다', async ({ page, context, baseURL }) => {
    await prepare(page, baseURL);
    await page.clock.install({ time: new Date('2026-11-15T14:59:00Z') });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(promo(page)).toBeVisible();
    await promo(page).getByRole('button', { name: '오늘 하루 보지 않기' }).click();
    expect(await page.evaluate(key => Number(localStorage.getItem(key)), `${prefix}:hideUntil`)).toBe(Date.parse('2026-11-15T15:00:00Z'));
    const next = await context.newPage(); await prepare(next, baseURL);
    await next.clock.install({ time: new Date('2026-11-15T14:59:01Z') });
    await next.goto('/', { waitUntil: 'domcontentloaded' }); await next.clock.runFor(650); await expect(promo(next)).toBeHidden();
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.clock.runFor(650); await expect(promo(page)).toBeHidden();
    await page.clock.setFixedTime(new Date('2026-11-15T15:00:01Z'));
    await page.reload({ waitUntil: 'domcontentloaded' }); await expect(promo(page)).toBeVisible(); await next.close();
});

});

test('저장소가 차단되어도 팝업을 닫고 홈페이지를 이용할 수 있다', async ({ page, baseURL }) => {
    await prepare(page, baseURL);
    await page.addInitScript(() => {
        for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(window, key, { configurable: true, get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(promo(page)).toBeVisible();
    await promo(page).getByRole('button', { name: '오늘 하루 보지 않기' }).click(); await expect(promo(page)).toBeHidden();
    await expect(page.locator('.hero-main-content .basic-preview-entry')).toBeVisible();
});

test('소개 페이지 이동은 기존 세션을 보존하고 다른 화면에는 팝업을 노출하지 않는다', async ({ page, baseURL }) => {
    await prepare(page, baseURL);
    await page.addInitScript(() => { sessionStorage.setItem('promo-test-session', 'unchanged'); localStorage.setItem('october2026ScoreUpdateHideUntil', String(Date.now() + 86400000)); });
    await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(promo(page)).toBeVisible();
    await promo(page).getByRole('link', { name: '컨설팅 자세히 보기' }).click();
    await expect(page).toHaveURL(/\/2027-jungsi-consulting#consulting$/);
    await expect(page.locator('#consultingPanel')).toBeVisible(); await expect(page.locator('#calculator')).toBeHidden();
    expect(await page.evaluate(() => sessionStorage.getItem('promo-test-session'))).toBe('unchanged');
    await expect(promo(page)).toHaveCount(0);
    await page.goBack({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(650); await expect(promo(page)).toBeHidden();
    await page.locator('.hero-main-content').getByRole('link', { name: '2027 정시컨설팅 비용·상담 안내 →', exact: true }).click();
    await expect(page).toHaveURL(/\/2027-jungsi-consulting#consulting$/);
    await expect(page.getByRole('tab', { name: '정시 컨설팅', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#consultingPanel')).toBeVisible(); await expect(page.locator('#calculator')).toBeHidden();
    await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('#consultingPanel')).toBeVisible();
    await page.goBack({ waitUntil: 'domcontentloaded' }); await expect(promo(page)).toBeHidden();
    await page.locator('.hero-main-content').getByRole('link', { name: '정시 합격 계산기 →', exact: true }).click();
    await expect(page).toHaveURL(/\/2027-jungsi-consulting#calculator$/);
    await expect(page.getByRole('tab', { name: '합격 계산기', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#calculator')).toBeVisible(); await expect(page.locator('#consultingPanel')).toBeHidden();
    for (const path of ['/login', '/service', '/2027-jungsi-consulting/start']) {
        const response = await page.request.get(path); expect(response.ok()).toBe(true);
        expect(await response.text()).not.toContain('id="homeConsultingPromo"');
    }
    await page.goto('/basic-preview', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(650); await expect(promo(page)).toBeHidden();
});
