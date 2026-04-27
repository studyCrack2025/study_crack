// js/config.js

// 1. 현재 접속한 도메인을 확인하여 개발(Dev) 환경인지 운영(Prod) 환경인지 판단
const currentDomain = window.location.hostname;
const IS_DEV = currentDomain.includes('cloudfront.net') || currentDomain.includes('dev.studycrack.co.kr') || currentDomain === 'localhost' || currentDomain === '127.0.0.1';

// 2. 환경에 따라 API Gateway 기본 주소에 스테이지(/dev 또는 /prod)를 자동으로 붙여줍니다.
const API_BASE_URL = "https://ft35jsftc1.execute-api.ap-northeast-2.amazonaws.com";
const GATEWAY_URL = IS_DEV ? `${API_BASE_URL}/dev` : `${API_BASE_URL}/prod`;

const CONFIG = {
    // API 경로 설정 (환경별로 자동 설정된 GATEWAY_URL 적용)
    api: {        
        // 유저 전용 엔드포인트
        user: `${GATEWAY_URL}/api/user`,
        
        // 관리자/튜터 전용 엔드포인트
        admin: `${GATEWAY_URL}/api/admin`,
        
        // 파일 서비스 전용 엔드포인트
        file: `${GATEWAY_URL}/api/file`,
        
        // 알림 전용 엔드포인트
        noti: `${GATEWAY_URL}/api/noti`,
        
        // Qna 전용 엔드포인트
        qna: `${GATEWAY_URL}/api/qna`,
        
        // 리포트 전용 엔드포인트
        report: `${GATEWAY_URL}/api/report`,
        
        // StudyCrack_Analysis 람다로 연결되는 주소
        analysis: `${GATEWAY_URL}/analysis`,
        
        // StudyCrack_Payment 람다로 연결되는 주소
        payment: `${GATEWAY_URL}/payment`,
        
        // StudyCrack_Auth 람다로 연결되는 주소
        auth: `${GATEWAY_URL}/auth`,

        // NicePay returnUrl 콜백
        payment_return: `${GATEWAY_URL}/payment-return`,
        
        // pdf 생성 관련 백엔드
        pdf: `${GATEWAY_URL}/generate-pdf`
    },

    // NicePay 설정
    nicepay: {
        clientId: 'R2_9ff3f8dde7ae45a1b84b6c0ab9ca6ea9'
    },
    
    // 기존 Cognito 설정
    cognito: {
        userPoolId: 'ap-northeast-2_00mP8t8UM',
        clientId: '2lovlq38kvgn2dckppn91iqq2l',
        // AWS 콘솔 > Cognito > App integration > Domain 에서 설정한 도메인을 입력하세요.
        // 예: 'studycrack.auth.ap-northeast-2.amazoncognito.com'
        domain: '' // TODO: Cognito 도메인 설정 필요
    },

    // 소셜 로그인 설정
    social: {
        // 환경별 콜백 URL — 현재 도메인을 그대로 사용하므로 별도 분기 불필요
        // Provider OAuth 앱에 아래 URI 모두 등록 필요:
        //   https://studycrack.co.kr/social-callback
        //   https://dev.studycrack.co.kr/social-callback
        //   http://localhost:3000/social-callback
        callbackUrl: (currentDomain === 'localhost' || currentDomain === '127.0.0.1')
            ? `http://${currentDomain}:3000/social-callback`
            : `https://${currentDomain}/social-callback`,

        // Google OAuth 2.0 Client ID (공개값 — Client Secret은 Lambda 환경변수에만 보관)
        // Naver Client ID (공개값)
        // Kakao REST API Key (공개값 — JavaScript Key 아님)
        google: { clientId: '943531531983-smammosbmt2netc1uu06bspf4553ucnj.apps.googleusercontent.com' },
        naver:  { clientId: 'qzuULTydirmJNXlXhnVQ' },
        kakao:  { clientId: 'fae387832b86d1a8ebe95712ea8b404b' }
    }
};