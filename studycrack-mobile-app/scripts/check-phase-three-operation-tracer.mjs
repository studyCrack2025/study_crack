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
assert.match(profileHandlers, /type:\s*'delete_user'/);
assert.match(profileHandlers, /deleteConfirmToken/);
assert.match(profileHandlers, /startWithdrawSocialReauth/);
assert.match(profileHandlers, /https:\/\/pf\.kakao\.com/);
assert.doesNotMatch(profileHandlers, /회원탈퇴가 완료되었습니다[\s\S]{0,180}goto\?\.\('authLogin'/);
assert.match(profileOverlays, /withdrawSubmitting/);
assert.match(profileOverlays, /소셜 계정으로 본인 확인/);
assert.match(accountState, /withdrawSubmitting:\s*false/);
assert.match(handlerState, /'withdrawSubmitting'/);
assert.match(screenContext, /'weeklyReportsStatus'/);
assert.match(screenContext, /'withdrawSubmitting'/);
assert.match(secondaryScreens, /qnaStatus === 'idle' \|\| qnaStatus === 'loading'/);
assert.match(secondaryScreens, /notiStatus === 'idle' \|\| notiStatus === 'loading'/);
assert.doesNotMatch(secondaryScreens, /최근 3개년|높은 정확도|결과가 크게 갈립니다/);
assert.match(socialCallback, /getSafeSocialReturnUrl\(\) \|\| '\/mypage\?reauth=success&purpose=delete_account'/);
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
    return { ok: true, json: async () => ({ success: true }) };
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
    return { ok: true };
  },
  window: { localStorage, location: { pathname: '/studycrack-mobile.html' }, sessionStorage },
  withdrawPassword: 'safe-password'
});
assert.equal(await handlers.confirmWithdraw(), true);
assert.deepEqual(verifiedCredentials, { email: 'student@example.com', password: 'safe-password' });
assert.deepEqual(requestTypes, ['delete_user', 'logout']);
assert.deepEqual(submittingStates, [true, false]);
assert.equal(destination, 'authLogin');
assert.equal(sessionStorage.getItem('accessToken'), null);

console.log('phase 3 MY/settings/operation tracer contract ok');
