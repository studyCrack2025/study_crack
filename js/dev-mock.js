// 로컬 디자인 테스트용 mock 진입점
// 이 파일은 항상 disabled 상태로 커밋됩니다.
//
// 로컬 테스트를 하려면:
//   1. js/dev-mock.local.js 파일을 생성 (템플릿: dev-mock.local.example.js)
//   2. DevTools 콘솔에서 localStorage.setItem('use_dev_mock','1') 후 새로고침
//   비활성화: localStorage.removeItem('use_dev_mock')
//   dev-mock.local.js 는 .gitignore 처리되어 절대 커밋/배포되지 않습니다.
window.DEV_MOCK = { enabled: false };

// localhost 환경 + opt-in 플래그가 켜진 경우에만 dev-mock.local.js 동적 로드.
// (자동 로드 시 파일 부재로 404 콘솔 노이즈가 발생했던 문제를 opt-in 방식으로 해소)
if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    && localStorage.getItem('use_dev_mock') === '1') {
    var _s = document.createElement('script');
    _s.src = '/js/dev-mock.local.js';
    document.head.appendChild(_s);
}
