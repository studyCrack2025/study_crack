# CTO 인수인계: Frontend → Backend 연결 가이드

> 범위: `js/studycrack-mobile.js`의 현재 mock/localStorage 기반 구현 정리. 기능/디자인/로직 변경 없음.

## 1) 추가된 TODO_API 주석 목록

- `TODO_API_AUTH_LOGIN_LOGOUT` (로그인/로그아웃).
- `TODO_API_GET_RANKING` (랭킹 조회).
- `TODO_API_PROFILE_LOAD_SAVE` (내 프로필 조회/수정).
- `TODO_API_GET_ANALYSIS` (분석/대학검색/시뮬레이션 결과).
- `TODO_API_AUTH_PASSWORD_RESET` (비밀번호 재설정).
- `TODO_API_AUTH_SIGNUP_VERIFY` (회원가입 + 이메일/휴대폰 인증).
- `TODO_API_DOMAIN_MAP` (Onboarding/Coaching/Pro Report/Payment/Admin/Tutor/Settings 전체 매핑).
- `TODO_API_SCORE_SNAPSHOT_SAVE` (성적 스냅샷 저장).
- `TODO_API_PLANNER_SAVE` (플래너 저장).
- `TODO_API_NOTIFICATIONS_SAVE` (알림 조회/읽음 처리).
- `TODO_API_STUDY_RECORDS_SAVE` (학습 시간 기록 저장).
- `TODO_API_STUDY_SUBJECT_RECORDS_SAVE` (과목별 학습 기록 저장).

## 2) 화면별 API 연결 포인트

### Auth
- Login: `POST /auth/login`
- Logout: `POST /auth/logout`
- Signup: `POST /auth/signup`
- Email verify: `POST /auth/verify/email/send`, `POST /auth/verify/email/confirm`
- Phone verify: `POST /auth/verify/phone/send`, `POST /auth/verify/phone/confirm`
- Password reset: `POST /auth/password/reset/request`, `POST /auth/password/reset/confirm`

### Home / Profile / Settings
- Profile load/update: `GET /users/me`, `PATCH /users/me`
- Settings update: `PATCH /users/settings`
- Notifications: `GET /notifications`, `PATCH /notifications/{id}/read`

### Ranking
- Ranking list/podium/my rank: `GET /ranking?period=daily|weekly|monthly`

### Analysis
- University search pool: `GET /analysis/universities?query=&score=`
- Analysis result: `GET /analysis/result?userId=`

### Planner / Study log
- Planner save/load: `PUT /planner/items`, `GET /planner/items`
- Study records save/load: `PUT /study/records`, `GET /study/records`
- Subject records save/load: `PUT /study/records/subjects`, `GET /study/records/subjects`
- Score snapshot save/load: `PUT /scores/snapshot`, `GET /scores/snapshot`

### Onboarding
- Survey: `POST /onboarding/survey`
- Scores: `POST /onboarding/scores`
- Target university: `POST /onboarding/target`

### Coaching
- Requests: `POST /coaching/requests`
- Weekly feedback: `GET /coaching/weekly-feedback`

### Pro Report
- Request: `POST /reports/requests`
- List/detail: `GET /reports`, `GET /reports/{id}`

### Payment
- Checkout: `POST /payments/checkout`
- Subscription status: `GET /subscriptions/me`
- Confirm: `POST /payments/confirm`

### Admin/Tutor
- Admin dashboard: `GET /admin/dashboard`
- Tutor assignments: `GET /tutors/assignments`
- Tutor feedback: `GET /tutors/feedback`

## 3) localStorage key 목록

- `studycrack_scroll_positions_v1`
- `studycrack_startup_errors_v1`
- `user`
- `selectedPlan`
- `selectedUniversity`
- `activeTab`
- `scores`
- `plannerItems`
- `notifications`
- `studyRecords`
- `studySubjectRecords`
- `examScoresByType`
- `studycrack_signup_completed`
- `studycrack_signup_profile`
- `studycrack_onboarding_completed`

## 4) 화면 주요 action 목록

### 공통 네비게이션
- `goto`, `back`, `tab`

### Auth
- 로그인 submit
- 이메일 찾기
- 비밀번호 재설정 요청/확인
- 회원가입 정보 입력/약관 동의/인증코드 확인/가입 완료

### Onboarding
- 기본 정보 입력
- 성적 입력/시험타입 선택
- 목표대학 설정 완료

### Home
- 목표대학 카드 조작
- 빠른 이동 버튼
- 공지/알림 인터랙션

### Analysis
- 대학 검색 실행(`runUniversitySearch`)
- 대학 추가/삭제
- 시뮬레이션 바 증감(`simulateBarGain`)
- 과목 breakdown 토글

### Planner
- 일정 추가/삭제/완료 토글
- 날짜 선택
- 자습/과목 선택

### Coaching
- 코칭 요청 작성
- 과목별 계획/실적 입력

### Ranking
- 기간 변경(daily/weekly/monthly)
- 랭킹 화면 진입

### My/Profile
- 프로필 수정 모달 열기/닫기/저장
- 구독/리포트 관련 진입 액션

## 5) 백엔드 연결 우선순위

1. **P0 (즉시)**: Auth + Users/Profile + Onboarding 완료 플로우
   - 이유: 로그인/가입/초기 데이터 확정이 모든 화면의 전제조건.
2. **P1 (핵심 사용경험)**: Planner + Study Records + Subject Records + Scores Snapshot
   - 이유: 사용자 일일 사용 데이터의 정합성 및 유지 핵심.
3. **P1 (가시성)**: Analysis + Ranking
   - 이유: 핵심 가치 화면이며 현재 mock 의존도가 높음.
4. **P2 (운영/확장)**: Notifications + Coaching + Pro Report
   - 이유: 기능 확장 및 반복 사용성 개선.
5. **P3 (사업/운영툴)**: Payment + Admin/Tutor
   - 이유: 운영 측면 중요하나 학습 기본 플로우 대비 후순위 가능.

## 6) 코드 동작 변경 없음 확인

- 이번 변경은 `TODO_API` 주석 추가 및 문서(`CTO_BACKEND_HANDOVER.md`) 작성만 포함.
- JS 로직 분기/상태 변경/DOM 렌더링/스타일 규칙 수정 없음.
