import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProfileHandlers } from '../src/handlers/profile-handlers.js';

const [profileHandlers, profileOverlays, secondaryScreens, screenContext, accountState, handlerState, socialCallback, packageSource] = await Promise.all([
  readFile(new URL('../src/handlers/profile-handlers.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/mypage/ProfileOverlays.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/mypage/MyPageSecondaryScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/screen-context.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/account/state.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/state/handler-state-actions.js', import.meta.url), 'utf8'),
  readFile(new URL('../../js/social-callback.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

assert.match(profileHandlers, /verifyPassword/);
const deletionRequest = await readFile(new URL('../src/features/account/deletion-request.js', import.meta.url), 'utf8');
assert.match(deletionRequest, /type:\s*'request_account_deletion'/);
assert.match(deletionRequest, /deleteConfirmToken/);
assert.match(profileHandlers, /import\('\.\.\/features\/account\/deletion-request.js'\)/);
assert.match(profileHandlers, /startWithdrawSocialReauth/);
assert.match(profileHandlers, /https:\/\/pf\.kakao\.com/);
assert.doesNotMatch(profileHandlers, /회원탈퇴가 완료되었습니다[\s\S]{0,180}goto\?\.\('authLogin'/);
assert.match(profileOverlays, /withdrawSubmitting/);
assert.match(profileOverlays, /소셜 계정으로 본인 확인/);
assert.match(accountState, /withdrawSubmitting:\s*false/);
assert.match(handlerState, /'withdrawSubmitting'/);
assert.match(screenContext, /'weeklyReportsStatus'/);
assert.match(screenContext, /'withdrawSubmitting'/);
assert.match(secondaryScreens, /ResourceFeedback status=\{qnaStatus\}/);
assert.match(secondaryScreens, /ResourceFeedback status=\{notiStatus\}/);
assert.match(await readFile(new URL('../src/components/ResourceFeedback.jsx', import.meta.url), 'utf8'), /\['idle', 'loading', 'error'\]/);
assert.doesNotMatch(secondaryScreens, /최근 3개년|높은 정확도|결과가 크게 갈립니다/);
assert.match(socialCallback, /loginReturnUrl \|\| '\/mypage\?reauth=success&purpose=delete_account'/);
assert.match(socialCallback, /loginReturnUrl = attempt\.returnUrl/);
assert.match(socialCallback, /consumeSocialLoginAttempt\(returnedState\)/);
assert.match(packageSource, /check-phase-three-service-tracer\.mjs && node scripts\/check-phase-three-operation-tracer\.mjs && node scripts\/check-phase-three-screen-coverage\.mjs/);

function createStorage(entries = []) {
  const values = new Map(entries);
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
    get length() { return values.size; }
  };
}

const localStorage = createStorage([['userId', 'student-local']]);
const sessionStorage = createStorage([['accessToken', 'existing-session']]);
const requestTypes = [];
const submittingStates = [];
let verifiedCredentials = null;
let destination = '';
const handlers = createProfileHandlers({
  alert: () => {},
  apiBase: { auth: '/api/auth', user: '/api/user' },
  apiFetch: async (_url, options) => {
    requestTypes.push(JSON.parse(options.body).type);
    return { ok: true, json: async () => ({ success: true, completed: true, status: 'complete' }) };
  },
  goto: (screen) => { destination = screen; },
  localStorage,
  sessionStorage,
  setHistory: () => {},
  setLoggedIn: () => {},
  setWithdrawModalOpen: () => {},
  setWithdrawPassword: () => {},
  setWithdrawSubmitting: (value) => submittingStates.push(value),
  user: { authProvider: 'local', email: 'student@example.com' },
  verifyPassword: async (credentials) => {
    verifiedCredentials = credentials;
    return { ok: true, reauthAccessToken: 'fresh-proof' };
  },
  window: { localStorage, location: { pathname: '/studycrack-mobile.html' }, sessionStorage },
  withdrawPassword: 'safe-password'
});
assert.equal(await handlers.confirmWithdraw(), true);
assert.deepEqual(verifiedCredentials, { email: 'student@example.com', password: 'safe-password' });
assert.deepEqual(requestTypes, ['request_account_deletion', 'logout']);
assert.deepEqual(submittingStates, [true, false]);
assert.equal(destination, 'authLogin');
assert.equal(sessionStorage.getItem('accessToken'), null);

for (const data of [{ success: true, completed: false, status: 'review_required' }, { success: true }, { success: false, completed: true, status: 'complete' }]) {
  const calls = [], states = [];
  const storage = createStorage([['accessToken', 'keep-session']]);
  const pending = createProfileHandlers({
    alert: () => {}, apiBase: { user: '/user', auth: '/auth' },
    apiFetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return { ok: true, json: async () => data }; },
    sessionStorage: storage, localStorage: createStorage(), window: {},
    user: { authProvider: 'local', email: 'student@example.com' }, withdrawPassword: ' password ',
    verifyPassword: async ({ password }) => { assert.equal(password, ' password '); return { ok: true, reauthAccessToken: 'fresh' }; },
    setWithdrawSubmitting: value => states.push(value), setWithdrawPassword: () => {}, setWithdrawModalOpen: () => {},
    setLoggedIn: () => assert.fail('pending must not log out'), setHistory: () => assert.fail('pending must not reset history'),
    goto: () => assert.fail('pending must not navigate')
  });
  await pending.confirmWithdraw();
  assert.equal(storage.getItem('accessToken'), 'keep-session');
  assert.equal(calls.length, 1); assert.equal(calls[0].reauthAccessToken, 'fresh');
  assert.deepEqual(states, [true, false]);
}

console.log('phase 3 MY/settings/operation tracer contract ok');
