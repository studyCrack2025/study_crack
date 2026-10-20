import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const sharedSource = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const callbackSource = await readFile(new URL('../../js/social-callback.js', import.meta.url), 'utf8');
const origin = 'https://dev.studycrack.co.kr';
const key = 'sc_social_attempt_v1';

async function setup(page, { response = { success: true, userId: 'synthetic-owner' }, status = 200 } = {}) {
  const requests = [];
  await page.addInitScript(() => {
    window.IS_LOCAL = false;
    window.CONFIG = { api: { auth: '/synthetic/auth', user: '/synthetic/user', game: '/synthetic/game' },
      social: { callbackUrl: 'https://dev.studycrack.co.kr/social-callback', google: { clientId: 'synthetic-google' }, naver: { clientId: 'synthetic-naver' } } };
  });
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/synthetic/')) {
      requests.push(JSON.parse(route.request().postData() || '{}'));
      const auth = path === '/synthetic/auth';
      await route.fulfill({ status: auth ? status : path.endsWith('/game') ? 500 : 200, contentType: 'application/json',
        body: JSON.stringify(auth ? response : path.endsWith('/game') ? { error: 'Internal Server Error' } : { name: '합성 학생', computedTier: 'basic' }) });
    } else await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="statusMsg"></div><div id="socialSignupTermsModal" class="hidden"></div></body></html>' });
  });
  await page.goto(`${origin}/studycrack-mobile`);
  await page.addScriptTag({ content: sharedSource });
  return requests;
}

async function start(page, { provider = 'google', ended = false, purpose = 'mobile' } = {}) {
  return page.evaluate(({ provider, ended, purpose }) => {
    if (ended) clearClientSession();
    const authUrl = createSocialLoginUrl({ provider, purpose, returnUrl: '/studycrack-mobile' });
    return new URL(authUrl).searchParams.get('state');
  }, { provider, ended, purpose });
}
async function callback(page, state, query = '') {
  await page.goto(`${origin}/social-callback?code=synthetic&state=${encodeURIComponent(state)}${query}`);
  await page.addScriptTag({ content: sharedSource });
  await page.addScriptTag({ content: callbackSource });
}

for (const provider of ['google', 'naver']) for (const ended of [false, true]) test(`${provider} callback after ended=${ended} completes without reusing old credentials`, async ({ page }) => {
  const requests = await setup(page);
  const state = await start(page, { provider, ended });
  await page.evaluate(() => {
    sessionStorage.setItem('accessToken', 'old-access');
    sessionStorage.setItem('deleteConfirmToken', 'old-delete');
  });
  await callback(page, state);
  await expect(page).toHaveURL(`${origin}/studycrack-mobile`);
  expect(requests.filter(request => request.type === 'social_callback')).toEqual([{ type: 'social_callback', provider, code: 'synthetic', redirectUri: `${origin}/social-callback` }]);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('synthetic-owner');
  expect(await page.evaluate(() => localStorage.getItem('sc_session_ended'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('deleteConfirmToken'))).toBeNull();
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
});

for (const mode of ['missing', 'wrong-state', 'expired', 'logout', 'replaced', 'owner-changed', 'legacy-state']) test(`callback ${mode} never calls Auth`, async ({ page }) => {
  const requests = await setup(page);
  let state = await start(page);
  await page.evaluate(({ mode, key }) => {
    if (mode === 'missing') sessionStorage.removeItem(key);
    if (mode === 'expired') {
      const attempt = JSON.parse(sessionStorage.getItem(key));
      attempt.createdAt -= 600000;
      sessionStorage.setItem(key, JSON.stringify(attempt));
    }
    if (mode === 'logout') clearClientSession();
    if (mode === 'replaced') createSocialLoginUrl({ provider: 'naver', purpose: 'mobile' });
    if (mode === 'owner-changed') localStorage.setItem('userId', 'other-owner');
    if (mode === 'legacy-state') {
      sessionStorage.removeItem(key);
      sessionStorage.setItem('socialState', 'synthetic|google|mobile');
    }
  }, { mode, key });
  if (mode === 'wrong-state') state = 'forged|google|mobile';
  if (mode === 'legacy-state') state = 'synthetic|google|mobile';
  await callback(page, state);
  await expect(page.locator('#statusMsg')).toContainText('보안 검증에 실패했습니다.');
  expect(requests).toEqual([]);
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
});

test('callback replay cannot reuse a completed login request', async ({ page }) => {
  const requests = await setup(page);
  const state = await start(page);
  await callback(page, state);
  await expect(page).toHaveURL(`${origin}/studycrack-mobile`);
  await callback(page, state);
  await expect(page.locator('#statusMsg')).toContainText('보안 검증에 실패했습니다.');
  expect(requests.filter(request => request.type === 'social_callback')).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('synthetic-owner');
});
test('cancellation clears only the pending request and permits a new attempt', async ({ page }) => {
  const requests = await setup(page);
  const state = await start(page);
  await callback(page, state, '&error=access_denied');
  await expect(page.locator('#statusMsg')).toContainText('소셜 로그인이 취소되었습니다.');
  expect(requests).toEqual([]);
  const next = await start(page, { provider: 'naver' });
  expect(next).not.toBe(state);
  await callback(page, next);
  await expect(page).toHaveURL(`${origin}/studycrack-mobile`);
});
test('a different storage context refuses the callback rather than skipping state verification', async ({ page, browser }) => {
  await setup(page);
  const state = await start(page);
  const isolated = await browser.newContext();
  try {
    const other = await isolated.newPage();
    const requests = await setup(other);
    await callback(other, state);
    await expect(other.locator('#statusMsg')).toContainText('보안 검증에 실패했습니다.');
    expect(requests).toEqual([]);
  } finally { await isolated.close(); }
});
test('server failure does not turn into a verified login or an endless wait', async ({ page }) => {
  const requests = await setup(page, { status: 502, response: { error: '소셜 인증 처리 중 오류가 발생했습니다.' } });
  const state = await start(page);
  await callback(page, state);
  await expect(page.locator('#statusMsg')).toContainText('소셜 인증 처리 중 오류가 발생했습니다.');
  await expect(page.getByRole('link', { name: '앱으로 돌아가 다시 로그인하기' })).toHaveAttribute('href', '/studycrack-mobile');
  expect(requests).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
});
test('game500 after login is a resource failure, not a logout', async ({ page }) => {
  await setup(page);
  const state = await start(page);
  await callback(page, state);
  await expect(page).toHaveURL(`${origin}/studycrack-mobile`);
  await page.addScriptTag({ content: sharedSource });
  const result = await page.evaluate(async () => {
    try { await apiFetch('/synthetic/game', { method: 'POST', body: JSON.stringify({ type: 'get_study_habitat' }) }); }
    catch (error) { return { status: error.status, code: error.code, owner: localStorage.getItem('userId'), ended: localStorage.getItem('sc_session_ended') }; }
  });
  expect(result).toEqual({ status: 500, code: '', owner: 'synthetic-owner', ended: null });
  await expect(page).toHaveURL(`${origin}/studycrack-mobile`);
});
test('delete reauthentication retains its owner and returns to account info', async ({ page }) => {
  const requests = await setup(page, { response: { deleteReauthVerified: true, deleteConfirmToken: 'synthetic-delete' } });
  await page.evaluate(() => localStorage.setItem('userId', 'synthetic-owner'));
  const state = await page.evaluate(() => new URL(createSocialLoginUrl({ provider: 'naver', purpose: 'delete_reauth', returnUrl: '/studycrack-mobile?screen=accountInfo' })).searchParams.get('state'));
  await callback(page, state);
  await expect(page).toHaveURL(`${origin}/studycrack-mobile?screen=accountInfo`);
  expect(requests[0].purpose).toBe('delete_reauth');
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('synthetic-owner');
  expect(await page.evaluate(() => sessionStorage.getItem('deleteConfirmToken'))).toBe('synthetic-delete');
});
