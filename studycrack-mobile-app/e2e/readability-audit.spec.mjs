import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { installApiMock, installAuthenticatedSession, mockUser } from './support/mock-api.mjs';
import { expectScreenReady } from './support/screen-ready.mjs';

const coverage = JSON.parse(await readFile(new URL('../fixtures/phase-three-screen-coverage.json', import.meta.url)));
const screens = Object.keys(coverage.screens);
const publicScreens = new Set(['splash', 'on1', 'on2', 'on3', 'authLogin', 'authFindId', 'authFindPw', 'authSignup']);
const priority = ['timer', 'planner', 'aquarium', 'analysis', 'strategy', 'plannerAdd', 'scoreInfo', 'addUniversity', 'my', 'proIntro', 'customerSupport'];
const longText = '아주긴한국어대학학과명과이름을줄이지않고표시하는가독성검사';

async function expectReadabilityContent(page, screen, state, { largeCounts = false } = {}) {
  const root = await expectScreenReady(page, screen);
  const name = state === 'long' ? longText : mockUser.name;
  const duration = largeCounts ? '23:59:59' : '00:00:00';
  if (screen === 'timer') {
    await expect(root.locator('.timer-v2-brand small')).toContainText(name);
    await expect(root.locator('.sc-study-headline > b')).toHaveText(duration);
    await expect(root.locator('.timer-week-summary')).toBeVisible();
  } else if (screen === 'planner') {
    await expect(root.locator('.planner-study-status')).toContainText(duration);
    await expect(root.locator('.planner-feedback-copy')).toContainText('SKY MENTOR');
  } else if (screen === 'aquarium') {
    await expect(root.locator('.aquarium-wallet')).toContainText(largeCounts ? '999999장' : '2장');
  } else if (screen === 'analysis') {
    await expect(root.locator('.analysis-target-allowance')).toContainText('Pro');
    if (state === 'empty') {
      await expect(root.locator('.analysis-refresh-bar')).toContainText('선택한 시험의 성적을 입력해주세요.');
      await expect(root.locator('[data-field="analysisTargetMajor"]')).toHaveValue('');
      await expect(root.locator('.analysis-score-summary')).toHaveCount(0);
    } else {
      await expect(root.locator('[data-field="analysisTargetMajor"]')).toContainText(state === 'long' ? longText : '연세대학교 정치외교학과');
      await expect(root.locator('.analysis-refresh-bar')).toContainText('마지막 계산');
      if (state === 'long') {
        await expect(root.locator('.analysis-boost-empty')).toHaveText('현재 조건의 과목별 결과가 없어요.');
      } else {
        await expect(root.locator('.analysis-score-card-head > div:first-child strong')).toHaveText(/\d+(?:\.\d+)?점/);
        await expect(root.locator('.analysis-sim-table')).toBeVisible();
      }
    }
    await expect(root.locator('[data-action="calculateAnalysisScore"]')).toBeEnabled();
  } else if (screen === 'addUniversity' || screen === 'ob4') {
    await expect(root.getByText(state === 'empty' ? '추천에 필요한 성적 정보가 없습니다.' : '성균관대학교 글로벌경영학과', { exact: screen === 'addUniversity' || state === 'empty' })).toBeVisible();
  } else if (screen === 'my') {
    await expect(root.locator('.my-profile-copy strong')).toContainText(name);
    await expect(root.locator('.my-summary-notice')).toHaveCount(0);
  } else if (screen === 'accountInfo') {
    await expect(root.locator('.sc-secondary-intro')).toContainText(mockUser.email);
  } else if (screen === 'ranking') {
    await expect(root.locator('.ranking-row')).toContainText('테*트');
    await expect(root.locator('.ranking-summary-main')).toContainText(duration);
  } else if (screen === 'scoreInfo') {
    if (state === 'empty') await expect(root.locator('.score-info-subject-card strong')).toHaveText(['-', '-', '-', '-', '-', '-']);
    else await expect(root.locator('.score-info-subject-card').first()).toContainText('91점');
  } else if (screen === 'strategy') {
    await expect(root.getByText('아직 제출한 학습 점검이 없어요', { exact: true })).toBeVisible();
  } else if (screen === 'weekly') {
    await expect(root.getByText('주간 점검 기록이 없습니다.', { exact: true })).toBeVisible();
  } else if (screen === 'report' || screen === 'proElite') {
    await expect(root.getByText('아직 발행된 PRO 리포트가 없어요', { exact: true })).toBeVisible();
  } else if (screen === 'tutor' || screen === 'customerSupport') {
    await expect(root.locator('.qna-list-row')).toContainText('분석 결과 문의');
  } else if (screen === 'notificationList') {
    await expect(root.locator('.noti-list-row')).toContainText('학습 알림');
  } else if (screen === 'proIntro') {
    await expect(root.locator('.plan-membership-summary strong')).toHaveText('PRO');
  }
  await expect(root.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

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

async function setup(page, state, apiOptions = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installAuthenticatedSession(page);
  await installApiMock(page, { ...apiOptions, tier: 'pro', userOverrides: state === 'empty' ? { targetUnivs: [], quantitative: {} } : state === 'long' ? { name: longText, targetUnivs: [{ univ: longText, major: `${longText}융합학부` }] } : {} });
}

async function audit(memberPage, testInfo, entries, viewport, state, zoom = false, fallbackFont = false) {
  const rows = [];
  const publicPage = await memberPage.context().newPage();
  await installApiMock(publicPage);
  await publicPage.emulateMedia({ reducedMotion: 'reduce' });
  for (const screen of entries) {
    const page = publicScreens.has(screen) ? publicPage : memberPage;
    await page.setViewportSize(viewport);
    await page.goto(`/studycrack-mobile.html?screen=${screen}`);
    await expectReadabilityContent(page, screen, state);
    if (fallbackFont) {
      await page.addStyleTag({ content: 'body { font-family: Arial, sans-serif; letter-spacing: .035em; }' });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
    }
    if (zoom) await enlargeText(page);
    const result = await inspect(page);
    if (zoom && await page.locator('.tabbar').count()) {
      await expect.poll(() => page.locator('.app-content').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThan(await page.locator('.tabbar').evaluate(el => el.offsetHeight));
    }
    rows.push({ screen, state: publicScreens.has(screen) ? 'public' : state, viewport, syntheticFont200: zoom, fallbackFont, ...result });
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

test('analysis fallback font 200 percent remains within the card', async ({ page }, testInfo) => {
  await setup(page, 'normal', { analysisDelayByExam: { jun: 400, mar: 400 } });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/studycrack-mobile.html?screen=analysis');
  await expectReadabilityContent(page, 'analysis', 'normal');
  const columns = () => page.locator('.analysis-sim-table').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await expect.poll(columns).toBe(2);
  await audit(page, testInfo, ['analysis'], { width: 320, height: 568 }, 'normal', true, true);
  await expect.poll(columns).toBe(1);
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
      await expectReadabilityContent(page, screen, 'normal');
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
    await expectReadabilityContent(page, screen, 'normal', { largeCounts: true });
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
