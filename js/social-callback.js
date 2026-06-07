// js/social-callback.js
// 소셜 OAuth 콜백 페이지 전용 처리 스크립트

(async function() {
    const AUTH_URL = CONFIG.api.auth;
    const USER_API_URL = CONFIG.api.user;
    const statusMsg = document.getElementById('statusMsg');

    // innerHTML 대신 안전한 DOM 조작 (XSS 방지)
    function showError(msg) {
        statusMsg.textContent = '';
        const span = document.createElement('span');
        span.style.color = '#dc2626';
        span.textContent = msg;
        const link = document.createElement('a');
        link.href = '/login';
        link.style.color = '#2563eb';
        link.textContent = '로그인 페이지로 돌아가기';
        statusMsg.appendChild(span);
        statusMsg.appendChild(document.createElement('br'));
        statusMsg.appendChild(document.createElement('br'));
        statusMsg.appendChild(link);
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const errorParam = params.get('error');

    // 1. 오류 파라미터 확인
    if (errorParam) {
        showError('소셜 로그인이 취소되었습니다.');
        sessionStorage.removeItem('socialState');
        return;
    }

    if (!code || !returnedState) {
        showError('인증 처리 중 오류가 발생했습니다. (파라미터 누락)');
        return;
    }

    // 2. CSRF state 검증
    const savedState = sessionStorage.getItem('socialState');
    const isLinkMode = sessionStorage.getItem('socialLinkMode') === 'true';
    const socialMarketingAgreed = !isLinkMode && sessionStorage.getItem('socialMarketingAgreed') === 'true';
    sessionStorage.removeItem('socialState');
    sessionStorage.removeItem('socialLinkMode');
    sessionStorage.removeItem('socialMarketingAgreed');

    if (!savedState || savedState !== returnedState) {
        showError('보안 검증에 실패했습니다. 다시 시도해 주세요.');
        return;
    }

    // state 형식: {nonce}|{provider}[|{purpose}]
    // purpose를 state에 인코딩해 OAuth 리다이렉트 후에도 의도 보존
    const stateParts = savedState.split('|');
    if (stateParts.length < 2) {
        showError('인증 처리 중 오류가 발생했습니다. (state 오류)');
        return;
    }
    const provider = stateParts[1];
    const statePurpose = stateParts[2] || '';

    if (!['google', 'naver'].includes(provider)) {
        showError('지원하지 않는 로그인 방식입니다.');
        return;
    }
    const callbackUrl = CONFIG.social.callbackUrl;

    // 3. Lambda에 code 전달 → provider 토큰 교환 (purpose 포함)
    try {
        statusMsg.textContent = statePurpose === 'delete_reauth' ? '본인 확인 중입니다...' : '계정 정보를 확인하고 있습니다...';

        const res = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                type: 'social_callback',
                provider,
                code,
                redirectUri: callbackUrl,
                marketingAgreed: socialMarketingAgreed,
                ...(statePurpose && { purpose: statePurpose })
            })
        });

        let result;
        try {
            result = await res.json();
        } catch (jsonErr) {
            console.error('[SocialCallback] JSON parse error:', jsonErr, 'HTTP status:', res.status);
            showError(`인증 처리 중 오류가 발생했습니다. (응답 파싱 실패, HTTP ${res.status})`);
            return;
        }

        if (!res.ok) {
            console.error('[SocialCallback] Lambda error response:', { status: res.status, body: result });
            if (res.status === 409) {
                showError(result.error || '이미 동일 이메일로 가입된 계정이 있습니다. 기존 이메일/비밀번호로 로그인해 주세요.');
            } else {
                showError(result.error || `로그인 처리에 실패했습니다. (HTTP ${res.status})`);
            }
            return;
        }

        // 3-a. 탈퇴 재인증 응답 처리 (full login 없이 deleteConfirmToken만 발급)
        if (result.deleteReauthVerified && result.deleteConfirmToken) {
            sessionStorage.setItem('deleteConfirmToken', result.deleteConfirmToken);
            window.location.href = '/mypage?reauth=success&purpose=delete_account';
            return;
        }

        const { userId, isNewUser } = result;

        if (!userId) {
            showError('로그인 처리에 실패했습니다. (사용자 ID 누락)');
            return;
        }

        // 4. 연동 모드 + 새 계정 생성된 경우: 기존 세션 보관 후 확인
        if (isLinkMode && isNewUser) {
            const prevUserId = localStorage.getItem('userId');

            const confirmed = confirm(
                '연동하려는 소셜 계정의 이메일이 현재 계정과 달라\n새로운 별도 계정이 생성되었습니다.\n\n' +
                '새 계정으로 계속 진행하시겠습니까?\n(취소 시 기존 계정을 유지합니다)'
            );

            if (!confirmed) {
                if (prevUserId) localStorage.setItem('userId', prevUserId);
                window.location.href = '/mypage';
                return;
            }

            localStorage.setItem('userId', userId);
            localStorage.setItem('userRole', 'student');
            window.location.href = '/welcome';
            return;
        }

        // 5. 세션 갈아끼우기 — 이전 사용자 흔적 제거 후 새 토큰 set.
        //    backend social_callback 응답에 accessToken/idToken/refreshToken이 포함됨 (Set-Cookie와 별개로 명시).
        //    이걸 sessionStorage/메모리에 저장하지 않으면 Bearer 헤더 폴백이 stale 토큰을 그대로 사용 → 세션 뒤섞임 사고.
        if (typeof clearClientSession === 'function') {
            clearClientSession();
        } else if (typeof clearSharedClientSession === 'function') {
            clearSharedClientSession();
        }
        if (result.accessToken && typeof setAccessToken === 'function') {
            setAccessToken(result.accessToken);
        } else if (result.accessToken) {
            sessionStorage.setItem('accessToken', result.accessToken);
        }
        if (result.idToken && typeof setIdToken === 'function') {
            setIdToken(result.idToken);
        } else if (result.idToken) {
            sessionStorage.setItem('idToken', result.idToken);
        }
        if (result.refreshToken && typeof registerRefreshCookie === 'function') {
            // 백엔드가 이미 Set-Cookie로 rt 쿠키 set했지만, fallback localStorage refreshToken 정합성을 위해 호출
            try { await registerRefreshCookie(result.refreshToken); } catch (_) {}
        }
        localStorage.setItem('userId', userId);
        localStorage.setItem('userRole', 'student');

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'login', user_id: userId });

        // 6. 사용자 정보 조회 및 라우팅
        statusMsg.textContent = isLinkMode ? '연동 완료! 마이페이지로 이동 중...' : '로그인 완료! 이동 중입니다...';

        const userRes = await fetch(USER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(result.accessToken ? { Authorization: `Bearer ${result.accessToken}` } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ type: 'get_login_profile' })
        });

        if (userRes.ok) {
            const userData = await userRes.json();
            localStorage.setItem('userName', userData.name || '');
            if (userData.computedTier) localStorage.setItem('userTier', userData.computedTier);
        }

        // 마이페이지 연동 요청인 경우 마이페이지로 복귀
        if (isLinkMode) {
            window.location.href = '/mypage';
            return;
        }

        window.location.href = isNewUser ? '/welcome' : '/';

    } catch (e) {
        console.error('[SocialCallback] Unhandled error:', {
            name: e.name,
            message: e.message,
            stack: e.stack
        });
        // TypeError: Failed to fetch → CORS 또는 네트워크 문제
        // SyntaxError → Lambda가 JSON이 아닌 응답 반환
        const hint = e.name === 'TypeError' ? ' (네트워크/CORS 문제 의심)' : e.name === 'SyntaxError' ? ' (서버 응답 파싱 실패)' : '';
        showError(`인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.${hint}`);
    }
})();
