// js/shared/api.js — shared API/session helpers.
function createCognitoMemoryStorage() {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() };
}

let _clientSessionGeneration = 0;
let _sharedRefreshController = null;
const _sessionRequests = new Set();
const SESSION_EPOCH_KEY = 'sc_session_epoch';
const SESSION_ENDED_KEY = 'sc_session_ended';
const SOCIAL_ATTEMPT_KEY = 'sc_social_attempt_v1';
const SOCIAL_ATTEMPT_TTL_MS = 10 * 60 * 1000;
let _observedSessionEpoch = localStorage.getItem(SESSION_EPOCH_KEY) || '';

function isSafeSocialReturnPath(value) {
    return ['', '/studycrack-mobile', '/studycrack-mobile/', '/studycrack-mobile.html',
        '/studycrack-mobile?screen=accountInfo', '/studycrack-mobile/?screen=accountInfo', '/studycrack-mobile.html?screen=accountInfo',
        '/2027-jungsi-consulting/start'].includes(value);
}

function isSafeAuthReturnPath(value) {
    if (typeof value !== 'string' || value.length < 1 || value.length > 512
        || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n\0]/.test(value)) return false;
    try {
        const target = new URL(value, window.location.origin);
        return target.origin === window.location.origin;
    } catch (_) { return false; }
}

function readJungsiInviteTransient() {
    try {
        const value = JSON.parse(sessionStorage.getItem('sc_jungsi_invite_v1') || 'null');
        if (value?.version === 1 && /^APP_[0-9a-f-]{36}$/i.test(value.applicationId || '')
            && /^[A-Za-z0-9_-]{43}$/.test(value.token || '')) return value;
    } catch (_) {}
    return null;
}

function readSocialLoginAttempt() {
    try {
        const attempt = JSON.parse(sessionStorage.getItem(SOCIAL_ATTEMPT_KEY) || 'null');
        if (!attempt || Object.keys(attempt).some(key => !['version', 'state', 'provider', 'purpose', 'epoch', 'owner', 'callback', 'createdAt', 'returnUrl'].includes(key))
            || attempt.version !== 1 || !['google', 'naver'].includes(attempt.provider)
            || !['', 'mobile', 'delete_reauth', 'link_account'].includes(attempt.purpose)
            || typeof attempt.state !== 'string' || !/^[a-f0-9]{32}\|(google|naver)(\|(mobile|delete_reauth|link_account))?$/.test(attempt.state)
            || attempt.state !== `${attempt.state.split('|')[0]}|${attempt.provider}${attempt.purpose ? `|${attempt.purpose}` : ''}`
            || attempt.epoch !== (localStorage.getItem(SESSION_EPOCH_KEY) || '')
            || attempt.owner !== (localStorage.getItem('userId') || '')
            || attempt.callback !== CONFIG.social?.callbackUrl
            || !Number.isSafeInteger(attempt.createdAt) || attempt.createdAt > Date.now()
            || Date.now() - attempt.createdAt >= SOCIAL_ATTEMPT_TTL_MS
            || !isSafeSocialReturnPath(attempt.returnUrl)) return null;
        return attempt;
    } catch (_) { return null; }
}

function discardSocialLoginAttempt() {
    try {
        [SOCIAL_ATTEMPT_KEY, 'socialState', 'socialLinkMode'].forEach(key => sessionStorage.removeItem(key));
        return true;
    } catch (_) { return false; }
}

function consumeSocialLoginAttempt(returnedState) {
    const attempt = readSocialLoginAttempt();
    const consumed = discardSocialLoginAttempt();
    return consumed && attempt && attempt.state === returnedState ? attempt : null;
}

function createSocialLoginUrl({ provider, purpose = '', returnUrl = '' } = {}) {
    const social = CONFIG.social;
    if (!['google', 'naver'].includes(provider) || !['', 'mobile', 'delete_reauth', 'link_account'].includes(purpose)
        || !social?.[provider]?.clientId || !social.callbackUrl
        || !isSafeSocialReturnPath(returnUrl)) throw new Error('SOCIAL_START_UNAVAILABLE');
    const random = window.crypto;
    if (typeof random?.getRandomValues !== 'function') throw new Error('SOCIAL_START_UNAVAILABLE');
    const nonce = Array.from(random.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    // 새 로그인 시도가 이전 계정의 인증 결과를 되살리지 않도록 한다.
    if (purpose === '' || purpose === 'mobile') beginClientLogin();
    else if (!hasClientSession()) throw new Error('SOCIAL_START_UNAVAILABLE');
    const attempt = { version: 1, state: `${nonce}|${provider}${purpose ? `|${purpose}` : ''}`, provider, purpose,
        epoch: localStorage.getItem(SESSION_EPOCH_KEY) || '', owner: localStorage.getItem('userId') || '',
        callback: social.callbackUrl, createdAt: Date.now(), returnUrl };
    if (!discardSocialLoginAttempt()) throw new Error('SOCIAL_START_UNAVAILABLE');
    sessionStorage.setItem(SOCIAL_ATTEMPT_KEY, JSON.stringify(attempt));
    sessionStorage.setItem(SESSION_EPOCH_KEY, attempt.epoch);
    if (returnUrl) {
        sessionStorage.setItem('socialReturnUrl', returnUrl);
        sessionStorage.setItem('socialEntry', 'mobile');
    } else {
        sessionStorage.removeItem('socialReturnUrl');
        sessionStorage.removeItem('socialEntry');
    }
    const query = new URLSearchParams({ client_id: social[provider].clientId, redirect_uri: attempt.callback, response_type: 'code', state: attempt.state });
    if (provider === 'google') {
        query.set('scope', 'openid email profile');
        query.set('access_type', 'offline');
        query.set('prompt', 'select_account');
    } else query.set('auth_type', 'reauthenticate');
    return `${provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://nid.naver.com/oauth2.0/authorize'}?${query}`;
}

function navigateSocialLogin(url) {
    const target = new URL(url);
    if (!['https://accounts.google.com/o/oauth2/v2/auth', 'https://nid.naver.com/oauth2.0/authorize'].includes(target.origin + target.pathname)) throw new Error('SOCIAL_START_UNAVAILABLE');
    const standalone = window.navigator?.standalone === true || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
    if (standalone) {
        if (typeof window.open !== 'function' || !window.open(url, '_self')) throw new Error('SOCIAL_START_UNAVAILABLE');
    } else window.location.href = url;
}

function isClientSessionEnded() {
    return localStorage.getItem(SESSION_ENDED_KEY) === '1';
}

function captureClientSession() {
    return { generation: _clientSessionGeneration, owner: localStorage.getItem('userId') || '', epoch: localStorage.getItem(SESSION_EPOCH_KEY) || '' };
}

function isClientSessionCurrent(scope, { login = false } = {}) {
    return !!scope && scope.generation === _clientSessionGeneration
        && scope.epoch === (localStorage.getItem(SESSION_EPOCH_KEY) || '')
        && (login || (!isClientSessionEnded() && scope.owner === (localStorage.getItem('userId') || '')));
}

function notifyClientSessionEnded() {
    if (typeof clearAccessToken === 'function') clearAccessToken();
    if (typeof clearIdToken === 'function') clearIdToken();
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('studycrack:session-ended'));
}

function invalidateClientSession() {
    _clientSessionGeneration += 1;
    const controller = _sharedRefreshController;
    _sharedRefreshController = null;
    _sharedRefreshPromise = null;
    _resumePromise = null;
    _lastResumeCheck = 0;
    controller?.abort();
    for (const request of _sessionRequests) request.abort();
    sessionStorage.clear();
    notifyClientSessionEnded();
}

function beginClientLogin() {
    let invite = null;
    try {
        const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '';
        if (returnUrl === '/2027-jungsi-consulting/start') invite = readJungsiInviteTransient();
    } catch (_) { invite = null; }
    clearClientSession();
    if (invite) sessionStorage.setItem('sc_jungsi_invite_v1', JSON.stringify(invite));
    return captureClientSession();
}

function completeClientLogin(data, scope) {
    if (!isClientSessionCurrent(scope, { login: true })) throw createSharedSessionChangedError();
    if (!syncTokensFromAuthResponse(data, { expectedGeneration: scope.generation })) throw createSharedSessionChangedError();
    localStorage.removeItem(SESSION_ENDED_KEY);
    sessionStorage.setItem(SESSION_EPOCH_KEY, scope.epoch);
}

// 다른 탭에서 복제된 오래된 인증 정보를 재사용하지 않는다.
if (isClientSessionEnded() || (sessionStorage.getItem(SESSION_EPOCH_KEY) && sessionStorage.getItem(SESSION_EPOCH_KEY) !== _observedSessionEpoch)) {
    // 유효한 새 로그인 요청만 남기고 이전 인증 정보는 모두 제거한다.
    const attempt = sessionStorage.getItem(SESSION_EPOCH_KEY) === _observedSessionEpoch ? readSocialLoginAttempt() : null;
    const pathname = window.location.pathname || '';
    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '';
    const preserveInvite = pathname === '/2027-jungsi-consulting/start'
        || ((pathname === '/login' || pathname === '/signup') && returnUrl === '/2027-jungsi-consulting/start')
        || (pathname === '/social-callback' && attempt?.returnUrl === '/2027-jungsi-consulting/start');
    const invite = preserveInvite ? readJungsiInviteTransient() : null;
    sessionStorage.clear();
    if (attempt) sessionStorage.setItem(SOCIAL_ATTEMPT_KEY, JSON.stringify(attempt));
    if (invite) sessionStorage.setItem('sc_jungsi_invite_v1', JSON.stringify(invite));
}
sessionStorage.setItem(SESSION_EPOCH_KEY, _observedSessionEpoch);
if (!isClientSessionEnded() && localStorage.getItem('userId') && !localStorage.getItem('sc_legacy_data_owner')) localStorage.setItem('sc_legacy_data_owner', localStorage.getItem('userId'));

function getClientAccountStorage() {
    const scope = captureClientSession();
    const prefix = `sc_account:${encodeURIComponent(scope.owner)}:`;
    return {
        getItem(key) {
            if (!scope.owner || !isClientSessionCurrent(scope)) return null;
            return localStorage.getItem(prefix + key) ?? (localStorage.getItem('sc_legacy_data_owner') === scope.owner ? localStorage.getItem(key) : null);
        },
        setItem(key, value) {
            if (!scope.owner || !isClientSessionCurrent(scope)) throw createSharedSessionChangedError();
            localStorage.setItem(prefix + key, value);
        }
    };
}

// 장기 인증 정보가 브라우저 저장소에 남지 않도록 정리한다.
if (typeof IS_LOCAL !== 'undefined' && !IS_LOCAL) {
    try {
        const stale = ['refreshToken', 'accessToken', 'idToken', 'token'];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key?.startsWith('CognitoIdentityServiceProvider.')) stale.push(key);
        }
        stale.forEach(key => localStorage.removeItem(key));
    } catch (_) {}
}
if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', enforceClientSessionOnPageShow);
    window.addEventListener('storage', (event) => {
        if (event.key === SESSION_EPOCH_KEY || event.key === null) enforceClientSessionOnPageShow();
    });
    window.addEventListener('online', () => coordinateClientSessionResume());
    window.document?.addEventListener('visibilitychange', () => {
        if (window.document.visibilityState === 'visible') coordinateClientSessionResume();
    });
}

// Public routes are handled by their own callers.
function reportSharedDiagnostic(kind, route, status = 0) {
    try { window.STUDYCRACK_DIAGNOSTICS?.record(kind, route, Number.isInteger(status) ? status : 0); } catch (_) {}
}

const PUBLIC_ROUTES_EXACT = ['/', '/login', '/signup', '/tutor/login', '/tutor/signup', '/welcome', '/social-callback', '/admin/login', '/service', '/promo', '/promotion/kcc01', '/promotion_kcc01', '/promotion_kcc01.html', '/2027-jungsi-consulting/start'];
const PUBLIC_ROUTES_PREFIX = ['/mbti_', '/checkout', '/success', '/change-password', '/studycrack-mobile'];

function isPublicRoute(pathname) {
    const p = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (PUBLIC_ROUTES_EXACT.includes(p)) return true;
    return PUBLIC_ROUTES_PREFIX.some((prefix) => p.startsWith(prefix));
}

function hasClientSession() {
    if (isClientSessionEnded()) return false;
    const hasBearerToken = !!(
        sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('token')
    );
    const hasRefreshToken = !!localStorage.getItem('refreshToken');

    // 로컬 점검 환경에서는 userId 같은 잔여 프로필 값만으로 세션을 인정하지 않는다.
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return hasBearerToken || hasRefreshToken;

    // dev/prod의 HttpOnly 쿠키 세션은 JS에서 토큰을 직접 확인할 수 없다.
    return !!(localStorage.getItem('userId') || hasBearerToken);
}

function enforceClientSessionOnPageShow(event) {
    const currentPath = window.location.pathname || '/';
    const isPublic = isPublicRoute(currentPath);
    const epoch = localStorage.getItem(SESSION_EPOCH_KEY) || '';
    if (_observedSessionEpoch !== epoch) {
        _observedSessionEpoch = epoch;
        invalidateClientSession();
        if (currentPath.startsWith('/studycrack-mobile')) window.location.replace(`${currentPath}?screen=authLogin`);
        else if (!isPublic) window.location.replace(getRoleLoginPath());
        return;
    }

    if (!hasClientSession() && !isPublic) {
        window.location.replace(getRoleLoginPath());
        return;
    }
    if (event?.persisted) coordinateClientSessionResume();
}

let _resumePromise = null;
let _lastResumeCheck = 0;
function coordinateClientSessionResume() {
    enforceClientSessionOnPageShow();
    if (!hasClientSession() || window.navigator?.onLine === false) return Promise.resolve(false);
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL && isSharedBearerTokenFresh(getSharedBearerToken())) return Promise.resolve(true);
    if (_resumePromise) return _resumePromise;
    if (Date.now() - _lastResumeCheck < 15000) return Promise.resolve(true);
    _lastResumeCheck = Date.now();
    const scope = captureClientSession();
    const pending = tryRefreshToken({ preserveTransientErrors: true }).then(valid => {
        if (!valid && isClientSessionCurrent(scope)) {
            clearClientSession();
            void clearServerSessionCookies();
            if (window.location.pathname.startsWith('/studycrack-mobile')) window.location.replace(`${window.location.pathname}?screen=authLogin`);
            else if (!isPublicRoute()) window.location.replace(getRoleLoginPath());
        }
        return valid;
    }).catch(() => false).finally(() => { if (_resumePromise === pending) _resumePromise = null; });
    _resumePromise = pending;
    return pending;
}

// 세션 정리. 결제 진행 데이터처럼 세션 외 localStorage 값은 보존한다.
const SESSION_KEYS_LOCAL = [
    'refreshToken', 'userId', 'userEmail', 'userRole', 'userName', 'userTier',
    'authProvider', 'accessToken', 'idToken', 'token',
    // 잔존 시 다른 사용자 로그인 혼선 가능.
    'tutorialStatus', 'pending_tutorial', 'tutorial_completed', 'tutorNameAlias'
];

function clearClientSession() {
    localStorage.setItem(SESSION_ENDED_KEY, '1');
    _observedSessionEpoch = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_EPOCH_KEY, _observedSessionEpoch);
    invalidateClientSession();
    SESSION_KEYS_LOCAL.forEach((k) => localStorage.removeItem(k));
    // SDK 잔여 세션 키까지 정리해 계정 전환 혼선을 막는다.
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('CognitoIdentityServiceProvider.')) keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (_) { /* localStorage 접근 실패는 무시 */ }
    sessionStorage.clear();
}

// Legacy alias.
const clearSharedClientSession = clearClientSession;

// 역할별 로그인 경로.
function getRoleLoginPath() {
    const role = localStorage.getItem('userRole');
    if (role === 'admin') return '/admin/login';
    if (role === 'tutor') return '/tutor/login';
    return '/login';
}

// Legacy alias.
const getLoginRedirectPath = getRoleLoginPath;

// 로그인 페이지로 이동.
let _redirectingToLogin = false;
function redirectToLogin(reason) {
    if (_redirectingToLogin) return;
    _redirectingToLogin = true;

    const r = reason || 'expired';
    if (r === 'expired') {
        try { alert('보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.'); } catch (_) {}
    }
    try { sessionStorage.setItem('session_redirect_reason', r); } catch (_) {}
    const path = getRoleLoginPath();
    clearClientSession();
    // 세션 정리 뒤 이동 사유를 다시 기록한다.
    try { sessionStorage.setItem('session_redirect_reason', r); } catch (_) {}
    window.location.replace(path);
}

// 기존 클라이언트 세션 호환.
function getSharedBearerToken() {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken') || localStorage.getItem('token');
}

function syncTokensFromAuthResponse(data, options = {}) {
    if (!data || typeof data !== 'object') return false;
    if (options.expectedGeneration !== undefined && options.expectedGeneration !== _clientSessionGeneration) return false;

    const idPayload = data.idToken ? getSharedPayloadFromToken(data.idToken) : {};
    const userId = data.userId || idPayload.sub;
    if (!data.accessToken && !data.idToken && !userId) return true;

    const expectedUserId = options.expectedUserId || localStorage.getItem('userId') || '';
    if (expectedUserId && userId && expectedUserId !== userId) {
        console.warn('[Auth] Refusing mismatched token sync');
        return false;
    }

    if (data.accessToken) {
        sessionStorage.setItem('accessToken', data.accessToken);
        if (typeof setAccessToken === 'function') setAccessToken(data.accessToken);
    }
    if (data.idToken) {
        sessionStorage.setItem('idToken', data.idToken);
        if (typeof setIdToken === 'function') setIdToken(data.idToken);
    }

    if (userId) localStorage.setItem('userId', userId);
    return true;
}

function getSharedPayloadFromToken(token) {
    try {
        const base64Url = String(token).split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(window.atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(json);
    } catch (_) {
        return {};
    }
}

function isSharedBearerTokenFresh(token, minimumValiditySeconds = 30) {
    if (!token) return false;
    const payload = getSharedPayloadFromToken(token);
    if (!Number.isFinite(Number(payload.exp))) return true;
    return Number(payload.exp) * 1000 > Date.now() + minimumValiditySeconds * 1000;
}

function createSharedAuthExpiredError(status = 401) {
    const error = new Error('Auth expired');
    error.code = 'AUTH_EXPIRED';
    error.status = status;
    return error;
}

function createSharedSessionChangedError() {
    return Object.assign(new Error('계정이 변경되었습니다. 다시 확인해주세요.'), { code: 'AUTH_SESSION_CHANGED', status: 409 });
}

function assertSharedSessionCurrent(generation, owner) {
    if (generation !== _clientSessionGeneration || (owner && owner !== (localStorage.getItem('userId') || ''))) throw createSharedSessionChangedError();
}

function fetchSharedAuthJson(payload, { timeoutMs = 12000, signal, sessionScope = captureClientSession() } = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    return new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            callback(value);
        };
        const onAbort = () => {
            finish(reject, Object.assign(new Error('Request cancelled'), { name: 'AbortError' }));
            controller?.abort();
        };
        if (signal?.aborted) { onAbort(); return; }
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => {
            finish(reject, Object.assign(new Error('연결을 다시 확인해주세요.'), { code: 'AUTH_CONNECTION_TIMEOUT' }));
            controller?.abort();
        }, timeoutMs);
        Promise.resolve().then(async () => {
            const response = await fetch(CONFIG.api.auth, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify(payload), ...(controller ? { signal: controller.signal } : {})
            });
            if (response.ok && ['silent_refresh', 'register_login_cookies', 'register_refresh_cookie', 'social_callback', 'social_complete_signup'].includes(payload.type) && payload.purpose !== 'delete_reauth'
                && !isClientSessionCurrent(sessionScope, { login: payload.type !== 'silent_refresh' })) {
                // 늦은 응답이 종료한 세션을 복원하지 않도록 다시 정리한다.
                if (!isClientSessionEnded()) clearClientSession();
                void clearServerSessionCookies();
                throw createSharedSessionChangedError();
            }
            let data;
            try { data = await response.json(); }
            catch (_) { throw Object.assign(new Error('연결을 다시 확인해주세요.'), { code: 'AUTH_RESPONSE_INVALID', status: response.status }); }
            return { response, data };
        }).then(value => finish(resolve, value), error => finish(reject, error));
    });
}

async function clearServerSessionCookies({ includeLocal = false } = {}) {
    if (IS_LOCAL && !includeLocal) return true;
    try {
        const { response, data } = await fetchSharedAuthJson({ type: 'logout' }, { timeoutMs: 5000 });
        return response.ok && data?.success === true;
    } catch (_) {
        // 클라이언트 세션 정리는 계속 진행한다.
        return false;
    }
}

async function performClientLogout(redirectPath) {
    const path = redirectPath || getRoleLoginPath();
    clearClientSession();
    await clearServerSessionCookies();
    window.location.replace(path);
}

// Refresh request single-flight guard.
let _sharedRefreshPromise = null;

function tryRefreshToken({ preserveTransientErrors = false } = {}) {
    if (isClientSessionEnded()) return Promise.resolve(false);
    const result = (promise) => preserveTransientErrors ? promise : promise.catch(() => false);
    if (_sharedRefreshPromise) return result(_sharedRefreshPromise);
    const generation = _clientSessionGeneration;
    const owner = localStorage.getItem('userId') || '';
    const scope = captureClientSession();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    _sharedRefreshController = controller;
    const p = (async () => {
        const rt = IS_LOCAL ? localStorage.getItem('refreshToken') : null;
        if (IS_LOCAL && !rt) return false;
        const { response, data } = await fetchSharedAuthJson(IS_LOCAL ? { type: 'refresh_token', refreshToken: rt } : { type: 'silent_refresh' }, { signal: controller?.signal });
        assertSharedSessionCurrent(generation, owner);
        if (!isClientSessionCurrent(scope)) throw createSharedSessionChangedError();
        if (!response.ok) {
            if (response.status === 401 || ["AUTH_SESSION_EXPIRED", "AUTH_ACCOUNT_UNAVAILABLE"].includes(data?.code)) return false;
            throw Object.assign(new Error('인증 연결을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.'), { status: response.status, code: 'AUTH_CONNECTION_FAILED' });
        }
        if (!data || Array.isArray(data) || (data.success !== true && (!data.accessToken || !data.idToken))) {
            throw Object.assign(new Error('연결을 다시 확인해주세요.'), { code: 'AUTH_RESPONSE_INVALID' });
        }
        if (!syncTokensFromAuthResponse(data, { expectedUserId: owner, expectedGeneration: generation })) throw createSharedSessionChangedError();
        return true;
    })();

    const tracked = p.then((refreshed) => {
        if (!refreshed) reportSharedDiagnostic('auth_refresh_failure', 'auth');
        return refreshed;
    }, (error) => {
        if (error?.name !== 'AbortError') reportSharedDiagnostic('auth_refresh_failure', 'auth', error?.status);
        throw error;
    }).finally(() => {
        if (_sharedRefreshController === controller) _sharedRefreshController = null;
        if (_sharedRefreshPromise === tracked) _sharedRefreshPromise = null;
    });
    _sharedRefreshPromise = tracked;
    return result(_sharedRefreshPromise);
}

// Shared API wrapper.
async function apiFetch(url, options = {}) {
    const generation = _clientSessionGeneration;
    const owner = localStorage.getItem('userId') || '';
    const scope = captureClientSession();
    if (isClientSessionEnded()) throw createSharedAuthExpiredError();
    options = { ...options };
    const defaultHeaders = { 'Content-Type': 'application/json' };
    options.headers = { ...defaultHeaders, ...(options.headers || {}) };

    // 로컬 점검 환경에서는 만료된 인증 정보로 보호 요청을 보내기 전에 갱신을 끝낸다.
    // 여러 화면 요청이 동시에 시작되어도 tryRefreshToken의 single-flight를 공유한다.
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL && hasClientSession()) {
        const currentBearerToken = getSharedBearerToken();
        if (!isSharedBearerTokenFresh(currentBearerToken)) {
            const refreshed = await tryRefreshToken({ preserveTransientErrors: true });
            if (!isClientSessionCurrent(scope)) throw createSharedSessionChangedError();
            if (!refreshed || !isSharedBearerTokenFresh(getSharedBearerToken(), 0)) {
                throw createSharedAuthExpiredError(401);
            }
        }
    }

    const bearerToken = getSharedBearerToken();
    if (bearerToken && !options.headers.Authorization) {
        options.headers.Authorization = `Bearer ${bearerToken}`;
    }
    options.credentials = 'include';

    try {
        let response = await boundedClientRequest(signal => fetch(url, { ...options, signal }), options.signal);
        assertSharedSessionCurrent(generation, owner);
        if (!isClientSessionCurrent(scope)) throw createSharedSessionChangedError();

        if (response.ok) return guardSharedResponse(response, scope);

        if (response.status === 401 || response.status === 403) {
            const refreshed = await tryRefreshToken({ preserveTransientErrors: true });
            assertSharedSessionCurrent(generation, owner);
            if (refreshed) {
                if (!canReplaySharedRequest(options)) throw Object.assign(new Error('연결이 복구됐어요. 처리 결과를 확인한 뒤 다시 시도해주세요.'), { code: 'AUTH_RETRY_REQUIRED', status: 409 });
                const refreshedBearerToken = getSharedBearerToken();
                if (refreshedBearerToken) {
                    options.headers.Authorization = `Bearer ${refreshedBearerToken}`;
                } else {
                    delete options.headers.Authorization;
                }
                response = await boundedClientRequest(signal => fetch(url, { ...options, signal }), options.signal);
                assertSharedSessionCurrent(generation, owner);
                if (!isClientSessionCurrent(scope)) throw createSharedSessionChangedError();
                if (response.ok) return guardSharedResponse(response, scope);
            }
            if (!refreshed || response.status === 401) {
                const expiredError = createSharedAuthExpiredError(response.status);
                if (!isPublicRoute(window.location.pathname)) redirectToLogin('expired');
                throw expiredError;
            }
        }

        let errorMessage = `서버 통신 오류 (상태 코드: ${response.status})`;
        let errorCode = '';
        try {
            const errorData = await boundedClientRequest(() => response.json(), options.signal);
            if (errorData.message || errorData.error) errorMessage = errorData.message || errorData.error;
            if (typeof errorData.code === 'string') errorCode = errorData.code;
        } catch (e) { if (e?.name === 'AbortError' || e?.code === 'TIMEOUT') throw e; }
        const apiError = new Error(errorMessage);
        apiError.status = response.status;
        apiError.code = errorCode;
        throw apiError;
    } catch (error) {
        if (error?.name !== 'AbortError') {
            const route = Object.keys(CONFIG.api).find((key) => CONFIG.api[key] === url);
            reportSharedDiagnostic('api_failure', route, error?.status);
        }
        // 예상된 인증 만료와 화면 전환에 따른 요청 취소는 호출처에서 조용히 처리한다.
        if ((!error || error.code !== 'AUTH_EXPIRED') && error?.name !== 'AbortError') {
            console.error('API 통신 실패');
        }
        throw error;
    }
}

function guardSharedResponse(response, scope) {
    return new Proxy(response, { get(target, key) {
        const value = Reflect.get(target, key, target);
        if (key === 'clone') return () => guardSharedResponse(target.clone(), scope);
        if (['json', 'text', 'blob', 'arrayBuffer', 'formData'].includes(key) && typeof value === 'function') return async (...args) => {
            if (!isClientSessionCurrent(scope)) throw createSharedSessionChangedError();
            const data = await boundedClientRequest(() => value.apply(target, args));
            if (!isClientSessionCurrent(scope)) throw createSharedSessionChangedError();
            return data;
        };
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}

function boundedClientRequest(task, signal) {
    const controller = new AbortController();
    _sessionRequests.add(controller);
    return new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
            _sessionRequests.delete(controller);
            callback(value);
        };
        const cancel = () => controller.abort();
        controller.signal.addEventListener('abort', () => finish(reject, Object.assign(new Error('요청이 취소됐어요.'), { name: 'AbortError' })), { once: true });
        if (signal?.aborted) { cancel(); return; }
        signal?.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => {
            finish(reject, Object.assign(new Error('응답을 확인하지 못했어요.'), { code: 'TIMEOUT' }));
            controller.abort();
        }, 45000);
        Promise.resolve().then(() => task(controller.signal)).then(value => finish(resolve, value), error => finish(reject, error));
    });
}

function canReplaySharedRequest(options) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(String(options.method || 'GET').toUpperCase())) return true;
    try {
        const payload = JSON.parse(options.body);
        if (['get_user', 'get_login_profile', 'get_user_analysis', 'get_product_guide', 'get_study_summary', 'get_study_ranking', 'get_admission_calendar', 'get_game_profile', 'get_study_habitat', 'get_fish_catalog', 'get_fish_detail', 'get_pending_draw', 'get_pro_reports', 'get_weekly_reports', 'get_qna_list', 'student_get_notifications', 'analyze_my_targets', 'backtrace_required_raw', 'convert_score', 'get_tutorial_recommendations', 'get_univ_list_only', 'simulate_score_rise', 'get_study_file_download', 'get_planner', 'list_payment_history'].includes(payload.type)) return true;
        if (payload.type === 'planner_sync_v1') return payload.operation === 'get_server_planner';
        return ['start_study_session', 'complete_study_session', 'claim_study_reward'].includes(payload.type)
            && typeof payload.data?.sessionId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(payload.data.sessionId);
    } catch (_) { return false; }
}

// Shared URL constants.
const ADMIN_API_URL = CONFIG.api.admin;
const REPORT_API_URL = CONFIG.api.report;
const FILE_API_URL = CONFIG.api.file;
const PAYMENT_API_URL = CONFIG.api.payment || CONFIG.api.admin;

// 첨부 권한을 재확인하며, 실패한 경우 오래된 주소로 우회하지 않는다.
async function resolvePrivateAttachment(value) {
    const original = new URL(value, window.location.origin);
    if (!original.hash.startsWith('#scFile=')) return value;
    const owner = localStorage.getItem('userId') || '';
    if (!owner || original.protocol !== 'https:' || original.username || original.password || original.hash.length > 2048) throw new Error('첨부파일을 다시 확인해주세요.');
    const context = JSON.parse(decodeURIComponent(original.hash.slice(8)));
    if (!context || typeof context.subjectUserId !== 'string' || !/^[A-Za-z0-9_@.+:-]{1,128}$/.test(context.subjectUserId)
        || (context.reportKind !== undefined && (!['weekly', 'pro'].includes(context.reportKind) || !/^[A-Za-z0-9_:.-]{1,100}$/.test(context.reportId || '')))) throw new Error('첨부파일을 다시 확인해주세요.');
    const response = await apiFetch(FILE_API_URL, { method: 'POST', body: JSON.stringify({ type: 'get_study_file_download', data: { fileUrl: value, subjectUserId: context.subjectUserId, ...(context.reportKind ? { reportKind: context.reportKind, reportId: context.reportId } : {}) } }) });
    const result = await response.json();
    if (owner !== (localStorage.getItem('userId') || '')) throw new Error('계정이 변경되었습니다. 다시 확인해주세요.');
    const fresh = new URL(result.downloadUrl);
    if (fresh.protocol !== 'https:' || fresh.username || fresh.password || fresh.host !== original.host || fresh.pathname !== original.pathname || !fresh.searchParams.has('X-Amz-Signature')) throw new Error('첨부파일을 다시 확인해주세요.');
    return fresh.href;
}

async function openPrivateAttachment(value) {
    let url;
    try {
        url = new URL(value, window.location.origin);
        if (url.protocol !== 'https:' || url.username || url.password) return false;
    } catch (_) { return false; }
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
        const href = await resolvePrivateAttachment(value);
        if (tab) tab.location.replace(href);
        else window.location.assign(href);
        return true;
    } catch (_) {
        tab?.close();
        window.alert('첨부파일을 열 수 없습니다. 계정과 보고서 상태를 확인한 뒤 다시 시도해주세요.');
        return false;
    }
}

if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', event => {
        const anchor = event.target?.closest?.('a[href]');
        if (!anchor || event.defaultPrevented || !anchor.href.includes('#scFile=')) return;
        event.preventDefault();
        void openPrivateAttachment(anchor.href);
    });
    const refreshedImages = new WeakSet();
    document.addEventListener('error', event => {
        const img = event.target;
        if (img?.tagName !== 'IMG' || !img.src.includes('#scFile=') || refreshedImages.has(img)) return;
        refreshedImages.add(img);
        resolvePrivateAttachment(img.src).then(href => { if (img.isConnected) img.src = href; }).catch(() => { img.alt = '첨부파일을 다시 확인해주세요.'; });
    }, true);
}
