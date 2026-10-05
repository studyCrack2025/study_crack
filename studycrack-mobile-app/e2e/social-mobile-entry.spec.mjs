import { expect, test } from '@playwright/test';
import { installApiMock } from './support/mock-api.mjs';

for (const provider of ['google', 'naver']) test(`built mobile ${provider} button resumes an ended session through the real callback page`, async ({ page, baseURL }) => {
  await installApiMock(page);
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
  await page.route(/\/js\/config\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nCONFIG.social.callbackUrl = new URL('/social-callback', location.origin).href;` });
  });
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
    expect(url.searchParams.get('state')).toMatch(new RegExp(`^[a-f0-9]{32}\\|${provider}\\|mobile$`));
    const callback = new URL(url.searchParams.get('redirect_uri'));
    expect(callback.origin).toBe(baseURL);
    callback.searchParams.set('code', 'synthetic-code');
    callback.searchParams.set('state', url.searchParams.get('state'));
    await route.fulfill({ contentType: 'text/html', body: `<!doctype html><script>location.replace(${JSON.stringify(callback.href)});</script>` });
  });
  await page.goto('/studycrack-mobile.html?screen=authLogin');
  await expect(page.locator(`[data-action="ssoSuccess"][data-provider="${provider}"]`)).toBeVisible();
  await page.locator(`[data-action="ssoSuccess"][data-provider="${provider}"]`).click();
  await expect.poll(() => authRequests.filter(request => request.type === 'social_callback').length).toBe(1);
  await expect(page).toHaveURL(`${baseURL}/studycrack-mobile.html`);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('e2e-student');
  expect(await page.evaluate(() => localStorage.getItem('sc_session_ended'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('sc_social_attempt_v1'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).not.toBe('must-not-restore');
});
