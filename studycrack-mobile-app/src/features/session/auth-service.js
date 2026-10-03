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

function isLocalHost() {
  const host = getMobileBrowserServices().browser?.location?.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

async function registerLoginCookies({ accessToken, idToken, refreshToken }) {
  const browser = getMobileBrowserServices().browser;
  const storage = browser?.localStorage;
  if (isLocalHost()) {
    try { storage?.setItem?.('refreshToken', refreshToken); } catch (_) {}
    return false;
  }
  const authUrl = getConfig().api && getConfig().api.auth;
  if (!authUrl || !accessToken || !idToken || !refreshToken) throw new Error('로그인 세션을 등록하지 못했습니다.');
  try {
    const res = await browser?.fetch?.(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: AUTH_REQUEST_TYPES.REGISTER_LOGIN_COOKIES, accessToken, idToken, refreshToken })
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.success !== true || data.accessToken !== accessToken || data.idToken !== idToken) throw new Error('INVALID_SESSION_RESPONSE');
      if (browser?.syncTokensFromAuthResponse && !browser.syncTokensFromAuthResponse(data)) throw new Error('INVALID_SESSION_RESPONSE');
      try { storage?.removeItem?.('refreshToken'); } catch (_) {}
      return true;
    }
  } catch (_) {
    // 인증 실패는 아래에서 처리한다.
  }
  throw new Error('로그인 세션을 등록하지 못했습니다. 다시 시도해주세요.');
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

function mapCognitoError(err) {
  const code = (err && (err.code || err.name)) || '';
  if (code === 'NotAuthorizedException') return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (code === 'UserNotFoundException') return '가입된 계정을 찾을 수 없습니다.';
  if (code === 'UserNotConfirmedException') return '이메일 인증이 완료되지 않은 계정입니다. 가입을 마저 진행해주세요.';
  if (code === 'PasswordResetRequiredException') return '비밀번호 재설정이 필요합니다. 비밀번호 찾기를 이용해주세요.';
  if (code === 'TooManyRequestsException' || code === 'LimitExceededException') return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  return (err && err.message) || '로그인 중 오류가 발생했습니다.';
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
  const { completeEmailSignup } = await import('../../../../js/shared/signup-submit.js');
  return completeEmailSignup({ url: authApiUrl || getConfig().api?.auth, pool: getUserPool(), CognitoUser, AuthenticationDetails, CognitoUserAttribute,
    email, password, profile: profileData, fetchImpl });
}

// 이메일/비밀번호 로그인. 성공 시 { ok: true }, 실패 시 { ok: false, error }.
export function loginWithPassword({ email, password } = {}) {
  return new Promise((resolve) => {
    const pool = getUserPool();
    if (!pool) {
      resolve({ ok: false, error: '로그인 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
      return;
    }
    clearPreviousSession();
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool, Storage: pool.storage });
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: async (result) => {
        try {
          const accessToken = result.getAccessToken().getJwtToken();
          const idToken = result.getIdToken();
          const idTokenJwt = idToken.getJwtToken();
          const userId = (idToken.payload && idToken.payload.sub) || '';
          const refreshToken = result.getRefreshToken().getToken();
          try {
            sessionStorage.setItem('accessToken', accessToken);
            sessionStorage.setItem('idToken', idTokenJwt);
            localStorage.setItem('userEmail', email);
            if (userId) localStorage.setItem('userId', userId);
          } catch (_) {}
          await registerLoginCookies({ accessToken, idToken: idTokenJwt, refreshToken });
          resolve({ ok: true });
        } catch (error) {
          clearMobileAuthArtifacts();
          resolve({ ok: false, error: mapCognitoError(error) });
        }
      },
      onFailure: (err) => resolve({ ok: false, error: mapCognitoError(err) }),
      newPasswordRequired: () => resolve({ ok: false, error: '비밀번호 재설정이 필요합니다. 비밀번호 찾기를 이용해주세요.' })
    });
  });
}

export function verifyPassword({ email, password } = {}) {
  return new Promise((resolve) => {
    const pool = getUserPool();
    if (!pool) {
      resolve({ ok: false, error: '로그인 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
      return;
    }
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool, Storage: memoryStorage() });
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: session => resolve({ ok: true, reauthAccessToken: session.getAccessToken().getJwtToken() }),
      onFailure: (err) => resolve({ ok: false, error: mapCognitoError(err) }),
      newPasswordRequired: () => resolve({ ok: false, error: '비밀번호 재설정이 필요합니다. 비밀번호 찾기를 이용해주세요.' })
    });
  });
}
