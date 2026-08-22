import { chromium } from '@playwright/test';

const email = String(process.env.STUDYCRACK_DEV_SMOKE_EMAIL || '').trim();
const password = String(process.env.STUDYCRACK_DEV_SMOKE_PASSWORD || '');
const baseUrl = String(process.env.STUDYCRACK_DEV_MOBILE_URL || 'https://dev.studycrack.co.kr/studycrack-mobile.html').replace(/\?.*$/, '');

if (!email || !password) {
  console.error('STUDYCRACK_DEV_SMOKE_EMAIL and STUDYCRACK_DEV_SMOKE_PASSWORD are required.');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
try {
  const page = await context.newPage();
  await page.goto(`${baseUrl}?screen=authLogin`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-field="loginEmail"]').fill(email);
  await page.locator('[data-login-password]').fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.locator('[data-screen="timer"]').waitFor({ state: 'visible', timeout: 20_000 });

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
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-screen="authLogin"]').waitFor({ state: 'visible', timeout: 20_000 });
  console.log('dev auth/session smoke passed');
} finally {
  await browser.close();
}
