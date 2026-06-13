# src map

이 디렉토리는 `js/studycrack-mobile.js`를 기능 단위로 분리하기 위한 소스 영역입니다.

- `constants/`: asset path, mock data, 약관, 요금제, 대학 mock 데이터
- `state/`: localStorage, scroll, planner item normalization 유틸
- `components/`: 재사용 UI 조각. 공용 셸(AppBar/AppShell/TabBar/MascotBubble) + 공용 오버레이(Modal/Sheet) + 공유 조각(terms/grade-buttons/mbti modal)을 입력 주입형 순수 함수로 분리. 현재는 문자열 반환, literal JSX 전환은 Phase 7 빌드 이후.
- `screens/`: 화면별 renderer 또는 JSX component. 초기에는 원본 문자열 renderer를 module 함수로 분리합니다.
- `handlers/`: `data-action` 이벤트 처리와 모바일 앱 handler group 조립
- `styles/`: 앱 전용 CSS 원본. `design-v2.css`(원본 런타임 인라인 `designV2StyleTag`에서 추출한 V2 재디자인 스타일)는 `runtime/main.js`가 import해 빌드 번들에 주입됨
- `app/`: screen registry와 모바일 앱 kernel 조립

초기 단계에서는 런타임 파일을 바로 대체하지 않고, 원본과 동일한 의미의 데이터를 이곳에 먼저 분리합니다.
