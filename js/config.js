// js/config.js

const currentDomain = window.location.hostname;
const IS_LOCAL = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
const IS_DEV   = !IS_LOCAL && (currentDomain.includes('cloudfront.net') || currentDomain.includes('dev.studycrack.co.kr'));

const API_BASE_OVERRIDE = typeof window.STUDYCRACK_API_BASE_URL === 'string' ? window.STUDYCRACK_API_BASE_URL.trim() : '';
const LOCAL_API_BASE = "https://ft35jsftc1.execute-api.ap-northeast-2.amazonaws.com/local";
const API_BASE = API_BASE_OVERRIDE || (IS_LOCAL
    ? LOCAL_API_BASE
    : IS_DEV
        ? "https://api.dev.studycrack.co.kr"
        : "https://api.studycrack.co.kr");

const CONFIG = {
    clientDiagnostics: { enabled: false, sampleRate: 0.1 },
    api: {
        user:           `${API_BASE}/api/user`,
        admin:          `${API_BASE}/api/admin`,
        file:           `${API_BASE}/api/file`,
        noti:           `${API_BASE}/api/noti`,
        qna:            `${API_BASE}/api/qna`,
        report:         `${API_BASE}/api/report`,
        game:           `${API_BASE}/api/game`,
        analysis:       `${API_BASE}/api/analysis`,
        payment:        `${API_BASE}/api/payment`,
        auth:           `${API_BASE}/api/auth`,
        payment_return: `${API_BASE}/api/payment-return`,
        payment_notify: `${API_BASE}/api/payment-notify`,
        pdf:            `${API_BASE}/api/generate-pdf`
    },

    // Browser public identifier.
    nicepay: {
        clientId: (IS_LOCAL || IS_DEV)
            ? 'R2_3989842eefe74b4490031691658710a6'
            : 'R2_9ff3f8dde7ae45a1b84b6c0ab9ca6ea9'
    },

    // Browser public identifiers.
    cognito: {
        userPoolId: 'ap-northeast-2_00mP8t8UM',
        clientId: '2lovlq38kvgn2dckppn91iqq2l',
        domain: ''
    },

    // Browser public OAuth identifiers.
    social: {
        callbackUrl: IS_LOCAL
            ? `http://${currentDomain}:3000/social-callback`
            : `https://${currentDomain}/social-callback`,

        google: { clientId: '943531531983-smammosbmt2netc1uu06bspf4553ucnj.apps.googleusercontent.com' },
        naver:  { clientId: 'qzuULTydirmJNXlXhnVQ' }
    }
};

window.CONFIG = CONFIG;
