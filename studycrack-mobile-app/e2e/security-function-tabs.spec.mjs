import { expect, test } from '@playwright/test';
import vm from 'node:vm';
import { prepareMobileSecurityFunction } from '../../tools/prepare-mobile-security-function.mjs';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test.skip(!process.env.STUDYCRACK_PREVIEW_ROOT, 'Requires the verified public artifact.');

test('차단 CSP로 다섯 기본 탭과 플랜 상세의 지연 파일을 불러온다', async ({ page }) => {
  const apiOrigin = 'https://api.example.test';
  await page.addInitScript(origin => { window.STUDYCRACK_API_BASE_URL = origin; }, apiOrigin);
  await installAuthenticatedSession(page);
  await installApiMock(page, { tier: 'standard' });
  await page.addInitScript(() => {
    window.__tabCspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__tabCspViolations.push({ directive: event.effectiveDirective, disposition: event.disposition });
    });
  });
  await page.route('**/studycrack-mobile.html?*', async route => {
    const response = await route.fetch();
    const candidate = prepareMobileSecurityFunction({ html: await response.text(), origin: 'https://dev.studycrack.co.kr', mode: 'enforce', connectOrigins: [apiOrigin] });
    const context = vm.createContext({}); vm.runInContext(candidate.code, context);
    const result = context.handler({
      request: { uri: '/studycrack-mobile.html', method: 'GET', headers: { host: { value: 'dev.studycrack.co.kr' } } },
      response: { statusCode: response.status(), headers: Object.fromEntries(Object.entries(response.headers()).map(([name, value]) => [name, { value }])) }
    });
    await route.fulfill({ response, headers: Object.fromEntries(Object.entries(result.headers).map(([name, entry]) => [name, entry.value])) });
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  for (const [tab, title] of [['planner', 'Planner of Today'], ['aquarium', 'Fish Tank'], ['analysis', 'Score Analysis'], ['strategy', 'Study Coaching']]) {
    await page.locator(`.tabbar [data-tab="${tab}"]`).click();
    await expect(page.locator('.primary-screen-header').getByRole('heading', { level: 1 })).toHaveText(title);
  }
  await page.getByRole('button', { name: '플랜별 기능 보기 →' }).click();
  await expect(page.locator('[data-screen="proIntro"]')).toBeVisible();
  expect(await page.evaluate(() => window.__tabCspViolations)).toEqual([]);
});
