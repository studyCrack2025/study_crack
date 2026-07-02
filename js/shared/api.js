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
const PUBLIC_ROUTES_EXACT = ['/', '/login', '/signup', '/tutor/login', '/tutor/signup', '/welcome', '/social-callback', '/admin/login', '/service', '/promo', '/promotion_kcc01', '/promotion_kcc01.html'];
const PUBLIC_ROUTES_PREFIX = ['/mbti_', '/checkout', '/success', '/change-password', '/studycrack-mobile'];

function isPublicRoute(pathname) {
    const p = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (PUBLIC_ROUTES_EXACT.includes(p)) return true;
    return PUBLIC_ROUTES_PREFIX.some((prefix) => p.startsWith(prefix));
}

function hasClientSession() {
    return !!(
        localStorage.getItem('userId') ||
        sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('refreshToken')
    );
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
        console.warn('[Auth] Refusing mismatched token sync', { expectedUserId, responseUserId: userId });
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

function tryRefreshToken() {
    if (_sharedRefreshPromise) return _sharedRefreshPromise;

    const p = (async () => {
        if (IS_LOCAL) {
            const rt = localStorage.getItem('refreshToken');
            if (!rt) return false;
            try {
                const res = await fetch(CONFIG.api.auth, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'refresh_token', refreshToken: rt })
                });
                if (!res.ok) return false;
                const data = await res.json().catch(() => ({}));
                return syncTokensFromAuthResponse(data);
            } catch (_) {
                return false;
            }
        }

        const callSilentRefresh = () => fetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'silent_refresh' })
        });

        try {
            const res = await callSilentRefresh();
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                return syncTokensFromAuthResponse(data);
            }

            const fallbackRt = localStorage.getItem('refreshToken');
            if (!fallbackRt) return false;

            const registerRes = await fetch(CONFIG.api.auth, {
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
        } catch (e) {
            return false;
        }
    })();

    _sharedRefreshPromise = p.finally(() => { _sharedRefreshPromise = null; });
    return _sharedRefreshPromise;
}

// Shared API wrapper.
async function apiFetch(url, options = {}) {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    options.headers = { ...defaultHeaders, ...(options.headers || {}) };
    const bearerToken = getSharedBearerToken();
    if (bearerToken && !options.headers.Authorization) {
        options.headers.Authorization = `Bearer ${bearerToken}`;
    }
    options.credentials = 'include';

    try {
        const response = await fetch(url, options);

        if (response.ok) return response;

        if (response.status === 401 || response.status === 403) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
                const refreshedBearerToken = getSharedBearerToken();
                if (refreshedBearerToken) {
                    options.headers.Authorization = `Bearer ${refreshedBearerToken}`;
                } else {
                    delete options.headers.Authorization;
                }
                const retryRes = await fetch(url, options);
                if (retryRes.ok) return retryRes;
                if (retryRes.status === 403) {
                    const errBody = await retryRes.json().catch(() => ({}));
                    throw new Error(errBody.error || errBody.message || '접근 권한이 없습니다.');
                }
            }
            const expiredError = new Error('Auth expired');
            expiredError.code = 'AUTH_EXPIRED';
            expiredError.status = response.status;
            if (isPublicRoute(window.location.pathname)) {
                return Promise.reject(expiredError);
            }
            redirectToLogin('expired');
            return Promise.reject(expiredError);
        }

        let errorMessage = `서버 통신 오류 (상태 코드: ${response.status})`;
        try {
            const errorData = await response.json();
            if (errorData.message || errorData.error) errorMessage = errorData.message || errorData.error;
        } catch (e) { /* ignore */ }
        throw new Error(errorMessage);
    } catch (error) {
        // 예상된 인증 만료는 호출처에서 조용히 처리한다.
        if (!error || error.code !== 'AUTH_EXPIRED') {
            console.error('API 통신 실패:', error);
        }
        throw error;
    }
}

// Shared URL constants.
const ADMIN_API_URL = CONFIG.api.admin;
const REPORT_API_URL = CONFIG.api.report;
const FILE_API_URL = CONFIG.api.file;
const PAYMENT_API_URL = CONFIG.api.payment || CONFIG.api.admin;
