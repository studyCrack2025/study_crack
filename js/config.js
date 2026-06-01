// js/config.js

// 1. 현재 접속한 도메인을 확인하여 환경을 판단
const currentDomain = window.location.hostname;
const IS_LOCAL = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
const IS_DEV   = !IS_LOCAL && (currentDomain.includes('cloudfront.net') || currentDomain.includes('dev.studycrack.co.kr'));

// 2. 환경에 따라 API 베이스 URL 결정 (스테이지 분리 상세: docs/security/architecture-notes.md §1)
const API_GATEWAY_BASE_URL = "https://ft35jsftc1.execute-api.ap-northeast-2.amazonaws.com";
const API_BASE = IS_LOCAL
    ? `${API_GATEWAY_BASE_URL}/local`
    : IS_DEV
        ? "https://api.dev.studycrack.co.kr"
        : "https://api.studycrack.co.kr";

const CONFIG = {
    api: {
        user:           `${API_BASE}/api/user`,
        admin:          `${API_BASE}/api/admin`,
        file:           `${API_BASE}/api/file`,
        noti:           `${API_BASE}/api/noti`,
        qna:            `${API_BASE}/api/qna`,
        report:         `${API_BASE}/api/report`,
        analysis:       `${API_BASE}/api/analysis`,
        payment:        `${API_BASE}/api/payment`,
        auth:           `${API_BASE}/api/auth`,
        payment_return: `${API_BASE}/api/payment-return`,
        payment_notify: `${API_BASE}/api/payment-notify`,
        pdf:            `${API_BASE}/api/generate-pdf`
    },

    // NicePay 가맹점 ID (공개 식별자). 상세: docs/security/architecture-notes.md §2
    nicepay: {
        clientId: (IS_LOCAL || IS_DEV)
            ? 'R2_3989842eefe74b4490031691658710a6'
            : 'R2_9ff3f8dde7ae45a1b84b6c0ab9ca6ea9'
    },

    // Cognito 설정
    cognito: {
        userPoolId: 'ap-northeast-2_00mP8t8UM',
        clientId: '2lovlq38kvgn2dckppn91iqq2l',
        domain: ''
    },

    // 소셜 로그인 설정
    social: {
        callbackUrl: IS_LOCAL
            ? `http://${currentDomain}:3000/social-callback`
            : `https://${currentDomain}/social-callback`,

        google: { clientId: '943531531983-smammosbmt2netc1uu06bspf4553ucnj.apps.googleusercontent.com' },
        naver:  { clientId: 'qzuULTydirmJNXlXhnVQ' }
    }
};
