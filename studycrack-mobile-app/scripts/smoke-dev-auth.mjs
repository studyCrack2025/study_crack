import { chromium, expect } from '@playwright/test';
import { assertDevReleaseIdentity, validateDevSmokeConfig } from './smoke-dev-auth-contract.mjs';

let config;
try { config = validateDevSmokeConfig(process.env); }
catch { console.error('Provide the test account, full expected dev commit and approved dev mobile URL.'); process.exit(2); }
const { email, password, baseUrl, expectedCommit } = config;
const release = await fetch('https://dev.studycrack.co.kr/release.json', { credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
if (release.status !== 200) throw new Error('Dev release identity is unavailable.');
assertDevReleaseIdentity(await release.json(), expectedCommit);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
try {
  const page = await context.newPage();
  await page.goto(`${baseUrl}?screen=authLogin`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-field="loginEmail"]').fill(email);
  await page.locator('[data-login-password]').fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.locator('[data-screen="timer"]').waitFor({ state: 'visible', timeout: 20_000 });
  const sessionCookies = (await context.cookies('https://api.dev.studycrack.co.kr')).filter(cookie => ['at', 'rt'].includes(cookie.name));
  if (sessionCookies.length !== 2 || sessionCookies.some(cookie => !cookie.httpOnly || !cookie.secure)) throw new Error('Secure dev session cookies were not established.');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-screen="timer"]').waitFor({ state: 'visible', timeout: 20_000 });

  const secondPage = await context.newPage();
  await secondPage.goto(`${baseUrl}?screen=timer`, { waitUntil: 'domcontentloaded' });
  await secondPage.locator('[data-screen="timer"]').waitFor({ state: 'visible', timeout: 20_000 });
  await secondPage.close();

  await page.goto(`${baseUrl}?screen=settingsMain`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /로그아웃/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.locator('[data-screen="authLogin"]').waitFor({ state: 'visible', timeout: 20_000 });
  await expect.poll(async () => (await context.cookies('https://api.dev.studycrack.co.kr')).filter(cookie => ['at', 'rt'].includes(cookie.name)).length, { timeout: 8000, message: 'Dev session cookies must be cleared after logout.' }).toBe(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-screen="authLogin"]').waitFor({ state: 'visible', timeout: 20_000 });
  const signedOutPage = await context.newPage();
  await signedOutPage.goto(`${baseUrl}?screen=timer`, { waitUntil: 'domcontentloaded' });
  await signedOutPage.locator('[data-screen="authLogin"]').waitFor({ state: 'visible', timeout: 20_000 });
  await signedOutPage.close();
  console.log(`dev auth/session smoke passed (${expectedCommit.slice(0, 8)})`);
} finally {
  await browser.close();
}
