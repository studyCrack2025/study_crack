// 모바일 자체 인증 서비스. 세부 인증 사양은 docs/exec-plans/active/260623_mobile_native_auth.md 참조.
import { AuthenticationDetails, CognitoUser, CognitoUserAttribute, CognitoUserPool } from 'amazon-cognito-identity-js';

function getConfig() {
  return (typeof window !== 'undefined' && window.CONFIG) || {};
}

let cachedPool = null;
function getUserPool() {
  if (cachedPool) return cachedPool;
  const { cognito } = getConfig();
  if (!cognito || !cognito.userPoolId || !cognito.clientId) return null;
  cachedPool = new CognitoUserPool({ UserPoolId: cognito.userPoolId, ClientId: cognito.clientId });
  return cachedPool;
}

function isLocalHost() {
  const host = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

async function registerLoginCookies({ accessToken, idToken, refreshToken }) {
  if (isLocalHost()) {
    try { localStorage.setItem('refreshToken', refreshToken); } catch (_) {}
    return false;
  }
  const authUrl = getConfig().api && getConfig().api.auth;
  if (!authUrl || !accessToken || !idToken || !refreshToken) return false;
  try {
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: 'register_login_cookies', accessToken, idToken, refreshToken })
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (typeof window !== 'undefined' && typeof window.syncTokensFromAuthResponse === 'function') {
        window.syncTokensFromAuthResponse(data);
      }
      try { localStorage.removeItem('refreshToken'); } catch (_) {}
      return true;
    }
  } catch (_) {
    // 폴백: refreshToken localStorage 보관(웹과 동일)
  }
  try { localStorage.setItem('refreshToken', refreshToken); } catch (_) {}
  return false;
}

function clearPreviousSession() {
  clearMobileAuthArtifacts();
}

function clearMobileSocialArtifacts(win = typeof window !== 'undefined' ? window : undefined) {
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

export function clearMobileAuthArtifacts(win = typeof window !== 'undefined' ? window : undefined) {
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

function mapSignupError(err) {
  const code = (err && (err.code || err.name)) || '';
  if (code === 'UsernameExistsException') return '이미 가입된 이메일입니다. 로그인 또는 비밀번호 찾기를 이용해주세요.';
  if (code === 'InvalidPasswordException') return '비밀번호 조건을 확인해주세요. 영문 대/소문자, 숫자, 특수문자 포함 8자 이상이어야 합니다.';
  if (code === 'InvalidParameterException') return '입력 정보를 다시 확인해주세요.';
  if (code === 'TooManyRequestsException' || code === 'LimitExceededException') return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  return (err && err.message) || '회원가입 중 오류가 발생했습니다.';
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
  return postAuthJson({ authApiUrl, fetchImpl, payload: { type: 'send_email_auth', email } });
}

export async function verifySignupEmailCode({ authApiUrl, code, email, fetchImpl } = {}) {
  const data = await postAuthJson({ authApiUrl, fetchImpl, payload: { type: 'verify_code', email, code } });
  if (data?.success === false) throw new Error(data?.error || 'VERIFY_FAILED');
  return data;
}

export async function requestSignupSmsCode({ authApiUrl, fetchImpl, phone } = {}) {
  return postAuthJson({ authApiUrl, fetchImpl, payload: { type: 'send_sms_auth', phone } });
}

export async function verifySignupSmsCode({ authApiUrl, code, fetchImpl, phone } = {}) {
  const data = await postAuthJson({ authApiUrl, fetchImpl, payload: { type: 'verify_code', phone, code } });
  if (data?.success === false) throw new Error(data?.error || 'VERIFY_FAILED');
  return data;
}

function signUpCognito({ attributeList, email, password }) {
  return new Promise((resolve) => {
    const pool = getUserPool();
    if (!pool) {
      resolve({ ok: false, error: '회원가입 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
      return;
    }
    pool.signUp(email, password, attributeList, null, (err, result) => {
      if (err) {
        resolve({ ok: false, error: mapSignupError(err) });
        return;
      }
      resolve({ ok: true, userSub: result?.userSub || '' });
    });
  });
}

export async function signUpWithEmail({ authApiUrl, email, fetchImpl, password, profileData } = {}) {
  const attributeList = [
    new CognitoUserAttribute({ Name: 'gender', Value: profileData.gender }),
    new CognitoUserAttribute({ Name: 'given_name', Value: profileData.name }),
    new CognitoUserAttribute({ Name: 'name', Value: profileData.name }),
    new CognitoUserAttribute({ Name: 'phone_number', Value: profileData.cognitoPhone }),
    new CognitoUserAttribute({ Name: 'email', Value: email }),
    new CognitoUserAttribute({ Name: 'birthdate', Value: profileData.birthdate })
  ];
  const signup = await signUpCognito({ attributeList, email, password });
  if (!signup.ok) return signup;
  try {
    await postAuthJson({
      authApiUrl,
      fetchImpl,
      payload: { type: 'update_profile', userId: signup.userSub, data: profileData }
    });
    return { ok: true, userSub: signup.userSub };
  } catch (error) {
    return { ok: false, afterAccountCreated: true, error: error?.message || '계정은 생성되었으나 프로필 저장에 실패했습니다.' };
  }
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
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool });
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
          resolve({ ok: false, error: mapCognitoError(error) });
        }
      },
      onFailure: (err) => resolve({ ok: false, error: mapCognitoError(err) }),
      newPasswordRequired: () => resolve({ ok: false, error: '비밀번호 재설정이 필요합니다. 비밀번호 찾기를 이용해주세요.' })
    });
  });
}
