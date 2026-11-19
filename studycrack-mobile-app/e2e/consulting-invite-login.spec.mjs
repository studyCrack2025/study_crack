import { expect, test } from '@playwright/test';

const startPath = '/2027-jungsi-consulting/start';
const inviteKey = 'sc_jungsi_invite_v1';
const applicationId = 'APP_123e4567-e89b-12d3-a456-426614174000';
const inviteUrl = `${startPath}#app=${applicationId}&invite=${'A'.repeat(43)}`;
const codeInput = page => page.getByLabel('이메일로 받은 10자리 인증코드');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64');
const fixtureToken = encode({ alg: 'none' }) + '.' + encode({ sub: 'fixture-student', exp: 4070908800 }) + '.synthetic';
const fixtureTokens = { accessToken: fixtureToken, idToken: fixtureToken, userId: 'fixture-student' };

async function prepare(page) {
  const api = { active: false, calls: [] };
  await page.addInitScript(({ accessToken: token }) => {
    class Pool {
      constructor(options) { this.storage = options.Storage; }
      getCurrentUser() { return null; }
    }
    class User {
      authenticateUser(_details, callbacks) {
        queueMicrotask(() => callbacks.onSuccess({
          getAccessToken: () => ({ getJwtToken: () => token }),
          getIdToken: () => ({ getJwtToken: () => token, payload: { sub: 'fixture-student' } }),
          getRefreshToken: () => ({ getToken: () => 'synthetic-refresh' })
        }));
      }
      signOut() {}
    }
    window.AmazonCognitoIdentity = { CognitoUserPool: Pool, CognitoUser: User,
      AuthenticationDetails: class { constructor(value) { Object.assign(this, value); } } };
  }, fixtureTokens);
  await page.route(/https:\/\/(?:www\.googletagmanager\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)\//, route => route.abort());
  await page.route('https://cdn.jsdelivr.net/npm/amazon-cognito-identity-js@*/dist/amazon-cognito-identity.min.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/js/config.js*', route => {
    const origin = new URL(route.request().url()).origin;
    return route.fulfill({ contentType: 'application/javascript', body: `window.IS_LOCAL = false; window.CONFIG = ${JSON.stringify({
      api: { auth: origin + '/synthetic/auth', user: origin + '/synthetic/user', consulting: origin + '/synthetic/consulting', consultingPublic: origin + '/synthetic/consulting-public' },
      cognito: { userPoolId: 'synthetic_pool', clientId: 'synthetic-client' },
      social: { callbackUrl: origin + '/social-callback', google: { clientId: 'synthetic-google' }, naver: { clientId: 'synthetic-naver' } }
    })};` });
  });
  for (const authorize of ['https://accounts.google.com/o/oauth2/v2/auth*', 'https://nid.naver.com/oauth2.0/authorize*']) {
    await page.route(authorize, route => {
      const request = new URL(route.request().url());
      const callback = new URL(request.searchParams.get('redirect_uri'));
      callback.search = new URLSearchParams({ code: 'synthetic-code', state: request.searchParams.get('state') }).toString();
      return route.fulfill({ status: 302, headers: { location: callback.href }, body: '' });
    });
  }
  await page.route('**/synthetic/**', async route => {
    const body = route.request().postDataJSON();
    api.calls.push({ type: body.type, data: body.data });
    const reply = json => route.fulfill({ json });
    if (body.type === 'register_login_cookies' || body.type === 'social_callback') {
      api.active = true;
      return reply({ success: true, ...fixtureTokens, isNewUser: false });
    }
    if (body.type === 'logout') { api.active = false; return reply({ success: true }); }
    if (body.type === 'public_preflight_v2_consulting_invite') {
      return reply({ success: true, data: { maskedEmail: 's***@example.invalid', maskedPhone: '010-****-0000', expiresAt: '2099-01-01T00:00:00.000Z' } });
    }
    if (!api.active) return route.fulfill({ status: 401, json: { success: false, code: 'AUTH_SESSION_EXPIRED' } });
    if (body.type === 'silent_refresh') return reply({ success: true, ...fixtureTokens });
    if (body.type === 'get_login_profile') return reply({ role: 'student', name: '합성 학생', computedTier: 'standard', tutorialRewardClaimed: true });
    if (body.type === 'student_get_v2_consulting_invite_status') {
      expect(body.data.applicationId).toBe(applicationId);
      return reply({ success: true, data: { linked: false, maskedEmail: 's***@example.invalid', maskedPhone: '010-****-0000', expiresAt: '2099-01-01T00:00:00.000Z' } });
    }
    throw new Error('Unexpected synthetic request: ' + body.type);
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
  const pending = await page.evaluate(key => sessionStorage.getItem(key), inviteKey);
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  return { api, pending };
}

async function passwordLogin(page) {
  await page.getByPlaceholder('이메일', { exact: true }).fill('student@example.invalid');
  await page.getByPlaceholder('비밀번호', { exact: true }).fill('Synthetic1!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(startPath + '$'));
  await expect(codeInput(page)).toBeVisible();
}

for (const event of ['pageshow', 'storage']) test(`초대 로그인 뒤 ${event} 세션 변경은 초대만 유지하고 이전 계정 데이터는 제거한다`, async ({ page }) => {
  const { api, pending } = await prepare(page);
  await passwordLogin(page);
  const statusCount = () => api.calls.filter(call => call.type === 'student_get_v2_consulting_invite_status').length;
  const beforeRestore = statusCount();
  await page.evaluate(event => {
    sessionStorage.setItem('accessToken', 'previous-account-access');
    sessionStorage.setItem('idToken', 'previous-account-id');
    sessionStorage.setItem('deleteConfirmToken', 'previous-account-confirmation');
    localStorage.setItem('sc_session_epoch', 'fixture-completed-login');
    window.dispatchEvent(event === 'pageshow'
      ? new PageTransitionEvent('pageshow', { persisted: true })
      : new StorageEvent('storage', { key: 'sc_session_epoch', newValue: 'fixture-completed-login' }));
  }, event);
  await expect.poll(statusCount).toBeGreaterThan(beforeRestore);
  await expect(codeInput(page)).toBeVisible();
  await expect(page.getByText('유효한 초대 정보를 찾을 수 없습니다.', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), inviteKey)).toBe(pending);
  expect(await page.evaluate(() => sessionStorage.getItem('deleteConfirmToken'))).toBeNull();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(codeInput(page)).toBeVisible();
  expect(api.calls.filter(call => call.type === 'student_get_v2_consulting_invite_status').length).toBeGreaterThanOrEqual(2);
  expect(api.calls.filter(call => call.type === 'student_claim_v2_consulting_invite')).toHaveLength(0);
  expect(await page.evaluate(key => localStorage.getItem(key), inviteKey)).toBeNull();
});

for (const provider of ['Google', 'Naver']) test(`첫 초대는 실제 공통 ${provider} 로그인 복귀 후 링크를 다시 열지 않고 코드를 입력한다`, async ({ page }) => {
  const { api, pending } = await prepare(page);
  await page.locator('#socialBtn' + provider).click();
  await expect(page).toHaveURL(new RegExp(startPath + '$'));
  await expect(codeInput(page)).toBeVisible();
  expect(await page.evaluate(key => sessionStorage.getItem(key), inviteKey)).toBe(pending);
  expect(api.calls.filter(call => call.type === 'social_callback')).toHaveLength(1);
  expect(api.calls.filter(call => call.type === 'student_claim_v2_consulting_invite')).toHaveLength(0);
});

test('초대 로그인 후 명시적으로 로그아웃하면 초대와 로그인 정보가 모두 지워진다', async ({ page }) => {
  const { api } = await prepare(page);
  await passwordLogin(page);
  await page.evaluate(() => { void performClientLogout('/login'); });
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(key => sessionStorage.getItem(key), inviteKey)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
  expect(api.calls.filter(call => call.type === 'logout')).toHaveLength(1);
});
