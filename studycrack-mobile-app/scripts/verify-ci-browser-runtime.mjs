import assert from 'node:assert/strict';
import { access, constants, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const require = createRequire(import.meta.url);
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const lockedVersion = lock.packages['node_modules/@playwright/test'].version;
assert.equal(require('@playwright/test/package.json').version, lockedVersion, 'Installed Playwright must match the lockfile');
assert.equal(process.env.PLAYWRIGHT_BROWSERS_PATH, '/ms-playwright', 'CI must use the preinstalled image browsers');

for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const started = performance.now();
  const executable = engine.executablePath();
  const relative = path.relative('/ms-playwright', executable);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `${name} must come from the image`);
  await access(executable, constants.X_OK);
  const browser = await engine.launch({ timeout: 15_000 });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><p>브라우저 준비 확인</p>', { timeout: 10_000 });
    assert.equal(await page.locator('p').textContent(), '브라우저 준비 확인');
    assert.ok((await page.locator('p').boundingBox()).height > 0);
  } finally {
    await browser.close();
  }
  console.log(`${name} ${lockedVersion}: preinstalled runtime ready (${Math.round(performance.now() - started)} ms)`);
}
