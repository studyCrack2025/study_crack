import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const [input, output] = process.argv.slice(2);
assert.ok(input && output, 'Usage: report-aquarium-matrix.mjs <test-results> <new-output-directory>');
const rows = [];
for (const entry of await readdir(resolve(input), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const folder = resolve(input, entry.name);
  let report;
  try { report = JSON.parse(await readFile(resolve(folder, 'matrix.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  for (const row of report.captures) {
    const identity = row.screenshot.match(/^day-(1|7|15|30|50|100)-(320|360|390|430)-(full|home|guide|share)\.png$/);
    assert.ok(identity, 'Unexpected capture filename');
    assert.equal(Number(identity[1]), row.day); assert.equal(identity[3], row.variant);
    rows.push({ ...row, viewportWidth: Number(identity[2]), source: resolve(folder, row.screenshot), requestedDays: report.requestedDays });
  }
}
const stages = [1, 7, 15, 30, 50, 100], widths = [320, 360, 390, 430], variants = ['full', 'home', 'guide', 'share'];
assert.equal(rows.length, 96, 'All 96 completed captures are required');
for (const day of stages) for (const width of widths) for (const variant of variants) {
  assert.equal(rows.filter(row => row.day === day && row.viewportWidth === width && row.variant === variant).length, 1);
}
await mkdir(resolve(output));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 1 });
  for (const day of stages) {
    const original = await readFile(new URL(`../src/assets/aquarium-backgrounds/day-${String(day).padStart(2, '0')}.png`, import.meta.url));
    const cells = [];
    for (const variant of variants) for (const width of widths) {
      const row = rows.find(row => row.day === day && row.viewportWidth === width && row.variant === variant);
      const png = await readFile(row.source);
      cells.push(`<section><h2>${variant} · ${width}px</h2><img src="data:image/png;base64,${png.toString('base64')}"><p>Source ${row.naturalWidth}×${row.naturalHeight} · scene ${row.width.toFixed(1)}×${row.height.toFixed(1)}px</p></section>`);
    }
    const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>DAY ${day} — aquarium QA</title><style>body{margin:16px;font:14px system-ui;background:#e8edf3;color:#122232;}header{display:flex;align-items:center;gap:24px;}header img{width:120px;height:auto;}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:start;}section{background:white;padding:8px;}h2{font-size:15px;}section img{display:block;width:100%;height:auto;}p{font-size:12px;}</style><header><img src="data:image/png;base64,${original.toString('base64')}"><div><h1>DAY ${day} · 4 widths × 4 views</h1><p>Local mocked account / original background at left / captures from verified public artifact.</p><p>Full and share preserve original scene ratio. Home/guide use bottom-aligned cover crops.</p><p>Contact sheets are visual review aids, not pixel-diff approval or real-device acceptance.</p></div></header><main>${cells.join('')}</main></html>`;
    const file = resolve(output, `day-${day}.html`);
    await writeFile(file, html);
    await page.goto(`file://${file}`);
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
    await page.screenshot({ path: resolve(output, `day-${day}.png`), fullPage: true });
  }
  await writeFile(resolve(output, 'matrix.json'), JSON.stringify(rows, null, 2));
  console.log(`Prepared 96-case matrix and six contact sheets in ${resolve(output)}`);
} finally { await browser.close(); }
