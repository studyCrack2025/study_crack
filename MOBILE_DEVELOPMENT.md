# StudyCrack Mobile Development

이 문서는 공개 저장소에서 모바일 프론트엔드를 안전하게 개발하고 검증하기 위한 최소 가이드입니다. 운영 인프라, 비밀값, 내부 계정, 데이터 저장소 식별자와 인증 구현 상세는 포함하지 않습니다.

## Requirements

- Node.js 20 이상
- npm
- Chromium 기반 브라우저

## Quick Start

```bash
cd studycrack-mobile-app
npm ci
npm run dev
```

로컬 서버가 안내하는 주소에서 앱을 확인합니다. 실제 계정과 원격 API를 사용하는 인증 검증은 승인된 개발 환경에서만 수행합니다.

## Required Checks

변경을 제출하기 전에 아래 검사를 모두 실행합니다.

```bash
cd studycrack-mobile-app
npm run check
npm run build
npm run test:e2e
cd ..
node tools/audit_css_duplicates.mjs
git diff --check
```

`npm run check`는 화면·상태·API·CSS 소유권과 dead code를 함께 검사합니다. 배포 workflow도 check, build, 핵심 브라우저 흐름을 통과해야 다음 단계로 진행됩니다.

## Source Layout

```text
studycrack-mobile-app/src/
  app/          앱 조립, 화면 registry, 접근 정책
  features/     계정, 분석, 코칭, 알림, 플래너, 리포트, 세션, 문의
  screens/      화면별 React 컴포넌트와 presentation
  components/   여러 화면에서 재사용하는 UI
  shared/       API transport, 모델 계약, 브라우저 유틸리티
  runtime/      진입점과 최소 호환 조립
  styles/       foundation, components, screens 단위 CSS
```

## Dependency Rules

1. 화면은 필요한 상태와 action만 전달받습니다.
2. 기능별 API, 상태와 effect는 해당 `features/<domain>/`이 소유합니다.
3. 공통 transport와 모델 검증은 `shared/`에 둡니다.
4. 기능 모듈은 다른 기능의 화면 구현을 직접 import하지 않습니다.
5. `runtime/main.js`는 앱 조립만 담당하며 도메인 로직을 소유하지 않습니다.
6. CSS selector는 하나의 소유 파일에서만 선언합니다. 하단 override로 같은 selector를 재선언하지 않습니다.
7. 고정 entry와 로그인 후 지연 chunk의 import 소유권을 중복시키지 않습니다.

## API Result Contract

화면에 전달되는 API 결과는 다음 공통 형태를 사용합니다.

```js
// success
{ ok: true, data, error: '', status, code }

// failure
{ ok: false, data: null, error, status, code }
```

- 성공 응답도 화면에 전달하기 전에 도메인 모델로 검증합니다.
- 올바르지 않은 성공 응답은 `INVALID_RESPONSE` 실패로 정규화합니다.
- 인증 만료, 사용 취소와 일반 오류는 서로 다른 상태로 처리합니다.
- 화면은 raw transport 예외 대신 공통 결과를 기준으로 loading, empty, stale, error 상태를 표현합니다.

## CSS Ownership

- `styles/foundation/`: token, reset, typography, motion
- `styles/components/`: 여러 화면이 공유하는 primitive와 overlay
- `styles/screens/`: 화면 또는 기능 전용 selector
- `css/studycrack-mobile.css`: 번들 로딩 전 fallback shell 전용

CSS를 수정할 때는 기존 selector의 소유 파일을 먼저 찾고 그 규칙을 직접 수정합니다. 새 selector를 추가했다면 CSS 중복 감사와 작은 화면의 수평 overflow를 함께 확인합니다.

## Browser Verification

최소 확인 폭은 320, 360, 390, 430px입니다. 각 폭에서 다음을 확인합니다.

- 로그인과 회원가입
- 홈 최초 데이터 로딩
- 분석 기준 변경
- 플래너 입력과 저장
- 알림, 문의와 보조 화면
- modal, sheet, 키보드 열린 상태
- 수평 overflow와 하단 navigation 겹침

인증 계층 변경은 로컬 검사만으로 완료하지 않습니다. 승인된 개발 환경에서 로그인, 새로고침, 새 탭, 로그아웃 전체 흐름을 확인해야 합니다.

## Public Documentation Rule

공개 코드와 문서에는 비밀값, 운영 리소스 이름, 인증 내부 단계, 결제 검증 상세와 사업 알고리즘을 기록하지 않습니다. 보안상 필요한 구현 설명은 사용자 보호 목적과 공개 가능한 계약 수준으로만 작성합니다.
