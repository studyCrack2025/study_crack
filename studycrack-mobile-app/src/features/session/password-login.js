import { AuthenticationDetails, CognitoUser } from 'amazon-cognito-identity-js';
import { AUTH_REQUEST_TYPES } from '../../shared/api/request-types.js';

async function registerLoginCookies(browser, { accessToken, idToken, refreshToken }, scope) {
  const host = browser.location?.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    if (!browser.isClientSessionCurrent(scope, { login: true })) throw new Error('로그인 상태가 변경됐어요.');
    browser.localStorage.setItem('refreshToken', refreshToken);
    browser.completeClientLogin({ accessToken, idToken }, scope);
    return;
  }
  if (!browser.CONFIG?.api?.auth || !accessToken || !idToken || !refreshToken) throw new Error('로그인 세션을 등록하지 못했습니다.');
  const { response, data } = await browser.fetchSharedAuthJson({ type: AUTH_REQUEST_TYPES.REGISTER_LOGIN_COOKIES, accessToken, idToken, refreshToken }, { sessionScope: scope });
  if (!response.ok || data.success !== true || data.accessToken !== accessToken || data.idToken !== idToken) throw new Error('로그인 세션을 등록하지 못했습니다. 다시 시도해주세요.');
  browser.completeClientLogin(data, scope);
  browser.localStorage.removeItem('refreshToken');
}

function describeError(err) {
  const code = (err && (err.code || err.name)) || '';
  if (code === 'NotAuthorizedException') return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (code === 'UserNotFoundException') return '가입된 계정을 찾을 수 없습니다.';
  if (code === 'UserNotConfirmedException') return '이메일 인증이 완료되지 않은 계정입니다. 가입을 마저 진행해주세요.';
  if (code === 'PasswordResetRequiredException') return '비밀번호 재설정이 필요합니다. 비밀번호 찾기를 이용해주세요.';
  if (code === 'TooManyRequestsException' || code === 'LimitExceededException') return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  return (err && err.message) || '로그인 중 오류가 발생했습니다.';
}

export function performPasswordLogin({ email, password, pool, browser, scope, clearSession }) {
  if (!browser.isClientSessionCurrent(scope, { login: true })) return Promise.resolve({ ok: false, error: '로그인 상태가 변경됐어요. 다시 시도해주세요.' });
  if (!pool) return Promise.resolve({ ok: false, error: '로그인 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
  return new Promise(resolve => {
    let settled = false;
    const current = () => browser.isClientSessionCurrent(scope, { login: true });
    const finish = value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => {
      if (current()) clearSession();
      finish({ ok: false, error: '로그인 응답을 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.' });
    }, 30000);
    const user = new CognitoUser({ Username: email, Pool: pool, Storage: pool.storage });
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: async result => {
        try {
          if (settled || !current()) throw new Error('로그인 상태가 변경됐어요. 다시 시도해주세요.');
          const accessToken = result.getAccessToken().getJwtToken();
          const idToken = result.getIdToken();
          const idTokenJwt = idToken.getJwtToken();
          const refreshToken = result.getRefreshToken().getToken();
          browser.sessionStorage.setItem('accessToken', accessToken);
          browser.sessionStorage.setItem('idToken', idTokenJwt);
          browser.localStorage.setItem('userEmail', email);
          if (idToken.payload?.sub) browser.localStorage.setItem('userId', idToken.payload.sub);
          await registerLoginCookies(browser, { accessToken, idToken: idTokenJwt, refreshToken }, scope);
          finish({ ok: true });
        } catch (error) {
          if (current()) clearSession();
          finish({ ok: false, error: describeError(error) });
        }
      },
      onFailure: error => finish({ ok: false, error: describeError(error) }),
      newPasswordRequired: () => finish({ ok: false, error: '비밀번호 재설정이 필요합니다. 비밀번호 찾기를 이용해주세요.' })
    });
  });
}

export function performPasswordVerification({ email, password, pool, storage }) {
  return new Promise(resolve => {
    if (!pool) { resolve({ ok: false, error: '로그인 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' }); return; }
    const user = new CognitoUser({ Username: email, Pool: pool, Storage: storage });
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: session => resolve({ ok: true, reauthAccessToken: session.getAccessToken().getJwtToken() }),
      onFailure: error => resolve({ ok: false, error: describeError(error) }),
      newPasswordRequired: () => resolve({ ok: false, error: '비밀번호 재설정이 필요합니다. 비밀번호 찾기를 이용해주세요.' })
    });
  });
}
