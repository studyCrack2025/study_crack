import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
const sharedSource = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');
const webSource = await readFile(new URL('../../js/auth.js', import.meta.url), 'utf8');
const profileSources = {
  student: await readFile(new URL('../../js/mypage.js', import.meta.url), 'utf8'),
  tutor: await readFile(new URL('../../js/mypage_tutor.js', import.meta.url), 'utf8')
};
const mobileSource = (await readFile(new URL('../src/features/session/auth-service.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '').replace(/^export /gm, '');

async function setup(page, { local = false, success = true, malformed = false } = {}) {
  await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><input id="email" value="user@example.invalid"><input id="password" value="Synthetic1!">' }));
  await page.goto(local ? 'http://127.0.0.1:3000/login' : 'https://dev.studycrack.co.kr/login');
  await page.evaluate(({ local, success, malformed }) => {
    window.IS_LOCAL = local;
    window.CONFIG = { api: { auth: '/synthetic/auth', user: '/synthetic/user' }, cognito: { userPoolId: 'synthetic_pool', clientId: 'synthetic-client' } };
    const token = payload => btoa(JSON.stringify({ alg: 'none' })) + '.' + btoa(JSON.stringify(payload)) + '.synthetic';
    const accessToken = token({ sub: 'owner', exp: Math.floor(Date.now() / 1000) + 3600 });
    const idToken = token({ sub: 'owner', exp: Math.floor(Date.now() / 1000) + 3600 });
    window.__session = { getAccessToken: () => ({ getJwtToken: () => accessToken }), getIdToken: () => ({ getJwtToken: () => idToken, payload: { sub: 'owner' } }), getRefreshToken: () => ({ getToken: () => 'synthetic-refresh' }) };
    window.__requests = [];
    window.__users = [];
    window.__alerts = [];
    window.alert = value => window.__alerts.push(value);
    window.fetch = async (url, options = {}) => {
      const body = JSON.parse(options.body || '{}');
      window.__requests.push(body);
      const data = body.type === 'get_login_profile' ? { role: 'student', name: '학생', tutorialRewardClaimed: true }
        : malformed ? {} : { success: true, accessToken, idToken, userId: 'owner' };
      return { ok: success, status: success ? 200 : 503, json: async () => data };
    };
    class Pool {
      constructor(options) { this.storage = options.Storage || localStorage; }
      getCurrentUser() { return this.user || null; }
    }
    class User {
      constructor(options) { this.storage = options.Storage || localStorage; this.pool = options.Pool; this.username = options.Username; window.__users.push(this); }
      authenticateUser(_details, callbacks) {
        this.storage.setItem('CognitoIdentityServiceProvider.synthetic.refreshToken', 'synthetic-refresh');
        this.pool.user = this;
        return callbacks.onSuccess(window.__session);
      }
      signOut() { this.storage.removeItem('CognitoIdentityServiceProvider.synthetic.refreshToken'); this.pool.user = null; }
      getUsername() { return this.username; }
    }
    window.AmazonCognitoIdentity = { CognitoUserPool: Pool, CognitoUser: User, AuthenticationDetails: class { constructor(data) { Object.assign(this, data); } }, CognitoUserAttribute: class {} };
    Object.assign(window, window.AmazonCognitoIdentity);
    window.getMobileBrowserServices = () => ({ browser: window });
    window.AUTH_REQUEST_TYPES = { REGISTER_LOGIN_COOKIES: 'register_login_cookies' };
  }, { local, success, malformed });
  await page.addScriptTag({ content: sharedSource });
}
for (const mobile of [false, true]) for (const mode of ['success', 'failure', 'malformed']) test((mobile ? '모바일' : '웹') + ' 로그인은 장기 토큰을 저장하지 않고 세션 등록 실패를 차단한다 ' + mode, async ({ page }) => {
  await setup(page, { success: mode !== 'failure', malformed: mode === 'malformed' });
  if (mobile) {
    await page.addScriptTag({ content: mobileSource });
    const result = await page.evaluate(() => loginWithPassword({ email: 'user@example.invalid', password: 'Synthetic1!' }));
    expect(result.ok).toBe(mode === 'success');
    if (mode !== 'success') {
      expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
      expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
    }
  } else {
    await page.addScriptTag({ content: webSource });
    const result = await page.evaluate(async () => {
      setAccessToken(window.__session.getAccessToken().getJwtToken());
      setIdToken(window.__session.getIdToken().getJwtToken());
      try { return await registerRefreshCookie('synthetic-refresh'); } catch (_) { return false; }
    });
    expect(result).toBe(mode === 'success');
  }
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('CognitoIdentityServiceProvider.')))).toEqual([]);
  expect(await page.evaluate(() => window.__requests.filter(item => item.type === 'register_login_cookies').length)).toBe(1);
});
test('기존 장기 토큰은 정리하고 쿠키 갱신 실패 시 저장 토큰으로 우회하지 않는다', async ({ page }) => {
  await setup(page, { success: false });
  await page.evaluate(() => {
    localStorage.setItem('refreshToken', 'legacy-refresh');
    localStorage.setItem('CognitoIdentityServiceProvider.synthetic.refreshToken', 'legacy-sdk-refresh');
    localStorage.setItem('pendingPaymentId', 'keep-payment');
  });
  await page.addScriptTag({ content: '(function(){\n' + sharedSource + '\n})();' });
  expect(await page.evaluate(() => tryRefreshToken())).toBe(false);
  expect(await page.evaluate(() => window.__requests.map(item => item.type))).toEqual(['silent_refresh']);
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('CognitoIdentityServiceProvider.synthetic.refreshToken'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('pendingPaymentId'))).toBe('keep-payment');
});
test('로컬 점검용 로그인은 유지하고 재인증 SDK 저장소는 현재 로그인과 분리한다', async ({ page }) => {
  await setup(page, { local: true });
  await page.addScriptTag({ content: mobileSource });
  expect((await page.evaluate(() => loginWithPassword({ email: 'user@example.invalid', password: 'Synthetic1!' }))).ok).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('synthetic-refresh');
  expect(await page.evaluate(() => window.__requests.length)).toBe(0);
  expect((await page.evaluate(() => verifyPassword({ email: 'user@example.invalid', password: 'Synthetic1!' }))).ok).toBe(true);
  expect(await page.evaluate(() => window.__users[0].storage === window.__users[1].storage)).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('CognitoIdentityServiceProvider.')))).toEqual([]);
});
test('쿠키 등록 실패는 신원 조회와 성공 이동보다 먼저 처리한다', async ({ page }) => {
  await setup(page, { success: false });
  await page.addScriptTag({ content: webSource });
  await page.evaluate(async () => {
    localStorage.setItem('userId', 'owner');
    window.__handled = false;
    handleRoleSuccess = () => { window.__handled = true; };
    handleSignOut = async () => { clearClientSession(); };
    await resolveUserIdentity('login', '', { waitFor: Promise.reject(new Error('registration failed')) });
  });
  expect(await page.evaluate(() => window.__handled)).toBe(false);
  expect(await page.evaluate(() => window.__requests.length)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
});
test('튜터 로그인도 세션 등록 실패 시 신원을 조회하지 않고 SDK와 클라이언트를 정리한다', async ({ page }) => {
  await setup(page, { success: false });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addScriptTag({ content: webSource });
  await page.evaluate(() => handleTutorSignIn());
  await expect.poll(() => page.evaluate(() => window.__alerts.length)).toBe(1);
  expect(await page.evaluate(() => window.__requests.map(item => item.type))).toEqual(['register_login_cookies']);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
  expect(await page.evaluate(() => window.__users[0].storage.getItem('CognitoIdentityServiceProvider.synthetic.refreshToken'))).toBeNull();
  expect(errors).toEqual([]);
});
for (const role of ['student', 'tutor']) for (const mode of ['success', 'wrong-password', 'different-owner']) test(`${role} 비밀번호 변경은 현재 비밀번호·계정 일치 확인 뒤 실제 변경한다 ${mode}`, async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    document.body.innerHTML = '<input id="currentPassword" value="OldSynthetic1!"><input id="newChangePassword" value="NewSynthetic1!"><input id="newChangePasswordConfirm" value="NewSynthetic1!">';
    localStorage.setItem('userId', 'owner');
    window.__passwordCalls = [];
  });
  await page.addScriptTag({ content: profileSources[role] });
  await page.evaluate(({ role, mode }) => {
    window.handleSignOut = () => window.__passwordCalls.push('logout');
    const user = {
      getUsername: () => 'user@example.invalid',
      authenticateUser(details, callbacks) {
        window.__passwordCalls.push(['reauth', details.Password]);
        if (mode === 'wrong-password') return callbacks.onFailure({});
        callbacks.onSuccess({ getIdToken: () => ({ payload: { sub: mode === 'different-owner' ? 'other-owner' : 'owner' } }) });
      },
      changePassword(oldPassword, newPassword, callback) {
        window.__passwordCalls.push(['change', oldPassword, newPassword]);
        callback(null, 'SUCCESS');
      },
      signOut() { window.__passwordCalls.push('sdk-signout'); }
    };
    if (role === 'tutor') tutorCognitoUser = user;
    else cognitoUser = user;
    changePassword();
  }, { role, mode });
  expect(await page.evaluate(() => window.__passwordCalls)).toEqual([
    ['reauth', 'OldSynthetic1!'],
    ...(mode === 'success' ? [['change', 'OldSynthetic1!', 'NewSynthetic1!'], 'logout'] : mode === 'different-owner' ? ['sdk-signout'] : [])
  ]);
});
