// 모바일 자체 인증 서비스.
import { AuthenticationDetails, CognitoUser, CognitoUserAttribute, CognitoUserPool } from 'amazon-cognito-identity-js';
import { getMobileBrowserServices } from '../../shared/browser/mobile-runtime.js';
import { AUTH_REQUEST_TYPES } from '../../shared/api/request-types.js';

function getConfig() {
  return getMobileBrowserServices().browser?.CONFIG || {};
}

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() };
}
let cachedPool = null;
function getUserPool() {
  if (cachedPool) return cachedPool;
  const { cognito } = getConfig();
  if (!cognito || !cognito.userPoolId || !cognito.clientId) return null;
  cachedPool = new CognitoUserPool({ UserPoolId: cognito.userPoolId, ClientId: cognito.clientId, Storage: memoryStorage() });
  return cachedPool;
}

function clearPreviousSession() {
  clearMobileAuthArtifacts();
}

function clearMobileSocialArtifacts(win = getMobileBrowserServices().browser) {
  const keys = ['socialReturnUrl', 'socialEntry', 'socialState', 'socialLinkMode'];
  try {
    const storage = win?.localStorage || globalThis.localStorage;
    keys.forEach((key) => storage?.removeItem?.(key));
  } catch (_) {}
  try {
    const storage = win?.sessionStorage || globalThis.sessionStorage;
    keys.forEach((key) => storage?.removeItem?.(key));
  } catch (_) {}
}

export function clearMobileAuthArtifacts(win = getMobileBrowserServices().browser) {
  try { getUserPool() && getUserPool().getCurrentUser() && getUserPool().getCurrentUser().signOut(); } catch (_) {}
  clearMobileSocialArtifacts(win);
  if (win && typeof win.clearClientSession === 'function') {
    try { win.clearClientSession(); } catch (_) {}
    clearMobileSocialArtifacts(win);
    return;
  }
  try {
    const storage = win?.localStorage || globalThis.localStorage;
    [
      'refreshToken',
      'userId',
      'userEmail',
      'userRole',
      'userName',
      'userTier',
      'authProvider',
      'accessToken',
      'idToken',
      'token',
      'socialReturnUrl',
      'socialEntry',
      'socialState',
      'socialLinkMode',
      'tutorialStatus',
      'pending_tutorial',
      'tutorial_completed',
      'tutorNameAlias'
    ].forEach((key) => storage?.removeItem?.(key));
    const cognitoKeys = [];
    for (let i = 0; i < (storage?.length || 0); i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith('CognitoIdentityServiceProvider.')) cognitoKeys.push(key);
    }
    cognitoKeys.forEach((key) => storage.removeItem(key));
  } catch (_) {}
  try {
    (win?.sessionStorage || globalThis.sessionStorage)?.clear?.();
  } catch (_) {}
}

async function postAuthJson({ authApiUrl, fetchImpl = globalThis.fetch, payload } = {}) {
  const url = authApiUrl || (getConfig().api && getConfig().api.auth);
  if (!url || typeof fetchImpl !== 'function') throw new Error('AUTH_API_MISSING');
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || 'REQUEST_FAILED');
  return data;
}

export async function requestSignupEmailCode({ authApiUrl, email, fetchImpl } = {}) {
  return postAuthJson({ authApiUrl, fetchImpl, payload: { type: AUTH_REQUEST_TYPES.SEND_EMAIL_AUTH, email } });
}

export async function verifySignupEmailCode({ authApiUrl, code, email, fetchImpl } = {}) {
  const data = await postAuthJson({ authApiUrl, fetchImpl, payload: { type: AUTH_REQUEST_TYPES.VERIFY_CODE, email, code } });
  if (data?.success === false) throw new Error(data?.error || 'VERIFY_FAILED');
  return data;
}

export async function requestSignupSmsCode({ authApiUrl, fetchImpl, phone } = {}) {
  return postAuthJson({ authApiUrl, fetchImpl, payload: { type: AUTH_REQUEST_TYPES.SEND_SMS_AUTH, phone } });
}

export async function verifySignupSmsCode({ authApiUrl, code, fetchImpl, phone } = {}) {
  const data = await postAuthJson({ authApiUrl, fetchImpl, payload: { type: AUTH_REQUEST_TYPES.VERIFY_CODE, phone, code } });
  if (data?.success === false) throw new Error(data?.error || 'VERIFY_FAILED');
  return data;
}

export async function signUpWithEmail({ authApiUrl, email, fetchImpl, password, profileData } = {}) {
  const browser = getMobileBrowserServices().browser;
  const scope = browser?.captureClientSession?.();
  const { completeEmailSignup } = await import('../../../../js/shared/signup-submit.js');
  const result = await completeEmailSignup({ url: authApiUrl || getConfig().api?.auth, pool: getUserPool(), CognitoUser, AuthenticationDetails, CognitoUserAttribute,
    email, password, profile: profileData, fetchImpl });
  if (scope && !browser.isClientSessionCurrent(scope, { login: true })) throw new Error('로그인 상태가 변경됐어요. 다시 시도해주세요.');
  return result;
}

// 이메일/비밀번호 로그인. 성공 시 { ok: true }, 실패 시 { ok: false, error }.
export async function loginWithPassword({ email, password } = {}) {
  const browser = getMobileBrowserServices().browser;
  clearPreviousSession();
  const scope = browser.captureClientSession();
  const { performPasswordLogin } = await browser.boundedClientRequest(() => import('./password-login.js'));
  return performPasswordLogin({ email, password, pool: getUserPool(), browser, scope,
    clearSession: clearPreviousSession });
}

export async function verifyPassword({ email, password } = {}) {
  const { performPasswordVerification } = await import('./password-login.js');
  return performPasswordVerification({ email, password, pool: getUserPool(), storage: memoryStorage() });
}
