// js/shared/api.js — shared API/session helpers.
// bfcache 복원 시 stale 세션 노출을 막기 위해 페이지 세션을 재검증한다.
const PAGE_SESSION_USER_ID = typeof window !== 'undefined'
    ? (localStorage.getItem('userId') || '')
    : '';

if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', (e) => {
        enforceClientSessionOnPageShow(e);
    });
}

// Public routes are handled by their own callers.
function reportSharedDiagnostic(kind, route, status = 0) {
    try { window.STUDYCRACK_DIAGNOSTICS?.record(kind, route, Number.isInteger(status) ? status : 0); } catch (_) {}
}

const PUBLIC_ROUTES_EXACT = ['/', '/login', '/signup', '/tutor/login', '/tutor/signup', '/welcome', '/social-callback', '/admin/login', '/service', '/promo', '/promotion/kcc01', '/promotion_kcc01', '/promotion_kcc01.html'];
const PUBLIC_ROUTES_PREFIX = ['/mbti_', '/checkout', '/success', '/change-password', '/studycrack-mobile'];

function isPublicRoute(pathname) {
    const p = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (PUBLIC_ROUTES_EXACT.includes(p)) return true;
    return PUBLIC_ROUTES_PREFIX.some((prefix) => p.startsWith(prefix));
}

function hasClientSession() {
    const hasBearerToken = !!(
        sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('token')
    );
    const hasRefreshToken = !!localStorage.getItem('refreshToken');

    // 로컬 점검 환경에서는 userId 같은 잔여 프로필 값만으로 세션을 인정하지 않는다.
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return hasBearerToken || hasRefreshToken;

    // dev/prod의 HttpOnly 쿠키 세션은 JS에서 토큰을 직접 확인할 수 없다.
    return !!(localStorage.getItem('userId') || hasBearerToken || hasRefreshToken);
}

function enforceClientSessionOnPageShow(event) {
    const currentPath = window.location.pathname || '/';
    const currentUserId = localStorage.getItem('userId') || '';
    const isPublic = isPublicRoute(currentPath);

    if (PAGE_SESSION_USER_ID && currentUserId && PAGE_SESSION_USER_ID !== currentUserId) {
        window.location.reload();
        return;
    }

    if (!hasClientSession() && !isPublic) {
        window.location.replace(getRoleLoginPath());
        return;
    }
    if (event && event.persisted) {
        window.location.reload();
    }
}

// 세션 정리. 결제 진행 데이터처럼 세션 외 localStorage 값은 보존한다.
const SESSION_KEYS_LOCAL = [
    'refreshToken', 'userId', 'userEmail', 'userRole', 'userName', 'userTier',
    'authProvider', 'accessToken', 'token',
    // 잔존 시 다른 사용자 로그인 혼선 가능.
    'tutorialStatus', 'pending_tutorial', 'tutorial_completed', 'tutorNameAlias'
];

function clearClientSession() {
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

async function clearServerSessionCookies() {
    if (IS_LOCAL) return;
    try {
        await fetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'logout' })
        });
    } catch (_) {
        // 클라이언트 세션 정리는 계속 진행한다.
    }
}

async function performClientLogout(redirectPath) {
    await clearServerSessionCookies();
    clearClientSession();
    window.location.replace(redirectPath || getRoleLoginPath());
}

// Refresh request single-flight guard.
let _sharedRefreshPromise = null;

function tryRefreshToken({ preserveTransientErrors = false } = {}) {
    const result = (promise) => preserveTransientErrors ? promise : promise.catch(() => false);
    if (_sharedRefreshPromise) return result(_sharedRefreshPromise);
    const refreshFetch = async (...args) => {
        const response = await fetch(...args);
        if (!response.ok && ![400, 401, 403].includes(response.status)) {
            const error = new Error('인증 연결을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
            error.status = response.status;
            throw error;
        }
        return response;
    };

    const p = (async () => {
        if (IS_LOCAL) {
            const rt = localStorage.getItem('refreshToken');
            if (!rt) return false;
            const res = await refreshFetch(CONFIG.api.auth, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'refresh_token', refreshToken: rt })
            });
            if (!res.ok) return false;
            const data = await res.json().catch(() => ({}));
            return syncTokensFromAuthResponse(data);
        }

        const callSilentRefresh = () => refreshFetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'silent_refresh' })
        });

        const res = await callSilentRefresh();
        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            return syncTokensFromAuthResponse(data);
        }

        const fallbackRt = localStorage.getItem('refreshToken');
        if (!fallbackRt) return false;

        const registerRes = await refreshFetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'register_refresh_cookie', refreshToken: fallbackRt })
        });
        if (!registerRes.ok) return false;

        localStorage.removeItem('refreshToken');
        const retryRes = await callSilentRefresh();
        if (!retryRes.ok) return false;

        const data = await retryRes.json().catch(() => ({}));
        return syncTokensFromAuthResponse(data);
    })();

    _sharedRefreshPromise = p.then((refreshed) => {
        if (!refreshed) reportSharedDiagnostic('auth_refresh_failure', 'auth');
        return refreshed;
    }, (error) => {
        if (error?.name !== 'AbortError') reportSharedDiagnostic('auth_refresh_failure', 'auth', error?.status);
        throw error;
    }).finally(() => { _sharedRefreshPromise = null; });
    return result(_sharedRefreshPromise);
}

// Shared API wrapper.
async function apiFetch(url, options = {}) {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    options.headers = { ...defaultHeaders, ...(options.headers || {}) };

    // 로컬 점검 환경에서는 만료된 인증 정보로 보호 요청을 보내기 전에 갱신을 끝낸다.
    // 여러 화면 요청이 동시에 시작되어도 tryRefreshToken의 single-flight를 공유한다.
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL && hasClientSession()) {
        const currentBearerToken = getSharedBearerToken();
        if (!isSharedBearerTokenFresh(currentBearerToken)) {
            const refreshed = await tryRefreshToken({ preserveTransientErrors: true });
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
        let response = await fetch(url, options);

        if (response.ok) return response;

        if (response.status === 401 || response.status === 403) {
            const refreshed = await tryRefreshToken({ preserveTransientErrors: true });
            if (refreshed) {
                const refreshedBearerToken = getSharedBearerToken();
                if (refreshedBearerToken) {
                    options.headers.Authorization = `Bearer ${refreshedBearerToken}`;
                } else {
                    delete options.headers.Authorization;
                }
                response = await fetch(url, options);
                if (response.ok) return response;
            }
            if (response.status === 401) {
                const expiredError = createSharedAuthExpiredError(response.status);
                if (!isPublicRoute(window.location.pathname)) redirectToLogin('expired');
                throw expiredError;
            }
        }

        let errorMessage = `서버 통신 오류 (상태 코드: ${response.status})`;
        let errorCode = '';
        try {
            const errorData = await response.json();
            if (errorData.message || errorData.error) errorMessage = errorData.message || errorData.error;
            if (typeof errorData.code === 'string') errorCode = errorData.code;
        } catch (e) { /* ignore */ }
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

// Shared URL constants.
const ADMIN_API_URL = CONFIG.api.admin;
const REPORT_API_URL = CONFIG.api.report;
const FILE_API_URL = CONFIG.api.file;
const PAYMENT_API_URL = CONFIG.api.payment || CONFIG.api.admin;
