// js/shared/api.js
// auth.js 없이 동작하는 페이지(admin_detail.html 등)용 apiFetch 모듈
// HttpOnly 쿠키 기반 인증 — 토큰을 JS에 저장하지 않음

let _sharedRefreshPromise = null;

function getSharedBearerToken() {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken') || localStorage.getItem('token');
}

function clearSharedClientSession() {
    ['refreshToken','userId','userEmail','userRole','userName','userTier','authProvider','accessToken','token'].forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
}

function getLoginRedirectPath() {
    const userRole = localStorage.getItem('userRole');
    return (userRole === 'admin' || userRole === 'tutor') ? '/admin/login' : '/login';
}

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

            // admin/detail는 auth.js를 로드하지 않으므로 localStorage refreshToken fallback을 여기서 직접 처리
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

        if (!response.ok) {
            if (response.status === 401) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    const retryRes = await fetch(url, options);
                    if (retryRes.ok) return retryRes;
                }
                alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                const redirectPath = getLoginRedirectPath();
                clearSharedClientSession();
                window.location.href = redirectPath;
                return Promise.reject(new Error("Auth expired"));
            }
            if (response.status === 403) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody.error || errBody.message || '접근 권한이 없습니다.');
            }
            let errorMessage = `서버 통신 오류 (상태 코드: ${response.status})`;
            try {
                const errorData = await response.json();
                if (errorData.message || errorData.error) errorMessage = errorData.message || errorData.error;
            } catch (e) { /* ignore */ }
            throw new Error(errorMessage);
        }
        return response;
    } catch (error) {
        console.error("API 통신 실패:", error);
        throw error;
    }
}

// 공유 URL 상수 (admin_detail.html 등 auth.js 미탑재 페이지용)
const ADMIN_API_URL = CONFIG.api.admin;
const REPORT_API_URL = CONFIG.api.report;
const FILE_API_URL = CONFIG.api.file;
const PAYMENT_API_URL = CONFIG.api.payment || CONFIG.api.admin;
