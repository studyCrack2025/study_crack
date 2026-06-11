# src map

이 디렉토리는 `js/studycrack-mobile.js`를 기능 단위로 분리하기 위한 소스 영역입니다.

- `constants/`: asset path, mock data, 약관, 요금제, 대학 mock 데이터
- `state/`: localStorage, scroll, app state 초기화 유틸
- `components/`: 재사용 UI 조각
- `screens/`: 화면별 renderer 또는 JSX component
- `handlers/`: `data-action` 이벤트 처리
- `styles/`: 앱 전용 CSS 원본

초기 단계에서는 런타임 파일을 바로 대체하지 않고, 원본과 동일한 의미의 데이터를 이곳에 먼저 분리합니다.
