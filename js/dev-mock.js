// 로컬 디자인 테스트용 mock 진입점
// 이 파일은 항상 disabled 상태로 커밋됩니다.
//
// 로컬 테스트를 하려면:
//   js/dev-mock.local.js 파일을 생성하세요 (템플릿: dev-mock.local.example.js)
//   dev-mock.local.js 는 .gitignore 처리되어 절대 커밋/배포되지 않습니다.
window.DEV_MOCK = { enabled: false };

// localhost 환경에서만 dev-mock.local.js 동적 로드 (프로덕션에서는 요청 자체 안 함)
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    var _s = document.createElement('script');
    _s.src = '/js/dev-mock.local.js';
    document.head.appendChild(_s);
}
