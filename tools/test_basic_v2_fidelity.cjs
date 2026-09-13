const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = process.env.BASIC_V2_QA_DIR || path.join(root, 'docs/exec-plans/evidence/260914_basic_v2');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const normalize = value => value.replace(/\s+/g, ' ').trim();

async function main() {
    const contracts = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures/basic-v2-copy.json'), 'utf8'));
    const sections = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures/basic-v2-sections.json'), 'utf8'));
    await fs.mkdir(output, { recursive: true });
    const server = http.createServer(async (req, res) => {
        try {
            const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
            const pathname = requested === '/' ? '/index.html' : requested;
            if (!/^\/(?:index\.html|basic-preview\.html|(?:assets|css|js)\/)/.test(pathname)) {
                res.writeHead(404).end();
                return;
            }
            const file = path.resolve(root, `.${pathname}`);
            if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403).end(); return; }
            const bytes = await fs.readFile(file);
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(bytes);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const origin = `http://127.0.0.1:${server.address().port}`;
        const results = [];
        for (const width of [1348, 1440, 1024, 768, 390, 320]) {
            const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const request = route.request();
                const url = new URL(request.url());
                if (url.origin === origin || /^(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/.test(url.hostname)) return route.continue();
                if (['fetch', 'xhr'].includes(request.resourceType())) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
                return route.abort();
            });
            await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
            assert.ok(await page.locator('#hero-main').count(), `landing loaded at ${page.url()}`);
            const noticeClose = page.locator('#septemberUpdateClose');
            if (await noticeClose.isVisible()) await noticeClose.click();
            await page.evaluate(async () => {
                await document.fonts.ready;
                document.querySelectorAll('.scroll-reveal').forEach(node => node.classList.add('visible'));
                document.querySelector('#hero-main').dispatchEvent(new MouseEvent('mouseenter'));
                document.querySelector('.hero-dots button').click();
            });
            await page.waitForTimeout(1100);
            await page.addStyleTag({ content: '*,*::before,*::after { animation:none !important; transition:none !important; }' });
            for (const contract of contracts) {
                const selector = width <= 900 && contract.mobileSelector ? contract.mobileSelector : contract.selector;
                const text = normalize(await page.locator(selector).innerText());
                assert.equal(text, contract.text, `${width}px ${contract.id} (${selector})`);
            }
            for (const section of sections) {
                assert.equal(normalize(await page.locator(section.selector).innerText()), section.text, `${width}px whole-section copy (${section.selector})`);
            }
            assert.equal(await page.locator('.proof-preview').count(), 0);
            assert.equal(await page.locator('.landing-proof .ppt-card-img img').count(), 3);
            assert.equal(await page.locator('.personalized-score-table tbody tr').count(), 3);
            assert.equal(await page.locator('.trust-number').count(), 4);
            const metrics = await page.evaluate(() => {
                const rect = selector => {
                    const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
                    return { x, y, width, height };
                };
                return {
                    overflow: document.documentElement.scrollWidth - innerWidth,
                    cards: ['.step-card--one','.step-card--two','.step-card--three'].map(rect),
                    proof: ['.ppt-card-img','.ppt-card-body'].map(rect),
                    panels: [...document.querySelectorAll('.personalized-panel')].map(node => node.getBoundingClientRect().y),
                    images: [...document.querySelectorAll('.landing-proof img')].map(node => ({ src: new URL(node.src).pathname, loaded: node.complete && node.naturalWidth > 0 })),
                    ctaBackground: getComputedStyle(document.querySelector('.cta-section')).backgroundImage,
                    ctaAfterReviews: document.querySelector('#review-section').nextElementSibling === document.querySelector('.cta-section'),
                    ctaBeforeFooter: document.querySelector('.cta-section').nextElementSibling === document.querySelector('footer'),
                    priceBackground: getComputedStyle(document.querySelector(innerWidth <= 900 ? '#mobileCourseDetail' : '.solution-card')).backgroundColor,
                    priceTextColor: getComputedStyle(document.querySelector(innerWidth <= 900 ? '#mobileCourseDetail .landing-basic-title' : '#courseDetailView .landing-basic-title')).color,
                    kcc: document.body.innerText.includes('KCC'),
                    heroBackground: getComputedStyle(document.querySelector('#heroBg')).backgroundImage,
                    heroPreload: document.querySelector('link[rel="preload"][as="image"]').getAttribute('href'),
                    firstHeroDot: document.querySelector('.hero-dots button').classList.contains('active')
                };
            });
            assert.equal(metrics.overflow, 0, `${width}px horizontal overflow`);
            assert.equal(metrics.kcc, false);
            assert.ok(metrics.heroBackground.includes('/assets/basic-v2/hero-phone.png'));
            assert.equal(metrics.heroPreload, '/assets/basic-v2/hero-phone.png');
            assert.equal(metrics.firstHeroDot, true);
            assert.ok(metrics.ctaBackground.includes('/assets/figma/figma-asset-10.png'), 'original final CTA background');
            assert.equal(metrics.ctaAfterReviews, true, 'final CTA immediately follows reviews');
            assert.equal(metrics.ctaBeforeFooter, true, 'final CTA is above footer');
            assert.ok(await page.evaluate(() => new Promise(resolve => {
                const image = new Image();
                image.onload = () => resolve(image.naturalWidth > 0);
                image.onerror = () => resolve(false);
                image.src = '/assets/figma/figma-asset-10.png';
            })), 'final CTA image loads');
            assert.equal(metrics.priceBackground, 'rgb(255, 255, 255)', 'BASIC price card is white');
            assert.notEqual(metrics.priceTextColor, 'rgb(255, 255, 255)', 'BASIC card text contrasts with white');
            assert.ok(metrics.images.every(image => image.loaded), 'all original images load');
            assert.equal(metrics.images[0].src, '/assets/basic-v2/proof-classroom.png', 'classroom background is not replaced by a result screenshot');
            assert.ok(metrics.proof[0].y < metrics.proof[1].y, 'screenshot above copy');
            if (width > 900) {
                const [one,two,three] = metrics.cards;
                assert.ok(one.x < two.x && two.x === three.x && two.y < one.y && one.y < three.y, 'staircase layout');
                assert.ok(Math.max(...metrics.panels) - Math.min(...metrics.panels) < 2, 'aligned target panels');
            }
            for (const [name, selector] of Object.entries({ hero: '#hero-main', value: '.landing-value', questions: '#about', proof: '.landing-proof', targets: '#planner-promo', trust: '.trust-section', plans: '#program', final: '.cta-section' })) {
                await page.locator(selector).scrollIntoViewIfNeeded();
                if (name === 'hero') {
                    await page.evaluate(() => { document.querySelector('.hero-dots button').click(); });
                    await page.waitForTimeout(1100);
                }
                await page.locator(selector).screenshot({ path: path.join(output, `${width}-${name}.png`), style: name === 'hero' ? '' : '#site-header { visibility: hidden; }' });
            }
            if (width <= 640) {
                for (let index = 0; index < 3; index++) {
                    await page.locator('#pptIndicators button').nth(index).click();
                    await page.waitForFunction(index => {
                        const rect = document.querySelectorAll('.landing-proof .ppt-card')[index].getBoundingClientRect();
                        const active = document.querySelectorAll('#pptIndicators button')[index].classList.contains('active');
                        return active && rect.x >= -1 && rect.right <= innerWidth + 1;
                    }, index);
                    assert.equal(await page.locator('.landing-proof .bg-img').getAttribute('src'), '/assets/basic-v2/proof-classroom.png');
                    await page.locator('.landing-proof').screenshot({ path: path.join(output, `${width}-proof-card-${index + 1}.png`), style: '#site-header { visibility: hidden; }' });
                }
            }
            await page.locator('.course-tab-btn[data-tier="starter"]').click();
            assert.ok(await page.locator(width <= 900 ? '#mobileCourseDetail .detail-title' : '#courseDetailView .detail-title').isVisible(), 'other plan still renders');
            await page.locator('.course-tab-btn[data-tier="basic"]').click();
            assert.ok(await page.locator(width <= 900 ? '#mobileCourseDetail .landing-basic-title' : '#courseDetailView .landing-basic-title').isVisible(), 'BASIC restores after switching');
            const resizedWidth = width <= 900 ? 1024 : 390;
            await page.setViewportSize({ width: resizedWidth, height: 1000 });
            await page.locator(resizedWidth <= 900 ? '#mobileCourseDetail .landing-basic-title' : '#courseDetailView .landing-basic-title').waitFor({ state: 'visible' });
            assert.equal(normalize(await page.locator(resizedWidth <= 900 ? '#mobileCourseDetail .landing-basic-title' : '#courseDetailView .landing-basic-title').innerText()), '전체 점수 전략 확인', 'BASIC survives breakpoint change');
            assert.deepEqual(errors, [], 'no page exceptions');
            results.push({ width, copyChecks: contracts.length, wholeSectionChecks: sections.length, tabSwitchPassed: true, breakpointChangePassed: true, ...metrics });
            await page.close();
        }
        await fs.writeFile(path.join(output, 'landing-results.json'), JSON.stringify(results, null, 2));
        console.log(`Basic v2: ${results.length} widths, ${contracts.length} exact-copy and ${sections.length} whole-section checks per width; image and layout checks passed.`);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
