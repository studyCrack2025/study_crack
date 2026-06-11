# studycrack-mobile-app

`studycrack-mobile.html` 모바일 앱 초안을 모듈화하기 위한 앱 전용 소스 루트입니다.

현재 프로덕션/정적 런타임은 아직 루트의 아래 파일을 사용합니다.

- `studycrack-mobile.html`
- `js/studycrack-mobile.js`
- `css/studycrack-mobile.css`

이 폴더는 위 단일 파일 구조를 단계적으로 분리하기 위한 준비 공간입니다. 기존 웹 프론트와 충돌하지 않도록 앱 전용 코드만 둡니다.

## Migration Order

1. constants/mock data 분리
2. storage/state 유틸 분리
3. 화면 renderer 분리
4. event handler 분리
5. JSX component 전환
6. Vite/React 빌드 전환

각 단계는 `docs/exec-plans/active/260611_studycrack_mobile_app_modularization.md`를 기준으로 진행합니다.

## Current Status

- Phase 0: 앱 소스 골격 생성 완료
- Phase 1: constants/mock data 분리 완료
- Phase 2: storage/state 유틸 분리 완료
- Phase 3: onboarding/auth/home/mypage-settings renderer 분리 진행 중
