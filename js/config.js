// js/config.js (설정 파일 분리)

// 통합 API Gateway 주소
const GATEWAY_URL = "https://ft35jsftc1.execute-api.ap-northeast-2.amazonaws.com";

const CONFIG = {
    // API 경로 설정 (Gateway 하나로 통합됨)
    api: {
        // StudyCrack_API 람다로 연결되는 주소
        base: `${GATEWAY_URL}/api`,        
        
        // StudyCrack_Analysis 람다로 연결되는 주소
        analysis: `${GATEWAY_URL}/analysis` 
    },
    
    // 기존 Cognito 설정
    cognito: {
        userPoolId: 'ap-northeast-2_00mP8t8UM', 
        clientId: '2lovlq38kvgn2dckppn91iqq2l'  
    }
};