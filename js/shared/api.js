// js/shared/api.js — 인증/세션 처리 단일 모듈 (apiFetch/redirectToLogin/clearClientSession).
// 인증 정책 상세: docs/security/architecture-notes.md §3

// ─── 공개 경로 정의 (비로그인 사용자가 정상 접근하는 페이지) ──────────────────
// 공개 경로에서 401이 발생해도 강제 로그인 페이지로 튕기지 않는다. 호출처가 알아서 분기.
const PUBLIC_ROUTES_EXACT = ['/', '/login', '/signup', '/welcome', '/social-callback', '/admin/login', '/service', '/promo'];
const PUBLIC_ROUTES_PREFIX = ['/mbti_', '/checkout', '/success', '/change-password'];

function isPublicRoute(pathname) {
    const p = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (PUBLIC_ROUTES_EXACT.includes(p)) return true;
    return PUBLIC_ROUTES_PREFIX.some((prefix) => p.startsWith(prefix));
}

// ─── 세션 정리 ────────────────────────────────────────────────────────────
// localStorage는 화이트리스트 키만 삭제 — checkoutData(결제 진행 중 데이터) 등 다른 키는 보존.
// sessionStorage는 통째로 clear (현행 동작 유지).
const SESSION_KEYS_LOCAL = [
    'refreshToken', 'userId', 'userEmail', 'userRole', 'userName', 'userTier',
    'authProvider', 'accessToken', 'token',
    // 잔존 시 다른 사용자 로그인 시 혼선 가능 — 함께 정리
    'tutorialStatus', 'pending_tutorial', 'tutorial_completed', 'tutorNameAlias'
];

function clearClientSession() {
    SESSION_KEYS_LOCAL.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
}

// 레거시 이름 alias — 기존 호출처(shared/api.js를 직접 import한 admin_detail 등) 호환.
const clearSharedClientSession = clearClientSession;

// ─── 역할 기반 로그인 경로 ─────────────────────────────────────────────────
function getRoleLoginPath() {
    const role = localStorage.getItem('userRole');
    return (role === 'admin' || role === 'tutor') ? '/admin/login' : '/login';
}

// 레거시 이름 alias.
const getLoginRedirectPath = getRoleLoginPath;

// ─── 로그인 페이지로 이동 (세션 정리 + reason 전달 + 이중 alert 차단) ─────────
// reason: 'expired' | 'unauthorized' | 'manual'
let _redirectingToLogin = false;
function redirectToLogin(reason) {
    if (_redirectingToLogin) return; // 동시 다발 호출 시 한 번만
    _redirectingToLogin = true;

    const r = reason || 'expired';
    if (r === 'expired') {
        try { alert('보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.'); } catch (_) {}
    }
    try { sessionStorage.setItem('session_redirect_reason', r); } catch (_) {}
    const path = getRoleLoginPath();
    clearClientSession();
    // clearClientSession 내부 sessionStorage.clear가 reason도 지우므로 재설정.
    try { sessionStorage.setItem('session_redirect_reason', r); } catch (_) {}
    window.location.href = path;
}

// ─── Bearer 토큰 (레거시 호환) ────────────────────────────────────────────
function getSharedBearerToken() {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken') || localStorage.getItem('token');
}

// ─── silent_refresh 싱글톤 락 ──────────────────────────────────────────────
let _sharedRefreshPromise = null;

function tryRefreshToken() {
    if (_sharedRefreshPromise) return _sharedRefreshPromise;

    const p = (async () => {
        const callSilentRefresh = () => fetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'silent_refresh' })
        });

        try {
            const res = await callSilentRefresh();
            if (res.ok) return true;

            // auth.js를 로드하지 않은 페이지(admin_detail 등)에서도 동작하도록 localStorage refreshToken fallback 직접 처리
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
            return retryRes.ok;
        } catch (e) {
            return false;
        }
    })();

    _sharedRefreshPromise = p.finally(() => { _sharedRefreshPromise = null; });
    return _sharedRefreshPromise;
}

// ─── 단일 표준 apiFetch ──────────────────────────────────────────────────
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

        // 401/403 처리 정책: docs/security/architecture-notes.md §3
        if (response.status === 401 || response.status === 403) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
                const retryRes = await fetch(url, options);
                if (retryRes.ok) return retryRes;
                if (retryRes.status === 403) {
                    const errBody = await retryRes.json().catch(() => ({}));
                    throw new Error(errBody.error || errBody.message || '접근 권한이 없습니다.');
                }
                // retry가 또 401이면 아래 만료 처리로 fallthrough
            }
            // refresh 실패 또는 refresh 성공했는데 retry도 401 → 진짜 세션 만료
            if (isPublicRoute(window.location.pathname)) {
                return Promise.reject(new Error('Auth expired'));
            }
            redirectToLogin('expired');
            return Promise.reject(new Error('Auth expired'));
        }

        let errorMessage = `서버 통신 오류 (상태 코드: ${response.status})`;
        try {
            const errorData = await response.json();
            if (errorData.message || errorData.error) errorMessage = errorData.message || errorData.error;
        } catch (e) { /* ignore */ }
        throw new Error(errorMessage);
    } catch (error) {
        console.error('API 통신 실패:', error);
        throw error;
    }
}

// ─── 공유 URL 상수 (admin_detail.html 등 auth.js 미탑재 페이지용) ──────────
const ADMIN_API_URL = CONFIG.api.admin;
const REPORT_API_URL = CONFIG.api.report;
const FILE_API_URL = CONFIG.api.file;
const PAYMENT_API_URL = CONFIG.api.payment || CONFIG.api.admin;
