// js/shared/api.js
// auth.js 없이 동작하는 페이지(admin_detail.html 등)용 apiFetch 모듈
// refresh token 자동 갱신 + 401 시 재시도 포함

let _sharedIsRefreshing = false;

async function tryRefreshToken() {
    if (_sharedIsRefreshing) return false;
    _sharedIsRefreshing = true;
    try {
        // 1차: HttpOnly 쿠키 기반 silent_refresh
        const res = await fetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'silent_refresh' })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.accessToken && data.idToken) {
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('idToken', data.idToken);
                return true;
            }
        }
        // 2차: localStorage refreshToken 폴백 (기존 세션 호환)
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;
        const fallbackRes = await fetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'refresh_token', refreshToken })
        });
        if (!fallbackRes.ok) return false;
        const fallbackData = await fallbackRes.json();
        if (fallbackData.accessToken && fallbackData.idToken) {
            localStorage.setItem('accessToken', fallbackData.accessToken);
            localStorage.setItem('idToken', fallbackData.idToken);
            return true;
        }
        return false;
    } catch (e) {
        return false;
    } finally {
        _sharedIsRefreshing = false;
    }
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    options.headers = { ...defaultHeaders, ...(options.headers || {}) };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    const newToken = localStorage.getItem('accessToken');
                    options.headers['Authorization'] = `Bearer ${newToken}`;
                    const retryRes = await fetch(url, options);
                    if (retryRes.ok) return retryRes;
                    if (!retryRes.ok && retryRes.status !== 401 && retryRes.status !== 403) {
                        throw new Error(`서버 통신 오류 (상태 코드: ${retryRes.status})`);
                    }
                }
                alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                const userRole = localStorage.getItem('userRole');
                ['accessToken','idToken','refreshToken','userId','userEmail','userRole','userName','userTier','authProvider'].forEach(k => localStorage.removeItem(k));
                sessionStorage.clear();
                window.location.href = (userRole === 'admin' || userRole === 'tutor') ? '/admin/login' : '/login';
                return Promise.reject(new Error("Auth expired"));
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
