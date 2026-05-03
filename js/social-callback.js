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
    const isReauthMode = sessionStorage.getItem('socialReauthMode') === 'true';
    const reauthPurpose = sessionStorage.getItem('socialReauthPurpose') || '';
    sessionStorage.removeItem('socialState');
    sessionStorage.removeItem('socialLinkMode');
    sessionStorage.removeItem('socialReauthMode');
    sessionStorage.removeItem('socialReauthPurpose');

    if (!savedState || savedState !== returnedState) {
        showError('보안 검증에 실패했습니다. 다시 시도해 주세요.');
        return;
    }

    // state 형식: {nonce}|{provider}
    const providerMatch = savedState.match(/\|([a-z]+)$/);
    if (!providerMatch) {
        showError('인증 처리 중 오류가 발생했습니다. (provider 오류)');
        return;
    }
    const provider = providerMatch[1];
    if (!['google', 'naver'].includes(provider)) {
        showError('지원하지 않는 로그인 방식입니다.');
        return;
    }
    const callbackUrl = CONFIG.social.callbackUrl;

    // 3-a. 재인증 모드: 기존 세션 유지, 소셜 계정 본인 확인만 수행
    if (isReauthMode) {
        try {
            statusMsg.textContent = '본인 확인 중입니다...';
            const currentAccessToken = getAccessToken();
            if (!currentAccessToken) {
                showError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
                return;
            }
            const reauthRes = await fetch(AUTH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentAccessToken}` },
                body: JSON.stringify({ type: 'reauth_social', provider, code, redirectUri: callbackUrl })
            });
            const reauthResult = await reauthRes.json();
            if (!reauthRes.ok || !reauthResult.verified) {
                showError(reauthResult.error || '본인 확인에 실패했습니다. 다시 시도해 주세요.');
                return;
            }
            window.location.href = `/mypage?reauth=success&purpose=${encodeURIComponent(reauthPurpose)}`;
        } catch (e) {
            console.error('[SocialCallback] Reauth error:', e);
            showError('본인 확인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        }
        return;
    }

    // 3. Lambda에 code 전달 → provider 토큰 교환 + Cognito 토큰 발급
    try {
        statusMsg.textContent = '계정 정보를 확인하고 있습니다...';

        const res = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                type: 'social_callback',
                provider,
                code,
                redirectUri: callbackUrl
            })
        });

        const result = await res.json();

        if (!res.ok) {
            if (res.status === 409) {
                showError(result.error || '이미 동일 이메일로 가입된 계정이 있습니다. 기존 이메일/비밀번호로 로그인해 주세요.');
            } else {
                showError(result.error || '로그인 처리에 실패했습니다. 다시 시도해 주세요.');
            }
            console.error('[SocialCallback] Lambda error:', res.status, result);
            return;
        }

        const { accessToken, idToken, userId, isNewUser } = result;

        if (!accessToken || !idToken || !userId) {
            showError('로그인 처리에 실패했습니다. (토큰 오류)');
            return;
        }

        // 4. 연동 모드 + 새 계정 생성된 경우: 기존 세션 보관 후 확인
        if (isLinkMode && isNewUser) {
            const prevAccessToken = getAccessToken();
            const prevIdToken    = localStorage.getItem('idToken');
            const prevUserId     = localStorage.getItem('userId');

            const confirmed = confirm(
                '연동하려는 소셜 계정의 이메일이 현재 계정과 달라\n새로운 별도 계정이 생성되었습니다.\n\n' +
                '새 계정으로 계속 진행하시겠습니까?\n(취소 시 기존 계정을 유지합니다)'
            );

            if (!confirmed) {
                // 기존 세션 복원 후 마이페이지로 복귀
                if (prevAccessToken) setAccessToken(prevAccessToken);
                if (prevIdToken)    localStorage.setItem('idToken', prevIdToken);
                if (prevUserId)     localStorage.setItem('userId', prevUserId);
                window.location.href = '/mypage';
                return;
            }

            // 확인 → 새 계정 토큰으로 교체 후 welcome으로
            setAccessToken(accessToken);
            localStorage.setItem('idToken', idToken);
            localStorage.setItem('userId', userId);
            localStorage.setItem('userRole', 'student');
            window.location.href = '/welcome';
            return;
        }

        // 5. 토큰 저장
        setAccessToken(accessToken);
        localStorage.setItem('idToken', idToken);
        localStorage.setItem('userId', userId);
        localStorage.setItem('userRole', 'student');
        if (result.refreshToken) localStorage.setItem('refreshToken', result.refreshToken);

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'login', user_id: userId });

        // 6. 사용자 정보 조회 및 라우팅
        statusMsg.textContent = isLinkMode ? '연동 완료! 마이페이지로 이동 중...' : '로그인 완료! 이동 중입니다...';

        const userRes = await fetch(USER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ type: 'get_user' })
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
        console.error('[SocialCallback] Error:', e);
        showError('인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
})();
