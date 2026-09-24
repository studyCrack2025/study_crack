const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/exec-plans/evidence/260914_basic_v2/preview-example');
const normalize = text => text.replace(/\s+/g, ' ').trim();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

async function main() {
    const copy = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures/basic-v2-preview-copy.json'), 'utf8'));
    const sections = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures/basic-v2-preview-sections.json'), 'utf8'));
    await fs.mkdir(output, { recursive: true });
    const server = http.createServer(async (req, res) => {
        try {
            const pathname = new URL(req.url, 'http://localhost').pathname;
            if (!/^\/(?:basic-preview-example\.html$|(?:js|css|assets)\/)/.test(pathname)) { res.writeHead(404).end(); return; }
            const file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
            if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403).end(); return; }
            const content = await fs.readFile(file);
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
            res.end(content);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    if (process.argv.includes('--serve')) {
        console.log(`http://127.0.0.1:${server.address().port}/basic-preview-example.html`);
        await new Promise(resolve => process.once('SIGINT', resolve));
        await new Promise(resolve => server.close(resolve));
        return;
    }
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const origin = `http://127.0.0.1:${server.address().port}`;
        const results = [];
        for (const width of [1348,1440,1024,768,390,320]) {
            const page = await browser.newPage({ viewport: { width, height: 1050 }, reducedMotion: 'reduce' });
            const errors = [], unexpected = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin === origin || url.hostname === 'cdn.jsdelivr.net') return route.continue();
                unexpected.push(url.origin);
                return route.abort();
            });
            await page.goto(`${origin}/basic-preview-example.html`, { waitUntil: 'networkidle' });
            await page.evaluate(() => document.fonts.ready);
            for (const item of copy) assert.equal(normalize(await page.locator(item.selector).innerText()), item.text, `${width} ${item.selector}`);
            for (const item of sections) assert.equal(normalize(await page.locator(item.selector).innerText()), item.text, `${width} whole section ${item.selector}`);
            assert.deepEqual(await page.locator('.basic-example-scores tr').evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.innerText))), [['국어','108'],['수학','110'],['영어','3등급'],['탐구 1','53'],['탐구 2','51']]);
            const metrics = await page.evaluate(() => {
                const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; };
                return {
                    overflow: document.documentElement.scrollWidth - innerWidth,
                    input: rect('.basic-example-input'), priority: rect('.basic-example-priority'),
                    comparison: [...document.querySelectorAll('.basic-example-comparison .basic-example-metric')].map(n => ({ x:n.getBoundingClientRect().x, y:n.getBoundingClientRect().y })),
                    unlockColor: getComputedStyle(document.querySelector('.basic-example-unlock')).backgroundColor,
                    text: document.querySelector('main').innerText
                };
            });
            assert.equal(metrics.overflow, 0);
            assert.equal(metrics.unlockColor, 'rgb(255, 255, 255)');
            assert.doesNotMatch(metrics.text, /106점|국어 \+2|수학 \+6|탐구 1 \+3|KCC/);
            if (width > 640) {
                assert.equal(metrics.input.y, metrics.priority.y);
                assert.ok(metrics.priority.width > metrics.input.width);
                assert.ok(metrics.comparison.every(item => item.y === metrics.comparison[0].y));
            } else assert.ok(metrics.priority.y > metrics.input.y);
            for (const [name,selector] of [['p7','#basicExamplePriority'],['p8','#basicExampleSimulation']]) await page.locator(selector).screenshot({ path:path.join(output,`${width}-${name}.png`) });
            await page.locator('#basicExampleCriteria').click();
            assert.equal(await page.locator('#basicExampleDialog').evaluate(n => n.open), true);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#basicExampleDialog').evaluate(n => n.open), false);
            assert.equal(await page.locator('.basic-example-purchase').getAttribute('href'), '/payment?plan=basic');
            if (width <= 640) {
                await page.locator('#hamburgerBtn').click();
                await page.waitForFunction(() => document.getElementById('mobileNavPanel').classList.contains('active'));
                await page.keyboard.press('Escape');
            }
            assert.deepEqual(errors, []);
            assert.deepEqual(unexpected, []);
            const { text, ...layout } = metrics;
            results.push({ width,copyChecks:copy.length,wholeSectionChecks:sections.length, ...layout });
            await page.close();
        }
        await fs.writeFile(path.join(output,'results.json'), JSON.stringify(results,null,2));
        console.log(`Preview example: ${results.length} widths × ${copy.length} exact copy checks, 5 score rows, layout, dialog and no data requests passed.`);
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
