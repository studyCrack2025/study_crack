// js/social-callback.js
// 소셜 OAuth 콜백 페이지 전용 처리 스크립트

(async function() {
    const AUTH_URL = CONFIG.api.auth;
    const USER_API_URL = CONFIG.api.user;
    const statusMsg = document.getElementById('statusMsg');

    function showError(msg) {
        statusMsg.innerHTML = `<span style="color:#dc2626;">${msg}</span><br><br><a href="/login" style="color:#2563eb;">로그인 페이지로 돌아가기</a>`;
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
    sessionStorage.removeItem('socialState');

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
    const callbackUrl = CONFIG.social.callbackUrl;

    // 3. Lambda에 code 전달 → provider 토큰 교환 + Cognito 토큰 발급
    try {
        statusMsg.textContent = '계정 정보를 확인하고 있습니다...';

        const res = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'social_callback',
                provider,
                code,
                redirectUri: callbackUrl
            })
        });

        const result = await res.json();

        if (!res.ok) {
            // 이메일 충돌
            if (res.status === 409) {
                showError(result.error || '이미 동일 이메일로 가입된 계정이 있습니다.<br>기존 이메일/비밀번호로 로그인해 주세요.');
            } else {
                showError(result.error || '로그인 처리에 실패했습니다. 다시 시도해 주세요.');
            }
            return;
        }

        const { accessToken, idToken, userId, isNewUser } = result;

        if (!accessToken || !idToken || !userId) {
            showError('로그인 처리에 실패했습니다. (토큰 오류)');
            return;
        }

        // 4. 토큰 저장
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('idToken', idToken);
        localStorage.setItem('userId', userId);
        localStorage.setItem('userRole', 'student');

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'login', user_id: userId });

        // 5. 사용자 정보 조회 및 라우팅
        statusMsg.textContent = '로그인 완료! 이동 중입니다...';

        const userRes = await fetch(USER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ type: 'get_user' })
        });

        if (userRes.ok) {
            const userData = await userRes.json();
            localStorage.setItem('userName', userData.name || '');
            if (userData.computedTier) localStorage.setItem('userTier', userData.computedTier);

            if (isNewUser) {
                window.location.href = '/welcome';
            } else {
                window.location.href = '/';
            }
        } else {
            // 신규 소셜 유저 → 웰컴 페이지로
            window.location.href = '/welcome';
        }

    } catch (e) {
        console.error('Social callback error:', e);
        showError('인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
})();
