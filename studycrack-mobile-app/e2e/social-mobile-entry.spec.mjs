import { expect, test } from '@playwright/test';
import { installApiMock } from './support/mock-api.mjs';

async function routeSocialConfig(page, calculator) {
  await page.route(/\/js\/config\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ response, body: `${calculator ? body.replace(/^const IS_LOCAL = .*;$/m, 'const IS_LOCAL = false;') : body}\nCONFIG.social.callbackUrl = new URL('/social-callback', location.origin).href;` });
  });
}

for (const provider of ['google', 'naver']) for (const surface of ['mobile', 'calculator']) test(`built ${surface} ${provider} button resumes an ended session through the real callback page`, async ({ page, context, baseURL }) => {
  const calculator = surface === 'calculator';
  await installApiMock(page);
  // OAuth navigation must not depend on a live font provider's response time.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  const authRequests = [];
  const token = `fixture.${Buffer.from(JSON.stringify({ sub: 'e2e-student', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  await page.addInitScript(() => {
    window.STUDYCRACK_API_BASE_URL = '';
    Object.defineProperty(navigator, 'standalone', { value: true });
    if (!localStorage.getItem('__socialEntryFixture')) {
      localStorage.setItem('__socialEntryFixture', '1');
      localStorage.setItem('sc_session_ended', '1');
      localStorage.setItem('sc_session_epoch', 'ended-fixture');
      sessionStorage.setItem('accessToken', 'must-not-restore');
    }
  });
  // Only the preview callback address differs from deployment configuration.
  await routeSocialConfig(page, calculator);
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'application/javascript', body: 'window.AmazonCognitoIdentity = { CognitoUserPool: class { getCurrentUser() { return null; } } };' }));
  await page.route('**/api/auth', async route => {
    const payload = route.request().postDataJSON();
    authRequests.push(payload);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload.type === 'social_callback'
      ? { success: true, userId: 'e2e-student', accessToken: token, idToken: token }
      : { success: true, userId: 'e2e-student', accessToken: token, idToken: token }) });
  });
  await page.route(/https:\/\/(accounts\.google\.com|nid\.naver\.com)\//, async route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('state')).toMatch(new RegExp(`^[a-f0-9]{32}\\|${provider}${calculator ? '' : '\\|mobile'}$`));
    const callback = new URL(url.searchParams.get('redirect_uri'));
    expect(callback.origin).toBe(baseURL);
    callback.searchParams.set('code', 'synthetic-code');
    callback.searchParams.set('state', url.searchParams.get('state'));
    await route.fulfill({ contentType: 'text/html', body: `<!doctype html><script>location.replace(${JSON.stringify(callback.href)});</script>` });
  });
  if (calculator) {
    await page.goto('/2027-jungsi-consulting/calculator');
    await page.getByRole('link', { name: '로그인하고 시작하기', exact: true }).click();
    await page.locator(provider === 'google' ? '#socialBtnGoogle' : '#socialBtnNaver').click();
  } else {
    await page.goto('/studycrack-mobile.html?screen=authLogin');
    await expect(page.locator(`[data-action="ssoSuccess"][data-provider="${provider}"]`)).toBeVisible();
    await page.locator(`[data-action="ssoSuccess"][data-provider="${provider}"]`).click();
  }
  await expect.poll(() => authRequests.filter(request => request.type === 'social_callback').length).toBe(1);
  await expect(page).toHaveURL(`${baseURL}${calculator ? '/2027-jungsi-consulting/calculator' : '/studycrack-mobile.html'}`);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('e2e-student');
  expect(await page.evaluate(() => localStorage.getItem('sc_session_ended'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('sc_social_attempt_v1'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).not.toBe('must-not-restore');
  if (calculator) {
    await expect(page.getByRole('heading', { name: '2027학년도 수능 성적', exact: true })).toBeVisible();
    await context.addCookies([{ name: 'synthetic-cookie-session', value: 'active', url: baseURL, httpOnly: true }]);
    await page.reload();
    await expect(page.getByRole('heading', { name: '2027학년도 수능 성적', exact: true })).toBeVisible();
    const second = await context.newPage();
    await installApiMock(second);
    await routeSocialConfig(second, true);
    await second.goto('/2027-jungsi-consulting/calculator');
    await expect(second.getByRole('heading', { name: '2027학년도 수능 성적', exact: true })).toBeVisible();
    await page.evaluate(() => clearClientSession());
    await expect(page.getByRole('heading', { name: '내 계정으로 준비해주세요.' })).toBeVisible();
    await second.reload();
    await expect(second.getByRole('heading', { name: '내 계정으로 준비해주세요.' })).toBeVisible();
    await second.close();
  }
});
