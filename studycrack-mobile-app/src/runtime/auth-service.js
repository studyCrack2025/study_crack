// 모바일 자립형 인증 서비스(Phase A). 웹 js/auth.js의 검증된 Cognito 로그인 흐름과 동치로 맞춘다.
// - 토큰 저장/세션 부트는 웹과 동일: sessionStorage accessToken/idToken(Bearer) + Auth Lambda 쿠키 등록(httpOnly).
// - 토큰 동기화/세션 정리는 js/shared/api.js의 전역(window.syncTokensFromAuthResponse/clearClientSession)을 재사용.
// 보안: fake/우회 경로 없음. 실제 Cognito + 검증된 Auth Lambda만 사용. (계획: docs/exec-plans/active/260623_mobile_native_auth.md)
import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';

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

// 웹 registerRefreshCookie와 동치. LOCAL은 cross-site 쿠키가 후속 요청에 안 실리므로 refreshToken만 보관.
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
  try { getUserPool() && getUserPool().getCurrentUser() && getUserPool().getCurrentUser().signOut(); } catch (_) {}
  if (typeof window !== 'undefined' && typeof window.clearClientSession === 'function') {
    try { window.clearClientSession(); } catch (_) {}
  }
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
