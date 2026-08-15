# 모바일 CTO 전달본 최종 구현 로드맵

- 작성일: 2026-08-15
- 상태: CMP-08·G2 완료 / G3 구현 대기
- 상위 계획: `260815_mobile_cto_handoff_crosswalk.md`
- 입력 문서: reference inventory, interaction matrix, screen crosswalk, API·data crosswalk, visual crosswalk, gap·risk register
- 구현 대상: `studycrack-mobile-app`
- 기본 배포: GitHub Actions 정적 배포
- 기본 backend 영향: 없음

## 1. 목적

CTO 전달본 코드와 공개 데모를 **프론트 외관의 기준본**으로 삼아 화면 구성과 시각 표현을 거의 동일하게 재구현하고, 그 안에 현재 StudyCrack 모바일 앱의 실제 인증, 공부, 게임, 분석, 플랜, 결제와 운영 기능을 보존·보완해 연결한다. 이 문서는 구현자가 별도 재해석 없이 다음을 알 수 있는 최종 작업 지도다.

1. 어느 순서로 변경할지
2. 각 단계에서 어느 파일을 수정할지
3. 어느 state·API·backend 계약을 보존할지
4. 어떤 자동 검사와 실사용 흐름을 통과해야 끝나는지
5. 어떤 단위로 배포하고 실패 시 어떻게 되돌릴지

### 1.1 시각적 기준 우선순위

- 제공된 CTO 코드와 `https://studycrack-hbaxyjhe.manus.space` 데모가 시각적 source of truth다.
- 현재 앱은 기능·상태·API 계약의 source of truth이며, 현재 외관은 보존 대상이 아니다.
- 전달본과 현재 외관이 충돌하면 기능 계약을 유지한 상태에서 전달본의 화면 구성·밀도·색감·motion을 우선한다.
- 기존 component DOM이 전달본 구성을 방해하면 component를 재조합하거나 다시 작성할 수 있다. 기존 화면에 색상 token만 덧씌우는 수준으로 완료 처리하지 않는다.
- 전달본에 없는 현재 기능은 기존 모습으로 남기지 않고 전달본의 card, row, sheet, hierarchy와 같은 시각 문법으로 확장한다.
- 390x844를 시각적 golden viewport로 사용한다. 이 크기에서는 reference와 나란히 비교해 주요 geometry와 composition 차이가 없어야 한다.
- 320·360·430px에서는 같은 디자인을 유동적으로 재배치하되 font 확대, 가로 잘림, card 비율 붕괴를 허용하지 않는다.

### 1.2 시각적 합격 기준

1. page header, section 순서, card hierarchy, primary CTA 위치가 reference와 대응한다.
2. card width·padding·radius·border·shadow, type size·weight·line-height와 색상 역할이 reference와 대응한다.
3. bottom navigation, active state, modal·sheet·drawer와 loading·empty·locked·success 상태가 reference의 표현 방식을 따른다.
4. 현재 앱의 과거 신문형 plan card, 과대 typography, 서로 다른 tab별 margin, legacy blue card가 남아 있지 않는다.
5. 390x844 screenshot을 reference와 side-by-side 및 반투명 overlay로 비교해 의미 있는 위치·크기·색감 불일치가 없어야 한다.
6. 화면이 기능적으로 동작하더라도 시각적 parity를 충족하지 못하면 해당 단계는 미완료다.

허용되는 차이는 다음 네 가지뿐이다.

- StudyCrack의 현재 공식 logo·크랙이·물고기 asset 사용
- mock 대신 현재 API의 실제 데이터·상태·플랜 권한 사용
- WCAG 대비, focus, touch target과 reduced-motion 보정
- 320~430px 실제 모바일 viewport를 위한 반응형 재배치

## 2. 최종 구현 원칙

1. 전달본의 기술 stack을 덮어쓰지는 않지만, 화면 composition과 외관은 전달본을 우선해 재구현한다.
2. React 18, Vite 5, JavaScript와 modular CSS 구조는 구현 수단으로 유지한다.
3. 현재 화면 DOM과 CSS 모양 자체에는 호환성을 부여하지 않는다. 실제 기능·상태·API만 보존한다.
4. 공식 StudyCrack 로고, 현재 크랙이와 물고기 asset을 사용한다.
5. 합격확률을 만들지 않고 같은 시각적 위치에 실제 환산점수를 사용한다.
6. 공부시간·보상·물고기·구독은 서버 확정값만 표시한다.
7. 인증·결제·약관·플랜 권한은 현재 계약을 유지한다.
8. 공통 스타일은 components가, 화면 배치는 screens CSS가 소유한다.
9. 기존 selector를 직접 수정하며 하단 override를 추가하지 않는다.
10. 한 단계에서 시각 변경과 API 계약 변경을 섞지 않는다.
11. 각 단계는 구현, reference parity, 검사, 캡처, dev 확인과 문서 갱신까지 끝낸 뒤 다음 단계로 이동한다.

## 3. 구현 전 기준선

G0 첫 수정 전에 아래 기준을 남긴다.

### 3.1 코드 기준

- 현재 branch와 commit SHA
- `git status --short`
- 42개 screen registry
- bootstrap CSS 14개, deferred CSS 23개
- architecture baseline 출력
- CSS duplicate·dead selector·ownership·color contract 결과
- production bundle 파일별 크기

### 3.2 화면 기준

다음 viewport에서 주요 화면의 ready·loading·empty·error·locked 상태를 캡처한다.

- 320x700
- 360x800
- 390x844
- 430x932

기준 화면:

- splash, authLogin, authSignup, auth recovery
- timer, planner, aquarium, analysis, strategy
- ranking, scoreInfo, lockedFeature, proIntro, payment
- my, accountInfo, notificationList, customerSupport

### 3.3 기준 명령

```bash
cd studycrack-mobile-app
npm run check
npm run build
npm run test:e2e
npm run baseline
```

저장소 루트에서는 `node tools/audit_css_duplicates.mjs`와 `git diff --check`를 실행한다.

## 4. 변경 묶음 원칙

- G0~G8은 각각 독립 검토·rollback 가능한 변경 묶음으로 유지한다.
- 한 묶음이 실패한 상태에서 다음 묶음으로 넘어가지 않는다.
- 화면 파일과 해당 소유 CSS, presentation, 계약 검사만 함께 변경한다.
- feature `api.js`, handler와 backend는 기능 결함이 재현되지 않는 한 읽기 전용으로 취급한다.
- 실제 계약 결함이 발견되면 현재 묶음을 멈추고 원인·payload·Lambda·DB 영향을 별도 소계획으로 작성한다.
- backend 변경이 생기면 프론트 배포와 섞지 않고 Lambda 재배포 필요 여부를 명시한다.

## 5. G0 Foundation

### 5.1 목표

전달본의 trust blue, 학습 aqua, reward gold, compact typography, card density와 낮은 shadow를 현재 token·primitive에 정확히 적용한다. G0은 단순 palette 참고가 아니라 이후 모든 화면이 reference와 같은 외관을 만들 수 있도록 foundation 값을 맞추는 단계다. 화면별 composition은 아직 조정하지 않는다.

### 5.2 수정 예정 파일

- `src/styles/foundation/tokens.css`
- `src/styles/foundation/base.css`
- `src/styles/foundation/shell.css`
- `src/styles/components/primitives.css`
- `src/constants/assets.js`는 official asset mapping 확인이 필요할 때만 수정
- `scripts/check-color-contracts.mjs`
- 필요 시 color·UI contract fixture

### 5.3 보호 경계

- `.app-frame`의 최대 430px와 `100dvh` 유지
- input font 16px 유지
- bootstrap/deferred CSS import 순서 유지
- provider·과목·랭킹 고유색 token 유지
- API, state, routing 변경 금지

### 5.4 작업 순서

1. canvas·ink·line·surface token
2. trust blue·aqua·gold·alert·rare role token
3. normal·raised·overlay shadow
4. display·title·section·body·caption type scale
5. card·CTA·input·chip·empty·progress primitive
6. AA pair와 color literal contract 갱신

### 5.5 완료 조건

- foundation 외 신규 hex·rgb·oklch 0건
- 작은 text AA 4.5:1 이상
- 320px에서 button·input text 잘림 0건
- CSS duplicate·important 증가 0건
- 전체 check/build/e2e 통과

### 5.6 배포·rollback

- 정적 배포만 필요
- token 변경을 한 번에 되돌릴 수 있도록 G0 단독 묶음 유지
- 전 화면 시각 diff가 과도하면 화면별 override가 아니라 token 값을 조정

### 5.7 구현 결과 (2026-08-15)

- 전달본의 trust blue `#0A56B2`, aqua `#22B6A8`, gold `#F0B64D`, canvas `#F7F9FC`와 ink·line·surface 체계를 foundation token에 반영했다.
- display/title/section/body/caption을 `22/18/16/13/11px`로 조밀화하고 input은 iOS 확대 방지를 위해 16px을 유지했다.
- card는 16px radius와 낮은 shadow, CTA는 48px·800 weight·press `.98`, progress는 500ms transition을 공통 primitive에 반영했다.
- 색상 계약을 16개 role token과 9개 AA pair로 갱신했으며 screen·component color literal은 0건을 유지했다.
- 390x844 온보딩·로그인 화면을 직접 확인하고 320x700에서 document·button·input 가로 overflow 0건을 확인했다.
- 수조 회귀 중 발견한 `FishSprite`의 개체 ID/종류 ID class 혼용을 분리해 종류별 시각 계약을 복구했다.
- `npm run check`, `npm run build`, CSS duplicate audit, `git diff --check`, 15개 Playwright E2E가 통과했다.
- backend, API Gateway, DynamoDB 변경은 없다. G1 공통 Shell·Navigation·Overlay 구현도 완료했으며 다음 작업은 G2 인증·가입·Onboarding이다.

## 6. G1 공통 Shell·Navigation·Overlay

### 6.1 목표

모든 화면의 header, navigation, modal, sheet, drawer, motion과 safe area를 하나의 공통 체계로 맞춘다.

### 6.2 수정 예정 파일

Components:

- `src/components/AppContextHeader.jsx`
- `src/components/AppScreenShell.jsx`
- `src/components/SecondaryScreen.jsx`
- `src/components/TabBar.jsx`
- `src/components/Modal.jsx`
- `src/components/Sheet.jsx`
- `src/components/TermsModal.jsx`
- `src/screens/mypage/ProfileDrawer.jsx`

CSS:

- `src/styles/components/context-header.css`
- `src/styles/components/navigation.css`
- `src/styles/components/modals.css`
- `src/styles/components/sheets.css`
- `src/styles/components/drawers.css`
- `src/styles/components/secondary.css`
- `src/styles/foundation/motion.css`

Contracts:

- `scripts/check-ui-contracts.mjs`
- `scripts/check-overlay-contracts.mjs`
- `scripts/check-interaction-contracts.mjs`
- `scripts/check-css-ownership.mjs`

### 6.3 핵심 구현

- compact context header 위계
- 72px stable bottom navigation
- 중앙 수조 elevated action, layout shift 없는 transform
- 일반 modal 중앙 정렬과 최대 84dvh
- bottom sheet 최대 92dvh, safe area와 keyboard 대응
- full-height profile drawer
- 공통 focus trap·focus restore·accessible name
- screen mount와 실제 navigation에서만 reveal
- reduced motion에서 particle·stagger 제거

### 6.4 보호 경계

- 탭 순서 `timer/planner/aquarium/analysis/strategy`
- locked screen에서도 navigation 유지
- overlay boolean과 소유 화면을 임의 통합하지 않음
- screen 전환·API refresh 때 전체 재animation 금지
- `overlay-state.js`는 상태 결함이 확인될 때만 별도 변경

### 6.5 완료 조건

- 5개 주 탭 active 상태 정확
- modal·sheet·drawer가 navigation과 겹치지 않음
- keyboard-open에서 CTA 접근 가능
- focus 이동·복원과 back/Escape 통과
- 4 viewport overlay 캡처 통과
- 390x844에서 reference navigation·overlay와 side-by-side parity 통과

### 6.6 구현 결과

- 5개 탭의 순서와 권한별 노출 계약을 유지하고 72px stable navigation, 일반 active surface, 중앙 48px elevated 수조 action을 적용했다.
- `Modal`, `Sheet`, profile/home drawer가 공통 `useOverlayDialog`를 통해 accessible name, focus trap, 최초 focus, Escape 닫기와 focus restore를 사용한다.
- 브라우저 DOM 접근은 `shared/browser/overlay-focus.js`로 격리하고 app assembly 경계를 유지했다.
- sheet handle·92dvh·safe area, modal 중앙·84dvh, full-height drawer와 overlay layer를 단일 소유 파일에서 관리한다.
- 인증 복구 modal과 app overlay wrapper도 같은 공통 계약으로 이동했다.
- API·state·backend·DB 계약 변경 없이 UI 조립과 interaction만 변경했다.
- `npm run check`, production build, CSS 감사, `git diff --check`, 15개 Playwright E2E와 320·390·430px 시각 확인을 통과했다.
- 다음 작업은 G2 인증·가입·Onboarding 구현이다.

## 7. G2 인증·가입·Onboarding

### 7.1 목표

전달본의 조밀하고 신뢰감 있는 진입 경험을 적용하되 현재 인증·약관·소셜 계약을 그대로 유지한다.

### 7.2 수정 예정 파일

Screens:

- `src/screens/auth/AuthScreens.jsx`
- `src/screens/onboarding/IntroScreens.jsx`
- `src/screens/onboarding/OnboardingShell.jsx`
- `src/screens/onboarding/SurveyScreens.jsx`
- `src/screens/onboarding/Ob3Screen.jsx`
- `src/screens/onboarding/ResultScreens.jsx`
- `src/screens/onboarding/ScoreJourneyCard.jsx`
- `src/screens/mypage/LegalScreens.jsx`

CSS:

- `src/styles/screens/auth.css`
- `src/styles/screens/auth-signup.css`
- `src/styles/screens/auth-recovery.css`
- `src/styles/screens/onboarding.css`
- `src/styles/screens/locked-splash.css`의 splash 소유 규칙
- `src/styles/components/mbti-survey.css`

Constants·contracts:

- `src/constants/assets.js`
- `src/constants/terms.js`
- `scripts/check-auth-presentation.mjs`
- `scripts/check-email-input.mjs`
- onboarding 관련 UI·interaction contract

### 7.3 기본 읽기 전용 경계

- `src/features/session/*`
- `src/handlers/auth-handlers.js`
- `src/shared/api/client.js`
- `/api/auth` request type
- Cognito, cookie/Bearer, Google·Naver callback

### 7.4 화면별 결과

- splash: full viewport, 안정적인 session 판정, official logo·크랙이
- login: provider icon·label 중앙 정렬, full-width input·CTA, compact recovery entry
- recovery: 중앙 modal, 단계와 오류가 흔들리지 않는 layout
- signup: 약관부터 시작하는 현재 단계형 흐름 유지
- intro: 3개 화면의 부드러운 motion과 실제 제품 가치만 표시
- ob1~ob5: 현재 학습 정보·성적·MBTI·분석·플랜 계약 유지
- legal: 실제 전문, version/date와 내부 scroll

### 7.5 검증

- 일반 로그인 성공·실패
- 한글 이메일 입력 차단
- 이메일·비밀번호 찾기
- 약관 필수·마케팅 선택·전문 모달
- 이메일·전화 인증 단계
- Google·Naver 모바일 return target
- dev 로그인 → 새로고침 → 새 탭 → 로그아웃

### 7.6 배포·rollback

- backend가 불변이면 정적 배포만 필요
- dev cookie smoke 전 main 승격 금지
- auth contract 변경이 필요해지면 G2 시각 묶음에서 분리

### 7.7 구현 결과 (2026-08-15)

- 로그인은 공식 로고 타일, compact brand copy, full-width 입력·CTA, 중앙 정렬된 Google·Naver 버튼과 조용한 recovery entry로 재구성했다.
- 이메일 찾기와 비밀번호 재설정은 G1 공통 `Modal` 계약 위에서 중앙 위치, 고정 field 높이와 단계별 copy를 유지한다.
- 회원가입은 현재 약관 우선 4단계 계약을 유지하면서 progress·logo topbar, 단계별 heading, field surface, custom checkbox와 sticky action hierarchy를 전달본에 맞췄다.
- splash는 official logo·크랙이를 사용한 full viewport scene으로, 소개 3개 화면은 실제 환산점수·과목 효율·관리 기능만 보여주는 순차 reveal로 정리했다.
- 진단 `ob1~ob5`는 progress·title·subcopy header와 크랙이 안내 surface를 같은 문법으로 묶었으며 입력·MBTI·분석·플랜 action은 변경하지 않았다.
- `AuthScreens.jsx`, `IntroScreens.jsx`, `OnboardingShell.jsx`와 각 소유 CSS만 변경했다. session, auth handler, API client, Cognito·social callback, Lambda와 DynamoDB는 불변이다.
- `check-auth-presentation.mjs`와 Playwright에 brand·signup topbar·환산점수 intro·약관 전문·다음 단계 계약을 추가했다.
- 390x844 로그인·가입·인트로 캡처에서 provider 정렬과 가로 overflow를 확인했다. `npm run check`, production build, CSS 감사와 전체 E2E가 통과했다.
- dev cookie 실세션은 정적 배포 후 별도 smoke 조건이며 G2 코드에는 인증 계약 변경이 없다.

## 8. G3 공부·플래너·랭킹

### 8.1 목표

오늘 실행 중심의 타이머와 플래너를 전달본 밀도로 정리하고 서버 공부 세션·요약·랭킹 계약을 보존한다.

### 8.2 수정 예정 파일

Screens:

- `src/screens/timer/TimerScreen.jsx`
- `src/screens/planner/PlannerScreen.jsx`
- `src/screens/planner/PlannerAddScreen.jsx`
- `src/screens/planner/PlannerEditSheet.jsx`
- `src/screens/planner/presentation.js`
- `src/screens/planner/planner-options.js`
- `src/screens/profile/ProfileScreens.jsx`의 ranking composition

CSS:

- `src/styles/screens/timer.css`
- `src/styles/screens/planner.css`
- `src/styles/screens/planner-calendar.css`
- `src/styles/screens/planner-add.css`
- `src/styles/screens/ranking.css`

Contracts:

- `scripts/check-planner-presentation.mjs`
- `scripts/check-study-reward-pipeline.mjs`
- `scripts/check-core-reliability.mjs`
- `e2e/core-flows.spec.mjs` 공부·플래너·랭킹 flow

### 8.3 기본 읽기 전용 경계

- `src/features/study/*`
- `src/features/planner/api.js`, `state.js`, `storage.js`
- `src/handlers/timer-handlers.js`
- `src/handlers/planner-handlers.js`
- UserCore session·summary·ranking API

### 8.4 구현 내용

- timer: 사용자 요약, 오늘 누적, study start, 개별 기록, 이번 주 흐름
- 공부 시작 sheet: planner 선택 또는 직접 과목·구체 활동 입력
- planner: 오늘 item, 날짜·주·월 탐색, 완료·편집·삭제
- plannerAdd: 단계형 입력, draft와 keyboard focus 보존
- ranking: 일·주·월 segmented control과 서버 순위 hierarchy
- local-only planner에는 계정 동기화 문구를 표시하지 않음

### 8.5 검증

- 시작 → background resume → 완료 → 요약
- 완료 재탭·빠른 탭 중복 방지
- 플래너 추가·수정·완료·삭제·새로고침
- input 한 글자마다 keyboard가 닫히지 않음
- ranking 기간 전환과 unavailable/0 구분
- 공부 완료 성공·보상 실패를 독립 상태로 표시

### 8.6 배포·rollback

- 기존 API 유지 시 정적 배포만 필요
- `record_study_session`으로 회귀 금지
- 서버 플래너는 G3에 포함하지 않고 별도 확장 계획으로 유지

### 8.7 구현 결과 (2026-08-15)

- timer는 `오늘의 플래너 → 오늘 누적 공부 → 보상 → 주간 흐름 → 서식지` 순으로 재배치해 첫 화면에서 다음 공부와 실행 CTA가 먼저 보이도록 정리했다.
- 오늘 플래너에는 실제 완료 개수, 계획 시간 기반 진행률, 최대 3개 일정과 다음 미완료 일정 시작 CTA를 연결했다. 일정 선택은 기존 study start sheet를 열며 서버 세션 생성 전 확인 절차를 유지한다.
- 누적 공부는 서버 `get_study_summary`와 실행 중 경과시간 합산, 개별 세션 펼치기, 시작·완료·보상 재시도 계약을 그대로 사용한다.
- planner는 전달본의 compact progress·fish feedback을 적용하고 `완료/전체`, 실제 완료 시간/총 계획 시간, 오늘 항목, 주·월 탐색 순으로 계층을 정리했다. 추가·수정·완료·삭제와 local-only 저장 경계는 변경하지 않았다.
- ranking은 일간·주간·월간 segmented control을 유지하면서 내 순위, 티어, 참여 인원, 상위 비율을 한 summary hierarchy로 통합했다. 빈 기록·오류·0초 상태는 기존 서버 응답 기준으로 구분한다.
- 장식용 물고기 SVG의 불필요한 title text를 제거해 planner 진행 카드의 접근성 텍스트에 species ID가 섞이지 않도록 했다.
- `src/features/study/*`, planner API/state/storage, timer/planner handler, UserCore와 Gamification Lambda는 수정하지 않았다. 신규 DB·API·Lambda 배포 요구사항은 없다.
- `npm run check`, production build, CSS ownership/dead selector/duplicate 감사, Playwright 16개 전체 흐름이 통과했다. 320px·430px planner 캡처와 timer 실행 화면에서 가로 overflow가 없음을 확인했다.

## 9. G4 수조·Discovery·도감

### 9.1 목표

전달본의 몰입형 수조, 발견, 도감과 보상 표현을 현재 Gamification 서버 원장 위에 적용한다.

### 9.2 수정 예정 파일

- `src/screens/aquarium/AquariumScreen.jsx`
- `src/screens/aquarium/FishSprite.jsx`
- 필요 시 수조 내부 discovery·dex·share component 분리
- `src/styles/screens/aquarium.css`
- `src/constants/assets.js`
- `scripts/check-game-api-contracts.mjs`
- `scripts/check-study-reward-pipeline.mjs`
- `e2e/core-flows.spec.mjs` 수조·pending draw flow

### 9.3 기본 읽기 전용 경계

- `src/features/gamification/api.js`
- `src/features/gamification/model.js`
- `src/features/gamification/state.js`
- `src/features/gamification/use-game-profile-resource.js`
- `src/handlers/gamification-handlers.js`
- Gamification Lambda와 `StudyCrack_Game`

### 9.4 구현 내용

- midnight habitat와 실제 3개 활성 슬롯
- 선택 fish 상세, 이름·배치·먹이·EXP·수질
- 신규 fish reveal의 rarity별 motion·sound fallback
- pending draw 복원, 확인 뒤 acknowledge
- 12종 catalog 기반 도감과 획득·미획득 filter
- Web Share는 익명 기본값과 실패 fallback
- theme 서버 저장은 제외하고 별도 P3 후보 유지

### 9.5 검증

- feature off·allowlist·on 화면
- starter 선택·먹이·이름·배치·새로고침 복원
- 중복 feed/draw 요청 잠금
- pending draw 복구와 acknowledge
- reduced motion·asset 실패 fallback
- 게임 API 실패가 공부 기록을 훼손하지 않음

### 9.6 배포·rollback

- 현재 API를 그대로 쓰면 정적 배포만 필요
- Gamification source가 변경될 때만 Lambda 재배포 필요
- local fish·재화 fallback을 추가하지 않음

### 9.7 구현 완료 (2026-08-15)

- 수조 첫 화면을 midnight habitat, 실제 3개 활성 슬롯, 연속 학습·수질 HUD, 서버 조개·먹이 잔액 순으로 재구성했다. 수조와 선택 물고기, 성장·먹이, 이름·배치 관리의 기존 기능은 유지하되 물고기 선택 목록을 가로 탐색형으로 압축했다.
- 도감은 전달본의 dark collection hero와 수집률, Discovery 진입 카드, `전체/획득/미획득` 필터를 적용했다. 12종 catalog와 owned 판정은 기존 Gamification 응답만 사용하며 로컬 물고기나 재화를 만들지 않는다.
- Discovery는 pending draw의 서버 선확정·새로고침 복원·3단계 공개·acknowledge 절차를 그대로 유지하면서 희귀도별 halo·ring·particle과 선택적 Web Audio 효과음을 추가했다. 브라우저가 오디오를 차단하거나 AudioContext를 지원하지 않아도 보상 흐름은 계속된다.
- 공유는 기존 익명 Web Share와 clipboard fallback을 유지한다. 성적·이름·계정 정보는 payload와 공유 카드에 포함하지 않는다.
- `src/features/gamification/*`, gamification handler, Gamification Lambda와 `StudyCrack_Game`은 변경하지 않았다. 신규 API·테이블·IAM·Lambda 배포 요구사항은 없다.
- `npm run check`, production build, CSS ownership/dead selector/duplicate 감사, Playwright 16개 전체 흐름이 통과했다. starter·중복 feed 잠금·이름·3슬롯·새로고침, pending draw 복구·acknowledge, 도감 필터, Web Share, reduced motion과 320·430px 가로 overflow를 확인했다.

## 10. G5 환산 분석·대학·성적

### 10.1 목표

합격확률 없이 실제 대학별 환산점수, 과목 원점수 +1 효율과 Standard·Pro 역산을 전달본 hierarchy로 표현한다.

### 10.2 수정 예정 파일

Screens:

- `src/screens/analysis/AnalysisScreen.jsx`
- `src/screens/analysis/AnalysisContent.jsx`
- `src/screens/analysis/AddUniversityScreen.jsx`
- `src/screens/analysis/presentation.js`
- `src/screens/profile/ProfileScreens.jsx`의 scoreInfo·qualInfo
- `src/screens/profile/ScoreEditModal.jsx`
- `src/components/score-journey.js`

CSS:

- `src/styles/screens/analysis-base.css`
- `src/styles/screens/analysis-unified.css`
- `src/styles/screens/analysis.css`
- `src/styles/screens/score-input.css`
- `src/styles/components/insights.css`

Contracts:

- `scripts/check-analysis-presentation.mjs`
- `scripts/check-score-store.mjs`
- `scripts/check-score-conversion.mjs`
- `scripts/check-university-catalog.mjs`
- `e2e/core-flows.spec.mjs` 초기 분석·대학 변경 flow

### 10.3 기본 읽기 전용 경계

- `src/features/analysis/*`
- `src/handlers/analysis-handlers.js`
- Analysis Lambda의 환산·simulation·역산 알고리즘

### 10.4 구현 내용

- 최초 진입 loading 뒤 제목과 본문을 한 번에 reveal
- 시험 selector와 선택 대학이 같은 resource key를 사용
- 환산점수·합격선·안정선 gauge
- 원점수 +1 전후 재환산 차이 표와 최고 반영 과목 강조
- 0 이하 clamp 뒤 단순 delta 가산 금지
- 대학 → 학과 순차 검색과 추천 대학
- 성적 raw/grade 숫자 입력과 변환 결과 정렬
- Basic 이상 순방향 효율, Standard·Pro 역산

### 10.5 검증

- 로그인 직후 기본 시험 환산점수
- 빠른 시험·대학 전환에서 stale response 차단
- 대학 삭제 성공 뒤에만 UI 제거
- 대학 검색 한글 focus 유지
- 250점 상한·긴 대학·학과 overflow
- +1 후에도 clamp 0이면 0으로 표시
- 성적 저장 뒤 modal 종료와 표점·백분위 반영

### 10.6 배포·rollback

- 기존 API 유지 시 정적 배포만 필요
- 분석 request payload·plan gate 변경은 별도 계약 묶음
- fixture나 local 합격확률 fallback 금지

### 10.7 구현 완료 (2026-08-15)

- 전달본의 확률 중심 hero를 실제 `LIVE 환산점수` 중심으로 치환하고, 희망 대학·시험 selector, 0–250 게이지와 합격·안정선, 원점수 +1 효율 표를 같은 정보 계층에 배치했다. 합격확률과 고정 점수는 도입하지 않았다.
- 원점수 +1 효율은 서버의 전후 환산 절대값을 각각 화면 범위로 clamp한 뒤 표시 차이를 계산한다. 전후 값이 모두 0 이하인 경우 `+0점`, `0 → 0`으로 표시하며 raw delta를 현재 UI 점수에 더하지 않는다.
- Basic 이상은 네 과목 순방향 효율을 모두 확인하고 Standard·Pro만 역산 응답을 사용한다. 테스트 fixture도 실제 `bySubject`·`expected` 응답 형태로 맞췄다.
- 추천 대학과 대학→학과 순차 검색, 한글 입력 focus, 성적 6단계 숫자 입력과 표점·백분위 환산을 유지했다. 탐구 단계 이동 시 선택 과목과 원점수 draft를 함께 보존하고 최종 저장 뒤 modal을 닫는다.
- `src/features/analysis/*`, Analysis handler의 요청 계약, Analysis·UserCore Lambda는 변경하지 않았다. 신규 API·테이블·IAM·Lambda 배포 요구사항은 없다.
- `npm run check`, production build, CSS 감사와 Playwright 17개 전체 흐름이 통과했다. 320·430px 가로 overflow, 최초 환산점수, 시험·대학 전환, 대학 검색, Basic·Standard 권한과 성적 저장 종료를 확인했다.

## 11. G6 코칭·리포트·플랜·결제

### 11.1 목표

코칭과 상업 화면을 전달본의 조밀한 위계로 맞추면서 실제 8단계 점검, 보고서, 가격, 잠금과 웹 결제를 유지한다.

### 11.2 수정 예정 파일

- `src/screens/coaching/CoachingScreen.jsx`
- `src/screens/coaching/presentation.js`
- `src/screens/service/ServiceContentScreens.jsx`
- `src/screens/service/ServicePlanScreens.jsx`
- `src/constants/plans.js`
- `src/styles/screens/coaching.css`
- `src/styles/screens/reports.css`
- `src/styles/screens/service.css`
- `src/styles/screens/locked-splash.css`의 locked 소유 규칙
- `scripts/check-coaching-presentation.mjs`
- `scripts/check-plan-contracts.mjs`
- `scripts/check-secondary-presentation.mjs`
- 리포트·잠금·결제 e2e flow

### 11.3 기본 읽기 전용 경계

- `src/features/reports/*`
- `src/features/coaching/state.js`
- `src/handlers/service-handlers.js`
- ReportCore, FileService, Payment와 웹 결제

### 11.4 구현 내용

- 코칭 3단계 intro와 실제 weekly history
- 8단계 점검 sheet의 keyboard·footer safe area
- report list·detail loading/empty/error
- locked preview + 중앙 plan 안내, navigation 유지
- service catalog 단일 원천의 Basic·Starter·Standard·Pro
- 선택 plan·기간·기능이 함께 바뀌는 detail
- 웹 결제 handoff와 서버 구독 확인 완료 화면

### 11.5 검증

- Free/Basic/Starter/Standard/Pro 권한 matrix
- 코칭 입력 scroll·keyboard·upload·submit
- report·PRO request·tutor Q&A
- locked CTA가 즉시 payment로 강제 이동하지 않음
- 가격·기간·혜택 정합
- 결제 완료를 클라이언트가 임의 확정하지 않음

### 11.6 배포·rollback

- backend가 불변이면 정적 배포만 필요
- 가격 상수 변경은 웹 catalog와 계약 검사를 함께 통과
- Payment Lambda 변경은 이 로드맵 본선에 포함하지 않음

### 11.7 구현 완료 (2026-08-15)

- 최신 실제 주간 점검을 `피드백 도착 / 검토 대기 / 새 점검 시작` 상태로 요약하고, 신청 CTA·3단계 합격 설계·점검/피드백 이력을 전달본의 조밀한 위계로 재배치했다. 기존 8단계 입력·첨부·제출 계약은 유지했다.
- PRO 리포트의 loading·empty·error·발행 상태를 분리하고, 주간 피드백 화면을 공통 secondary intro·section 구조로 통일했다. 실제 발행 URL만 다운로드하며 요청서·튜터 Q&A의 비제어 입력 계약을 보존했다.
- 잠금 화면은 preview와 중앙 플랜 안내 뒤 `proIntro`로 이동하며 payment로 바로 보내지 않는다. Basic·Starter·Standard·Pro의 가격·기능 원천은 `PLAN_META` 하나를 계속 사용하고 선택 상태에 `aria-pressed`를 추가했다.
- Standard·Pro의 선택 기간은 결제 상세 요약과 함께 갱신한다. 웹 결제가 현재 4주 단위만 최종 처리하므로 8·12주 총액을 모바일에서 임의 계산하지 않고, 웹에서 실제 금액과 적용 기간을 확정한다는 문구를 표시했다.
- `src/features/reports/*`, `src/features/coaching/state.js`, service handler, ReportCore·FileService·Payment와 웹 결제는 변경하지 않았다. 신규 API·Lambda·테이블·IAM 요구사항은 없다.
- `npm run check`, production build, CSS ownership/dead selector 검사와 Playwright 17개 전체 흐름이 통과했다. 320·430px 코칭, 8단계 sheet 진입, 리포트·Q&A, 잠금→플랜, PRO·8주 선택과 웹 결제 query를 확인했다.

## 12. G7 MY·계정·알림·지원

### 12.1 목표

계정·운영 기능을 같은 secondary shell과 row primitive로 통일하고 PII·알림·문의 동작을 보존한다.

### 12.2 수정 예정 파일

Screens:

- `src/screens/mypage/MyPageScreen.jsx`
- `src/screens/mypage/MyProfileHeader.jsx`
- `src/screens/mypage/MyMenuList.jsx`
- `src/screens/mypage/MbtiInsightCard.jsx`
- `src/screens/mypage/AccountInfoScreen.jsx`
- `src/screens/mypage/MyPageSecondaryScreens.jsx`
- `src/screens/mypage/ProfileOverlays.jsx`
- `src/screens/mypage/account-presentation.js`
- `src/screens/mypage/presentation.js`

CSS:

- `src/styles/screens/mypage.css`
- `src/styles/screens/mypage-data.css`
- `src/styles/screens/mypage-support.css`

Contracts:

- `scripts/check-mypage-presentation.mjs`
- `scripts/check-secondary-presentation.mjs`
- `scripts/check-qna-composer.mjs`
- 알림·문의·계정 e2e flow

### 12.3 기본 읽기 전용 경계

- `src/features/account/*`
- `src/features/notifications/*`
- `src/features/support/*`
- `src/handlers/profile-handlers.js`
- UserCore, Auth, Notification, QnaChat

### 12.4 구현 내용

- profile·구독·다음 결제일 요약
- 계정정보 단일 진입에서 이름·전화·비밀번호·소셜 관리
- 알림 목록 7개, 선택 상세, 한 건 읽음
- 실제 소비되는 notification preference만 정확히 표현
- FAQ·1:1 문의·데이터 오류 신고
- 긴 주간 피드백과 크랙이 asset이 겹치지 않는 layout
- 로그아웃·탈퇴 확인과 오류 상태

### 12.5 검증

- 이름·전화번호 인증·비밀번호 변경
- 소셜 연결·해제
- 알림 빈 목록·403·7개 pagination·상세 본문
- Q&A 한글 입력 focus 유지
- 계정 modal 순서 지연 발생 없음
- 로그아웃 뒤 새로고침 시 session 복귀 없음

### 12.6 배포·rollback

- 기존 API 유지 시 정적 배포만 필요
- weekly/billing 알림 소비 확장은 별도 P3 backend 계획
- PII mutation 변경이 필요하면 G7 시각 묶음에서 분리

### 12.7 구현 완료 (2026-08-15)

- **MY 첫 화면**: 프로필과 실제 이용 중 플랜, 이용 기간, 갱신 안내를 한 계층으로 묶었다. 선택 중인 결제안보다 현재 구독 tier를 우선하며, 다음 결제일이 없는 계정에는 자동 결제를 암시하지 않는다.
- **계정 관리**: 계정정보 단일 화면에서 이름·전화번호 인증·비밀번호·마케팅 수신·Google/Naver 연결 상태를 관리한다. 플랜 확인과 탈퇴는 별도 위험도를 가진 명령으로 분리했다.
- **알림 계약**: 앱이 실제 소비하는 `planner`, `report` 두 설정만 노출하고 서비스 필수 알림과 구분했다. 목록은 7개 단위, 안 읽은 수 표시, 상세 본문, 선택한 한 건 읽음 처리를 유지한다. weekly/billing 확장은 P3 backend 범위로 남겼다.
- **지원 흐름**: 일반 문의, 데이터 오류 신고, 카카오 문의를 분리했다. 데이터 오류 신고는 구조화된 제목·본문을 미리 채우며, 한글 입력 중 composer가 재마운트되지 않도록 기존 uncontrolled 입력 계약을 보존했다.
- **CSS 소유권**: 알림 목록·상세·pagination 규칙을 `mypage-support.css`로 옮기고 `home-overlays.css`의 중복 소유를 제거했다. MY·계정·지원 화면은 공통 secondary shell과 row 간격을 사용한다.
- **검증**: `npm run check`, production build, CSS duplicate/dead selector 감사, `git diff --check`, Playwright 전체 18개 흐름과 G7 타깃 시나리오를 통과했다.
- **backend 영향**: UserCore·Auth·Notification·QnaChat API, Lambda, API Gateway, DynamoDB 변경 없음. 정적 프론트 배포만 해당한다.

## 13. G8 Onboarding 잔여·Legacy·성능 마감

### 13.1 목표

대체가 검증된 legacy만 제거하고 bundle, 접근성, 성능, 문서와 배포 조건을 마감한다.

### 13.2 제거 후보

- `src/screens/home/HomeScreen.jsx`
- `src/screens/home/HomeOverlays.jsx`
- `src/screens/home/StudyGamificationPanels.jsx`
- `src/screens/home/presentation.js`
- `src/styles/screens/home-base.css`
- `src/styles/screens/home-overlays.css`
- `src/styles/screens/home.css`
- `screen-registry-app.js`의 `home`
- 관련 screen context, action, state field와 CSS fixture
- `record_study_session`의 신규 UI 참조

### 13.3 제거 선행조건

- `goto('home')`와 저장된 `home`이 analysis 또는 timer로 안전하게 정규화됨
- 대학·환산·캘린더·랭킹·알림·리포트 진입이 대체 화면에서 보존됨
- overlay와 profile drawer 대체 확인
- static·dynamic class와 DOM query 참조 0건
- e2e의 legacy query 호환 통과

### 13.4 마감 파일

- `src/app/screen-registry-app.js`
- `src/app/screen-registry.js`
- `src/app/mobile-routing.js`
- `src/app/screen-context.js`
- `src/state/navigation-state.js`
- `src/runtime/main.js`와 CSS import는 실제 제거 시만 수정
- `scripts/check-dead-code.mjs`
- `scripts/check-css-dead-selectors.mjs`
- `scripts/check-bundle-boundaries.mjs`
- `scripts/check-release-transition.mjs`
- architecture baseline·문서

### 13.5 완료 조건

- 목표 registry 41개
- dead selector·stale allowlist 0건
- duplicate·important 증가 0건
- bootstrap/deferred chunk 404 없음
- bundle size 기준선 대비 증가 사유 기록
- 전체 e2e와 dev 인증 smoke 통과
- `docs/exec-plans/current.md` 동기화와 완료 계획 이관 판단
- G0~G8 각 단계의 390x844 reference parity 캡처 보존

## 14. 본선에서 제외하는 선택 Backend

아래 항목은 G0~G8과 같은 구현·배포에 포함하지 않는다.

### 14.1 서버 플래너

- 신규 `StudyCrack_Planner`
- UserCore action 4종
- local → server lazy import
- UserCore IAM·Lambda 재배포

### 14.2 비회원 학습유형·claim·14일 이력

- 신규 LearningProfile Lambda
- `/api/learning` public/auth route
- 신규 `StudyCrack_LearningProfiles`
- one-time claim·TTL·versioned result
- 별도 보안·rate limit·개인정보 검토

### 14.3 수조 theme

- `PROFILE.themeId`, schema v2 lazy migration
- Gamification action·Lambda 재배포

### 14.4 알림 preference 소비 확장

- `weekly`, `billing` 정책 확정
- Reminder 또는 Payment 연계
- 마케팅·서비스 필수 알림 구분

이 네 항목은 제품 결정 후 각각 별도 active 계획으로 시작한다.

## 15. 단계별 검증표

| 단계 | 전체 check | build | e2e | 4 viewport | dev auth | 실데이터 |
|---|---:|---:|---:|---:|---:|---:|
| G0 | 필수 | 필수 | 필수 | 필수 | 불필요 | 불필요 |
| G1 | 필수 | 필수 | 필수 | 필수 | 불필요 | overlay 상태 |
| G2 | 필수 | 필수 | 필수 | 필수 | 필수 | 소셜·약관 |
| G3 | 필수 | 필수 | 필수 | 필수 | session 확인 | 공부·랭킹 |
| G4 | 필수 | 필수 | 필수 | 필수 | allowlist | 게임 원장 |
| G5 | 필수 | 필수 | 필수 | 필수 | session 확인 | 시험·대학·성적 |
| G6 | 필수 | 필수 | 필수 | 필수 | session 확인 | 플랜·리포트·결제 |
| G7 | 필수 | 필수 | 필수 | 필수 | 필수 | PII·알림·Q&A |
| G8 | 필수 | 필수 | 필수 | 전체 회귀 | 필수 | 전체 smoke |

## 16. 배포 절차

1. `dev-mobile-main`에서 단계 구현과 로컬 검증을 완료한다.
2. 각 단계 diff가 소유 파일을 벗어나지 않았는지 확인한다.
3. 사용자가 `dev`로 merge·push하면 `.github/workflows/deploy.yml`이 검사·빌드·Playwright 뒤 자동 배포한다.
4. dev에서 해당 단계의 실데이터 smoke를 수행한다.
5. 실패하면 다음 단계를 진행하거나 main으로 승격하지 않는다.
6. 전체 G0~G8과 dev smoke 완료 뒤 main 승격을 검토한다.
7. 수동 S3 업로드는 사용하지 않는다.

backend source가 실제 변경된 경우에만 사용자가 해당 Lambda를 재배포한다. G0~G8의 계획상 기본 backend 변경은 없다.

## 17. Rollback Checklist

- 변경 묶음이 한 단계 범위를 넘지 않는가
- 원래 selector를 수정했으며 override block이 없는가
- state/API/backend 변경이 시각 묶음에 섞이지 않았는가
- 신규 DB field가 optional·additive인가
- server 응답 전 local 성공값을 확정하지 않는가
- 이전 정적 배포 commit으로 되돌릴 수 있는가
- dev 실패 상태에서 main이 보호되는가
- local planner·game profile·성적·결제 데이터가 파괴되지 않는가
- 문서와 contract fixture도 코드와 함께 되돌아가는가

## 18. 최종 완료 기준

전체 전환은 다음 조건을 모두 만족할 때 완료다.

- 현재 실제 기능과 전달본의 모든 채택 기능이 화면 대응표대로 보존된다.
- 제공된 코드·데모와 주요 화면의 외관·composition이 거의 동일하다.
- 41개 목표 registry와 5개 주 탭이 정확히 동작한다.
- 합격확률·mock 지표·local reward가 제품 화면에 없다.
- 공통 token·primitive·overlay·navigation이 단일 소유권을 가진다.
- 320~430px에서 overflow·text clipping·navigation 겹침이 0건이다.
- 390x844 reference overlay 비교에서 의미 있는 geometry·색감·typography 불일치가 0건이다.
- 인증, 공부, 수조, 분석, 결제, 계정의 고위험 smoke가 통과한다.
- CSS duplicate·dead selector·important와 bundle 경계가 기준을 통과한다.
- GitHub Actions dev 배포와 실데이터 확인 뒤 main 승격 조건이 충족된다.
- active 계획과 `current.md`가 실제 구현 상태로 갱신된다.

## 19. CMP-08 완료 판정

- CMP-00~07의 모든 조사 결과를 G0~G8 파일 단위 구현 순서로 변환했다.
- 각 단계의 수정 예정 파일, 보호할 state·API·backend 경계와 완료 조건을 확정했다.
- 정적·E2E·4 viewport·dev auth·실데이터 검증 필요 여부를 단계별로 지정했다.
- 정적 배포와 선택 backend 배포를 분리하고 rollback checklist를 작성했다.
- 서버 플래너, 비회원 진단, 수조 theme, 알림 소비 확장을 본선에서 제외했다.
- 이번 CMP-08 자체에서는 런타임·Lambda·API Gateway·DynamoDB를 변경하지 않았다.
- G0 Foundation, G1 공통 Shell·Navigation·Overlay와 G2 인증·가입·Onboarding 구현·검증을 완료했다. 다음 작업은 G3 공부·플래너·랭킹 구현이다.

### 13.6 2026-08-16  
#- **  ;
set +tttttttext-fit cccccccsspppppppresentationoooooooverlayh  . `screen=home`, history,   legacy home  legacy home  analysis .
set +H .
#- **;
set +.
#- **;
set +H                                                                                  G8 release-complete  main  .
