import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

const coverage = JSON.parse(await readFile(new URL('../fixtures/phase-three-screen-coverage.json', import.meta.url)));
const screens = Object.keys(coverage.screens);
const publicScreens = new Set(['splash', 'on1', 'on2', 'on3', 'authLogin', 'authFindId', 'authFindPw', 'authSignup']);
const priority = ['timer', 'planner', 'aquarium', 'analysis', 'strategy', 'plannerAdd', 'scoreInfo', 'addUniversity', 'my', 'proIntro', 'customerSupport'];
const longText = '아주긴한국어대학학과명과이름을줄이지않고표시하는가독성검사';

async function saveMatrix(testInfo, name, rows) {
  const path = testInfo.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(rows, null, 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}

// Inspect actual text rectangles, not only the document (the shell clips overflow).
async function inspect(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const issues = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!node.textContent.trim() || !el || el.closest('script,style,svg,[aria-hidden="true"],[inert]')) continue;
      if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        // Deliberately scrollable data regions are inspected within their own frame.
        let left = 0, right = width;
        let intentionalScroll = false;
        for (let parent = el; parent; parent = parent.parentElement) {
          const css = getComputedStyle(parent);
          if (['auto', 'scroll'].includes(css.overflowX) && parent.scrollWidth > parent.clientWidth + 1) intentionalScroll = true;
          if (['hidden', 'clip'].includes(css.overflowX)) {
            const bounds = parent.getBoundingClientRect();
            left = Math.max(left, bounds.left); right = Math.min(right, bounds.right);
          }
        }
        if (!intentionalScroll && (rect.left < left - 2 || rect.right > right + 2)) {
          issues.push({ selector: `${el.tagName.toLowerCase()}.${String(el.className).trim().replaceAll(' ', '.')}`, text: node.textContent.trim().slice(0, 90), left: Math.round(rect.left), right: Math.round(rect.right), limit: [Math.round(left), Math.round(right)] });
          break;
        }
      }
    }
    return { documentOverflow: document.documentElement.scrollWidth - width, issues };
  });
}

async function enlargeText(page) {
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll('body *')];
    const sizes = elements.map(el => getComputedStyle(el).fontSize);
    elements.forEach((el, index) => { el.style.fontSize = `${parseFloat(sizes[index]) * 2}px`; });
  });
}

async function setup(page, state) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'pro', userOverrides: state === 'empty' ? { targetUnivs: [], quantitative: {} } : state === 'long' ? { name: longText, targetUnivs: [{ univ: longText, major: `${longText}융합학부` }] } : {} });
}

async function audit(memberPage, testInfo, entries, viewport, state, zoom = false) {
  const rows = [];
  const publicPage = await memberPage.context().newPage();
  await installApiMock(publicPage);
  await publicPage.emulateMedia({ reducedMotion: 'reduce' });
  for (const screen of entries) {
    const page = publicScreens.has(screen) ? publicPage : memberPage;
    await page.setViewportSize(viewport);
    await page.goto(`/studycrack-mobile.html?screen=${screen}`);
    const root = page.locator(screen === 'splash' ? '.splash-v2' : `[data-screen="${screen}"]`);
    await expect(root).toBeVisible();
    await page.waitForTimeout(200);
    if (zoom) await enlargeText(page);
    const result = await inspect(page);
    if (zoom && await page.locator('.tabbar').count()) {
      await expect.poll(() => page.locator('.app-content').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThan(await page.locator('.tabbar').evaluate(el => el.offsetHeight));
    }
    rows.push({ screen, state: publicScreens.has(screen) ? 'public' : state, viewport, syntheticFont200: zoom, ...result });
    await page.screenshot({ path: testInfo.outputPath(`${screen}-${viewport.width}-${state}${zoom ? '-font200' : ''}.png`) });
  }
  await publicPage.close();
  await saveMatrix(testInfo, 'readability-matrix', rows);
  expect(rows.filter(row => row.documentOverflow > 1 || row.issues.length), JSON.stringify(rows.filter(row => row.issues.length))).toEqual([]);
}

for (const width of [320, 390]) for (const state of ['normal', 'empty']) {
  test(`registry 41 screens ${width} ${state}`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await setup(page, state);
    await audit(page, testInfo, screens, { width, height: 844 }, state);
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
  test(`priority long data ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await setup(page, 'long');
    await audit(page, testInfo, priority, viewport, 'long');
  });
}

test('priority synthetic font 200 percent', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await setup(page, 'normal');
  await audit(page, testInfo, priority, { width: 320, height: 568 }, 'normal', true);
});

test('public input and legal pages support synthetic font 200 percent', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await installApiMock(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await audit(page, testInfo, ['authLogin', 'authFindId', 'authFindPw', 'authSignup', 'privacyPolicy', 'termsScreen'], { width: 320, height: 568 }, 'public', true);
});

for (const width of [320, 390]) {
  test(`input overlays, synthetic keyboard and enlarged text ${width}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await setup(page, 'normal');
    const rows = [];
    const cases = [
      ['university-search', 'addUniversity', '[data-action="openUniversitySearch"]'],
      ['score-input', 'scoreInfo', '[data-action="openScoreEdit"]'],
      ['coaching-input', 'strategy', '[data-action="openCoachingSheet"]'],
      ['name-input', 'accountInfo', '[data-action="openMyProfileEdit"]'],
      ['phone-input', 'accountInfo', '[data-action="openPhoneChangeModal"]'],
      ['withdraw-confirm', 'accountInfo', '[data-action="openWithdrawModal"]'],
      ['support-input', 'customerSupport', '.support-action-card.primary']
    ];
    for (const [overlay, screen, trigger] of cases) {
      await page.setViewportSize({ width, height: 568 });
      await page.goto(`/studycrack-mobile.html?screen=${screen}`);
      await page.locator(trigger).click();
      const panel = page.getByRole('dialog');
      await expect(panel).toHaveCount(1);
      await enlargeText(page);
      rows.push({ overlay, state: 'synthetic-font200', ...await inspect(page) });
      await panel.screenshot({ path: testInfo.outputPath(`${overlay}-${width}-font200.png`) });
      // This is a viewport simulation, not an iOS/Android keyboard acceptance test.
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 400 });
        window.visualViewport.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(100);
      const lastAction = panel.locator('button:not([disabled])').last();
      await lastAction.scrollIntoViewIfNeeded();
      const rect = await lastAction.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(401);
      rows.push({ overlay, state: 'keyboard400', ...await inspect(page) });
      await panel.screenshot({ path: testInfo.outputPath(`${overlay}-${width}-keyboard400.png`) });
    }
    await saveMatrix(testInfo, 'overlay-matrix', rows);
    expect(rows.filter(row => row.documentOverflow > 1 || row.issues.length), JSON.stringify(rows.filter(row => row.issues.length))).toEqual([]);
  });
}

test('large counts and long fish names remain readable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installAuthenticatedSession(page);
  const api = await installApiMock(page, {
    tier: 'pro',
    initialGameProfile: { ticketBalance: 999999 },
    fishCatalog: [{ speciesId: 'clownfish', displayName: longText, defaultName: longText, rarity: 'common', starter: true, colors: ['#FF7A5C', '#FFF4D8'] }]
  });
  api.state.studySeconds = 86399;
  const rows = [];
  for (const screen of ['timer', 'planner', 'ranking', 'aquarium']) {
    await page.goto(`/studycrack-mobile.html?screen=${screen}`);
    await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
    await page.waitForTimeout(200);
    rows.push({ screen, state: 'large-counts', ...await inspect(page) });
    await page.screenshot({ path: testInfo.outputPath(`${screen}-large-counts.png`) });
  }
  await page.locator('[data-action="openAquariumCatalog"]').click();
  await expect(page.locator('.aquarium-catalog-group')).toBeVisible();
  rows.push({ screen: 'fish-catalog', state: 'long-name', ...await inspect(page) });
  await page.screenshot({ path: testInfo.outputPath('fish-catalog-long-name.png') });
  await saveMatrix(testInfo, 'large-data-matrix', rows);
  expect(rows.filter(row => row.documentOverflow > 1 || row.issues.length), JSON.stringify(rows.filter(row => row.issues.length))).toEqual([]);
});

test('inactive score slide is excluded from focus and accessibility', async ({ page }) => {
  await setup(page, 'normal');
  await page.goto('/studycrack-mobile.html?screen=ob5');
  const current = page.locator('.score-journey-col.current');
  const target = page.locator('.score-journey-col.target');
  await page.locator('[data-action="setScoreView"][data-score-view="current"]').click();
  await expect(current).toHaveAttribute('aria-hidden', 'false');
  await expect(target).toHaveAttribute('inert', '');
  await page.locator('[data-action="setScoreView"][data-score-view="target"]').click();
  await expect(target).toHaveAttribute('aria-hidden', 'false');
  await expect(target).not.toHaveAttribute('inert');
  await expect(current).toHaveAttribute('inert', '');
  await page.locator('[data-action="setScoreView"][data-score-view="current"]').click();
  await expect(current).not.toHaveAttribute('inert');
  await expect(target).toHaveAttribute('aria-hidden', 'true');
});
