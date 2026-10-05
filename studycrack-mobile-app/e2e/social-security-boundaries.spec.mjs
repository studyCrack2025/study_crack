import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const callbackSource = await readFile(new URL('../../js/social-callback.js', import.meta.url), 'utf8');
const sharedSource = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');

for (const mode of ['legacy-google', 'legacy-naver', 'explicit-link']) test(`계정 연동은 기존 세션을 변경하지 않는다 ${mode}`, async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><div id="statusMsg"></div>' }));
  const state = mode === 'legacy-naver' ? 'synthetic|naver' : mode === 'explicit-link' ? 'synthetic|google|link_account' : 'synthetic|google';
  await page.goto(`/social-callback?code=synthetic&state=${encodeURIComponent(state)}`);
  await page.evaluate(({ state, mode }) => {
    window.CONFIG = { api: { auth: '/synthetic/auth', user: '/synthetic/user' }, social: { callbackUrl: '/social-callback' } };
    window.__requests = [];
    window.fetch = async (...args) => { window.__requests.push(args); throw new Error('unexpected request'); };
    sessionStorage.setItem('socialState', state);
    if (mode !== 'explicit-link') sessionStorage.setItem('socialLinkMode', 'true');
    localStorage.setItem('userId', 'current-user');
    sessionStorage.setItem('accessToken', 'synthetic-current-token');
    document.cookie = 'synthetic_session=current;path=/';
  }, { state, mode });
  await page.addScriptTag({ content: sharedSource });
  await page.addScriptTag({ content: callbackSource });
  await expect(page.locator('#statusMsg')).toContainText('현재 계정은 유지됩니다.');
  expect(await page.evaluate(() => window.__requests)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('current-user');
  expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).toBe('synthetic-current-token');
  expect(await page.evaluate(() => document.cookie)).toContain('synthetic_session=current');
  expect(await page.evaluate(() => sessionStorage.getItem('socialState'))).toBeNull();
});
