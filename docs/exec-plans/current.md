# 현재 개발 현황 (2026-08-21)

현재 브랜치: `dev-mobile-main`

---

## 2026-08-21 — FishDex Approved V2 FD-05 85종 도감 공개 로컬 완료

- **5등급 도감**: Common·Rare·Epic·Legendary·Special 그룹과 서버 기준 수집 분모를 표시한다. 전체·획득·미획득 상태 필터에 민물·바닷물고기·무척추·해양생물·크랙이 생태 필터를 추가했다.
- **구버전 호환**: category가 없는 기존 12종 응답에서는 생태 필터를 숨기며 보유·미보유 필터와 등급별 전체 분모는 그대로 유지한다.
- **성능**: 85개 이미지는 native lazy loading과 `content-visibility`를 사용한다. 도감 최초 진입에서 화면 밖 이미지를 전부 요청하지 않는지, 320·390·430px에서 수평 overflow가 없는지 자동 검증한다.
- **획득 표현**: Legendary와 Special에 등급별 공개 문구·음향·halo·particle 표현을 추가하고 reduced-motion 설정은 기존 계약을 유지한다.
- **검증**: 모바일 `npm run check`, production build, `git diff --check`, Playwright 19개 전체 흐름과 Gamification Node test 39개가 통과했다.
- **배포 영향**: FD-03~05 묶음은 `StudyCrack_Gamification` Lambda 재배포가 필요하다. 정적 프론트는 GitHub Actions로 배포한다. 배포 후 dev allowlist 실계정 smoke가 남아 있다.
- **출시 범위 확정**: 승인된 85종을 현재 정식 catalog로 고정했다. ID 100·133·134·135는 승인 PNG가 없어 별도 후속 계획으로 분리했으며, 입고 전까지 manifest·API·도감·뽑기에 노출하지 않는다.
- **문서 정리**: 85종 적용 계획은 구현 완료로 이관하고 실제 dev 계정 검증은 `260706_mobile_dev_smoke_backlog.md` 한곳에서 추적한다. 89종 확장은 `260821_mobile_fishdex_89_species_deferred.md`에서 재개 조건과 계약을 관리한다.

## 2026-08-21 — FishDex Approved V2 FD-04 5등급 보상 정책 완료

- **일반 뽑기**: `draw-v2`를 도입해 Common/Rare/Epic/Legendary를 70/25/4/1로 고정하고 Rare 10회·Epic 30회·Legendary 100회 천장을 적용했다.
- **중복 보상**: 등급별 EXP 30/80/180/400, Lv.10 조개 환급 10/20/30/50을 서버 정책 상수로 통합했다. 첫 3회 미획득 우선과 pending 복원·요청 멱등성은 그대로 유지한다.
- **Special 경계**: Special은 일반 draw pool에서 제외했다. API Gateway 요청이 진입할 수 없는 내부 이벤트와 `AWARD#requestId` 원장으로 업적·이벤트·운영 지급만 허용하며 중복은 EXP 500으로 처리한다.
- **지연 migration**: PROFILE schema를 3으로 올려 기존 재화·보유·배치·pending을 보존하면서 Legendary 천장 카운터와 `draw-v2` 버전을 additive하게 보충한다.
- **화면 안내**: 서버 공개 rules DTO가 확률·천장을 제공하고, 수조는 희귀·영웅·전설 천장을 모두 표시한다. 도움말은 4등급 확률과 Special 별도 획득 경로를 같은 서버 값으로 안내한다.
- **검증**: Gamification Node test 39개와 모바일 `npm run check`, production build, CSS ownership·dead selector·중복 감사, `git diff --check`, Playwright 18개 전체 흐름이 통과했다.
- **배포 영향**: `StudyCrack_Gamification` Lambda 재배포가 필요하다. 새 DynamoDB 테이블·GSI·실행 역할 권한은 필요 없으며 기존 `StudyCrack_Game` 테이블에 PROFILE·DRAW·AWARD 레코드를 사용한다.
- **다음 단계**: FD-05에서 85종 도감·획득·수조 공개 화면과 네트워크·실계정 호환을 집중 검증한다.

## 2026-08-21 — FishDex Approved V2 FD-03 서버 카탈로그·호환 migration 완료

- **활성 카탈로그**: `fish-catalog.v2.mjs`에 승인 자산 85종을 등록하고 `speciesId`, FishDex ID, `assetKey`, 한국어 이름, category, motion, 희귀도, 지급 가능 상태를 단일 계약으로 고정했다. 분포는 Common 21, Rare 30, Epic 16, Legendary 8, Special 10이다.
- **스타터·호환**: 신규 스타터는 구피·네온테트라·퍼큘라흰동가리다. 기존 7종의 직접 대응 ID는 보존하고 이미지가 없는 기존 5종은 보유·먹이·배치·과거 DRAW 복원 전용 legacy resolver로 남겼다. legacy·pending·Special은 신규 draw 후보에 들어가지 않는다.
- **지연 migration**: PROFILE schema를 2로 올리고 최초 게임 요청에서 `fish-v2`를 한 번만 조건부 저장한다. 재화·수질·배치·보상·pending 상태를 유지하며 FISH와 DRAW 원본 레코드는 일괄 수정하지 않는다.
- **프론트 계약**: 모바일 응답 검증기와 도감 그룹이 다섯 희귀도를 수용한다. 서버가 제공하는 85개 `assetKey`는 FD-01 manifest와 FD-02 `FishArtwork`로 연결되며 legacy는 SVG fallback을 유지한다.
- **검증**: Gamification Node test 35개, 모바일 `npm run check`, production build, Playwright 18개 전체 흐름과 `git diff --check`가 통과했다.
- **배포 영향**: `StudyCrack_Gamification` Lambda 재배포가 필요하다. DynamoDB 새 테이블·속성 정의·GSI 작업은 없고 PROFILE 필드는 요청 시 additive migration된다. 모바일 정적 변경은 GitHub Actions 배포만 사용한다.
- **다음 단계**: FD-04에서 Legendary 확률·천장·중복 보상과 Special의 업적·운영 지급 경로를 확정한다.

## 2026-08-21 — FishDex Approved V2 FD-02 renderer 연결 완료

- **단일 renderer**: `FishArtwork`가 generated manifest를 소비하고 수조·스타터·보유 목록·관리·도감·Discovery·공유·플래너의 물고기 표현을 맡는다.
- **fish-v1 호환**: 승인 이미지가 대응되는 기존 7종은 WebP로 전환했고, 대응되지 않는 파랑돔·노랑꼬리돔·줄무늬정어리·황제엔젤피시·블루탱은 기존 SVG fallback을 유지한다.
- **상태·성능**: grid/detail/habitat별 responsive source, 고정 1:1 shell, lazy/eager 우선순위, fade-in, 로드 실패 fallback과 reduced-motion 처리를 적용했다. 초기 bundle은 유지되고 deferred app chunk는 276.9KiB다.
- **검증**: 전체 `npm run check`, production build, CSS/dead-code 계약과 320·390·430px 수조·도감·Discovery·공유 Playwright 2개 흐름을 통과했다.
- **backend 영향**: 없음. fish-v1 catalog와 보상 정책은 그대로다.
- **다음 단계**: FD-03에서 85종 fish-v2 catalog, `assetKey`·희귀도·category·motion 메타데이터와 기존 보유종 지연 migration을 서버에 추가한다.

## 2026-08-21 — FishDex Approved V2 FD-01 자산 파이프라인 완료

- **승인 원본 검증**: `StudyCrack_FishDex_Approved_V2`의 85개 PNG에 대해 ID·slug·중복·1920x1920 RGBA·pending/retired 종 유입을 검사한다.
- **runtime 파생 자산**: 투명 영역을 기준으로 trim·정규화한 256/512/768 WebP 255개와 checksum manifest를 생성했다. 총 배포 자산은 5.25MiB다.
- **배경 정제**: ID 051·053·054의 낮은 alpha texture만 파생 자산 단계에서 제거했으며 흰색과 navy 배경에서 사각 배경 및 가장자리 이상이 없음을 확인했다. 승인 원본은 수정하지 않았다.
- **자동 계약**: `npm run fishdex:build`, `npm run fishdex:check`를 추가하고 전체 `npm run check`에 자산 무결성 검사를 포함했다.
- **backend 영향**: 없음. 이번 FD-01은 앱 정적 자산과 빌드 도구만 변경한다.
- **다음 단계**: FD-02에서 generated manifest를 소비하는 `FishArtwork` renderer와 legacy SVG fallback을 구현해 기존 12종 서버 정책을 유지한 채 화면 call site를 교체한다.

## 2026-08-16 — CTO 전달본 G8 Legacy·성능 로컬 마감 완료

- **홈 레거시 제거**: `HomeScreen`, home overlay·presentation과 홈 전용 CSS를 제거하고 registry·screen context·resource 소유권을 정리했다. 과거 `screen=home` 링크는 `analysis`로 안전하게 정규화한다.
- **기능 재배치**: 공부·보상 panel은 timer, 입시 일정 sheet는 planner로 이동했다. 대학 환산·랭킹·알림 진입을 유지하고 MY 학습 서비스에 PRO 리포트 진입을 복구해 Basic 계정의 잠금·플랜 안내도 실제 클릭 경로로 연결했다.
- **구조 마감**: 앱은 41개 화면·5개 주 탭, 34개 CSS 소유 파일, 5개 JS chunk를 사용한다. dead code·unused export·신규 dead selector는 0건이다.
- **규모**: G0 이전 대비 모바일 앱 104개 파일에서 1,152줄을 추가하고 1,683줄을 제거해 순 531줄 감소했다. production build는 281개 모듈이며 초기 JS 526.6KiB, bootstrap CSS 77.8KiB다.
- **검증**: `npm run check`, production build, CSS 감사, architecture baseline, Playwright 18개 전체 흐름과 `git diff --check`를 통과했다.
- **backend 영향**: 전체 G0~G8에서 Lambda, API Gateway, DynamoDB 변경 없음. GitHub Actions 정적 배포만 해당한다.
- **남은 배포 조건**: dev에서 로그인 → 새로고침 → 새 탭 → 로그아웃과 환산점수·공부·수조 실데이터 smoke를 통과한 뒤 active 계획을 completed로 이관하고 main 승격을 검토한다.

## 2026-08-15 — CTO 전달본 G7 MY·계정·알림·지원 구현 완료

- **MY·구독 요약**: 프로필과 현재 이용 플랜, 이용 기간, 갱신·변경 예정 정보를 하나의 계층으로 정리했다. 현재 구독 상태를 우선하며 무료·기간제·평생 계정을 구분해 존재하지 않는 자동 결제일을 만들지 않는다.
- **계정정보 관리**: 이름, 전화번호 인증, 비밀번호, 마케팅 수신, Google/Naver 연결 상태를 단일 화면에서 관리한다. 플랜 확인과 탈퇴는 역할과 위험도에 맞춰 분리했다.
- **알림**: 실제 소비되는 플래너·리포트 설정만 제공하고 필수 서비스 알림을 명시했다. 목록은 7개 단위, 안 읽은 수와 상세 본문을 제공하며 선택한 알림만 읽음 처리한다.
- **지원**: 일반 문의, 데이터 오류 신고, 카카오 문의를 구분했다. 데이터 오류 신고는 Q&A에 구조화된 기본 내용을 채우며 한글 입력 focus를 유지한다.
- **검증**: `npm run check`, production build, CSS ownership/dead selector 검사, `git diff --check`, Playwright 전체 18개 흐름과 G7 타깃 시나리오가 통과했다.
- **backend 영향**: UserCore·Auth·Notification·QnaChat API와 Lambda, API Gateway, DynamoDB 변경 없음. 정적 프론트 배포만 필요하다.
- **다음 단계**: G8에서 잔여 onboarding 정합, 대체가 검증된 legacy 제거, bundle·접근성·성능·배포 조건을 마감한다.

## 2026-08-15 — CTO 전달본 G6 코칭·리포트·플랜·결제 구현 완료

- **코칭 첫 화면**: 실제 최신 주간 점검을 `피드백 도착 / 검토 대기 / 새 점검 시작`으로 요약하고, 신청 CTA·3단계 합격 설계·실제 점검/피드백 이력을 조밀한 순서로 재배치했다. 합격확률이나 고정 주간 데이터는 추가하지 않았다.
- **8단계 점검**: 기존 과목별 달성률, 플래너·모의고사 첨부, 추이와 질문 입력, 제출 API를 유지했다. sheet 진행률과 footer가 모바일 viewport와 safe area 안에서 유지되는지 브라우저 흐름으로 확인했다.
- **리포트·주간 피드백**: PRO 리포트의 loading·empty·error·발행 상태를 구분하고, 주간 점검을 공통 secondary intro·section 문법으로 통일했다. 실제 발행 URL만 다운로드하며 Q&A 입력과 튜터 피드백 원문을 보존한다.
- **잠금·플랜**: 잠긴 기능은 미리보기와 중앙 안내 뒤 플랜 선택으로 이동하며 즉시 결제로 강제하지 않는다. Basic·Starter·Standard·Pro는 기존 `PLAN_META` 가격·혜택 단일 원천을 유지하고 선택 상태를 접근성 속성으로도 표시한다.
- **결제 경계**: Standard·Pro의 선택 기간을 상세 요약과 함께 갱신하되, 임의 총액을 만들지 않고 실제 4주 단위 웹 결제에서 금액·적용 기간을 최종 확인하도록 명시했다. 모바일은 결제 완료나 구독 상태를 직접 확정하지 않는다.
- **검증**: `npm run check`, production build, CSS ownership/dead selector 검사와 Playwright 17개 전체 흐름이 통과했다. 320·430px 코칭 화면, 코칭 sheet, 리포트·Q&A, 잠금→플랜, PRO·8주 선택과 웹 결제 query 전달을 확인했다.
- **backend 영향**: ReportCore·FileService·Payment API와 Lambda, DynamoDB 변경 없음. 정적 프론트 배포만 해당한다.
- **다음 단계**: G7에서 MY·계정·알림·문의 화면을 전달본 계층과 개인정보 경계에 맞춰 재구성한다.

## 2026-08-15 — CTO 전달본 G5 환산 분석·대학·성적 구현 완료

- **환산 분석 계층**: 전달본의 합격확률 영역을 실제 `LIVE 환산점수`로 치환하고, 짙은 핵심 지표 띠 뒤에 희망 대학·시험 selector, 0–250 게이지, 합격·안정선, 과목별 원점수 +1 효율을 배치했다. 고정 확률·fixture 점수는 사용하지 않는다.
- **+1 재환산 정합**: 화면의 효율은 원점수 +1 전후 서버 환산점수를 각각 0–250 범위로 표시한 뒤의 차이다. 내부값이 `-50 → -40`이어도 화면에서 둘 다 0이면 `+0점`, `0 → 0`으로 표시하며 단순 delta를 현재 0점에 더하지 않는다.
- **플랜 경계**: Basic 이상은 국어·수학·탐구1·탐구2 전체 효율과 최고 반영 과목을 확인한다. Standard·Pro만 실제 `backtrace_required_raw` 결과로 최소 도달 조합을 표시한다.
- **대학 선택**: 추천 대학 새로고침과 대학명 한글 검색, 대학 선택 뒤 해당 대학 학과 검색의 2단계를 유지했다. 입력 focus와 긴 대학·학과의 가로 overflow를 확인했다.
- **성적 입력**: 국어·수학 공통/선택 원점수, 영어·한국사 등급, 탐구 과목·원점수를 6단계 숫자 입력으로 유지했다. 탐구 단계 이동 시 과목명과 점수를 함께 보존하고 마지막에 전체 환산·저장 후 modal을 닫는다.
- **검증**: `npm run check`, production build, CSS duplicate/dead selector 감사, Playwright 17개 전체 흐름이 통과했다. 320·430px 분석 화면, 최초 점수, 시험·대학 전환, Basic·Standard 권한과 성적 저장 종료를 확인했다.
- **backend 영향**: Analysis·UserCore API, Lambda, API Gateway, DynamoDB 변경 없음. 정적 프론트 배포만 해당한다.
- **다음 단계**: G6 코칭·리포트·플랜·결제 화면 재구성을 완료했다.

## 2026-08-15 — CTO 전달본 G4 수조·Discovery·도감 구현 완료

- **몰입형 수조**: 기존 밝은 일반 카드 중심 구성을 midnight habitat 중심으로 바꾸고, 서버 조개·먹이, 실제 3개 활성 슬롯, 연속 학습·수질 HUD를 첫 화면에 배치했다.
- **물고기 성장·관리**: 선택 물고기의 레벨·EXP·먹이와 이름·배치 기능을 보존했다. 보유 물고기는 가로 탐색 목록으로 압축해 수조 장면보다 관리 카드가 먼저 무거워지지 않도록 정리했다.
- **도감**: 12종 실제 catalog, 수집률, `전체/획득/미획득` 필터와 새 물고기 진입을 전달본 계층으로 구현했다. 획득 판정과 잔액은 Gamification 서버 응답만 사용한다.
- **Discovery**: 서버 선확정 pending draw, 새로고침 복원, 3단계 공개와 acknowledge 계약을 유지하면서 희귀도별 halo·particle·ring과 실패 안전한 선택적 효과음을 적용했다.
- **공유·접근성**: 개인정보·입시 성적 없는 Web Share와 clipboard fallback을 유지했다. 효과음 실패와 reduced motion에서도 보상 흐름이 중단되지 않는다.
- **검증**: `npm run check`, production build, CSS 감사, Playwright 16개 전체 흐름이 통과했다. 320·430px 수조·도감 캡처에서 가로 overflow가 없다.
- **backend 영향**: Gamification API·handler·Lambda, API Gateway, `StudyCrack_Game` 변경 없음. 정적 프론트 배포만 해당한다.
- **다음 단계**: G5에서 환산 분석·대학 선택·성적 입력을 전달본 계층으로 재구성한다.

## 2026-08-15 — CTO 전달본 G3 공부·플래너·랭킹 구현 완료

- **타이머 실행 우선**: 첫 화면을 오늘 플래너, 오늘 누적 공부와 시작, 보상, 주간 흐름 순으로 재구성했다. 실제 다음 미완료 일정을 바로 선택할 수 있으며 기존 확인 sheet와 서버 세션 생성 절차를 유지한다.
- **실데이터 요약**: 오늘 계획의 완료 개수·계획 시간 진행률, 서버 누적 시간과 실행 중 경과, 개별 세션을 현재 UserCore 응답에서만 표시한다. mock 공부량이나 checkbox 기반 선보상은 추가하지 않았다.
- **플래너 정합**: 오늘 진행 카드를 `완료/전체`, 완료 시간/총 시간과 물고기 feedback 중심으로 조밀하게 바꿨다. 오늘 항목, 주·월 달력, 단계형 추가, 편집·완료·삭제와 local-only 저장 경계는 그대로다.
- **랭킹 정리**: 일·주·월 전환, 내 순위·티어·전체 인원·상위 비율과 실제 공부시간을 한 계층으로 통합했다. unavailable, empty와 0초는 기존 서버 상태로 구분한다.
- **회귀 방지**: 장식 물고기의 species title이 화면 텍스트에 섞이지 않게 정리하고 E2E 문구를 새 진행률 표현에 맞췄다.
- **검증**: `npm run check`, production build, CSS duplicate/dead selector 감사, Playwright 16개 전체 흐름이 통과했다. 320·430px 플래너와 타이머에서 가로 overflow가 없다.
- **backend 영향**: study/planner API·handler와 UserCore·Gamification Lambda, API Gateway, DynamoDB 변경 없음. 정적 프론트 배포만 해당한다.
- **다음 단계**: G4에서 수조·물고기 발견·도감 화면을 전달본의 몰입형 구성으로 재구성한다.

## 2026-08-15 — CTO 전달본 G2 인증·회원가입·Onboarding 구현 완료

- **로그인 진입**: 공식 StudyCrack 로고를 compact brand tile로 사용하고 전달본의 trust blue, 조밀한 brand copy, full-width 입력·CTA와 provider 중앙 정렬을 현재 Google·Naver 실제 action 위에 적용했다.
- **계정 복구**: 이메일 찾기와 비밀번호 재설정은 중앙 공통 modal, 안정적인 field 높이·copy·footer CTA를 유지한다. focus trap, Escape, restore는 G1 계약을 그대로 쓴다.
- **단계형 회원가입**: `약관 → 본인 인증 → 이메일 → 계정 설정` 순서와 필수 4종·선택 마케팅 동의를 보존하면서 progress topbar, 단계 heading, field surface, checkbox와 action hierarchy를 전달본 구성으로 재정렬했다.
- **splash·소개**: full viewport splash에 공식 logo·크랙이를 배치하고, 3개 intro는 실제 지원학과 환산점수·원점수 1점 효율·플래너/코칭/리포트 가치만 보여주도록 정리했다. 합격확률 mock은 사용하지 않는다.
- **진단 화면**: `ob1~ob5`의 progress·title·description과 크랙이 안내 surface를 하나의 shell 문법으로 묶었다. 성적·MBTI·분석·플랜 state와 action은 바꾸지 않았다.
- **계약·검증**: auth presentation 검사와 Playwright 약관 전문·다음 단계 회귀를 보강했다. `npm run check`, production build, CSS duplicate/dead selector 감사, `git diff --check`, 전체 E2E를 통과했다.
- **backend 영향**: session, Cognito, `/api/auth`, social callback, Lambda, API Gateway, DynamoDB 변경 없음. 정적 프론트 배포만 해당한다.
- **다음 단계**: G3에서 타이머·플래너·랭킹을 전달본의 오늘 실행 중심 밀도로 재구성한다.

## 2026-08-15 — CTO 전달본 G1 Shell·Navigation·Overlay 구현 완료

- **하단 내비게이션**: `timer/planner/aquarium/analysis/strategy` 순서를 유지하면서 72px 고정 셸, compact label, 일반 active surface와 중앙 48px 수조 action을 전달 데모의 composition으로 재구성했다.
- **오버레이 공통화**: `Modal`, `Sheet`, 프로필·홈 drawer가 공통 focus trap, 최초 focus, Escape 닫기와 focus restore 계약을 사용한다. 브라우저 전용 처리는 `shared/browser/overlay-focus.js`가 소유한다.
- **모달·시트·드로어**: modal은 중앙·최대 84dvh, sheet는 handle·최대 92dvh·safe area, drawer는 visual viewport 전체 높이와 단일 slide motion을 사용하도록 정리했다.
- **레이어와 motion**: `app-screen-overlays`를 app frame 직속 레이어로 고정하고 화면별 `display:contents`를 제거했다. 오버레이 애니메이션을 강제로 끄던 예외를 제거하고 260~280ms reveal로 통일했다.
- **인증 복구**: 이메일 찾기와 비밀번호 재설정도 공통 `Modal`을 사용하도록 바꿔 로그인 이후 화면과 동일한 접근성·위치 계약을 따른다.
- **계약 보강**: UI·overlay 검사에 중앙 수조 action, stable icon wrapper, accessible name, focus trap·restore, sheet handle과 profile drawer 계약을 추가했다.
- **화면 확인**: 390x844 로그인·계정 복구 모달과 320·430px 분석·플래너·프로필 drawer를 확인했다. 중앙 수조 action의 layout shift와 가로 overflow는 없다.
- **검증**: `npm run check`, production build, CSS ownership·dead selector 감사, `git diff --check`, Playwright 15개 전체 E2E가 통과했다.
- **backend 영향**: Lambda, API Gateway, DynamoDB 변경 없음. 정적 프론트 배포만 해당한다.
- **다음 단계**: G2 인증·회원가입·Onboarding 화면을 전달 데모의 compact composition으로 재구성한다.

## 2026-08-15 — CTO 전달본 G0 Foundation 구현 완료

- **시각 기준 적용 시작**: 현재 앱 외관을 보존하지 않고 제공 코드·데모를 시각 source of truth로 사용하는 원칙에 따라 첫 공통 기반 변경을 적용했다.
- **색상 체계**: trust blue `#0A56B2`, aqua `#22B6A8`, reward gold `#F0B64D`, canvas `#F7F9FC`와 새 ink·line·surface 값을 foundation token에 반영했다.
- **밀도와 공통 요소**: type scale을 `22/18/16/13/11px`로 조정하고 card shadow, 48px CTA, input placeholder, button press와 progress motion을 reference 기준으로 통일했다.
- **계약 보강**: UI fixture를 16개 palette token·9개 AA pair로 갱신했고 foundation 밖 color literal 0건, CSS duplicate·dead selector 증가 0건을 확인했다.
- **수조 회귀 수정**: 물고기 SVG의 개별 `fishId`와 `speciesId` CSS class를 분리해 종류별 외관 선택자가 정확히 동작하도록 했다.
- **화면 확인**: 390x844 온보딩·로그인 화면을 확인했고 320x700에서 document·button·input 수평 overflow가 없음을 확인했다.
- **검증**: `npm run check`, production build, CSS 감사, `git diff --check`, Playwright 15개 전체 E2E가 통과했다.
- **backend 영향**: Lambda, API Gateway, DynamoDB 변경 없음. 정적 프론트 배포만 해당한다.
- **다음 단계**: G1 공통 Shell·Navigation·Overlay 구현을 완료했으며 G2 인증·회원가입·Onboarding으로 이동한다.

## 2026-08-15 — CTO 전달본 CMP-00~08 최종 구현 로드맵 완료

- **기준 고정**: 전달 ZIP의 SHA-256과 119개 실제 파일, 현재 `dev-mobile-main`의 기준 commit을 기록했다. 압축 해제본은 `/tmp`에서 읽기 전용으로만 조사했다.
- **현재 앱 인벤토리**: 42개 화면, `timer/planner/aquarium/analysis/strategy` 5개 탭, 12개 상태 slice와 feature request type을 기준선으로 고정했다.
- **전달본 인벤토리**: 실제 route/render tree, 제품 파일, generated UI, Manus 전용 파일, localStorage key와 mock 수치를 분리했다. `HomePage`, `CoachingPage`, `StatsTab`, `MyPage`, `Home`은 현재 렌더 트리에 없는 중복·legacy로 판정했다.
- **핵심 대응**: 전달본의 홈은 현재 타이머·분석으로 나눠 흡수하고, 합격확률은 폐기해 실제 환산점수로 치환한다. checkbox 기반 보상과 local 물고기 발견 대신 현재 UserCore·Gamification 서버 원장을 유지한다.
- **화면 대조**: 현재 42개 화면 모두에 소유 feature, 전달본 대응, 최종 판정과 보존 조건을 부여했다. `KEEP / RESTYLE / ADAPT / BUILD / MERGE / RELOCATE / REJECT / RETIRE / VERIFY`를 사용한다.
- **정보 구조**: `timer/planner/aquarium/analysis/strategy` 5개 주 탭을 유지한다. 전달 홈은 timer·analysis에 분리 흡수하고 legacy `home`은 의존성 이관 후 제거한다.
- **API·데이터 대응**: USER·GAME·ANALYSIS·AUTH·NOTI·REPORT·SUPPORT 요청을 실제 Lambda와 DynamoDB 원천에 연결했다. 공부 완료→집계→게임 보상은 기존 서버 원장과 멱등성을 유지한다.
- **현재 계약 간극**: 플래너 CRUD는 서버가 아니라 `localStorage` 소유다. 알림 설정 네 값 중 Reminder가 실제 소비하는 값은 `planner`, `report`뿐이다.
- **조건부 확장**: 교차 기기 플래너는 `StudyCrack_Planner`+UserCore 확장, 비회원 진단·claim·14일 이력은 별도 LearningProfile Lambda·테이블, 수조 테마는 기존 Gamification PROFILE 확장으로 분류했다.
- **시각 체계 번역**: 전달본의 선명한 trust blue·학습 aqua·보상 gold, 낮은 shadow와 compact typography를 현재 token에 연결했다. 현재 stable token 이름, modular CSS 소유권과 320~430px 유동 frame은 유지한다.
- **시각적 기준 강화**: 제공된 코드·데모가 프론트 외관의 source of truth다. 현재 디자인은 보존하지 않고 390x844에서 화면 composition·card geometry·색감·typography·navigation·overlay·motion이 거의 동일해질 때까지 재구현한다.
- **허용 차이 제한**: 공식 StudyCrack asset, 실제 API 데이터·기능, 접근성 보정과 320~430px 반응형 재배치만 reference와 다를 수 있다. 기능만 동작하고 외관 parity가 부족하면 완료로 보지 않는다.
- **공통 UI 소유권**: card·CTA·input·context header·navigation·modal·sheet·drawer는 components가, 화면 section 조합은 각 screens CSS가 소유한다. 중앙 수조 탭, overlay 강도, motion과 reduced-motion 규칙을 구체화했다.
- **적용 제외**: React 19·Tailwind·Radix, 390px 고정 frame, 원격 font 필수 의존성, Manus asset, inline color 복사와 합격확률·mock 지표는 적용하지 않는다.
- **위험도 등록**: 공통 기반과 현재 42개 화면에 사용자 가치, 구현 범위, 위험도, migration, 배포, 회귀 영역과 P0~P4 우선순위를 부여했다.
- **핵심 위험**: foundation blast radius, navigation·overlay stacking, dev 인증, 분석 race, 공부 완료·보상 분리, local-only 플래너, 결제 catalog, PII 공유와 legacy 제거 순서를 별도 위험으로 고정했다.
- **확장 분리**: 서버 플래너, 비회원 진단·claim·14일 이력, 수조 theme와 알림 소비 확장은 시각 개편과 같은 배포에 섞지 않는다.
- **잠정 실행 묶음**: G0 기반 → G1 공통 상호작용 → G2 인증 → G3 공부 → G4 수조 → G5 분석 → G6 코칭·상업 → G7 계정·운영 → G8 정리 순서를 확정했다.
- **파일 단위 로드맵**: G0~G8마다 실제 수정 예정 화면·CSS·component·contract 파일과 기본 읽기 전용 API·handler·backend 경계를 확정했다.
- **검증·배포**: 단계마다 check·build·E2E·4 viewport와 필요한 dev auth·실데이터 smoke를 지정했다. `dev-mobile-main` 구현 후 `dev` merge·GitHub Actions 자동 배포만 사용한다.
- **Rollback**: 단계별 독립 변경, API 계약 분리, additive migration, server 응답 전 성공 확정 금지와 main 승격 차단 조건을 작성했다.
- **다음 단계**: G0 Foundation과 G1 공통 Shell·Navigation·Overlay 구현을 완료했으며 G2 인증·회원가입·Onboarding으로 이동한다.
- **현재 영향**: 이번 단계는 조사 계획과 문서만 추가했다. 모바일 런타임, Lambda, API Gateway, DynamoDB 변경과 배포 요구사항은 없다.
- **활성 문서**: `docs/exec-plans/active/260815_mobile_cto_handoff_crosswalk.md`, `260815_mobile_cto_reference_inventory.md`, `260815_mobile_cto_screen_crosswalk.md`, `260815_mobile_cto_interaction_matrix.md`, `260815_mobile_cto_api_data_crosswalk.md`, `260815_mobile_cto_visual_crosswalk.md`, `260815_mobile_cto_gap_risk_register.md`, `260815_mobile_cto_implementation_roadmap.md`

### CMP-03 동적 전수조사 추가 완료

- **핵심 루프 순회**: 튜토리얼 5단계, 주 탭 5개, 플래너 100% 완료, 자동 급식·스트릭·물고기 발견·도감, 수조 꾸미기·공유를 직접 조작했다.
- **진단·가입 순회**: 비회원 문맥 선택부터 24문항, IPAR 결과, guest claim, 가입 4단계와 planner 복귀까지 완료했다. 로그인 계정 찾기와 MY·설정도 확인했다.
- **데모 결함**: 목표 대학 dead CTA, 새로고침 후 튜토리얼 재등장, 분석 대학명 불일치, `18개` 표기와 6개 목록, Basic 과목 효율 잠금, 동의 전 가입 버튼 활성, 코드 없는 휴대폰 인증, overlay 접근성 노출 등 14건을 분리했다.
- **적용 경계**: checkbox로 합격확률·스트릭·보상을 동시 확정하는 구조와 공유 poster의 합격확률은 적용하지 않는다. 현재 UserCore·Analysis·Gamification 서버 계약을 유지한다.
- **반응형**: 320·390·430px에서 확인했으며 전달본은 390px 기기 frame 중심이다. 현재 앱의 실제 유동 container·safe-area 구조를 유지한다.
- **추가 문서**: `docs/exec-plans/active/260815_mobile_cto_interaction_matrix.md`

### CMP-04 화면·상태 대응 확정 완료

- **42개 전수 판정**: bootstrap, onboarding, 주 탭, secondary, service, legal 화면을 빠짐없이 최종 대응표에 연결했다.
- **소유권 확정**: streak는 timer overlay, 도감·공유는 aquarium mode, 대학 추가는 analysis secondary, 플랜 catalog는 proIntro가 소유한다.
- **중복 제거 방향**: 현재 `home`은 직접 query 외 정상 navigation에서 사용하지 않으므로 timer·analysis로 잔여 의존성을 옮긴 뒤 registry와 CSS에서 제거한다. 목표 화면 수는 41개다.
- **신규 후보 제한**: 비회원 진단을 채택할 때만 guest context·assessment·result·claim 4개 public route를 추가 검토한다.
- **배포 영향**: 이번 단계는 문서만 변경했다. Lambda, API Gateway, DynamoDB와 모바일 런타임 배포는 필요 없다.

---

## 2026-08-13 — 모바일 타이머·학습 기록·서식지 로컬 구현 완료

- **공통 헤더 완료**: 타이머·플래너·수조·분석·학습 코칭을 `AppContextHeader`로 통합하고 미정의 제목 토큰을 제거했다.
- **분석 역할 정리**: 타이머의 `학습 대시보드`를 `환산 분석`으로 교체했다. legacy `home` 이동도 분석 탭으로 호환 처리해 대학·시험·환산점수를 분석이 전담한다.
- **공부 입력 완료**: 과목 선택 즉시 시작과 browser prompt를 제거했다. 플래너/직접 과목과 최대 80자 학습 내용을 확인한 뒤에만 서버 세션을 시작한다.
- **개별 기록 완료**: UserCore 세션에 `activity`와 날짜별 개별 세션 요약 행을 추가했다. 총 누적시간을 누르면 실행 중·완료 세션의 과목, 내용, 시각, 실제 시간을 펼쳐 본다.
- **규칙·서식지 완료**: Gamification 서버 상수 기반 public rule DTO를 프로필 응답에 추가했다. 도움말은 보상·상한·서식지·먹이·뽑기를 설명하고, 30일 서식지는 날짜 달력·범례·선택 상세로 교체했다.
- **주간 흐름·서식지 추가 정리**: 날짜별 막대를 과목 색상 누적으로 표시하고 선택 날짜의 과목 시간을 초 단위로 제공한다. 서식지의 중복 주간 strip은 제거하고 30일 달력만 유지한다.
- **알림 계약 교정**: 과거 `message/detail/actionType`과 표준 `title/body/type`을 함께 정규화한다. 제목·본문 반복의 직접 원인은 `detail` 누락이었으며 신규 관리자 공지는 `body`도 저장한다.
- **물고기 표현 보강**: 희귀도별 획득 ring·particle·등장 motion과 species별 SVG 실루엣을 추가해 후반 물고기의 형태 차이를 강화했다.
- **검증·배포**: 모바일 전체 check/build, Playwright 15개 흐름, UserCore 15개·Gamification 12개 핵심 테스트와 CSS 계약이 통과했다. 새 테이블·GSI·IAM 추가는 없고 `StudyCrack_UserCore`, `StudyCrack_Gamification`, `StudyCrack_Notification` Lambda 재배포 후 dev 실계정 smoke가 남았다.
- **활성 계획**: `docs/exec-plans/active/260813_mobile_timer_study_experience_refinement.md`

---

## 2026-08-12 — 모바일 수조 AQ-07 전환 코드·로컬 검증

- **기존 사용자 이관**: 게임 PROFILE에 `schemaVersion=1`을 추가하고 최초 조회에서 기존 잔액·물고기·천장·연속 학습 상태를 보존한 채 한 번만 지연 이관한다. 과거 공부 보상과 기본 물고기는 소급 지급하지 않는다.
- **단계적 공개**: 기존 전체 차단 설정과 함께 `off / allowlist / on` 공개 모드를 추가했다. 비허용 계정은 수조 하위 화면까지 닫히고 준비 안내만 본다.
- **실행 안정성**: 타이머는 서버 시작 시각을 기준으로 하며 백그라운드 복귀 즉시 동기화한다. 타이머·보상·먹이·뽑기 등 가치 변경 동작은 작업 잠금으로 빠른 중복 탭을 한 요청으로 수렴시킨다.
- **동시성 검증**: 동일 보상과 동일 뽑기를 각각 12건 동시에 호출해 원장·재화 변경이 한 번만 일어남을 검증했다. backend 212개 테스트가 통과했다.
- **모바일 검증**: 전체 검사, production build, 모바일 Chromium Playwright 15개 흐름이 통과했다. 65초 백그라운드 복귀, legacy `home`·`my` 탭 이관과 중복 탭도 자동 검사한다.
- **배포 영향**: `StudyCrack_Gamification` Lambda 재배포가 필요하다. 새 테이블·인덱스는 없고 기존 PROFILE이 자체 이관된다.
- **남은 게이트**: dev allowlist 설정 후 실계정 로그인 → 새로고침 → 새 탭 → 로그아웃, 타이머·보상·수조·뽑기와 오류 지표를 확인한 뒤 dev 전체와 main 순서로 공개한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-12 — 모바일 수조 AQ-06 분석·코칭·플랜 정합

- **환산점수 중심 분석**: 합격확률을 도입하지 않고 대학별 환산점수와 원점수 +1 전후 환산점수 차이를 유지했다. 서버가 일부 과목만 반환해도 국어·수학·탐구1·탐구2 네 과목을 고정 순서로 표시한다.
- **이용권 경계**: 활성 Basic 이상은 전 과목 효율을 확인한다. 최소 원점수 역산은 활성 Standard·Pro만 사용하며 만료된 Standard 상태가 화면 tier만으로 역산을 여는 경로를 차단했다.
- **코칭 3단계**: `학습 성향 분석 → 목표 대학 분석 → 합격 설계` 흐름을 코칭 첫 화면에 추가했다. 기존 주간점검 8단계 입력·저장·피드백 구조는 그대로 보존했다.
- **플랜 원천 동기화**: Basic 25,000원, Starter 39,000원, Standard 49,000원/4주, Pro 149,000원/4주를 웹 서비스·결제 원천과 계약 검사로 고정했다. Basic 전 과목 효율과 Standard 역산 기능도 플랜 설명에 명시했다.
- **검증**: 전체 검사, production build, Playwright 15개 흐름이 통과했다. 320·430px 분석·코칭 캡처에서 가로 넘침과 선택기 잘림을 확인하고 교정했다.
- **배포 영향**: AQ-06에서 `backend-backup/`과 DynamoDB 변경은 없다. 추가 Lambda 배포는 필요 없다.
- **다음 단계**: AQ-07에서 사용자 마이그레이션, 기능 플래그, dev 인증·세션, 타이머 백그라운드와 보상·가챠 동시 요청을 출시 조건으로 검증한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-05 플래너·프로필 정보 구조

- **오늘 실행 중심 플래너**: 첫 화면을 오늘 진도, 오늘 할 일, 다른 날짜 탐색, 주간 피드백 순으로 정리했다. 완료·삭제·단계형 추가·상세 편집과 기존 주·월 달력은 유지한다.
- **프로필 요약 서랍**: 타이머 상단 프로필 버튼에서 오른쪽 서랍을 열어 사용자·플랜, 이번 주 공부, 조개와 연속 학습일을 확인한다. 프로필 서랍은 하단 탭까지 포함한 앱 프레임 전체 높이를 사용한다.
- **기존 마이 기능 보존**: 마이페이지 전체 보기, 계정정보, 목표 대학·성적, 플랜·결제, 알림, 문의·FAQ를 보조 화면으로 연결했다. 공부·수조 통계 오류는 해당 요약만 제한하고 계정 기능을 막지 않는다.
- **반응형 정리**: 프로필 서랍은 별도 작은 화면 override 없이 유동 크기로 동작한다. 월 달력의 계획 개수는 날짜 우상단 배지로 표시해 320px에서도 날짜와 겹치지 않는다.
- **계약과 검증**: 42개 화면, 170개 사용자 동작, 229개 상태 필드 계약을 통과했다. 전체 검사, production build, Playwright 15개 흐름과 320·430px 프로필·플래너 시각 검증을 완료했다.
- **배포 영향**: AQ-05에서 `backend-backup/`과 DynamoDB 변경은 없다. 기존 API를 사용하는 프론트 변경이므로 추가 Lambda 배포는 필요 없다.
- **다음 단계**: AQ-06에서 분석을 환산점수·과목별 1점 환산 효율 중심으로 정합하고, Standard 역산과 학습 코칭·플랜 기능 경계를 검증한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-03B 인벤토리·배치·이름 관리

- **내 물고기 관리**: 수조 화면에 전체 보유 물고기 목록과 선택 상세를 추가했다. 각 카드에서 이름·레벨·희귀도·현재 슬롯을 확인하고 관리 대상을 바꿀 수 있다.
- **3슬롯 배치**: 왼쪽·가운데·오른쪽 세그먼트로 물고기를 이동하며, 현재 슬롯을 다시 누르면 수조에서 해제한다. 응답의 `activeFishIds`를 인벤토리와 대조해 장면을 갱신하므로 클라이언트가 배치 결과를 임의 확정하지 않는다.
- **이름 변경**: 한글·영문·숫자와 공백 제외 10자 안내를 제공하고 `rename_fish` 응답의 물고기로 인벤토리와 수조 장면을 함께 갱신한다. 입력 중에는 화면 전체를 다시 그리지 않아 모바일 키보드가 닫히지 않는다.
- **동시 동작 보호**: 먹이·배치·이름 변경 처리 중 관련 조작을 잠그며, 수조 밖 물고기에 대한 비정상 먹이 요청이 다른 활성 물고기로 대체되지 않도록 차단했다.
- **계약과 검증**: 배치·이름 변경 validator/API/controller/handler와 161개 사용자 동작 계약을 갱신했다. 전체 검사, production build와 Playwright 12개 흐름이 통과했으며 선택 → 먹이 → 이름 변경 → 슬롯 이동 → 새로고침 복원을 확인한다.
- **배포 영향**: AQ-03B에서 `backend-backup/` 소스는 변경하지 않았다. 기존 Gamification Lambda의 `set_active_fish`, `rename_fish`를 사용하므로 AQ-01 백엔드가 배포돼 있으면 추가 Lambda 배포나 DB 작업은 없다.
- **다음 단계**: AQ-04에서 가챠 pending 복구, 3단계 상자 공개, 중복 획득 결과와 12종 도감 UI를 연결한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-03A 핵심 화면·스타터·성장 연결

- **수조 핵심 화면**: 로그인 후 지연 로딩되는 `AquariumScreen`을 추가하고 서버 수조 프로필, 3개 활성 슬롯, 재화, 수질과 물고기 카탈로그를 연결했다. 로딩·오류·스타터 잠금·선택 가능·획득 완료 상태를 각각 분리했다.
- **스타터와 성장**: 첫 유효 공부 뒤 해금된 사용자는 스타터 3종 중 하나를 선택할 수 있다. 선택 결과는 중앙 슬롯과 성장 카드에 즉시 반영되며, 먹이 주기는 서버 응답의 최신 먹이 잔액·EXP·레벨·수질만 사용한다.
- **전용 장면과 내비게이션**: 물고기 3슬롯, 수초·바닥·기포와 접근성 이름을 갖춘 반응형 수조 장면을 추가했다. 하단 탭은 `타이머 / 플래너 / 수조 / 분석 / 학습 코칭`으로 전환했고 기존 마이 기능은 타이머 상단 프로필 진입으로 보존했다.
- **구조 계약**: 수조 API validator·resource·state·handler를 gamification feature에 모으고 `aquarium.css`를 로그인 후 deferred CSS 소유 파일로 등록했다. 42개 화면, 159개 사용자 동작, 224개 상태 필드 계약으로 갱신했다.
- **검증**: 모바일 전체 검사, production build와 Playwright 12개 흐름이 통과했다. 첫 물고기 선택 → 중앙 배치 → 먹이 주기 → EXP 반영 E2E도 포함한다.
- **배포 영향**: AQ-03A 자체의 백엔드 소스 변경은 없다. AQ-01에서 구현한 Gamification Lambda, `/api/game` route와 `StudyCrack_Game` 테이블이 아직 반영되지 않았다면 해당 인프라 및 Lambda 배포가 선행돼야 한다.
- **다음 단계**: AQ-03B에서 보유 물고기 3슬롯 배치·해제, 이름 변경과 인벤토리 관리 화면을 구현한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-02C 전용 타이머 기본 화면·전환기 탭

- **기본 화면 전환**: 로그인 세션의 스플래시, 인증 화면 재진입, 온보딩 완료와 빈 history 뒤로가기를 모두 전용 `timer` 화면으로 연결했다. 저장된 이전 `home` 탭 값도 자동으로 `timer`로 이관한다.
- **타이머 정보구조**: 서버 오늘 누적시간, 시작·완료, 보상 복구, 오늘 플래너, 주간 흐름, 30일 서식지와 게임 재화를 한 화면에 배치했다.
- **전환기 하단 탭**: `타이머 / 플래너 / 분석 / 학습 코칭 / 마이`로 재편했다. 수조 탭과 프로필 서랍이 아직 없는 상태에서 기능을 잃지 않도록 마이는 AQ-05까지 유지한다.
- **기존 기능 보존**: 기존 홈은 `학습 대시보드` 보조 화면으로 유지해 대학 환산점수·입시 캘린더·랭킹·알림·리포트 진입을 보존했다.
- **검증**: 모바일 전체 검사, production build와 Playwright 11개 흐름이 통과했다. 화면 registry는 41개이며 CSS 중복·소유권·미사용 selector 신규 위반은 없다.
- **배포 영향**: AQ-02C 자체는 프론트 전용이다. 별도 Lambda·테이블 변경은 없으며 AQ-02B UserCore 미배포 상태라면 해당 재배포만 필요하다.
- **다음 단계**: AQ-03에서 수조 전용 화면과 활성 물고기·스타터 선택·먹이·성장 UI를 구현한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-02B 서버 공부 요약·주간 흐름

- **서버 단일 원천**: UserCore `get_study_summary`가 KST 기준 오늘·이번 주 총시간, 세션 수, 과목별 시간과 7일 일별 시간을 반환한다.
- **원자적 집계**: 세션 완료, 일·주·월 랭킹, 사용자 일간 총합·과목 총합을 한 트랜잭션으로 저장해 완료 재시도에도 시간이 중복되지 않는다.
- **기존 기록 호환**: 배포 전 일간·주간 랭킹 총시간을 요약 총합의 하한으로 사용해 기존 사용자의 오늘·주간 시간이 0으로 초기화되지 않는다.
- **모바일 resource**: study summary validator·API·resource 상태를 추가하고 홈 최초 진입과 공부 완료 뒤 독립적으로 재조회한다.
- **홈 UI**: 오늘 누적은 서버 값에 실행 중 경과만 더하고, 이번 주 7일 막대와 오늘 과목별 시간을 기존 학습 흐름 카드에 연결했다. 다른 홈 기능은 유지했다.
- **검증**: backend 전체 검사·테스트 208개, 모바일 전체 검사, production build, Playwright 10개가 통과했다.
- **배포 영향**: `StudyCrack_UserCore` Lambda 재배포가 필요하다. 새 테이블·인덱스는 없다.
- **다음 단계**: AQ-02C에서 전용 타이머 화면을 기본 진입으로 승격하고 신규 하단 탭 전환을 준비한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-02A 서버 타이머·보상·서식지 연동

- **서버 기준 타이머**: 공부 시작 전에 서버 세션을 생성하고 완료 응답의 duration만 오늘 기록·과목 기록·플래너 진척에 반영하도록 기존 로컬 선반영 흐름을 교체했다.
- **보상 복구**: 완료와 보상 청구를 분리해 완료 실패 시 보상을 막고, 보상만 실패하면 세션 ID를 보존해 재청구한다. 실행 중 세션과 미수령 보상은 새로고침 뒤 복구된다.
- **게임 resource**: `/api/game` binding, game profile·30일 habitat API와 validator·slice·독립 resource hook을 추가했다. 게임 장애는 홈 전체 로딩과 분석을 차단하지 않는다.
- **홈 호환 UI**: 공부 저장·보상 상태와 최근 7일·30일 서식지를 기존 홈에 연결했다. 대학 환산점수·캘린더·랭킹·알림·리포트 진입은 유실 없이 유지했다.
- **경계 정리**: planner에서 타이머 상태·handler·legacy `record_study_session` 프론트 경로를 제거하고 study·gamification 소유권과 자동 검사를 고정했다.
- **검증**: 모바일 전체 검사, production build, Playwright 핵심 흐름 10개가 통과했다.
- **다음 단계**: AQ-02B에서 서버 일별·주간 공부 요약과 전용 타이머 정보구조를 구현한 뒤 하단 탭 전환을 준비한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-01C 가챠·서식지 구현

- **원자적 가챠**: 조개 30개 차감, 70/25/5 희귀도, Rare 10회·Epic 30회 천장, 첫 3회 미획득 우선과 중복 EXP·최대레벨 환급을 `draw-v1` 정책으로 구현했다.
- **중단 복구**: DRAW 원장과 PROFILE pending ID를 저장한다. 동일 requestId 재요청은 같은 결과를 반환하며, 결과 확인 전에는 다음 뽑기를 막고 중단된 공개 화면을 복원한다.
- **일일 정산**: KST 날짜별 공부시간으로 수질 40~100, 연속 학습일과 마지막 유효 공부일을 하루 한 번 정산한다. 오늘 첫 유효 보상에는 streak가 즉시 반영된다.
- **30일 서식지**: `get_study_habitat`이 DAY 원장에서 최대 30일을 채워 stage 0~4와 서버 공부시간을 반환한다.
- **출시 제어**: `GAME_FEATURE_ENABLED=false`로 게임 API 전체를 안전하게 닫을 수 있다.
- **검증**: 확률 경계·천장·신규 보호·중복 성장·환급·pending 복구·수질 clamp·누락 날짜·streak 중복 방지 테스트를 추가해 backend 구조 검사와 전체 테스트 204개가 통과했다.
- **다음 단계**: AQ-02에서 모바일 study/game API·validator·state를 추가하고 기존 홈 타이머를 서버 세션 → 보상 청구 pipeline에 연결한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-01B 물고기 성장 기반 구현

- **카탈로그**: `fish-v1`에 해수 어종 12종과 스타터 3종을 고정 ID·희귀도·표시명·기본 이름·색·움직임 메타데이터로 구현했다.
- **스타터**: 첫 유효 공부 후 `starterState=selectable`이 되며, `claim_starter_fish`가 물고기 생성과 중앙 슬롯 배치를 한 트랜잭션으로 확정한다. 동일 선택 재시도는 기존 결과로 수렴한다.
- **성장**: 누적 EXP에서 1~10레벨과 진행률을 서버가 파생한다. `feed_fish`는 requestId별 원장으로 먹이 1개, EXP 10, 하루 최대 3회의 수질 상승을 원자적으로 반영한다.
- **관리 API**: 카탈로그·인벤토리, 물고기 상세, left·center·right 활성 배치, 이름 변경을 추가했다. 응답은 저장 키 없이 사용자에게 필요한 필드만 반환한다.
- **검증**: 카탈로그 수·스타터 제한·레벨 경계·먹이 상한·멱등 재시도·이름·배치 테스트를 추가해 backend 구조 검사와 전체 테스트 192개가 통과했다.
- **다음 단계**: AQ-01C에서 가챠 원자 트랜잭션·천장·중복 성장·pending 결과 복구와 수질 일일 정산·30일 서식지를 구현한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조 AQ-01A 서버 세션·보상 원장 구현

- **서버 공부 세션**: UserCore에 `start_study_session`, `complete_study_session`을 추가했다. 시작·종료 시각과 duration은 서버가 확정하며 완료와 일·주·월 랭킹 집계를 하나의 트랜잭션으로 처리한다.
- **전환기 보호**: 기존 `record_study_session` 응답은 유지하되 저장 레코드를 `rewardEligible=false`로 명시해 클라이언트가 보낸 duration으로 게임 재화를 얻지 못하게 했다.
- **신규 게임 경계**: `StudyCrack_Gamification`을 추가하고 프로필 지연 생성, `get_game_profile`, `claim_study_reward`, 공부 세션 원본 일관 읽기와 게임 테이블 repository를 분리했다.
- **경제·무결성**: 10분 최소 보상, 시간 구간별 조개·먹이, KST 일일 상한, 첫 유효 공부 수질 +2를 구현했다. 세션별 보상 원장과 profile version 조건을 같은 트랜잭션에 넣어 재시도·동시 청구의 중복 지급을 막는다.
- **검증**: backend 구조 검사와 전체 unit·handler 테스트 184개가 통과했다.
- **AWS 반영**: UserCore 재배포와 함께 신규 Gamification Lambda, `/api/game` route, `StudyCrack_Game` 테이블 및 최소 IAM 권한 설정이 필요하다.
- **다음 단계**: AQ-01B에서 12종 카탈로그, 스타터 선택, 물고기 인벤토리·먹이·EXP 정책을 구현한 뒤 AQ-02 타이머 UI와 연결한다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-11 — 모바일 수조·물고기 성장 시스템 v1 상세 사양 완료

- **카탈로그**: 해수 어종 12종을 Common 4·Rare 4·Epic 4로 확정하고 species ID, 표시 이름, 기본 이름, 색상, 실루엣과 움직임을 정의했다.
- **성장**: 첫 유효 공부 뒤 스타터 3종 선택, 플랑크톤 1개당 EXP 10, 10레벨 누적 EXP 곡선과 네 단계 시각 성장을 확정했다.
- **관리**: 활성 물고기 최대 3마리, 슬롯 배치, 이름 규칙, 먹이 입력 잠금, 최대레벨 처리와 수질 40~100 일일 정산 규칙을 정의했다.
- **경제**: 공부시간별 조개·플랑크톤 보상과 일일 상한, 조개 30개 가챠, 70/25/5 확률, Rare·Epic 천장, 신규 사용자 보호와 중복 EXP·환급 정책을 확정했다.
- **무결성**: 클라이언트 duration 기반 legacy 세션은 게임 보상에서 제외하고 UserCore의 서버 시작·완료 세션을 보상 근거로 사용하도록 실행 계획을 보강했다.
- **디자인**: Cracky의 네이비 외곽선·큰 눈·셀 셰이딩을 따르는 12종 × 2 pose WebP, 수조 palette, 장면·모션·접근성·지연 로딩 규격을 정했다.
- **상세 사양**: `docs/algorithms/aquarium-gamification.md`
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-10 — 모바일 공부-수조 성장 루프 레퍼런스 분석 완료

- **핵심 변화**: 기존 홈 중심 구조를 `타이머 → 공부 보상 → 먹이 주기 → 물고기 성장 → 수조 수집 → 재학습` 순환 구조로 바꾸는 대규모 정보 구조 개편을 분석했다.
- **내비게이션**: 레퍼런스의 `타이머 / 플래너 / 수조 / 분석 / 코칭` 하단 탭과 프로필 서랍을 기준으로 삼되, 현재 마이의 계정·성적·알림·문의·구독 기능은 보조 화면으로 보존한다.
- **수조 도메인**: 조개·먹이, 물고기 인벤토리·EXP·레벨, 수질, 30일 서식지, 도감, 원자적 가챠와 공유 흐름을 구체화했다.
- **백엔드 권장안**: UserCore의 공부 세션을 단일 원천으로 유지하고 신규 `StudyCrack_Gamification`과 게임 테이블이 보상 원장·재화·수집을 소유하도록 분리한다. 세션 ID와 요청 ID 기반 중복 방지가 필수다.
- **기존 정책 보존**: 분석은 합격확률을 도입하지 않고 환산점수와 실제 재계산 결과를 사용한다. Basic 이상은 전체 과목 1점 효율을 보고 Standard 이상만 역산을 사용한다.
- **코드 설계**: 현재 `HomeScreen`, planner slice·handler, screen registry, API controller와 UserCore 공부 세션 트랜잭션을 조사해 신규 study·gamification·ranking feature, 화면·CSS, handler와 Gamification Lambda의 파일 단위 소유권을 확정했다.
- **진행 상태**: 레퍼런스 동작 분석과 8단계 실행 계획, 실제 변경 파일, API payload, app state, DynamoDB 트랜잭션, 자동 검사와 첫 구현 묶음까지 구체화했다. 구현은 아직 시작하지 않았다.
- **활성 계획**: `docs/exec-plans/active/260810_mobile_aquarium_study_loop_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-09 문서·운영 정리 완료

- **공개 개발 문서**: 루트 `README.md`의 프론트 스택을 기존 웹 Vanilla JS와 모바일 React/Vite 혼합 구조로 정정하고, `MOBILE_DEVELOPMENT.md`에 설치·검사·빌드, source layout, feature 의존 규칙, API result, CSS 소유권과 viewport 검증을 공개 가능한 수준으로 문서화했다.
- **공개/내부 경계**: 공개 문서는 개발 계약만 포함하고, 운영 인프라·인증 내부 동작·사업 로직은 ignore된 `docs/`, `ARCHITECTURE.md`, `backend-backup/`에서만 관리하도록 소유권을 확정했다.
- **계획 정리**: 로컬 구현이 완료된 모바일 계획 10개를 `completed/`로 이관했다. `active/`에는 Reminder 운영 검증, 튜터 인증 인프라 라우팅, 모바일 dev 실세션 스모크만 남겼다.
- **운영 백로그**: 최신 분석·사용자·인증·리포트 백엔드 반영, 인증 필수 환경값 확인, 실제 역할·쿠키·데이터 smoke와 private backend source commit/배포 버전 대응을 하나의 dev smoke 문서로 통합했다.
- **최종 구조**: 모바일은 React 화면 40개, feature slice 10개, modular CSS 34개 구조이며 주요 백엔드 entry는 Analysis 117줄, UserCore 74줄, Auth 124줄, ReportCore 65줄이다.
- **검증 기준**: 모바일 check/build/Playwright, CSS 중복 감사, diff 검사와 backend 172개 계약 검사를 마감 기준으로 유지한다.
- **완료 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`
- **활성 계획**: `260601_reminder_schedule_diagnosis.md`, `260604_tutor_auth_separation.md`, `260706_mobile_dev_smoke_backlog.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08F ReportCore 모듈화 완료

- **리포트 경계**: 15개 route를 MBTI·주간·PRO·관리자 handler와 router로 이동하고 DynamoDB, S3, Solapi, 암호화, 알림과 권한 판정을 repository/provider/service로 분리했다.
- **정책 고정**: KST 주차, legacy 피드백 병합, 플랜별 제출 제한, 피드백 allowlist, 튜터 정산 중복 방지와 학생 응답의 운영 초안 비노출을 순수 policy로 고정했다.
- **보안**: MBTI 보고서 S3 키는 정식 16개 유형만 허용한다. 임의 4글자 유형은 400으로 차단한다.
- **구조 기준선**: ReportCore entry는 972줄에서 65줄로 감소했다. 전체 route 소유권, 직접 데이터 명령 금지, service의 AWS SDK 비의존과 65줄 상한을 구조 검사로 고정했다.
- **검증**: ReportCore fixture 20개를 추가해 backend 구조 검사와 테스트 172개, 모바일 check/build, Playwright 10개 흐름이 통과했다. API·DynamoDB 변경은 없다.
- **배포**: 실제 반영에는 `StudyCrack_ReportCore` Lambda 재배포가 필요하다. dev에서 주간 제출·튜터 피드백과 PRO 요청·검수·발행의 역할별 smoke가 필요하다.
- **다음 단계**: ARCH-09에서 공개/비공개 문서 소유권, 최신 구조 수치와 배포·실세션 smoke backlog를 정리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08E3 Auth 모듈화 완료

- **소셜 계정**: 신규 가입 대기·약관 확정, 기존 이메일 연결, 기존 계정 로그인, 연결 해제와 탈퇴 재인증을 handler·service·repository·policy로 분리했다.
- **세션**: silent refresh, 로그인 cookie 등록, body refresh와 logout을 session handler/provider로 이동했다. 기존 cookie·token 검증과 응답 계약을 유지한다.
- **보안**: 소셜 Cognito 비밀번호의 fallback secret을 제거했다. 배포 환경에 `SOCIAL_AUTH_SECRET`이 반드시 필요하며 값은 공개 코드·문서에 남기지 않는다.
- **구조 기준선**: Auth entry는 667줄에서 124줄, 최초 1,326줄에서 1,202줄 감소했다. 전체 19개 route 소유권, 직접 AWS command 금지와 124줄 상한을 구조 검사로 고정했다.
- **검증**: backend 구조 검사와 테스트 152개, 모바일 check/build, Playwright 10개 흐름이 통과했다. API·DynamoDB 변경은 없다.
- **배포**: `StudyCrack_Auth` Lambda 재배포와 `SOCIAL_AUTH_SECRET` 설정 확인이 필요하다. 이후 dev 일반 가입·복구 및 일반·Google·Naver 로그인 → 새로고침 → 새 탭 → 로그아웃 스모크가 필수다.
- **다음 단계**: ARCH-08F에서 `StudyCrack_ReportCore`를 같은 경계로 분리한 뒤 ARCH-09 문서·운영 정리를 마감한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08E2 Auth 가입·복구 경계 완료

- **인증 코드**: SMS·이메일 challenge 발송과 검증을 handler·policy·repository·messenger로 분리하고 10분 TTL과 검증 marker 계약을 고정했다.
- **일반 가입**: 가입 완료, 대학 목록, 튜터 초대코드를 registration 경계로 이동했다. 학생·튜터·관리자 저장과 마케팅 동의, 초대코드 소진, 환영 알림을 유지한다.
- **가입 보안**: Cognito의 이메일·전화번호와 실제 인증 대상을 대조하고 만료된 VERIFIED marker를 거부한다. 정상 응답은 유지하며 타인 sub 대입과 만료 인증 재사용만 403으로 차단한다.
- **계정 복구**: 학생→튜터 이메일 찾기와 비밀번호 초기화를 recovery 경계로 이동했다. 마스킹과 기존 오류 문구를 유지하고 변경 직전 인증코드 TTL을 재검증한다.
- **구조 기준선**: Auth entry는 1,038줄에서 667줄, 최초 1,326줄에서 659줄 감소했다. 10개 route 재유입과 667줄 초과를 구조 검사로 차단한다.
- **검증**: Auth fixture 16개를 추가해 backend 135개, 모바일 check/build, Playwright 10개 흐름이 통과했다. API·DynamoDB 변경은 없다.
- **배포**: 실제 반영에는 `StudyCrack_Auth` Lambda 재배포가 필요하다. 배포 후 일반 가입·비밀번호 복구 및 일반·Google·Naver 로그인 → 새로고침 → 새 탭 → 로그아웃 dev 스모크가 필수다.
- **다음 단계**: ARCH-08E3에서 소셜 가입·연결·재인증과 session refresh/logout route를 분리해 Auth entry를 200줄 이하로 완료한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08E1 Auth 기반 경계 완료

- **요청 경계**: Auth의 CORS allowlist, base64 body, cookie/Bearer parsing과 Authorizer 우선 사용자 식별을 공통 request 모듈로 이동했다.
- **세션 보안**: access/refresh cookie 정책과 Cognito RS256/JWKS 검증을 독립 모듈로 분리했다. issuer·token use·client id·만료·access/id 사용자 일치를 가입 쿠키 발급 전에 검증한다.
- **소셜 provider**: Google/Naver code 교환·프로필 정규화와 provider/callback URL allowlist를 adapter가 소유한다. 로그인과 탈퇴 재인증이 같은 경계를 사용한다.
- **구조 기준선**: Auth entry는 1,326줄에서 1,038줄로 감소했다. 이 상한 증가, provider endpoint와 서명 검증의 entry 재유입, service의 AWS SDK import를 구조 검사로 차단한다.
- **검증**: Auth fixture 11개를 추가해 backend 구조 검사와 전체 unit·handler 테스트 119개가 통과했다. API·DynamoDB 변경은 없다.
- **배포**: 이 변경을 AWS에 반영하려면 `StudyCrack_Auth` Lambda 재배포가 필요하다. 인증 변경이므로 배포 후 dev 일반·Google·Naver 로그인 → 새로고침 → 새 탭 → 로그아웃 스모크가 필수다.
- **다음 단계**: ARCH-08E2에서 인증 코드·일반 가입·계정 복구·프로필 변경을 handler/service/repository로 분리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08D4 UserCore 모듈화 완료

- **일정·공부 기록**: 개인 일정 CRUD와 공부 세션·랭킹을 handler·policy·repository로 이동했다. 일정 소유권·동시성 409, KST 일/주/월 경계, 세션 중복 방지와 상위 100명 계약을 유지한다.
- **회원 탈퇴**: 소셜 재인증 토큰 만료·사용자 일치·단일 소비와 학생/튜터 DB·Cognito 삭제를 deletion 경계로 분리했다.
- **요청·인증 조립**: CORS·body·Bearer/cookie parsing, Authorizer/token fallback, 연결 계정 치환, 학생 쓰기 역할 차단, 알림 저장을 각 전용 경계로 이동했다.
- **구조 기준선**: UserCore entry는 595줄에서 74줄로 감소했다. 최초 1,495줄 대비 1,421줄을 분리했고 74줄 상한, 직접 AWS data command와 이관 route 재유입을 구조 검사로 차단한다.
- **검증**: backend 구조 검사와 전체 unit·handler fixture 108개가 통과했다. API·DynamoDB 변경은 없다.
- **배포**: 이 변경을 AWS에 반영하려면 `StudyCrack_UserCore` Lambda 재배포가 필요하다.
- **다음 단계**: ARCH-08E에서 `StudyCrack_Auth`를 요청·provider·가입·토큰·계정 연결 경계로 분리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08D3 UserCore 프로모션·튜토리얼 경계 완료

- **프로모션 분리**: KCC 지급, 무통장 확인, MBTI 보고서를 promotion handler·policy·repository로 이동했다. 기존 지급과 동시 요청의 중복 차단, PRO 뒤 Standard 예약, 마케팅 동의 기록을 유지한다.
- **파일 보안**: MBTI 보고서 서명 URL을 S3 repository로 분리하고 16개 정식 유형만 object key로 허용한다.
- **튜토리얼 분리**: 보상과 진행 상태 route를 tutorial handler로 이동했다. 유료 플랜 유지, free trial 전환, 이전 상태 보존과 조건부 중복 수령 차단을 고정했다.
- **구조 기준선**: UserCore entry는 878줄에서 595줄로 감소했다. 이관한 여섯 route의 entry 재유입과 595줄 초과를 구조 검사로 차단한다.
- **검증**: backend 구조 검사와 전체 unit·handler fixture 84개가 통과했다. DynamoDB 변경은 없고 잘못된 MBTI 유형은 400으로 차단된다.
- **배포**: 이 변경을 AWS에 반영하려면 `StudyCrack_UserCore` Lambda 재배포가 필요하다.
- **다음 단계**: ARCH-08D4에서 개인 일정·공부 랭킹·회원 탈퇴를 분리하고 인증·CORS·알림 조립을 정리해 entry를 200줄 이하로 완료한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08D2 UserCore 학업 쓰기 경계 완료

- **계정정보 변경**: 회원정보 route를 account handler로 이동하고 학생·튜터별 허용 필드, 알림 설정 allowlist, 마케팅 동의·철회 시각을 순수 policy로 분리했다.
- **전화번호 인증**: 번호 정규화와 인증 TTL 확인 후 인증 증명 소비와 회원 갱신을 repository 단일 트랜잭션으로 유지했다. 기존 400·428·409 응답을 고정했다.
- **성적·목표 대학**: 정성·정량 성적과 목표 대학 route를 academic handler로 이동했다. 과탐Ⅱ 별칭·응시 자격, 6칸 정규화, 변경 횟수와 24시간 유예를 순수 policy가 소유한다.
- **구조 기준선**: UserCore entry는 1,155줄에서 878줄로 감소했다. 이관한 네 route의 entry 재유입과 878줄 초과를 구조 검사로 차단한다.
- **검증**: backend 구조 검사와 전체 unit·handler fixture 71개가 통과했다. API·DynamoDB 변경은 없다.
- **배포**: 이 내부 리팩터링을 AWS에 반영하려면 `StudyCrack_UserCore` Lambda 재배포가 필요하다.
- **다음 단계**: ARCH-08D3에서 KCC·무통장·MBTI 프로모션과 튜토리얼 보상·상태 저장 경계를 분리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08D1 UserCore 읽기 경계 완료

- **읽기 route 분리**: 사용자 전체·로그인 프로필·마이페이지·결제·분석·튜터 공개 프로필 여섯 route를 router와 profile handler로 이동했다. 목적별 응답 최소화와 튜터 개인정보 비노출 계약은 그대로다.
- **저장소와 정책 분리**: 학생·튜터·관리자 조회 및 예약 구독 갱신은 repository, 역할 판정·민감 필드 제거·예약 승격은 access service, 등급 만료와 KCC 지급 계산은 AWS 의존 없는 subscription policy가 담당한다.
- **구조 기준선**: UserCore entry는 1,495줄에서 1,155줄로 감소했다. 1,155줄 상한, service의 AWS SDK 비의존, 이관한 route의 entry 재유입을 구조 검사로 차단한다.
- **검증**: backend 구조 검사와 Analysis 포함 unit·handler fixture 60개가 통과했다. API·DynamoDB 변경은 없다.
- **배포**: 이 내부 리팩터링을 AWS에 반영하려면 `StudyCrack_UserCore` Lambda 재배포가 필요하다.
- **다음 단계**: ARCH-08D2에서 회원정보·성적·목표 대학 쓰기 route와 전화번호 인증 증명 소비를 account·academic 경계로 분리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08C Analysis 모듈화 완료

- **튜토리얼 경로 분리**: 2과목 상승 전략과 추천 대학 선정을 router·handler로 이동하고 전략 계산을 순수 service로 분리했다.
- **대학 환산 엔진**: 환산식 탐색, 응시 조건, 변환표준점수, 영어 등급, 가중합과 선택·필수 합산을 `admission-engine.mjs`가 단일 소유한다. 기존 계산 로그와 응답 shape를 유지한다.
- **조립 파일 완료**: Analysis entry는 1,409줄에서 117줄로 감소했다. 최초 2,951줄 대비 2,834줄이 분리됐고 117줄 상한과 전체 route의 router 소유권을 구조 검사로 고정했다.
- **검증**: backend 구조 검사와 unit·handler·추천 성공 fixture 테스트 49개가 통과했다. API·DynamoDB 변경은 없다.
- **배포**: 이 내부 리팩터링을 AWS에 반영하려면 `StudyCrack_Analysis` Lambda 재배포가 필요하다.
- **다음 단계**: ARCH-08D에서 같은 패턴을 `StudyCrack_UserCore`에 적용하고 학생·구독·목표 대학·튜토리얼 저장 경계를 분리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-10 — 모바일 시스템 구조 재정비 ARCH-08B 핵심 분석 경계 완료

- **핵심 route 분리**: `analyze_my_targets`, `simulate_score_rise`, `backtrace_required_raw`를 router와 독립 handler로 이동했다. request type과 응답 shape는 바꾸지 않았다.
- **계산 service 분리**: 모의고사 점수표 조회·공통/선택 조합, 수능 보정 context, 역산 탐색 계획을 AWS 의존 없는 service로 분리했다.
- **구조 기준선**: Analysis entry는 ARCH-08A의 2,456줄에서 1,409줄로 감소했다. 구조 검사는 이 상한 증가, 핵심 route의 entry 재유입, service의 AWS SDK 접근을 차단한다.
- **검증**: backend 구조 검사와 단위·handler 테스트 37개가 통과했다. API·DynamoDB 변경은 없다.
- **배포**: 이 내부 리팩터링을 AWS에 반영하려면 `StudyCrack_Analysis` Lambda 재배포가 필요하다.
- **다음 단계**: ARCH-08C에서 튜토리얼 전략·추천 경로와 대학 환산 엔진을 분리하고 Analysis entry를 200줄 이하로 축소한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-09 — 모바일 시스템 구조 재정비 ARCH-08A Analysis 기반 경계 완료

- **source of truth 진단**: `backend-backup/`은 공개 저장소 ignore 대상이라 현재 로컬 작업본은 commit 추적이 되지 않는다. 공개 저장소에 백엔드를 노출하지 않고 별도 private Git 저장소에서 source commit과 Lambda version을 연결하는 정책을 명문화했다.
- **Analysis 분리**: 요청·인증 context, 캐시, 접근 정책, UI 점수, 점수표 인덱스, S3/로컬 데이터, DynamoDB 사용자 조회를 `http/service/repository`로 분리했다. `index.mjs`의 AWS SDK 직접 import는 0건이다.
- **router/handler 시작**: `convert_score`, 대학 목록, 튜토리얼 점수, 예상 학습기간 네 route를 `src/router.mjs`와 독립 handler로 이동했다. 점수 환산은 AWS 없이 테스트 가능한 순수 service를 사용한다.
- **구조 기준선**: Analysis entry는 2,951줄에서 2,456줄로 감소했다. 새 검사에서 이 기준선 증가, service의 AWS SDK import, 경계 import 누락을 차단한다.
- **검증**: backend 구조 검사와 단위·handler 테스트 23개가 통과했다. API·응답·DynamoDB 계약 변경은 없다.
- **배포**: 이 내부 리팩터링을 AWS에 반영하려면 `StudyCrack_Analysis` Lambda 재배포가 필요하다.
- **다음 단계**: ARCH-08B에서 분석·시뮬레이션·역산 핵심 route를 handler/service로 분리하고 fixture 계약 테스트를 확장한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-08 — 모바일 시스템 구조 재정비 ARCH-07 CSS 소유권·지연 로딩 완료

- **화면 소유권**: 퇴역 `mobile-layout-system.css`의 홈·분석·플래너 규칙을 각 feature CSS로 이동했다. 공통 shell·primitive는 foundation/component가 계속 소유하며 layout 파일은 제거했다.
- **로딩 경계**: 로그인 전 14개 CSS는 `runtime/main.js`, 로그인 후 20개 CSS는 동적 `screen-registry-app.js`가 소유한다. 초기 CSS는 `75.4 KiB`, 로그인 후 hashed CSS는 `141.3 KiB`다.
- **배포 산출물**: 고정 `studycrack-mobile.css`와 `chunks/screen-registry-app-*.css`가 분리 생성된다. 기존 GitHub Actions의 `chunks/*` immutable 업로드 규칙으로 별도 배포 변경 없이 제공된다.
- **회귀 방지**: CSS 34개 전체의 단일 entry 소유권, layout 재생성 금지, feature selector 초기 번들 유입 금지, 초기 CSS 90 KiB 상한을 검사한다. 전 파일 dead-selector 기준선도 추가해 기존 58개 후보 외 신규 후보는 실패 처리한다.
- **검증**: 전체 check(94 source files, 40 screens, 149 actions, dead export 0), production build(260 modules), Playwright 10개 흐름, CSS 중복 감사와 diff check가 통과했다. API·Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-08에서 `backend-backup/`의 source of truth 방식을 먼저 확정하고 Lambda를 router·schema·handler·service·repository 경계로 점진 분리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-08 — 모바일 시스템 구조 재정비 ARCH-06 타입·API 계약 강화 완료

- **공통 모델 계약**: 사용자·구독·성적·분석·지원대학·플래너·공부 세션·알림·주간 리포트 모델을 JSDoc typedef와 runtime validator로 정의했다.
- **응답 경계**: 사용자·분석·랭킹·알림·리포트·문의·일정 API가 화면에 전달하기 전에 응답 shape를 검증한다. 유효하지 않은 성공 응답은 `INVALID_RESPONSE` envelope로 처리한다.
- **요청 타입 단일화**: 도메인별 Lambda request type을 `shared/api/request-types.js`가 소유하며 호출부 문자열 재선언과 중복 값은 계약 검사에서 실패한다.
- **상태 계약**: feature slice factory의 reducer·action·selector와 공통 API envelope 입출력을 JSDoc으로 명시했다. 지원대학 payload와 플래너 저장 복원도 모델 validator를 사용한다.
- **검증**: 전체 check(94 source files, 40 screens, 149 actions, dead export 0), production build(261 modules), Playwright 10개 흐름이 통과했다. CSS·Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-07에서 공용 layout CSS와 feature 화면 CSS의 소유권을 정리하고 로그인 후 CSS 지연 로딩 경계를 확정한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-07 — 모바일 시스템 구조 재정비 ARCH-05F 화면 셸·하단 탭 React 단일화 완료

- **공통 화면 셸**: `AppScreenShell.jsx`가 app frame, screen, overlay, modal lock, 하단 탭 배치를 소유하며 로그인 후 주요 화면과 `SecondaryScreenShell`이 같은 조립 경계를 사용한다.
- **하단 탭·아이콘**: 문자열 `renderTabBar`, `renderIcon`, 화면별 `tabBarHtml`을 제거하고 `TabBar.jsx`, `Icon.jsx`로 교체했다. 기존 `data-action="tab"`, 잠긴 탭 노출, 활성 탭 접근성 계약은 유지했다.
- **문자열 bridge 제거**: 모바일 source 전체의 `dangerouslySetInnerHTML` 사용은 0개다. 구조 검사가 해당 API와 `tabBarHtml` 재유입을 실패 처리한다.
- **context 축소**: 화면용 view context에서 전체 `...state` 확장을 제거했다. 각 화면은 allowlist에 등록된 값만 받고, 전체 state 호환은 delegated event adapter 내부에만 남는다.
- **검증**: 전체 check(92 source files, 40 screens, 149 actions, dead export 0), production build(259 modules), Playwright 10개 흐름이 통과했다. CSS와 Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-06에서 핵심 도메인 모델과 API 응답 계약을 JSDoc typedef·runtime validator로 강화한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-07 — 모바일 시스템 구조 재정비 ARCH-05E root 화면 React 이관 완료

- **온보딩 전환**: splash·서비스 소개 3개·설문/성적 입력·결과/솔루션 4개를 React component로 이관하고 공통 `OnboardingScreenShell`로 조립했다. 900ms 자동 전환, 비제어 입력, 기존 이동·분석 action은 유지했다.
- **문자열 경계 제거**: `onboarding/renderers.js`, 문자열 AppBar/layout helper, 미사용 학년 버튼 helper를 삭제했다. `MobileApp`의 full-screen HTML 주입 fallback도 제거했다.
- **점수 여정**: 문자열 `renderScoreJourneyCard`를 `ScoreJourneyCard.jsx`로 옮겨 현재/도달 성적과 Standard 역산 안내를 JSX가 직접 렌더링한다.
- **구조 지표**: 전체 40개 화면이 React component registry를 사용하며 문자열 root는 0개다. screen context allowlist도 40개 전부 등록됐다.
- **검증**: 전체 check(94 source files, 40 screens, 149 actions, dead export 0), production build(258 modules), Playwright 9개 흐름, `git diff --check`가 통과했다. CSS와 Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-05F에서 문자열 TabBar와 화면별 `tabBarHtml` bridge를 React component로 바꾸고 반복 shell 조립을 정리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-07 — 모바일 시스템 구조 재정비 ARCH-05D 잠금·플랜·결제 화면 React 이관

- **서비스 화면 단일화**: 잠금 안내·플랜 선택·PRO 전용 리포트·결제 확인·결제 안내를 `ServicePlanScreens.jsx`와 `ServiceContentScreens.jsx`의 React component로 이관했다.
- **결제 계약 보존**: 플랜·기간 선택 상태와 `/payment?source=mobile_app&plan=...&duration=...` 웹 이동 규칙을 유지했다. 모바일이 결제 성공 상태를 직접 만들지 않는다.
- **레거시 제거**: `service/renderers.js`와 미사용 문자열 `components/modal.js`, `components/secondary-page.js`를 삭제했다. 서비스 문자열 renderer는 0개다.
- **구조 지표**: 전체 40개 화면 중 React 소유 화면은 32개, 문자열 root는 8개다. 남은 문자열 root는 온보딩·splash 영역뿐이다.
- **검증**: 전체 check, production build, Playwright 8개 흐름이 통과했다. 새 흐름은 Basic 잠금 안내부터 PRO·8주 선택과 웹 결제 query까지 확인한다. CSS와 Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-05E에서 온보딩·splash 8개 문자열 화면과 문자열 AppBar/layout 경계를 순차 제거한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-07 — 모바일 시스템 구조 재정비 ARCH-05C 서비스 콘텐츠 화면 React 이관

- **서비스 화면 소유권**: 학습 리포트·리포트 상세·주간 점검·튜터 Q&A를 `ServiceContentScreens.jsx`로 옮기고 화면별 context allowlist에 등록했다.
- **입력·보안 계약**: 리포트 요청과 질문 작성은 공통 React `Modal`과 안정적인 비제어 입력을 사용한다. 리포트 다운로드 URL은 `http/https`만 허용하며 기존 action/payload는 바꾸지 않았다.
- **리소스 교정**: 튜터 화면에서도 Q&A 목록 조회가 활성화되도록 resource 조건을 수정했다. 고객센터와 튜터는 같은 feature API를 필요 시점에만 읽는다.
- **구조 지표**: 전체 40개 화면 중 React 소유 화면은 27개, 문자열 root는 13개다. `service/renderers.js`에는 결제·플랜·잠금 화면 5개만 남았다.
- **검증**: 전체 check, production build, Playwright 7개 흐름이 통과했다. 새 흐름은 PRO 리포트 요청 입력·튜터 질문 입력·주간 피드백 빈 상태와 하단 탭을 확인한다. CSS와 Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-05D에서 결제·결제 완료·플랜·PRO EXCLUSIVE·잠금 화면을 React로 이관한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-07 — 모바일 시스템 구조 재정비 ARCH-05B mypage 보조 화면·성적 modal React 이관

- **마이페이지 보조 화면**: 알림 설정·알림 목록·고객센터를 `MyPageSecondaryScreens.jsx`로 옮기고 전체 화면 문자열 renderer 파일을 제거했다. 알림 상세와 문의 작성은 공통 React `Modal`을 사용한다.
- **입력 안정성**: 문의 초안은 uncontrolled input과 기존 ref 계약을 유지해 한글 입력 중 화면/키보드가 재생성되지 않는다. 알림은 선택한 항목만 읽음 처리하고 같은 화면에서 상세 내용을 표시한다.
- **성적 입력**: 6단계 성적 modal을 `ScoreEditModal.jsx`로 옮기고 문자열 overlay bridge와 profile renderer를 완전히 제거했다. 한국사 단계의 상태 반영 누락도 함께 수정했다.
- **구조 지표**: 전체 40개 화면 중 React 소유 화면은 23개, 문자열 root는 17개다. profile 문자열 renderer는 0개이며 삭제된 mypage/profile renderer 재도입을 구조 검사가 차단한다.
- **검증**: 전체 check, production build, Playwright 6개 흐름이 통과했다. 새 브라우저 검사는 알림 상세·문의 입력 유지·성적 단계 전환을 직접 확인한다. CSS와 Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-05C에서 `service/renderers.js`의 보고서·주간 점검·튜터 화면부터 React로 이관한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-07 — 모바일 시스템 구조 재정비 ARCH-05A profile 보조 화면 React 이관

- **화면 소유권**: 공부 랭킹·정성조사서·성적 정보 root를 문자열 renderer에서 `ProfileScreens.jsx` React component로 옮겼다. deferred registry와 화면별 context allowlist가 세 화면의 소유권과 입력 계약을 고정한다.
- **성적 view model**: 파생 계층이 과목 카드 HTML을 만들던 `scoreInfoDetailList`를 제거하고, `scoreInfoSubjects` 구조화 배열을 React가 직접 표시하도록 변경했다.
- **잔여 호환 경계**: 성적 입력 modal은 이번 묶음에서 동작을 바꾸지 않고 `LegacyScoreEditOverlay.jsx`에 격리했다. `profile/renderers.js`에는 이 modal renderer만 남았다.
- **구조 지표**: 전체 40개 화면 중 React 소유 화면은 17개에서 20개로 증가했고 문자열 root는 23개에서 20개로 감소했다. 제거된 full-screen renderer가 다시 등록되지 않도록 구조 검사를 강화했다.
- **검증**: 전체 `npm run check`, production build, Playwright 핵심 5개 흐름이 통과했다. CSS와 Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-05B에서 알림 설정·알림 목록·고객센터를 React로 이관하고 성적 입력 modal의 문자열 브리지를 제거한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-06 — 모바일 시스템 구조 재정비 ARCH-04 앱 조립 계층 축소 완료

- **controller 분리**: API binding과 저장·업로드 명령은 `use-mobile-api-controller.js`, session과 6종 resource hook 조립은 `use-mobile-resource-orchestrator.js`가 소유한다.
- **view/effect 분리**: 홈·분석 view model 및 renderer 호환 context를 `mobile-view-context.js`에 격리하고 deferred registry, boot motion, viewport, timer, 화면 정리 effect를 `use-mobile-app-effects.js`로 이동했다.
- **브라우저 경계**: scroll·timer·viewport·text fit·gesture ref를 `shared/browser`로 이동했다. browser utility 밖의 `window.*` 직접 접근과 `features`·`shared`의 runtime 역참조는 0개다.
- **렌더 비용**: handler group은 render 때 재생성하지 않는 lazy dispatcher로 전환했다. document gesture listener도 최신 handler ref를 읽는 bridge 하나만 부착한다.
- **조립 크기**: 구조 검사 기준 `runtime/main.js`는 46줄, `app/MobileApp.js`는 196줄로 합계 242줄이다. 구조 검사는 bootstrap 60줄, 합계 350줄 상한을 강제한다.
- **검증**: 전체 check, production build, Playwright 핵심 5개 흐름이 통과했다. initial graph는 `498.7 KiB`, deferred app은 `122.9 KiB`다. Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-05에서 문자열 renderer와 delegated HTML 화면을 React registry로 옮기고, `mobile-view-context.js`의 전체 state 호환 spread를 제거한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-06 — 모바일 시스템 구조 재정비 ARCH-04A 권한·라우팅·브라우저 adapter 완료

- **접근 정책 분리**: 플랜 순위, 구독 활성 판정, 화면 접근 권한, 잠금 안내를 `app/access-policy.js`가 단일 소유한다. Free/Basic/Standard 권한과 점수 시뮬레이션·역산 경계를 실행 검사로 고정했다.
- **라우팅 분리**: 공개 화면 allowlist, 세션 유무에 따른 최초 화면, URL `screen` parameter 갱신과 deferred screen 판정을 `app/mobile-routing.js`로 이동했다.
- **브라우저 경계**: API binding, 설정, session helper, location/history, scroll, localStorage를 `shared/browser/mobile-runtime.js`로 모았다. session 차단·만료 처리는 `features/session/mobile-session-adapter.js`가 담당한다.
- **계층 정리**: auth service를 session feature로 옮겨 `features`·`shared`에서 `runtime`을 역참조하는 import를 제거했다. `runtime/main.js`는 1,062줄에서 853줄로 감소했다.
- **구조 검사**: `check-app-assembly.mjs`를 추가했고 전체 check, production build, Playwright 핵심 5개 흐름이 통과했다. initial graph는 `496.0 KiB`, deferred app은 `122.7 KiB`다. Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-04B에서 API/persistence controller, resource/session orchestrator, 화면 context builder, boot/timer hook을 분리한 뒤 `MobileApp`·router/provider·mount 경계를 확정한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-06 — 모바일 시스템 구조 재정비 ARCH-03C 상태 종류 분리 완료

- **물리적 하위 상태**: 10개 feature slice를 `serverResource`, `localDraft`, `ephemeralUi`로 분리했다. 195개 field는 각각 57개·45개·93개이며 중복과 미분류를 허용하지 않는다.
- **중첩 reducer**: 기존 flat patch/action 계약은 유지하면서 field 소유 slice와 상태 종류에 해당하는 객체만 갱신한다. 기존 화면·localStorage·Lambda payload는 바뀌지 않았다.
- **selector 소비**: handler updater는 root field selector를 사용하고 persistence hook은 필요한 상태 종류 selector만 사용한다. 전체 평면 state는 아직 이관되지 않은 app 조립·문자열 renderer 경계에만 남았다.
- **bundle 관리**: initial state 자체를 중첩 구조로 선언해 별도 분류 배열 중복을 제거했다. 초기 graph는 `496.4 KiB`, deferred app은 `122.7 KiB`로 경계 검사를 통과했다.
- **검증**: 전체 check, production build, Playwright 핵심 5개 흐름이 통과했다. Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-04에서 `runtime/main.js`를 `MobileApp`, router/provider, access policy, browser adapter로 분해하고 app-level 평면 context를 축소한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-06 — 모바일 시스템 구조 재정비 ARCH-03B 명시 action·화면 context 완료

- **handler 계약**: 기능 group별 required state action을 선언하고 compatibility setter pool과 범용 `setField`를 제거했다. 필수 action 누락은 생성 단계에서 실패하며 필수 setter의 `noop` 기본값 재유입도 검사로 차단한다.
- **화면 경계**: 17개 React screen이 전체 평면 context 대신 화면별 allowlist로 만든 view/action만 받도록 바꿨다. screen registry 누락과 필수 screen action 누락은 구조 검사에서 실패한다.
- **상태 계층**: 10개 slice와 195개 field 소유권을 순수 `state/app-state-schema.js`가 단일 소유한다. state 계층의 runtime 역참조를 제거했다.
- **저장 책임**: 분석·플래너·알림·계정·내비게이션 hydrate/save를 feature storage adapter와 app persistence hook으로 이동했다.
- **검증**: 전체 check, production build, Playwright 핵심 5개 흐름이 통과했다. Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-03C에서 각 slice를 server resource/local draft/ephemeral UI로 나누고 이행용 평면 selector 의존을 더 줄인다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-05 — 모바일 시스템 구조 재정비 ARCH-03A root feature slice 완료

- **root state 분리**: 195개 평면 state의 source of truth를 `navigation`, `session`, `analysis`, `planner`, `coaching`, `account`, `notifications`, `reports`, `support`, `overlay` 10개 slice로 전환했다.
- **slice 계약**: 각 feature가 initial state를 소유하고 공통 factory를 통해 reducer, action creator, selector를 제공한다. field 소유권 중복과 알 수 없는 patch는 즉시 실패한다.
- **호환 계층**: 기존 resource hook과 문자열 handler는 평면 selector view로 계속 동작한다. `Object.keys(state)` 기반 setter 생성은 제거했지만 delegated handler용 schema 기반 compatibility action은 ARCH-03B까지 한시 유지한다.
- **상태 복원**: localStorage hydrate가 nested root에 slice patch를 적용하도록 바뀌었으며 기존 성적·플래너·타이머·일정 복원 계약을 유지한다.
- **검증**: 전체 check, production build, Playwright 핵심 5개 흐름, diff check가 통과했다. Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-03B에서 handler별 required action 계약, screen별 view model, slice storage adapter를 도입하고 compatibility setter pool을 완전히 제거한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-05 — 모바일 시스템 구조 재정비 ARCH-02 resource effect 분리 완료

- **필요 시점 로딩**: 홈 최초 진입은 사용자·환산점수·일간 랭킹·수험 일정만 조회한다. 대학 목록·추천, PRO·주간 리포트, Q&A, 알림은 해당 화면이나 popover 진입 시점까지 지연한다.
- **effect 소유권**: 세션·분석·대학·랭킹·일정·리포트·문의·알림 조회를 각 `features/*/use-*-resource.js`로 옮겼다. `runtime/main.js`에는 도메인 fetch effect가 남지 않는다.
- **레이스 방지**: resource hook마다 request key와 `AbortController`를 적용했다. 분석 조회는 시험·성적·지원대학 기반 resource key를 사용해 출력 상태 변경이 진행 중 요청을 취소하지 않는다.
- **인증 만료 단일화**: `shared/api/client.js`가 `AUTH_EXPIRED` callback을 한 곳에서 처리하며 개별 handler의 중복 분기를 제거했다.
- **분석 소유권**: 점수 cache/store와 시험·목표 정규화 model을 `features/analysis`로 이전했다.
- **규모·검증**: `runtime/main.js`는 1,505줄 기준에서 1,069줄로 줄었다. 전체 check, production build, Playwright 5개가 통과했고 홈 smoke가 불필요한 6종 API의 최초 호출 부재를 고정한다.
- **배포 영향**: 정적 모바일 프론트 변경만 있으며 Lambda·DynamoDB 변경은 없다.
- **다음 단계**: ARCH-03에서 195개 평면 state와 자동 setter pool을 feature slice·명시적 action·selector로 전환한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-05 — 모바일 시스템 구조 재정비 ARCH-01 API 경계 분리 완료

- **transport 단일화**: `shared/api/client.js`가 성공·실패 envelope, JSON 응답 parsing, POST 전송을 단일 소유한다. API 반환은 `{ ok, data, error, status, code }`로 통일됐다.
- **도메인 소유권**: 사용자·분석·플래너·리포트·알림·문의·세션 API를 `features/*/api.js` 7개로 나눴고 점수·지원대학 변환은 순수 model로 분리했다.
- **레거시 제거**: 앱과 handler가 새 모듈을 직접 import하며 885줄 `runtime/persistence.js`는 삭제했다. compatibility barrel과 unreachable module도 남기지 않았다.
- **오류 계약**: API 실패를 `null`, `[]`, throw로 표현하던 혼용을 제거했다. 인증 만료는 envelope code를 통해 앱 조립 계층에서 조용히 세션 만료 처리한다.
- **계약 보존**: Lambda request `type`, payload와 URL binding은 그대로다. Lambda·DynamoDB 배포 변경은 없다.
- **회귀 방지**: 새 domain API contract 검사가 envelope와 모듈 경계를 고정한다. 전체 check, production build, Playwright 5개 smoke가 통과했다.
- **다음 단계**: ARCH-02에서 홈 진입 시 한꺼번에 실행되는 리포트·Q&A·알림·카탈로그 effect를 화면/feature 소유 resource controller로 옮기고 필요 시점에만 로드한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-04 — 모바일 시스템 구조 재정비 ARCH-00 안전망 완료

- **진단**: 모바일 CSS와 화면 chunk는 잘 분리됐지만 `runtime/main.js` 1,505줄, 195개 평면 state, `persistence.js` 885줄, JSX·문자열 renderer 이중 구조가 확장 병목으로 남아 있다.
- **배포 gate**: GitHub Actions `verify`가 운영 의존성 audit, 전체 check, production build, 구조 baseline, Playwright 5개 smoke를 통과해야만 deploy가 실행된다.
- **브라우저 계약**: 로그인 복구, 로그인 직후 홈 사용자·환산점수, 한글 대학→학과 검색, 타이머→랭킹, 분석 시험·대학 전환을 Chromium 모바일 viewport에서 자동 검증한다.
- **기준선**: source `JS 53 / JSX 24 / CSS 35`, 초기 bundle graph `483.4 KiB`, production entry `262.07 kB`, CSS `224.25 kB`, deferred app chunk `125.61 kB`다. 실행 결과는 Actions artifact로 14일 보관한다.
- **보안**: 운영 npm 의존성 취약점은 0건이다. Vite 5 개발 서버의 esbuild advisory는 Vite 8 메이저 호환성 검증이 필요해 후속으로 추적한다.
- **목표 구조**: `app -> features -> shared` 의존 방향을 고정하고 각 feature가 API·reducer·resource hook·selector·UI·CSS를 소유하게 한다.
- **진행 순서**: CI/E2E 안전망 → API 도메인 분리 → resource effect 분리 → feature state slice → main 축소 → React renderer 통일 → 계약·타입 → CSS 로딩 경계 → Lambda 모듈화 → 문서 정리.
- **다음 단계**: ARCH-01에서 `runtime/persistence.js`의 transport와 도메인 API를 compatibility export를 유지한 채 순차 분리한다.
- **실행 계획**: `docs/exec-plans/completed/260804_mobile_system_architecture_scalability_rebuild.md`

---

## 2026-08-04 — 모바일 대학 검색·랭킹·분석·코칭·주간 점검 후속 교정 완료

- **대학 추가**: 화면을 React로 이관하고 카탈로그 로딩·오류·재시도 상태, 대학명 공백 정규화를 추가했다. 한글 검색 입력은 결과가 바뀌어도 같은 input DOM을 유지한다.
- **공부 랭킹**: 세션 저장 성공과 중복 저장 응답 뒤 `rankingRefreshTick`을 갱신해 일간 랭킹을 즉시 재조회한다. UserCore와 집계 테이블 계약은 변경하지 않았다.
- **분석 게이지**: `적용 후 환산 N점`으로 문구를 바꾸고 0·250점 경계에서는 라벨을 게이지 안쪽으로 정렬한다.
- **코칭·주간 점검**: 코칭 hero 채도를 낮추고, 주간 피드백 문장과 크랙이를 별도 grid 열로 분리했다.
- **검증**: 전체 check, production build, diff check, CSS 감사와 390x844 대학 검색 포커스·overflow 확인이 통과했다.
- **배포 영향**: 정적 프론트만 변경됐으며 Lambda·DB 배포는 없다. dev 실계정 대학 추가와 타이머→랭킹 재조회 스모크만 남았다.
- **완료 문서**: `docs/exec-plans/completed/260803_mobile_university_ranking_ui_followup.md`

---

## 2026-08-03 — 모바일 성적 입력 등급·탐구 UI 교정

- 영어·한국사의 3열 9개 등급 버튼을 제거하고 `1~9` 한 자리 숫자 입력으로 단순화했다. 숫자 키패드를 사용하며 1~9 외 입력은 즉시 제거된다.
- 탐구 입력은 과목 선택과 원점수를 동일한 52px 높이, 같은 label 기준선의 2열 grid로 재구성했다. 390px 이하에서도 두 필드가 화면 폭 안에서 정렬된다.
- 퇴역한 `setScoreEditGrade` 액션과 등급 grid CSS를 함께 제거하고, 새 입력·정렬 selector 및 구형 UI 미복귀 계약을 presentation 검사에 추가했다.
- 390x844 로컬 화면에서 영어와 탐구 1 단계를 직접 이동하며 modal 정렬과 overflow를 확인했다.
- 전체 `npm run check`, production build, score-input CSS 사용 감사와 `git diff --check`가 통과했다. API·Lambda·DB 변경은 없다.

---

## 2026-08-03 — 모바일 최초 환산점수 요청 재개 보강

- **증상**: 로그인 직후 홈·분석의 대학별 환산점수가 표시되지 않고, 시험을 다른 회차로 바꿨다가 돌아와야 같은 시험의 점수가 나타났다.
- **원인**: 초기 사용자 조회 중 무효화된 분석 요청의 request ID는 바뀌었지만 동일 시험 signature와 `loading` 상태가 남을 수 있었다. 사용자 데이터가 준비된 뒤에도 중복 요청 가드가 이를 진행 중 요청으로 오인해 최초 계산을 건너뛰었다.
- **수정**: 사용자 데이터가 `ready`가 되는 경계에서 분석 request ID·signature·retry 상태를 함께 초기화하고, 사용자 로딩·오류 구간에서도 폐기된 signature를 제거한다. 사용자 응답 매핑은 점수 fetch 상태를 `idle`로 명시해 같은 시험의 새 요청을 즉시 허용한다.
- **표기**: 모바일의 `지원학과 AI 점수`, `AI 점수`, `예상 AI 점수`를 각각 `지원학과 환산 점수`, `환산 점수`, `예상 환산 점수`로 정리했다.
- **백엔드**: 최초 로딩과 시험 변경 모두 기존 `analyze_my_targets` 계약을 사용하므로 Lambda·DB 변경은 없다.
- **검증**: 모바일 전체 `npm run check`, production build, `git diff --check`가 통과했다. 남은 확인은 실세션에서 시험 선택을 건드리지 않고 최초 홈·분석 점수가 표시되는지 보는 dev 스모크다.

---

## 2026-08-03 — MY 학습 유형 카드 겹침 교정

- `my-insight-card`에 남아 있던 `margin-top:-20px`와 축소 폭을 제거했다.
- 프로필·구독 카드와 학습 유형 카드는 `my-page`의 공통 카드 간격을 사용하며 동일한 전체 폭으로 정렬된다.
- MY presentation 계약, 전체 UI 계약, build, CSS selector 감사와 diff check가 통과했다.

---

## 2026-08-03 — LOCAL 모바일 초기 403 묶음 방지

- **원인**: 만료된 access token을 가진 모바일 부팅에서 여러 보호 API가 먼저 403을 받은 뒤 공통 refresh에 합류했다. LOCAL에서는 토큰 없이 남은 `userId`도 세션으로 오인할 수 있었다.
- **수정**: `js/shared/api.js`가 LOCAL 보호 요청 전에 JWT 만료를 확인하고 single-flight refresh를 먼저 완료한다. LOCAL 세션 판정은 access/refresh token 존재를 기준으로 한다.
- **범위**: 프론트 공통 인증 계층과 회귀 검사만 변경했다. 개별 Lambda, API 계약, DynamoDB 테이블 변경은 없다.
- **검증**: 동시 5개 요청에서 refresh 1회, 만료 토큰 보호 요청 0회, `userId` 단독 비세션 계약과 모바일 전체 `npm run check`가 통과했다.
- **남은 확인**: localhost에서 캐시를 비우고 재로그인한 뒤 최초 홈 진입·새로고침을 확인한다. dev 병합 시에는 로그인→새로고침→새 탭→로그아웃 스모크를 별도로 수행한다.

---

## 2026-08-01 — Manus 색감 COLOR-06 로컬 통합 QA 완료

- **4개 viewport**: 320x700, 360x800, 390x844, 430x932에서 대표 화면 29개를 총 116회 순회했다. 수평 overflow, clipping, native control 노출과 renderer 오연결은 0건이다.
- **상태·overlay**: 인증 복구·회원가입 약관·전화번호 변경·홈 알림·코칭 잠금·프로필 상세를 작은/큰 폭에서 확인하고, focus·keyboard-open·Q&A 한글 입력 유지·플래너 주월 전환을 상호작용으로 검증했다.
- **발견 교정**: 320px FAQ 제목, 계정 inline action 터치 영역, muted/subtle text와 positive/urgent state, Naver CTA의 대비를 원래 소유 selector와 foundation token에서 수정했다.
- **회귀 계약**: 새 strong/muted/provider token exact value와 AA contrast pair를 `fixtures/ui-contract.json`에 고정했다. 일반 텍스트 대비 실패는 0건이며 provider 단일 문자 mark만 logo 예외다.
- **검증**: 전체 check(40 화면·149 action·5 플랜, AA 9조합), build(207 modules, CSS gzip `33.75 kB`), CSS duplicate 감사와 diff check가 통과했다.
- **dev 상태**: dev HTML이 최신 추출 CSS를 아직 로드하지 않아 실세션 시각·실데이터 QA는 배포 후로 남긴다. 상세 내용은 `docs/exec-plans/completed/260801_mobile_manus_color_alignment.md`와 dev 스모크 백로그에 기록했다.

---

## 2026-08-01 — Manus 색감 COLOR-00~05 완료

- **semantic palette**: 레퍼런스 실측값을 기준으로 deep navy `#1B3A6B/#0F2347`, mint `#00C9A7`, coral `#FF6B35`, threshold yellow `#FFC857`와 neutral surface token을 추가했다.
- **공통 UI 이관**: primitive, navigation, modal, sheet, secondary, drawer가 brand/action/state/surface token을 사용하도록 수정했다. 화면별 override는 추가하지 않았다.
- **홈·분석 composition**: 홈 환산점수와 분석 핵심 결과를 deep navy hero로 전환했다. 홈의 공부 시작은 coral, 진행도는 mint이며 분석의 합격선은 yellow, 안정선·원점수 +1 최고효율은 mint로 역할을 고정했다.
- **결과 위계**: 홈 hero 안의 텍스트·KPI는 흰색 투명도 위계로, 분석 과목 row는 white/neutral과 mint 선택 상태로 정리했다. Standard 역산 잠금은 neutral card와 navy CTA를 사용한다.
- **플래너 상태색**: 주·월 및 날짜 active는 navy, 완료·진행은 mint, 남은 계획·대기·균형 경고는 yellow로 고정했다. 과목색은 작은 dot에만 남겼다.
- **코칭 행동색**: 핵심 코칭 신청 hero는 mint와 deep navy text, white CTA 조합으로 전환했다. 내역 active는 navy, 점검 대기는 yellow, 피드백 준비·완료는 mint를 사용한다.
- **MY profile 위계**: 프로필·구독 정보를 deep navy hero에 배치하고 MBTI insight white card를 겹쳤다. 학습 stat 숫자는 navy·mint·coral, menu는 white/neutral 구조다.
- **인증·온보딩 정합화**: 공식 logo와 provider 고유색은 유지하고 로그인·가입·복구·onboarding의 form, error, success, gauge, CTA를 semantic token으로 통일했다.
- **보조 화면 정합화**: 랭킹·리포트·성적·정성 조사·Q&A·계정 관리·MBTI의 pale-blue 면을 white/neutral list와 명시적인 positive/urgent 상태로 교체했다.
- **서비스·overlay 정합화**: 요금제·결제의 active는 navy, benefit·완료는 mint로 분리했다. 알림·calendar·planner add와 성적/Q&A/복구 modal도 같은 surface·line·state 역할을 사용한다.
- **CSS 소유권**: 마지막 `mobile-layout-system.css`가 화면 hero 배경·그림자를 흰색 일반 카드로 덮던 충돌을 제거하고, color contract에 두 hero 제외 guard와 화면 token 소비를 고정했다.
- **직접 색상 제거**: screen `147 → 0`, component `76 → 0`, `tokens.css` 외 전체 `0`으로 정리했다. provider·subject·rank 값도 foundation token이 단일 소유한다.
- **legacy alias 퇴역**: `--primary`, `--primary-dark`, `--primary-soft` 사용과 정의를 제거했다. color contract가 직접 색상과 별칭의 재유입을 모두 상한 `0`으로 차단한다.
- **로컬 확인**: 기존 COLOR-04 순회에 더해 로그인, 홈 빈 상태, 플래너, 랭킹, PRO, MY와 프로필 상세 modal을 다시 확인했다. 확인한 430px frame의 수평 overflow는 0이다.
- **제품 계약 유지**: 공식 StudyCrack logo, 대학별 환산점수, 원점수 +1 전후 환산점수 효율, Basic/Standard 권한과 API는 변경하지 않는다.
- **상세 계획**: `docs/exec-plans/completed/260801_mobile_manus_color_alignment.md`
- **검증**: 전체 check, build(207 modules, CSS gzip `33.69 kB`), CSS duplicate/color audit와 diff check가 통과했다.
- **다음**: `COLOR-06`에서 320/360/390/430px 상태별 시각 QA와 dev 실세션 로그인·새로고침·탭 전환·로그아웃 smoke를 수행한다.

---

## 2026-08-01 — CLEAN-05 모바일 초기/앱 bundle 분할 완료

- **로컬 청크 경로 보정**: 번들 상대 import가 로컬 정적 서버에서 `/chunks/*`로 해석되어 404가 발생한 사례를 확인했다. Vite `base`를 실제 배포 위치 `/studycrack-mobile-app/dist/`로 고정하고, entry가 루트 `/chunks`를 참조하면 bundle boundary 검사가 실패하도록 보강했다. 백엔드 재배포는 필요 없다.
- **실제 지연 경계**: 인증·온보딩·약관은 초기 `screen-registry.js`에 유지하고, 홈·분석·플래너·코칭·MY 및 로그인 후 보조 화면은 동적 `screen-registry-app.js`에서 불러오도록 분리했다. 세션이 있으면 splash에서 앱 청크를 미리 요청하고, 직접 앱 화면 진입 시에는 중앙 로딩·실패 재시도 상태를 표시한다.
- **ES module 산출물**: 단일 IIFE를 고정 ES module entry, React·인증·기타 vendor, 로그인 후 앱 청크로 나눴다. CSS도 `studycrack-mobile.css`로 추출했으며 HTML은 module script와 추출 CSS를 직접 로드한다.
- **배포 캐시**: 고정 이름의 entry/CSS는 `no-cache`, content hash가 붙은 `chunks/*`·`assets/*`는 `immutable`로 배포하도록 GitHub Actions를 수정했다.
- **레거시 제거**: 새 레지스트리가 직접 import하면서 미도달이 된 화면 배럴 `index.js` 10개를 삭제했다. production graph는 77개 모듈 모두 도달하며 unused export는 0개다.
- **회귀 방지**: `check-bundle-boundaries.mjs`가 동적 앱 청크 존재, 핵심 앱 화면의 초기 graph 제외, module HTML, CSS 추출, 배포 캐시 및 청크별 500 KiB 상한을 검사한다.
- **검증**: 전체 check(54 source·40 화면·149 action·5 플랜), build(207 modules)와 CSS 감사가 통과했다. 초기 JS는 raw 약 `482.4 KiB`, gzip 약 `160.23 kB`이고 CSS gzip은 `33.52 kB`다. 앱 화면 청크는 `123.49 kB`/gzip `36.69 kB`이며 500 kB 경고가 사라졌다. 개발 서버 권한 제한으로 시각 검증은 수행하지 못했다.
- **다음**: dev 실세션에서 비로그인 로그인/가입, 기존 세션 splash preload, 로그인 직후 홈, 앱 탭 전환, 앱 청크 실패 재시도와 캐시 헤더를 확인한다.

---

## 2026-08-01 — CLEAN-04C3 분석·홈 leaf adapter React 이관 완료

- **분석 단일화**: 환산점수 결과, +1점 효율, Standard 역산과 대학 검색 sheet를 `AnalysisContent.jsx`의 React 트리로 옮겼다. `analysis/renderers.js`는 아직 문자열 화면인 대학 추가만 소유한다.
- **홈 단일화**: 과목별 공부 기록, 대학 선택·삭제, 공부 과목 선택, 알림 popover와 drawer를 `HomeOverlays.jsx`로 옮겼다. `home/renderers.js`는 삭제했다.
- **레거시 축소**: React `Sheet.jsx`로 완전히 대체된 문자열 `components/sheet.js`를 제거했다. JSX의 실제 `dangerouslySetInnerHTML`은 20곳에서 15곳으로 줄었으며 남은 범위는 주로 탭바·아이콘·appbar shell이다.
- **회귀 방지**: renderer boundary가 analysis/home React 소유권과 overlay의 HTML 주입 금지를 검사한다. production graph는 86개 모듈 모두 도달하고 unused export는 0개다.
- **검증**: 전체 check(63 source·40 화면·149 action·5 플랜), build(215 modules, `818.75 kB` / gzip `228.47 kB`), CSS 소유권 24건·dead selector·duplicate 감사와 diff check가 통과했다. 개발 서버 실행 권한 제한으로 시각 검증은 수행하지 못했다.
- **다음**: CLEAN-05에서 단일 500 kB 초과 번들을 auth/onboarding과 로그인 후 앱 경계로 나누는 방안을 먼저 설계한다.

---

## 2026-07-31 — CLEAN-04C2 MY·계정·MBTI React 이관 완료

- **MY overlay 이관**: 프로필 상세·사진 변경·튜터 정보와 탐구 MBTI modal을 `ProfileOverlays.jsx`, `MbtiModal.jsx`의 React 트리로 옮겼다. `MyPageScreen`은 더 이상 문자열 overlay를 주입하지 않는다.
- **계정 화면 승격**: `accountInfo`를 `AccountInfoScreen.jsx`로 승격하고 이름 변경·전화번호 인증·탈퇴·소셜 연동·마케팅 동의 action을 그대로 유지했다. 입력 modal은 `defaultValue`와 delegated `data-field`를 사용해 입력 중 DOM 교체를 피한다.
- **MBTI 중복 제거**: 온보딩 `ob3`도 JSX 화면으로 옮겨 같은 `MbtiModal`을 공유하게 했다. 구형 `components/mbti-modal.js`, `renderAccountInfoScreen`, `renderMyPageOverlays`, `renderOb3Screen`은 제거했다.
- **공통 화면 기반**: 법률과 계정 화면이 공유하는 `SecondaryScreenShell`, `SecondaryIntro`를 `components/SecondaryScreen.jsx`로 분리했다. JSX 화면은 16개, 문자열 화면은 24개이며 JSX의 `dangerouslySetInnerHTML`은 20곳 남았다.
- **검증**: 전체 check(65 source·40 화면·149 action·5 플랜, production module 86개·unused export 0), build(215 modules, `817.24 kB` / gzip `228.87 kB`), CSS 소유권·duplicate 감사와 diff check가 통과했다. CLEAN-04C1 대비 bundle은 `+4.66 kB`, gzip은 `+0.24 kB`다. 개발 서버 실행 권한 제한으로 시각 검증은 수행하지 못했다.
- **다음**: CLEAN-04C3에서 analysis 결과/검색과 home의 큰 leaf adapter를 React component로 이관한다.

---

## 2026-07-31 — CLEAN-04C1 React modal/sheet adapter 이관 완료

- **공통 overlay 기반**: `Modal.jsx`, `Sheet.jsx`, `TermsModal.jsx`를 추가해 기존 CSS의 modal/sheet class 계약을 React에서 직접 사용하도록 정리했다.
- **약관·플래너 이관**: 인증과 법률 화면의 약관 전문, 플래너 수정 sheet를 React component로 교체했다. 구형 `components/terms-modal.js`와 `planner/renderers.js`는 삭제했다.
- **설정 메인 이관**: `settingsMain`과 로그아웃 modal을 `LegalScreens.jsx`의 React 화면으로 옮겼다. JSX 화면은 14개, 문자열 화면은 26개가 됐고 JSX의 `dangerouslySetInnerHTML`은 21곳만 남았다.
- **회귀 방지**: renderer boundary와 auth/secondary/overlay 검사를 React 소유권 기준으로 갱신했다. 제거된 문자열 약관·플래너 adapter가 재유입되거나 JSX 화면과 문자열 화면의 소유권이 겹치면 검사에 실패한다.
- **검증**: 전체 check(65 source·40 화면·149 action·5 플랜, production module 81개·unused export 0), build(210 modules, `812.58 kB` / gzip `228.63 kB`), 관련 CSS duplicate 감사와 diff check가 통과했다. CLEAN-04B 대비 bundle은 `+1.35 kB`, gzip은 `-0.01 kB`다. 개발 서버 실행 권한 제한으로 시각 검증은 수행하지 못했다.
- **다음**: CLEAN-04C2에서 MY profile·MBTI·계정 overlay를 먼저 React로 옮기고, CLEAN-04C3에서 analysis/home의 큰 leaf adapter를 분리한다.

---

## 2026-07-31 — CLEAN-04B 인증 복구·법률 화면 JSX 이관 완료

- **JSX 화면 13개**: `authFindId`, `authFindPw`, `settingsTermsPicker`, `privacyPolicy`, `termsScreen` 다섯 화면을 JSX registry로 옮겼다. 문자열 화면은 32개에서 27개로 줄었다.
- **인증 복구 단일화**: 이메일 찾기·비밀번호 재설정 안내를 기존 `AuthShell` 안의 React 화면으로 통합하고 `auth/renderers.js`를 삭제했다.
- **법률 화면 단일화**: `LegalScreens.jsx`가 약관 목록과 개인정보·서비스 약관 읽기 화면을 소유한다. 기존 `TERMS_CONTENT`, `openTermsModal`, `back` action과 약관 modal 동작은 유지했다.
- **회귀 방지**: renderer ownership 계약을 13개 JSX 화면으로 확장하고, 제거된 인증 복구·법률 full-screen renderer가 다시 들어오면 검사에 실패하도록 고정했다. 인증·보조 화면 presentation 검사도 새 JSX 소유 파일을 기준으로 갱신했다.
- **검증**: 전체 check(67 source·40 화면·149 action·5 플랜, production module 79개·unused export 0), build(208 modules, `811.23 kB` / gzip `228.64 kB`), 관련 CSS 감사와 diff check가 통과했다. CLEAN-04A 대비 bundle 변화는 `+0.94 kB`, gzip `+0.09 kB`다. 개발 서버 실행 권한 제한으로 시각 검증은 수행하지 못했다.
- **다음**: CLEAN-04C에서 JSX 화면이 남겨둔 modal/sheet leaf HTML adapter를 React component로 이관해 `dangerouslySetInnerHTML` 범위를 줄인다.

---

## 2026-07-31 — CLEAN-04A JSX/string 전체 화면 중복 제거 완료

- **화면 소유권 단일화**: `home`, `analysis`, `planner`, `plannerAdd`, `strategy`, `my`, `authLogin`, `authSignup` 8개 화면의 full-screen 문자열 renderer를 제거하고 JSX component만 화면 root를 소유하게 했다.
- **fallback 차단**: string registry는 정확히 등록된 32개 문자열 화면만 처리한다. JSX 화면을 `home` 문자열 renderer로 대체하거나 custom renderer가 JSX key를 덮는 경로를 제거했다.
- **leaf adapter 보존**: analysis 결과/검색 modal, 홈 overlay, planner edit sheet, MY overlay처럼 JSX가 실제 호출하는 부분 renderer는 유지했다. renderer 파일 전체 삭제는 후속 이관 전까지 금지한다.
- **고아 코드 정리**: React 홈 캘린더와 중복이던 `components/calendar-sheet.js`, React가 직접 처리하는 가입 약관 toggle 및 플래너 과목·시간 delegated action 4개와 fixture를 제거했다.
- **재발 방지**: `check-renderer-boundaries.mjs`가 8개 JSX 소유권, full-screen 문자열 renderer 재유입 금지, 허용 leaf adapter 연결을 검사한다. 인증 presentation 검사도 현재 JSX 회원가입을 기준으로 갱신했다.
- **검증**: 전체 check(68 source·40 화면·149 action·5 플랜, production module 79개·unused export 0), build(208 modules, `810.29 kB` / gzip `228.55 kB`), CSS 감사와 diff check가 통과했다. CLEAN-03D 대비 bundle은 `47.52 kB`, gzip은 `11.35 kB` 줄었다. 개발 서버 실행 권한 제한으로 이번 단계의 시각 검증은 수행하지 못했다.
- **다음**: CLEAN-04B에서 인증 복구·약관처럼 상태가 단순한 보조 문자열 화면부터 JSX로 이관한다.

---

## 2026-07-31 — CLEAN-03D bridge/recovery 계약 정리 완료

- **bridge 제거**: `mobile-bridge.css`와 runtime import를 삭제했다. 구형 selector와 공용 카드·버튼·탭 여백 override를 제거하고, 실제 전역 form/overflow/shell 계약만 foundation 소유 파일로 옮겼다.
- **현재 계약 감사**: 과거 `design-v2.css` 기준 복구 비교를 폐기하고 shell·primitive·overlay·navigation·핵심 화면의 소유권/property 계약 24건을 검사하도록 `audit_mobile_css_recovery.mjs`를 교체했다.
- **재발 방지**: 퇴역한 `design-v2.css`/`mobile-bridge.css` 파일 또는 import가 돌아오면 실패하며, 새 감사기를 `npm run check`에 연결했다.
- **임시 계약 제거**: `.home-section-last`와 CLEAN-03D 임시 allowlist를 삭제했다. `primitives.css`는 42 class, actionable 미참조 후보 0개다.
- **검증**: 전체 check(69 source·40 화면·153 action·5 플랜, CSS 계약 24건), build(209 modules, `857.81 kB` / gzip `239.90 kB`), diff check가 통과했다. 로컬 개발 서버는 실행 권한 제한으로 이번 단계에서 시각 검증하지 못했다.
- **다음**: CLEAN-04로 JSX 8개 화면의 full-screen 문자열 fallback과 leaf helper를 분리해 dual renderer 중복을 단계적으로 줄인다.

---

## 2026-07-31 — CLEAN-03C 공통 CSS dead rule 정리 완료

- **공통 CSS 축소**: `primitives.css` 82→58줄/class 68→43개, `motion.css` 39→38줄/class 84→76개, `insights.css` 85→71줄/class 52→43개로 줄였다.
- **레거시 제거**: 사용되지 않는 primitive 초안, 존재하지 않는 motion 대상, 구형 PRO 알림·필터·목표 카드·score journey 화살표 규칙과 미사용 keyframe을 제거했다.
- **동적 allowlist**: 문자열 renderer가 만드는 랭킹 tier 5종과 CLEAN-03D까지 유지할 recovery contract 1건만 사유와 함께 등록했다. stale allowlist는 검사 실패로 처리한다.
- **재발 방지**: 세 공통 파일 모두 actionable 미참조 후보 0개를 `npm run check`에 연결했다.
- **검증**: 전체 check와 build(210 modules, `860.53 kB` / gzip `240.52 kB`)가 통과했다. 로컬 인트로 motion, 홈 bronze tier, 점수 여정, PRO 리포트 화면에서 overflow·boot·console 오류 0건을 확인했다.
- **다음**: CLEAN-03D로 `mobile-bridge.css`의 임시 selector와 baseline recovery contract를 현재 화면 계약으로 교체한다.

---

## 2026-07-31 — CLEAN-03B 서비스 CSS dead rule 정리 완료

- **서비스 CSS 축소**: `service.css`를 121줄에서 65줄로 줄였다. class 58→31개, source 미참조 후보 23→0개다.
- **레거시 제거**: 구형 모바일 플랜/결제 카드, 가격 행, capability/summary/features 표, payment flow 규칙과 handler/bridge의 이전 DOM selector를 제거했다.
- **동적 class 보존**: `PLAN_META`가 만드는 `blue/green/rose` theme와 renderer의 `active` 상태는 실제 플랜·기간 전환 경로를 확인해 유지했다.
- **재발 방지**: `service.css --fail` dead selector 감사를 `npm run check`에 추가했다.
- **검증**: 전체 check와 build(210 modules, `865.38 kB` / gzip `241.32 kB`)가 통과했다. 로컬 `proIntro`·`payment`에서 플랜/기간 전환, overflow 0, boot·console 오류 0건을 확인했다.
- **다음**: CLEAN-03C로 `primitives.css`, `motion.css`, `insights.css`의 공통 동적 class와 남은 dead 후보를 소유권별로 정리한다.

---

## 2026-07-31 — CLEAN-03A 분석 CSS dead rule 정리 완료

- **분석 CSS 축소**: `analysis-base.css`를 157줄에서 43줄로 줄였다. class 112→25개, source 미참조 후보 48→0개, duplicate selector 28→0개다.
- **레거시 제거**: 현재 렌더러가 만들지 않는 구형 분석 tab/summary/compare와 simulation chart/gauge/CTA 규칙, 연결되지 않는 분석 mode handler/state를 제거했다.
- **소유권 이관**: 온보딩의 환산점수·도달 예상·추천 대학 규칙은 `onboarding.css`, 점수 여정 폭/overflow 규칙은 `insights.css`의 기존 selector로 옮겼다. layout/motion에 남은 구형 분석 분기도 함께 정리했다.
- **재발 방지**: `audit-css-usage.mjs`를 추가하고 `analysis-base.css`의 source 미참조 후보 0개를 `npm run check`에 고정했다. 삭제 전 renderer·동적 class·DOM query 확인 절차도 디자인 지침에 추가했다.
- **검증**: 전체 check(69 source·40 화면·153 action·5 플랜), build(210 modules, `870.88 kB` / gzip `242.24 kB`), CSS duplicate audit와 diff check가 통과했다. 390×844 `ob4`/`ob5`에서 overflow와 console error/warn 0건을 확인했다.
- **잔여 계약**: CSS recovery audit의 기존 planner/KPI property contract 5개는 CLEAN-03D에서 현재 화면 계약으로 교체한다.
- **다음**: CLEAN-03B로 `screens/service.css`의 dead selector와 동적 plan/payment class를 분리 감사한다.

---

## 2026-07-30 — CLEAN-02 dead code·저장소 metadata 정리 완료

- **미도달 모듈**: runtime import graph에서 끊긴 barrel/kernel/component/mock/state 파일 10개를 삭제했다. 가짜 사용자명을 포함하던 랭킹 mock도 운영 source에서 제거됐다.
- **미사용 코드**: Vite가 tree-shake하던 export와 함수 10개군, 내부에서만 쓰던 `readObject` export를 정리했다. 구형 플래너 calendar modal renderer·state·open/close action도 함께 제거했다.
- **CSS 책임**: 주석 한 줄뿐인 `design-v2.css`와 import를 삭제했다. 모바일 CSS source of truth를 `runtime/main.js`의 명시적 modular import와 각 foundation/component/screen/layout 소유 파일로 문서화했다.
- **저장소**: 추적 중이던 `.idea` 파일 3개를 삭제하고 `.idea/`를 ignore했다. Vite scaffold 주석과 boot 실패 안내도 현재 동작에 맞췄다.
- **재발 방지**: `check-dead-code.mjs`가 production module 도달성과 Rollup unused export를 검사하며 `npm run check`에 연결됐다.
- **검증**: source 69개·화면 40개·action 153개·플랜 5개 계약, production source module 80개 도달·unused export 0개, build 210 modules, CSS audit와 `git diff --check`가 통과했다. bundle은 `879.90 kB`, gzip `243.89 kB`다.
- **다음**: CLEAN-03에서 `analysis-base.css`부터 동적 class와 recovery contract를 확인하며 dead selector를 단계적으로 제거한다.

---

## 2026-07-30 — CLEAN-01 운영 demo fail-open 제거 완료

- **빈 초기 상태**: 운영 앱에서 임의 사용자명·기본 대학·기본 성적·기본 플래너를 제거했다. 기존 demo 전용 `mock-data.js`, 가짜 분석 profile을 가진 `universities.js`도 삭제했다.
- **서버 권위 상태**: UserCore 조회 시작·실패 시 이전 사용자·플랜·목표 대학·성적·분석 cache를 비운다. 실패 시 홈은 가짜 데이터 대신 오류와 `다시 시도`를 표시한다.
- **분석 정합성**: 서버 환산 결과가 없을 때 정적 대학 profile이나 원점수 평균으로 점수를 만들지 않는다. 분석값이 없으면 명시적인 `분석 대기` 상태를 사용한다.
- **저장소 이관**: 과거 코드가 남긴 정확한 demo 성적 seed와 `pl-default-*` 계획만 선별 제거하고 사용자의 다른 로컬 데이터는 보존한다. 홈의 오늘 계획 key도 `YYYY-MM-DD`로 통일했다.
- **회귀 방지**: `check-production-state.mjs`를 `npm run check`에 연결하고 `retryInit` 상호작용 계약을 fixture에 추가했다.
- **검증**: 전체 check(79 source·40 화면·154 action·5 플랜), build(211 modules), CSS duplicate audit, `git diff --check`가 통과했다. 로컬 빈 홈에서 임의 데이터와 console error/warn이 없음을 확인했다.
- **후속 완료**: CLEAN-02에서 미도달 JS·미참조 export·추적 중 IDE metadata를 정리했다.

---

## 2026-07-30 — 모바일 변경 총정리·레거시 감사 완료

- **변경 범위**: `dev` 이후 12개 커밋, 114개 파일, `+3,877 / -1,942`줄이다. 모바일 CSS 33개, 화면 25개, 검사·fixture 18개가 중심이며 백엔드 변경은 없다.
- **구조 상태**: 화면 40개·action 153개·플랜 5개 계약과 build는 통과하지만 단일 bundle이 881.65 kB로 Vite 경고 기준을 넘는다.
- **최우선 위험 처리**: 사용자 API 일반 실패 시 기본 대학·점수·플래너와 분석 profile을 유지하던 demo fail-open은 CLEAN-01에서 제거했다.
- **정리 완료**: runtime import graph 미도달 JS, 단독 미참조 export와 추적 중인 `.idea` 파일은 CLEAN-02에서 제거하고 자동 검사로 고정했다.
- **CSS 후보**: class 1,063개 중 정적 literal 미참조 후보 151개가 있으며 `analysis-base.css`, `service.css`, `primitives.css` 순으로 크다. 동적 class를 제외하며 단계적으로 삭제해야 한다.
- **진행 문서**: `docs/exec-plans/completed/260730_mobile_change_summary_legacy_audit.md`

---

## 2026-07-29 — 모바일 dev 배포 사전 스모크 완료

- **공개/보호 라우팅**: 비로그인 상태에서 `home`, `analysis`, `planner`, `my`, `accountInfo`, 잘못된 화면 ID가 로그인으로 정규화되고 로그인·회원가입·개인정보·이용약관 화면은 직접 진입 가능함을 확인했다.
- **입력 가드**: 로그인 이메일에 한글을 섞어 입력해도 ASCII 이메일만 남도록 정규화됐다.
- **소셜 진입**: Google은 dev callback과 `google|mobile`, Naver는 dev callback과 `naver|mobile` 및 재인증 옵션으로 각 OAuth 화면에 정상 진입했다. 계정 인증 자체는 수행하지 않았다.
- **배포 기준선**: `dev-mobile-main`의 `4aecd82`가 `dev`의 `4a5c67b`보다 12개 커밋 앞서 있다. 실제 dev CSS도 캘린더 event overlay가 최신 `530`이 아닌 이전 `140`이라 Phase 1~9와 CLOSE 결과가 아직 배포되지 않은 상태다.
- **다음 게이트**: `dev-mobile-main` -> `dev` 병합과 GitHub Actions 배포 후 자산 버전을 확인하고, 로그인 -> 새로고침 -> 새 탭 -> 로그아웃, Google/Naver 복귀, 5개 플랜과 실제 API 데이터 스모크를 이어간다.

---

## 2026-07-29 — Manus 재구축 CLOSE 로컬 통합 QA 완료

- **계약 fixture**: 화면 40개, 정적 액션 153개, 4개 viewport, 화면·입력 상태 profile과 Free/Starter/Basic/Standard/Pro 권한을 `interaction-contract.json`에 고정했다.
- **회귀 검사**: `check-interaction-contracts.mjs`가 registry/fixture/action/dispatcher/플랜 권한과 항상 보이는 하단 5탭을 검사한다. 전체 `npm run check`에 연결했다.
- **화면 순회**: 320/360/390/430px에서 40개 화면씩 총 160개를 확인했고 수평 overflow, 빈 renderer, main tab 활성 불일치는 모두 0건이었다.
- **클릭 흐름**: 코칭 잠금→플랜 안내, 플래너 주·월→계획 추가, MY→계정정보, 인증 복구 modal과 홈 캘린더→일정 추가를 확인했다.
- **발견·수정**: 일정 추가 modal이 열린 캘린더 sheet 뒤에 가려지던 z-index 회귀를 수정하고 상대 layer 순서를 자동 검사로 고정했다.
- **상태**: 로컬 구현/QA는 완료했지만 dev Google/Naver·cookie 세션과 실제 5개 플랜/API smoke가 남아 있어 본 계획은 `active`에 유지한다.

---

## 2026-07-29 — Manus 재구축 Phase 9 진입·인증·온보딩 완료

- **인증 shell**: 로그인은 공식 logo, 358px form surface, 48px input/CTA, Google/Naver 실제 mark와 계정 복구를 하나의 위계로 재구성했다. 짧은 viewport에서는 compact brand row로 바뀐다.
- **복구 modal**: 이메일 찾기와 비밀번호 재설정을 360px 중앙 modal로 통일하고 장식 타일과 과대 제목을 제거했다. 390px에서 modal 중심 오차 0px를 확인했다.
- **단계형 회원가입**: 약관→본인·전화 인증→이메일 인증→계정 설정의 4단계 flow를 React와 fallback renderer에 동일하게 적용했다. 구형 social CTA와 한 페이지 일괄 입력은 제거했다.
- **온보딩 의미 보정**: splash/intro motion과 공식 logo·크랙이를 유지하고 임의 합격확률 문구를 지원학과 AI 점수와 원점수 +1 환산효율로 교체했다. 초기 입력의 이중 gutter와 하단 빈 공간도 제거했다.
- **소셜 callback**: 신규가입 약관 중간 화면을 공통 인증 surface로 맞추되 기존 계정 로그인 복귀와 신규 계정 약관 분기는 보존했다.
- **회귀 방지**: `check-auth-presentation.mjs`를 전체 검사에 연결했다. 수정 CSS 6개 duplicate selector 0, 전체 check/build/diff check 통과, 320/390px 수평 overflow 0을 확인했다.
- **다음**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md`의 `CLOSE-01~05` 통합 QA. Google/Naver 실계정과 dev cookie 세션은 dev 스모크 백로그에서 확인한다.

---

## 2026-07-29 — Manus 재구축 Phase 8 보조 화면 완료

- **공통 보조 화면 계약**: `secondary-page.js`와 `components/secondary.css`에 context intro, section head, compact list row, segmented control, form field, loading/empty/error state, 약관 reading surface를 정립했다.
- **화면 이관**: 대학 추가, 공부 랭킹, 리포트 목록·상세, 알림 설정·목록·상세, 정성조사서, 성적 정보, 계정 정보, 고객센터·Q&A·FAQ, 설정·약관, 플랜·결제·완료 화면을 같은 정보 위계로 맞췄다.
- **기능 계약 보존**: 대학→학과 2단계 선택, 일·주·월 랭킹, 알림 7개 pagination과 개별 상세, 성적 편집, 전화번호·소셜 계정, Q&A 작성, plan 선택과 웹 결제 action을 유지했다. 개인정보·이용약관은 placeholder 대신 기존 `TERMS_CONTENT` 전문을 표시한다.
- **CSS 소유권**: 공통 구조는 `secondary.css`, 화면 의미 보정은 각 `screens/*.css`가 소유한다. 이전 포디움 랭킹과 mypage의 Q&A·계정·정성조사서 중복 규칙을 제거하고 원래 파일을 직접 수정했다.
- **회귀 방지**: `check-secondary-presentation.mjs`를 전체 check에 연결해 공통 primitive와 주요 `data-action`, 알림 7개, 실제 약관, 가짜 포디움 재유입을 검사한다.
- **검증**: 전체 check/build, CSS duplicate audit, `git diff --check` 통과. 320/390/430px의 보조 화면 11종에서 수평 overflow 0, 대학→학과 전환, 약관 전문, 알림 switch와 브라우저 console error/warn 0건을 확인했다.
- **다음**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md` Phase 9 로그인·회원가입·온보딩 시각 연결.

---

## 2026-07-29 — Manus 재구축 Phase 7 공통 상태 완료

- **Overlay 계약**: modal은 frame 중앙, sheet는 frame 하단 전체 폭으로 통일하고 auth/home/analysis overlay를 `app-frame` 직속 layer로 이동했다.
- **구조와 스크롤**: 공통 header/body/footer를 도입해 긴 약관·주간 점검은 body만 scroll되고 header와 CTA는 고정된다.
- **모바일 키보드**: `visualViewport`의 높이와 offset을 CSS 변수로 동기화한다. 390x500 축소 상태에서도 sheet footer가 노출되고 내용만 독립적으로 scroll된다.
- **공통 상태**: 플래너·코칭 빈 상태를 `EmptyState` primitive로 교체했다. 잠금 화면은 preview를 유지하고 중앙 안내만 겹치며, 중앙 transform을 덮던 motion 회귀를 전용 keyframe으로 수정했다.
- **회귀 방지**: `check-overlay-contracts.mjs`를 전체 check에 연결했다. 공통 modal/sheet/empty/locked CSS duplicate selector는 모두 0이다.
- **검증**: 전체 check/build, CSS audit, `git diff --check` 통과. modal 중심 오차 0px, 320/360/390/430px sheet overflow 0, 약관 내부 scroll과 잠금 panel viewport 수용을 브라우저에서 확인했다.
- **다음**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md` Phase 8 보조 화면 전면 정리.

---

## 2026-07-29 — Manus 재구축 Phase 6 MY 완료

- **JSX 승격**: `my`를 `MyPageScreen.jsx`로 등록하고 profile, MBTI insight, 실제 학습 stat, 8개 기능 menu를 React 화면으로 재구성했다.
- **실데이터 모델**: 사용자명·학년/계열·구독·MBTI와 `studyRecords` 누적시간, 완료 planner item, 최장 연속 기록을 presentation 계층에서 정규화한다. 임의 사용자명·공부 기록은 만들지 않는다.
- **정보 구조**: 52px profile header, MBTI code/name/description과 4개 조언 row, 3열 stat, 학습 정보/서비스/계정·지원 menu group 순서로 정리했다.
- **기존 기능 보존**: profile 확대·사진 변경, Standard 이상 tutor 정보, 계정정보 관리, 전화번호 인증, Google/Naver 연동과 기존 화면 권한 분기를 그대로 유지했다.
- **CSS 소유권**: MY composition은 `screens/mypage.css`의 `.my-page` 계열이 소유한다. 공용 layout의 legacy MY selector를 제거했고 mypage duplicate selector는 17→13으로 줄었다.
- **검증**: 전체 check/build, CSS audit, `git diff --check` 통과. 빈/MBTI 결과 상태의 320/360/390/430px 수평 overflow 0, 390px content width 358px, profile modal 중앙 오차 0px와 accountInfo 이동을 확인했다.
- **다음**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md` Phase 7 공통 Modal·Sheet·Empty·Locked 상태 재구축.

---

## 2026-07-29 — Manus 재구축 Phase 5 학습 코칭 완료

- **JSX 승격**: `strategy`를 `CoachingScreen.jsx`로 등록해 화면과 8단계 점검 sheet가 React reconciliation을 사용하도록 바꿨다. 기존 `data-action`, validation, 파일 업로드, `save_weekly_check` payload는 유지했다.
- **정보 구조**: compact 코칭 context와 신청 hero 아래에 `이번 주 점검 / 받은 피드백` segmented control을 두고, 실제 `weeklyReports`를 요청 세션 row와 제출 완료 피드백 row로 분리했다.
- **상태/권한**: Standard 이상은 실제 요청·피드백과 빈/loading 상태를 확인한다. Starter 이하 잠금 경로는 동일한 코칭 preview geometry 위에 STANDARD 안내를 viewport 정중앙에 표시한다.
- **입력 안정성**: 단계 input과 textarea는 매 글자마다 sheet root를 교체하지 않는다. 1→5단계 이동과 이전/다음 왕복 후 값·focus가 유지됨을 확인했다.
- **CSS 소유권**: 코칭 composition/flow는 `screens/coaching.css`, 공통 sheet 좌표계는 `components/sheets.css`가 소유한다. 두 파일 duplicate selector 0, 코칭 관련 layout bridge override를 제거했다.
- **검증**: 전체 `npm run check`, Vite build, CSS duplicate audit, `git diff --check` 통과. 320/360/390/430px 수평 overflow 0, 잠금 panel 중심 오차 0px, browser console error/warn 0건을 확인했다.
- **다음**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md` Phase 6 MY 재구축.

---

## 2026-07-29 — Manus 재구축 Phase 4 플래너 완료

- **정보 구조**: 큰 제목·멘토 홍보 타일을 제거하고 날짜 문맥, compact 주/월 달력, 오늘 진도, 학습 계획, 주간 피드백 순서로 재구성했다.
- **진도 계약**: 완료 계획 수, 완료 시간, 총 계획 시간을 한 줄에 표시한다. 분 단위 완료율을 우선 사용하고 총 시간이 없는 legacy 항목은 완료 개수 비율로 계산한다.
- **계획 row**: 72px 최소 높이에 시간·제목·과목/세부 유형, 과목 식별점, 완료·삭제 action을 배치했다. 완료 시 높이를 유지한 채 border, 배경, 취소선만 변경한다.
- **기능 보존**: 주/월 전환, 주·월 단위 이전/다음 이동, 오늘 복귀, 기존 4단계 계획 추가, 완료 토글, 편집·삭제 및 local persistence 흐름을 유지했다.
- **CSS 소유권**: 메인 화면은 `planner.css`, 달력은 `planner-calendar.css`, 입력은 `planner-add.css`가 소유한다. 세 파일 duplicate selector 0, 이전 title/premium 공통 override 제거를 완료했다.
- **검증**: 전체 check, Vite build, CSS audit, `git diff --check` 통과. 320/360/390/430px 수평 overflow 0, 실제 계획 저장·완료율 0→100%·삭제 복귀와 browser console error/warn 0건을 확인했다.
- **다음**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md` Phase 5 학습 코칭 재구축.

---

## 2026-07-29 — Manus 재구축 Phase 3 분석 완료

- **정보 구조**: 대학·시험 selector, 현재 환산점수, 합격컷 부족 점수, 합격/안정 기준을 하나의 분석 hero와 단일 gauge로 통합했다.
- **원점수 +1 효율**: Basic 이상 이용자는 전 과목 효율을 바로 확인한다. 최고 효율 과목을 강조하고 row를 선택하면 서버가 계산한 `afterUiScore` 절대값까지 gauge가 연장된다.
- **음수 점수 계약**: 현재값과 상승 후 값을 각각 UI 범위로 clamp한다. `-50 → -40`을 `0 + 10 = 10`으로 표시하지 않도록 별도 presentation helper와 회귀 테스트를 추가했다.
- **역산/로딩**: Standard 이상만 역산 결과를 펼친다. 최초 분석 중에는 결과 카드 대신 중앙 loader만 표시하고 완료 후 결과 전체가 함께 등장한다.
- **CSS 소유권**: 분석 composition은 `analysis-unified.css`, gauge/효율 row는 `analysis.css`가 소유한다. 중복 selector는 각각 6→2, 19→0으로 감소했다.
- **검증**: `npm run check`, Vite build, CSS duplicate audit, `git diff --check` 통과. 320/360/390/430px 수평 overflow 0, 대학 선택 상태 유지, 브라우저 console error/warn 0건을 확인했다.
- **다음**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md` Phase 4 플래너 재구축.

---

## 2026-07-29 — Manus 재구축 Phase 2 홈 완료

- **정보 구조**: 인사/D-day를 compact header로 줄이고, 시험 기준·다중 목표 대학 전환을 유지한 환산점수 hero를 첫 핵심 영역으로 재구성했다.
- **오늘 미션**: 분리돼 있던 누적 공부 타이머와 오늘 목표를 한 카드로 결합했다. 실제 planner task와 과목별 timer를 집계해 최대 3개 과목의 목표 대비 진행률을 표시한다.
- **학습 흐름**: 거대한 랭킹 카드를 오늘 공부 시간·계획 완료율·계획 수와 연결된 compact ranking row로 바꾸고, 리포트 미리보기는 하단 secondary surface로 낮췄다.
- **환산점수 계약**: 분석 대기/성적 없음은 0점 대신 skeleton·`—`로 표시한다. 합격컷까지 필요한 점수는 `max(0, 100 - 현재 환산점수)`로 계산하며 합격확률이나 임의 수치를 만들지 않는다.
- **CSS 소유권**: slider/skeleton/breakdown은 `home-base.css`, 최종 홈 composition은 `home.css`가 소유하도록 이중 정의를 제거했다. `home.css` duplicate selector 17→0, `home-base.css` 9→4로 감소했다.
- **회귀 방지**: `check-home-presentation.mjs`를 `npm run check`에 연결해 pending/실점수/합격컷과 과목 집계 계약을 자동 검사한다.
- **검증**: 전체 check, Vite build, CSS duplicate audit, `git diff --check` 통과. 320/360/390/430px 수평 overflow 0, 캘린더·대학 카드·시험 기준 상호작용과 브라우저 콘솔 error/warn 0건을 확인했다.
- **다음**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md` Phase 3 분석 탭 재구축.

---

## 2026-07-29 — Manus 재구축 Phase 0·1 완료

- **기준선 계약**: 모바일 registry 40개 화면, 주 탭 5개, 4개 QA viewport, 공통 상태와 공식 logo/분석 권한을 `studycrack-mobile-app/fixtures/ui-contract.json`에 고정했다.
- **자동 검사**: `check-ui-contracts.mjs`를 `npm run check`에 추가해 화면 누락, 하단 탭 변경, onboarding 임의 logo 재사용, Trial 분석 권한 재유입을 차단한다.
- **공통 디자인 기반**: canvas/surface/ink/navy/상태색, 4~24px spacing, 12/16px radius, 3단 shadow, 10~24px type, 120~320ms motion token을 추가하고 legacy 변수는 adapter로 유지했다.
- **Shell/Navigation**: 16px gutter, 12px card gap, 72px 고정 하단 탭, 중성 단색 배경과 Noto Sans KR/Inter를 적용했다. tabbar 구조 스타일은 `navigation.css`로 단일화하고 tabbar 자체의 이동 motion을 제거했다.
- **권한/브랜드 보정**: onboarding은 공식 `studycrack_logo_wo_bg.png`를 사용하며, 순방향 점수 시뮬레이션은 Basic/Starter/Standard/Pro, 역산은 Standard/Pro만 허용한다.
- **검증**: `npm run check`, `npm run build`, CSS 복구 감사, `git diff --check` 통과. 320/390/430px 홈 및 390px 주 탭 5종에서 수평 overflow 0px와 화면/활성 탭 일치를 확인했다.
- **진행 문서**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md` — 다음은 Phase 2 홈 재구축이다.

---

## 2026-07-29 — Manus 재구축 계획 브랜드·인증·분석 계약 보정

- **공식 logo 고정**: 모바일의 모든 splash/intro/auth brand 표시는 `STUDYCRACK_LOGO_SRC`를 source of truth로 사용하고, 현재 공식 `assets/images/studycrack_logo_wo_bg.png` 외 임의 logo·문자 logo·AI 생성 logo를 금지했다. onboarding도 `og-image.jpg` 대신 같은 공식 logo로 통합한다.
- **인증 디자인 구체화**: 레퍼런스에 없는 로그인·회원가입을 생략하지 않고 내부 앱과 동일한 390px frame, 16px gutter, typography, surface, input, button, 중앙 modal 체계로 설계한다. 로그인/Google·Naver/계정 복구와 회원가입 약관→전화→이메일→계정 설정, 소셜 신규가입 약관 분기까지 세부 계약을 추가했다.
- **분석 의미 정정**: 레퍼런스의 합격확률은 도입하지 않는다. 홈·분석 핵심 값은 기존 대학별 환산점수이며, 과목별 1점 효율은 원점수 +1 전후의 환산점수 차이를 `점` 단위로 표시한다.
- **권한 정정**: 분석 탭에 진입한 Basic 이상 이용자는 전 과목 효율을 바로 확인한다. 과목별 BASIC 잠금과 전체 효율 upgrade CTA는 제거하고, Standard 이상 전용 잠금은 역산 결과에만 적용한다.
- **진행 문서**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md`

---

## 2026-07-28 — Manus 레퍼런스 기반 모바일 앱 전면 디자인 재구축 계획

- **레퍼런스 조사**: `https://studycrack-hbaxyjhe.manus.space/`의 홈·분석·플래너·코칭·MY 탭을 직접 조사하고 390px frame, 16px gutter, 358px card, 16px radius, 12px card gap, Noto Sans KR, normal/hero shadow 규격을 측정했다.
- **핵심 방향**: 기존 API·플랜 권한·저장 흐름을 유지하면서 `Foundation → Shell → 5개 주 탭 → modal/sheet → 보조 화면 → 인증/온보딩` 순서로 시각 구조를 재구축한다.
- **구조 개선**: 홈·분석·플래너 JSX를 재구성하고 학습 코칭·MY를 JSX로 승격한다. 입력 중심 보조 화면도 단계적으로 JSX로 옮겨 화면 전환, focus, scroll 상태를 보존한다.
- **세부 WBS**: Foundation, 홈, 분석, 플래너, 코칭, MY, overlay, 대학/랭킹/알림/성적/Q&A/결제, 인증/온보딩을 컴포넌트·데이터 출처·상태·CSS 소유권·완료 조건 단위로 세분화했다.
- **클릭 전수조사 보완**: 레퍼런스 5개 탭의 실제 button을 목록화하고 동작군별 대표 항목을 눌러 홈 미션/합격 링, 분석·플래너 upgrade sheet, 플래너 task 완료/해제, 코칭 예정/피드백 전환을 확인했다. 프로토타입에서 무동작인 plan CTA, 계획 추가, 코칭 신청·세션 준비, MY menu는 시각만 참고하고 현재 앱의 실제 기능을 연결하도록 분리했다.
- **전체 surface 보장**: 모바일 registry 40개 화면과 홈·분석·플래너·코칭·MY·인증·결제의 클릭 흐름, modal/sheet 상태 매트릭스를 계획에 추가했다. screen/action fixture, 4 viewport walkthrough, screenshot pair, 주요 `data-action` 테스트/예외 분류를 완료 게이트로 삼는다.
- **진행 문서**: `docs/exec-plans/completed/260728_mobile_manus_visual_rebuild.md`
- **현재 상태**: 레퍼런스 조사와 sector별 구현/검증 계획 완료, 코드 구현 시작 전.

---

## 2026-07-27 — 모바일 Q&A 입력 포커스·홈 최초 환산점수 재시도 보강

- **1:1 문의 원인/수정**: 문자열 renderer 기반 Q&A 작성 화면이 매 입력마다 React state를 갱신하면서 modal DOM 전체를 교체해 textarea focus와 모바일 키보드를 잃고 있었다. 입력 중에는 DOM과 `qnaDraftRef`만 갱신하고, 제출 시 현재 DOM 값을 읽도록 바꿔 한글 조합 중에도 입력 노드를 유지한다.
- **최초 환산점수 원인/수정**: 로그인 직후 첫 분석 요청이 API 준비·네트워크·서버 일시 오류 또는 빈 200 응답으로 끝나면 재시도하지 않아 시험을 바꿔야만 새 signature 요청이 발생했다. 인증/요청 오류는 제외하고 일시 오류·빈 응답만 300ms·600ms 간격으로 최대 2회 자동 재시도한다. 분석 결과에 생성 시험·signature 소유권을 기록해 직전 시험 결과가 현재 시험 캐시로 해석되는 경로도 차단하고, 기존 request ID guard로 오래된 응답의 역전 반영을 막는다.
- **검증**: Q&A 입력 중 state setter가 호출되지 않는 계약 테스트와 점수 재시도 정책 테스트를 `npm run check`에 연결했다. 전체 check, Vite production build, UserCore/Reminder Lambda 문법 검사, `git diff --check`가 통과했다.
- **배포 경계**: 이번 Q&A·환산점수 수정은 모바일 프론트 배포 대상이다. 기존 알림 환경설정에 따른 예약 발송 차단을 실제 적용하려면 `StudyCrack_Reminder` Lambda 재배포가 필요하고, 알림 설정 저장·랭킹 fallback까지 적용하려면 `StudyCrack_UserCore`도 함께 재배포해야 한다.

---

## 2026-07-27 — localhost API 라우팅 회귀 복구

- **원인**: `js/config.js`가 localhost에서도 dev 커스텀 도메인을 사용해 API Gateway `/local` stage와 `$LATEST` Lambda alias를 우회하고 있었다.
- **수정**: localhost API base를 직접 Gateway `/local` 경로로 복구하고, dev/prod 및 명시적 override 경로는 유지했다.
- **재발 방지**: `check-config-routing.mjs`를 `npm run check`에 연결해 localhost/dev/prod별 API URL 계약을 자동 검증한다.
- **후속 500 진단**: 라우팅 복구 후 드러난 요청은 홈의 `get_study_ranking`이며, 별도 랭킹 테이블 미생성 또는 Lambda 실행 역할 권한 누락 시 발생한다. 인프라 준비 전에는 빈 랭킹 응답으로 안전하게 저하하도록 UserCore를 보강했다.
- **검증**: 전체 source contract와 Vite production build, `git diff --check`가 통과했다.

---

## 2026-07-27 — 모바일 핵심 기능 신뢰성 로컬 구현 완료

- **진행 문서**: `docs/exec-plans/completed/260727_mobile_core_function_reliability_rebuild.md`
- **성적/대학**: 숫자 직접 입력과 실제 환산 결과 저장, 대학→학과 계층 검색, 최신 성적 기반 서버 추천을 연결했다.
- **타이머/랭킹**: 시작 시각 기반 세션 복구, 서버 세션 저장, 일간·주간·월간 실제 랭킹 계약을 구현했다.
- **분석/알림**: 역산 전용 상태기계와 API를 연결했고 알림 환경설정은 UserCore 저장 및 Reminder 발송 차단까지 연결했다.
- **코칭**: 점검 sheet를 viewport fixed layer로 바꾸고 하단 CTA 겹침과 입력 중 scroll 복원 충돌을 해소했다.
- **배포 대기**: `StudyCrack_UserCore`, `StudyCrack_Reminder` 재배포와 `StudyCrack_StudyRankings` 테이블(PK `periodKey`, SK `sortKey`, TTL `expiresAt`) 생성 후 dev 실계정 스모크가 필요하다.

---

## 2026-07-27 — 모바일 핵심 기능 신뢰성 재구축 조사 완료

- **진행 문서**: `docs/exec-plans/completed/260727_mobile_core_function_reliability_rebuild.md`
- **알림 설정**: switch 마크업은 있으나 일반 switch CSS, 서버 저장, Reminder 발송 차단이 빠져 있어 실제 설정 기능이 아니었다.
- **분석 역산**: 모바일이 웹의 `backtrace_required_raw` 후속 호출을 이식하지 않아 simulation 응답에 계획이 없을 때 `최소 조합 계산 중`이 영구 상태가 된다.
- **타이머/랭킹**: 타이머는 DOM 직접 갱신과 localStorage 기록만 사용하고, 랭킹은 mock/임의 공식이며 기간 전환 handler도 없다. 두 기능을 서버 학습 세션 단일 모델로 재구축한다.
- **대학 추가**: 추천은 정적 상수이고 서버 대학/학과 계층을 문자열 목록으로 평탄화하고 있다. 웹과 같은 추천 계약 및 대학→학과 2단계 선택으로 교체한다.
- **성적 입력**: wheel 입력을 숫자 직접 입력으로 바꾸고, 마지막 탐구 저장 후 모달이 닫히지 않는 분기를 수정한다. 실제 scoreboard 기반 표준점수·백분위·등급 응답을 저장 결과에 병합한다.
- **학습 코칭**: sheet 좌표계, tabbar/keyboard safe area, 입력 중 전체 재렌더에 따른 scroll reset을 함께 정리한다.
- **구현 순서**: 성적/지표 → 대학 추천/검색 → 타이머/랭킹 → 역산 → 알림 → 코칭/주간 점검 → dev 통합 스모크.

---

## 2026-07-24 — 모바일 인증 입력·분석 로딩·계정정보 관리 재정비 완료

- **완료 문서**: `docs/exec-plans/completed/260724_mobile_auth_analysis_account_management_rework.md`
- **이메일 입력**: 공용 ASCII 이메일 sanitizer와 validator를 로그인·회원가입·비밀번호 재설정의 JSX/fallback 경로에 적용하고 회귀 테스트를 추가했다.
- **홈/분석**: 홈 대학명·위험도를 왼쪽 정렬하는 독립 wrapper를 추가했다. 분석은 중앙 loading stage와 제목·결과 content stage가 상호 배타적으로 렌더되고 완료 후 함께 등장한다.
- **계정정보 통합**: 프로필 상세 진입을 `계정정보 관리` 하나로 합쳤다. 이름·전화번호 모달은 accountInfo 화면만 소유하고 화면 이탈 시 임시 상태를 정리한다.
- **서버 검증**: UserCore가 전화번호 인증 레코드의 존재와 TTL을 확인하고 회원정보 갱신과 인증 증명 소비를 트랜잭션으로 처리한다. Auth의 인증번호 TTL 검사도 보강했다.
- **검증**: `npm run check`, `npm run build`, Lambda 문법 검사, CSS 중복 감사, `git diff --check` 통과. 320px·390px 관련 화면 overflow 0 및 브라우저 console error 0을 확인했다.
- **후속 UI 교정**: 전화번호·비밀번호 변경 액션을 밑줄 링크로 명확히 하고, 계정 수정 모달의 장식 타일·단계 표시를 제거했다. 플래너 주간 날짜는 7열 균등 grid로, 분석 로딩은 경계 없는 가용 화면 중앙 장면으로 변경했다.
- **남은 확인**: StudyCrack_Auth와 StudyCrack_UserCore Lambda 재배포 후 SMS 변경·영속화·소셜 계정·dev 세션 사이클을 통합 스모크 백로그에서 확인한다.

---

## 2026-07-23 — 홈 초기 환산점수 수명주기·랭킹 소유권 복구

- **진행 문서**: `docs/exec-plans/completed/260723_mobile_home_score_tile_ranking_recovery.md`
- **점수 요청**: signature에 정규화된 원점수 payload를 포함하고 요청 ID를 추가해, 같은 시험·대학에서 늦게 도착한 이전 응답이 최신 결과를 덮지 못하게 했다. 동일 loading/ready signature의 중복 호출도 차단했다.
- **0점 계약**: 계산된 UI 0점과 계산 불가 기본값 0을 `available`로 구분한다. Lambda 응답에도 `score_available`과 사유 필드를 추가했으며, 프론트는 구버전 응답도 `is_eligible/status`로 판별한다.
- **랭킹 CSS**: 상세 랭킹을 `screens/ranking.css`로 분리하고 `mypage.css`의 랭킹 `!important`를 제거했다. 홈 랭킹 tier surface와 progress fill도 복구했다.
- **테스트**: score-store 계약 테스트를 `npm run check`에 연결했다. check/build/Lambda syntax/CSS recovery/CSS duplicate/diff 감사를 통과했고 320·390px 홈/랭킹에서 가로 overflow 0을 확인했다.
- **남은 확인**: dev 실계정 로그인 첫 화면, 시험 전환·복귀, 새로고침을 확인해야 한다. 명시적 백엔드 응답 계약 적용에는 StudyCrack_Analysis Lambda 재배포가 필요하다.

---

## 2026-07-23 — 모바일 전체 화면 레이아웃 계약 복구 완료
- **완료 문서**: `docs/exec-plans/completed/260723_mobile_full_layout_contract_audit.md`
- **범위**: 로그인·회원가입과 로컬 registry 40개 화면을 390 x 844에서 전수 순회하고, 320 x 700 좁은 화면 및 주요 modal/form을 추가 점검했다.
- **핵심 원인**: 기존 복구 감사는 selector 존재 여부만 확인해 `display`, `width`, `padding`, `position` 같은 필수 구조 속성 누락을 놓쳤다. 분할 전 정적 CSS에 있던 `.planner-input`, `.top-card-head`, `.notify-switch`, `.auth-sso-btn`, 플래너 grid 계약 일부가 modular source로 완전히 이관되지 않았다.
- **주요 회귀**: 로그인 입력/SSO 정렬, 복구 modal 입력, 플래너 시간 입력, 정성조사서 input/select, 계정 정보 마케팅 토글, 공용 상단 title tile, 플래너 CTA/list, 홈 report grid가 영향을 받는다. 대학 추가 화면은 390px에서 실제 우측 clipping이 재현된다.
- **복구 결과**: 공용 form/button/card/title 계약, 인증 화면과 복구 modal, 플래너 CTA/list, 홈 report grid, 계정 정보 marketing switch, 대학 추가 반응형을 원래 소유 파일에서 복구했다. 분석·학습 코칭·마이 상단 infographic도 함께 복구했다.
- **재발 방지**: selector 존재 감사에 13개 공용 component의 필수 property contract 검사를 추가했다. 현재 actionable missing selector와 property contract failure는 모두 0이다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. 320/360/390/430px와 registry 40개 화면을 검사했고 360px에서 무효 gap, 입력 padding 누락, native outset button은 0건이다.
- **문서 정리**: 본 계획은 구현 및 로컬 검증 완료 상태로 `completed/`에 유지한다. 실계정·권한·쿠키 검증은 `docs/exec-plans/active/260706_mobile_dev_smoke_backlog.md` 한 곳에서 계속 추적한다.

### 현재 active 계획

- `260601_reminder_schedule_diagnosis.md` — EventBridge 및 재배포 검증 대기
- `260604_tutor_auth_separation.md` — 인프라 라우팅 및 dev 인증 스모크 대기
- `260609_tutorial_strategy_projection.md` — dev 실데이터 스모크 대기
- `260628_score_subsystem_clean_rebuild.md` — R3~R5 구현 및 회귀 검증 진행 중
- `260701_kcc_promotion_page.md` — dev 배포 및 실계정 중복 지급 검증 대기
- `260706_mobile_dev_smoke_backlog.md` — 모바일 실세션 통합 검증 대기
- `260723_mobile_home_score_tile_ranking_recovery.md` — 로컬 구현 완료, dev 실계정 최초 점수 검증 대기
- `260723_mobile_cross_screen_layout_regression_audit.md` — 공통 여백·stack·타이포 1차 복구 완료, 상태별 검증 대기
- `260727_mobile_core_function_reliability_rebuild.md` — 로컬 구현 완료, 관련 Lambda/인프라 배포와 dev 실데이터 검증 대기
- `260728_mobile_manus_visual_rebuild.md` — Phase 0~9와 CLOSE 로컬 QA 완료, 최신 dev 배포 및 실세션 검증 대기
- `260730_mobile_change_summary_legacy_audit.md` — 변경 총정리·레거시 감사 완료, CLEAN-01~05 정리 구현 대기

---

## 2026-07-23 — 모바일 전 화면 공통 레이아웃 1차 복구

- **진행 문서**: `docs/exec-plans/completed/260723_mobile_cross_screen_layout_regression_audit.md`
- **공통 계약**: 모바일 page gutter와 card stack gap token을 추가하고, `.app-content`가 좌우 gutter를 단독 소유하도록 주요 탭의 이중 padding을 제거했다.
- **타이포/카드**: `.sub`, `.analysis-title` 기본 margin을 정규화하고 고객센터·주간/PRO 리포트·리포트 상세에 공통 stack을 적용했다. 고객센터 카드 간격은 0px에서 14~16px로 복구됐다.
- **화면별 복구**: 학습 코칭/플래너 제목 여백, 마이/튜터 subtitle, 홈 마지막 카드 묶음과 홈 환산점수 KPI 2열 구조를 고쳤다.
- **감사 강화**: 공통 stack, title/sub margin, 홈 section, KPI 구조를 CSS property contract에 추가했다.
- **검증**: 320 x 700과 390 x 844 주요 11개 화면에서 수평 overflow 0. 로그인 320px 입력/SSO 폭 유지. `npm run check`, `npm run build`, CSS 감사, `git diff --check` 통과.
- **남은 범위**: 홈 초기 점수·랭킹 구현, 상세 랭킹 CSS 분리, 분석·플래너·알림·프로필의 dev 실데이터 상태 검증.

---

## 2026-07-23 — 모바일 홈 초기 점수·타일·랭킹 재진단

- **계획 문서**: `docs/exec-plans/completed/260723_mobile_home_score_tile_ranking_recovery.md`
- **초기 점수 원인**: 요청 signature가 시험과 대학 목록만 포함하고 성적 payload를 제외한다. 고유 request ID도 없어 같은 signature의 오래된 응답을 최신 응답과 구분하지 못한다.
- **0점 오인**: 백엔드는 계산 불가 결과도 기본 `converted_score: 0`으로 시작하지만 프론트는 숫자 여부만 보고 confirmed 캐시에 넣는다. 계산 불가 0과 유효한 UI 0을 구분하는 응답 계약이 필요하다.
- **카드 구조 회귀**: 분할 전 존재하던 KPI row/item의 `display:grid`, 숫자 block, padding/text-align 계약이 현재 modular CSS에서 누락됐다. 홈 제목의 scoped `margin:0`도 빠져 기본 문단 여백이 카드 내부에 유입된다.
- **랭킹 회귀**: 티어 surface보다 뒤에서 로드되는 홈 랭킹 흰 배경이 이를 덮고, 상세 랭킹은 `insights.css`와 `mypage.css`가 중복 소유한다.
- **수정 순서**: 점수 signature/request ID → 0점 유효성 계약 → 홈 카드 구조 → 홈 타일 밀도 → 랭킹 전용 CSS → 320~430px 및 dev 실계정 회귀 검증.

---

## 2026-07-23 — 모바일 전 화면 레이아웃 회귀 전수조사

- **계획 문서**: `docs/exec-plans/completed/260723_mobile_cross_screen_layout_regression_audit.md`
- **전수조사 결론**: 홈과 같은 계열의 문제가 고객센터, 리포트, 튜터, 학습 코칭, 마이, 잠긴 기능 preview에도 존재한다. 광범위한 class 삭제가 아니라 브라우저 기본 margin 유입, 카드 stack gap 부재, shell/root 이중 padding, 화면별 CSS cascade 분산이 공통 원인이다.
- **즉시 재현**: 고객센터 문의/FAQ 카드 간격 0px, 리포트·튜터·학습 코칭의 제목/설명 기본 margin, 마이 프로필 subtitle 기본 margin을 확인했다.
- **조건부 화면**: 분석과 플래너는 로컬 빈 상태에서는 overflow가 없지만 loaded/loading/error/locked 및 기존 일정 상태의 dev 실데이터 검증이 필요하다.
- **복구 순서**: 공용 gutter/stack/타이포 계약 → 고객센터·리포트·튜터·코칭 복구 → 주요 탭 이중 padding 정리 → 랭킹 소유권 분리 → 320~430px 상태 기반 시각 회귀 검증.

---

## 2026-07-22 — 모바일 비로그인 보호 화면 직접 진입 차단
- **원인**: 모바일 단일 HTML이 공개 인증 화면과 앱 본문을 함께 제공하는 구조에서 `?screen=` 초기 화면 파라미터가 세션 없이도 보호 화면을 열 수 있었다. API 호출은 생략됐지만 기본 데모 상태의 홈/분석 화면이 노출됐다.
- **변경**: `studycrack-mobile-app/src/runtime/main.js` 초기 라우팅에 공개 화면 allowlist를 추가했다. dev/prod에서 비로그인 사용자가 보호 화면이나 알 수 없는 화면으로 직접 진입하면 URL과 화면을 `authLogin`으로 정규화한다.
- **로컬 QA 유지**: `localhost`, `127.0.0.1`, `*.local`에서는 `?screen=` 직접 진입을 유지해 화면별 디자인 테스트가 막히지 않게 했다.
- **검증**: `home`, `analysis`, `coach`, `planner`, `my`, `accountInfo`, 잘못된 화면 ID의 차단과 회원가입/개인정보처리방침/인트로 공개 화면 유지를 production-like 로컬 호스트에서 확인했다. `npm run check`, `npm run build`, `node --check`, `git diff --check`를 통과했다.
- **남은 dev 확인**: GitHub Actions 배포 후 비로그인 직접 진입과 로그인 -> 새로고침 -> 새 탭 -> 로그아웃 실세션 스모크가 필요하다.
- **공개 인증 화면 QA**: 320/360/390/430px에서 로그인·회원가입·이메일 찾기·비밀번호 찾기·개인정보 처리방침·이용약관을 추가 검사했다. 가로 overflow와 native 기본 버튼 회귀는 0건이고, 찾기 모달 중심 오차는 0px, 약관 시트 좌우/하단 여백은 12px였다.
- **dev 소셜 진입 QA**: Google/Naver 모두 dev `/social-callback`과 provider별 `mobile` state로 OAuth 화면에 진입했다. Google 계정 선택과 Naver 재인증 옵션도 정상이다. 인증 완료·신규 약관·모바일 복귀는 실제 계정 검증이 남는다.
- **배포 상태 구분**: 보호 라우팅 코드는 `dev-mobile-main` HEAD에는 있으나 자동 배포 대상 `dev`에는 아직 없다. dev에서 기존 홈 직접 진입이 보이는 원인은 번들 캐시가 아니라 미병합 상태이며, 모바일 dist는 워크플로우에서 `no-cache, no-store`와 CloudFront 무효화를 적용한다.

---

## 2026-07-22 — 모바일 플래너 입력 검증 및 CSS 계획 정리
- **플래너 완료 문서**: `docs/exec-plans/completed/260712_mobile_planner_time_detail_rework.md`
- **입력 플로우**: 잘못된 시간 차단, 4단계 전환, 과목/세부과목/학습유형 선택, 저장 후 일정 카드 반영과 새로고침 유지까지 확인했다.
- **반응형**: 360 x 800과 390 x 844에서 가로 overflow와 단계 카드/sticky footer 겹침이 없었다.
- **CSS 문서 이관**: `260715_mobile_css_bloat_duplication_audit.md`, `260717_mobile_layout_regression_report.md`를 완료 처리했다. CSS 분할·복구·전체 화면 스모크가 끝났으므로 수치만 줄이기 위한 추가 병합은 중단한다.
- **남은 모바일 검증**: 인증 쿠키, 소셜 복귀, 권한별 실데이터처럼 dev 세션이 필요한 항목은 `docs/exec-plans/active/260706_mobile_dev_smoke_backlog.md`에서만 관리한다.

---

## 2026-07-22 — 모바일 UI 전수 회귀 복구 완료
- **완료 문서**: `docs/exec-plans/completed/260721_mobile_ui_regression_full_audit.md`
- **복구 결과**: 분할 전 기준본 `4ffbfef`에서 활성 renderer가 사용하던 selector 누락을 공용 navigation/modal/sheet/drawer와 화면별 모듈로 이관했다. 기준본 복구 가능 누락은 0개다.
- **감사 정확도**: `tools/audit_mobile_css_recovery.mjs`가 템플릿 동적 표현식을 class로 오인하지 않도록 보정하고, 동반 기본 class 및 의도적 의미 wrapper를 분류한다. 현재 실제 조치 대상 누락은 0개다.
- **전체 화면 QA**: 360 x 800, 430 x 932에서 registry 40개 화면을 순회해 의도된 캐러셀 외 수평 overflow, native 기본 버튼, route 불일치가 모두 0건임을 확인했다.
- **상태 QA**: 390 x 844에서 인증 modal, 홈 캘린더/알림 sheet, 일정 입력, 분석 loading, 잠금 안내, 플래너, 회원가입, 인트로 motion을 확인했다. 일정 날짜 입력 2개의 native 최소 너비 겹침을 수정했다.
- **검증**: CSS 중복 감사, 복구 감사, `npm run check`, `npm run build`, `git diff --check` 통과. 500kB bundle 경고는 기존 기술부채다.

---

## 2026-07-21 — 모바일 UI 전수 회귀 진단
- **계획 문서**: `docs/exec-plans/completed/260721_mobile_ui_regression_full_audit.md`
- **실제 재현**: 390 x 844 로컬 렌더에서 로그인 보조 버튼이 브라우저 기본 `outset` 스타일로 노출되고, 이메일 찾기/약관 모달 backdrop이 `position: static`, `display: block`으로 문서 하단에 붙는 현상을 확인했다.
- **원인**: 모바일 정적 CSS를 fallback 전용으로 축소하는 과정에서 과거 정적 CSS가 소유하던 modal/sheet/drawer/appbar/button의 공용 구조 규칙이 modular 앱 CSS로 완전히 이관되지 않았다. 현재는 animation/색상 보정만 남고 overlay 좌표계가 빠진 상태다.
- **누락 규모**: 현재 소스에서 사용하는 정적 class 중 최소 127개가 과거 `css/studycrack-mobile.css`에는 존재하지만 현재 앱 CSS에는 exact selector가 없다. 분석/대학 추가, 플래너, 학습 코칭, 온보딩 상세, 리포트/결제 하위 화면까지 영향을 받는다.
- **인트로 모션**: `on1` 실제 렌더에서 `.app-screen`, `.onboarding-shot`, `.onboarding-card`, `.onboarding-character` 모두 `animation-name: none`임을 확인했다.
- **복구 순서**: 공용 UI 계약 → 인트로 motion → 인증 → 전체 overlay/sheet → 누락 활성 class 화면별 이관 → 360/390/430px 전체 시각 QA 순서로 진행한다. 과거 정적 CSS 전체를 되살리거나 새 override block을 누적하지 않는다.
- **복구 원본 확정**: 분할 전 마지막 전체본 `4ffbfef`의 `studycrack-mobile-app/src/styles/design-v2.css`(2,182줄)와 `css/studycrack-mobile.css`(3,403줄)를 합쳐 기준본으로 사용한다. `54810ed` 축소 경계와 `6af0ce0` 모듈 분할 결과를 함께 3-way 비교해 의도적 변경과 누락을 구분한다.
- **복구 방식**: Git object를 `git show`로 직접 조회하고, 활성 renderer class → 과거 selector family → 현재 소유 모듈을 자동 매핑한다. 구조 속성을 우선 복구하고 현재 색상/밀도는 유지하며, 과거 전체 CSS를 import하거나 통째로 덮어쓰지 않는다.
- **1차 복구 완료**: `tools/audit_mobile_css_recovery.mjs`를 추가해 기준본 2개 CSS와 현재 JS/JSX/CSS를 자동 대조한다. 확대된 추출 기준으로 확인된 기준본 복구 가능 class 132개를 navigation/modal/sheet/drawer/primitives와 화면별 모듈로 이관했고, 기준본 활성 class 누락은 0개가 됐다.
- **공용 모듈화**: `components/navigation.css`, `components/sheets.css`, `components/drawers.css`, `screens/coaching.css`, `screens/reports.css`를 신설했다. 새 모듈 내부 duplicate selector는 0건이며 과거 정적 CSS 전체를 import하지 않았다.
- **인트로/인증 복구**: `on1`~`on3` 장면과 내부 요소 stagger motion, 로그인 logo fallback, auth text action reset, 이메일/비밀번호 찾기 중앙 modal, 약관 bottom sheet 좌표계를 복구했다.
- **로컬 구조 스모크**: 390 x 844에서 35개 registry 화면을 순회해 수평 overflow 0px를 확인했다. native `outset` 버튼 1건(플래너 CTA)을 수정한 뒤 핵심 15개 화면 재검사에서 0건을 확인했다. 이메일 찾기 modal 중심 오차는 0px, 약관 sheet 하단 safe gap은 12px였다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. 남은 작업은 360/430px 및 실제 로그인 데이터 기반 loading/empty/long text/modal 시각 QA다.

---

## 2026-07-14 — 7월 학평 전과목 verified full 보간 갱신
- **데이터 재생성**: `2027_july_mock_exam_grade_cut_preprocess_verified_full.json`의 전과목 등급컷 요약값을 5월 조밀 보드 구조에 맞춰 보간해 `backend-backup/StudyCrack_Analysis/data/2026_jul_scoreboard_final.json`을 22개 영역으로 재생성했다. 생성기는 `backend-backup/StudyCrack_Analysis/data/_gen_jul_scoreboard.py`로 보존했다.
- **지원 범위**: 국어(화작/언매), 수학(확통/미적분/기하), 사회탐구 9과목, 과학탐구 8과목을 모두 지원한다. 기존 7월 모드의 일부 탐구 제한/차단 안내는 제거했다.
- **백엔드 확장**: `StudyCrack_Analysis`에 `SCOREBOARD_JUL` 캐시, 원점수/백분위 인덱스, `examMode/month === 'jul'` 분기를 유지한다. `JUL_SUBJECT_NOT_AVAILABLE`은 매핑 누락·비정상 입력 방어용으로만 남겼다.
- **프론트 확장**: `survey.html`/`tutorial.html`에 7월 학평 선택지를 유지하고, 7월 선택 시 전과목 등급컷 기반 보간 추정치라 실제 성적표와 다를 수 있다는 안내를 표시한다. 분석 화면의 7월 라벨도 `7월 학력평가(추정)`으로 표기한다.
- **문서화**: 보간 규칙과 검증 기준은 `docs/algorithms/jul-scoreboard-interpolation.md`에 정리했다.
- **검증**: 생성기 컷 재현 검증 통과, `python3 -m py_compile backend-backup/StudyCrack_Analysis/data/_gen_jul_scoreboard.py`, `node --check backend-backup/StudyCrack_Analysis/index.mjs`, `node --check js/survey.js`, `node --check js/tutorial.js`, `node --check js/analysis.js` 통과.
- **배포 참고**: 실제 환산 반영에는 **StudyCrack_Analysis Lambda 재배포가 필요하다.** 프론트 정적 자산은 GitHub Actions 배포 워크플로우로만 배포한다.

---

## 2026-07-10 — 모바일 알림/플래너/학습코칭 보정
- **계획 문서**: 구현/로컬 검증이 완료되어 `docs/exec-plans/completed/260710_mobile_notification_planner_coach_polish.md`로 이관했다.
- **탭 간격 통일 계획**: 홈/분석/학습코칭/플래너/마이 탭의 좌우 padding, 카드 gap, 상단 title tile 규격을 플래너 탭 기준으로 맞추는 작업은 구현/검증 완료 후 `docs/exec-plans/completed/260715_mobile_tab_spacing_unification.md`로 이관했다.
- **모바일 레이아웃 시스템 1차 적용**: `design-v2.css`와 정적 `studycrack-mobile.css` 하단에 `mobile layout system final` 블록을 추가했다. 홈/분석/플래너/학습코칭/마이의 root stack padding/gap/background, 주요 카드 radius/shadow/border, 상단 title tile 규격을 공통 token 기반으로 묶어 플래너 탭 기준의 밀도와 폭감을 공유하도록 했다.
- **CSS 체계 재정비 방향**: 기존 날짜별 override 누적을 당장 대규모 삭제하지 않고, `Foundation Tokens → App Shell Layer → Shared Components Layer → Screen Composition Layer → Temporary Overrides` 순서로 재정리하는 방향을 문서화했다. 후속 스모크가 안정되면 오래된 `.analysis-v2-head`, `.planner-screen`, `.my-stack` 중복 override를 단계적으로 제거한다.
- **CSS 비대화 1/2차 정리**: 모바일 CSS 두 파일의 selector 중복, 파일 간 중복, `!important` 누적, JS bundle CSS 주입 구조를 `docs/exec-plans/completed/260715_mobile_css_bloat_duplication_audit.md`에 정리했다. 1차로 `studycrack-mobile.css`를 bundle 로딩 전 fallback 전용 최소 CSS로 축소하고, 실제 앱 UI token/shell/component base는 `design-v2.css`로 이관했다. 정적 CSS는 약 175KB에서 약 1.5KB로 줄었고, 파일 간 selector 중복은 약 506개에서 약 10개로 줄었다. 2차로 `design-v2.css` 내부의 폐기된 analysis correction block과 공통 타이틀/루트 레이아웃 중복 override를 제거했다. `design-v2.css`는 약 256KB/2,284라인에서 약 244KB/2,206라인으로 줄었고, 내부 중복 hit는 약 1,208개에서 약 1,048개로 감소했다. 남은 핵심은 홈 카드/분석 게이지/시뮬레이션 표 같은 화면별 컴포넌트 override 통합이다.
- **CSS 재발 방지 장치**: `docs/design-docs/index.md`, `AGENTS.md`, `CLAUDE.md`에 CSS 중복/override 누적 금지와 모바일 앱 CSS source of truth 규칙을 명시했다. `tools/audit_css_duplicates.mjs`를 추가해 CSS 작업 전후 전체 중복 selector, duplicate hit, `!important`, cross-file selector를 확인할 수 있게 했다. 2026-07-15 전수조사 기준 고위험 파일은 `studycrack-mobile-app/src/styles/design-v2.css`, `css/analysis.css`, `css/style.css`다.
- **CSS 3차 정리 완료**: `design-v2.css`에서 사용처가 사라진 `analysis-v2-chart-area` legacy 막대 차트 계열과 `analysis-v2-sim-item` 잔재를 제거했다. 이어서 분석 시뮬레이션 표/카드, 홈 대학 카드/시험 기준 카드/타이머 계열 중복을 현재 최종 디자인 block 중심으로 정리했다. duplicate hits는 1,048 → 817, `!important`는 355회 → 317회, 파일 크기는 약 238KB → 약 219KB로 감소했다. 남은 핵심은 분석 게이지 계열 중복과 공통 surface class 추출이다.
- **모바일 CSS 분할 Phase 5A**: `design-v2.css`의 foundation/app shell/primitive/final layout override를 `foundation/tokens.css`, `foundation/base.css`, `foundation/shell.css`, `components/primitives.css`, `layout/mobile-layout-system.css`로 분리했다. `main.js` import 순서는 foundation → primitives → `design-v2.css` → final layout override로 고정해 cascade를 보존했다. `design-v2.css`는 1,959라인/약 209KB/duplicate hits 694에서 1,855라인/약 201KB/duplicate hits 625로 감소했고, 분리 CSS 포함 총 라인은 1,966라인이다. `!important`는 265회로 유지됐으며 다음 후보는 `screens/home.css`, `screens/analysis.css` 분리다.
- **모바일 CSS 분할 Phase 5B**: 홈 화면 최종 density override를 `screens/home.css`로 분리했다. `design-v2.css`는 1,855라인/duplicate hits 625에서 1,795라인/duplicate hits 565로 감소했고, 신규 `screens/home.css`는 자체 duplicate hits 0으로 유지했다. 분리 CSS 포함 총 라인은 1,964라인이며 다음 후보는 `screens/analysis.css`다.
- **모바일 CSS 분할 Phase 5C**: 분석 화면 최종 override와 `analysis-main-gauge-*` 계열을 `screens/analysis.css`로 분리했다. 홈/분석 혼합 360px media block도 각 화면 파일로 나눴다. `design-v2.css`는 1,795라인/duplicate hits 565에서 1,723라인/duplicate hits 495로 감소했고, 분리 CSS 포함 총 라인은 1,949라인이다.
- **모바일 CSS 분할 Phase 5D**: 플래너 화면 최종 캘린더/본문/빈 상태 override를 `screens/planner.css`로 분리했다. 공용 `calendar-form-*`은 원본에 남겼다. `design-v2.css`는 1,723라인/duplicate hits 495/`!important` 246회에서 1,579라인/duplicate hits 450/`!important` 162회로 감소했고, 분리 CSS 포함 총 라인은 1,945라인이다.
- **모바일 CSS 분할 Phase 5E**: 요금제/결제 화면의 `plan-console-*`, `payment-console-*`, `plan-benefit-*`, `plan-audience`, `payment-duration-*` 계열을 `screens/service.css`로 분리했다. 공용 background/transition/containment selector에 끼어 있는 서비스 selector는 cascade 안정성을 위해 원본에 남겼다. `design-v2.css`는 1,579라인/duplicate hits 450에서 1,476라인/duplicate hits 398로 감소했고, 신규 `screens/service.css`는 116라인이다.
- **모바일 CSS 분할 Phase 5F**: 마이/고객센터/정성조사서/성적정보 표시 화면의 `my-*`, `profile-*`, `qna-*`, `support-*`, `qual-*`, `account-*`, `score-info-*`, `mobile-social-*`, `my-mbti-*` 계열을 `screens/mypage.css`로 분리했다. 성적 입력 stepper/onepage 모달은 별도 대형 컴포넌트라 이번 단계에서 원본에 남겼다. `design-v2.css`는 1,476라인/duplicate hits 398에서 1,221라인/duplicate hits 289로 감소했고, 신규 `screens/mypage.css`는 248라인이다.
- **모바일 CSS 분할 Phase 5G**: 성적 입력 모달의 `score-onepage-*`, `score-stepper-*`, `score-wheel-*`, `score-grade-*` 계열을 `screens/score-input.css`로 분리했다. 공용 modal animation/width selector에 끼어 있는 `score-onepage-modal`은 cascade 안정성을 위해 원본에 남겼다. `design-v2.css`는 1,221라인/duplicate hits 289에서 1,143라인/duplicate hits 284로 감소했고, 신규 `screens/score-input.css`는 81라인이다.
- **모바일 CSS 분할 Phase 5H**: 로그인/회원가입/약관/이메일·비밀번호 찾기 화면의 `auth-*`, `signup-*`, `find-email-*`, auth 화면 전용 `terms-modal-*` 최종 override를 `screens/auth.css`로 분리했다. 공용 modal animation selector에 끼어 있는 `.terms-modal`/`.find-email-modal` 참조와 기본 terms modal 구조는 원본에 남겼다. `design-v2.css`는 1,143라인/duplicate hits 284에서 1,017라인/duplicate hits 240으로 감소했고, 신규 `screens/auth.css`는 121라인이다.
- **모바일 CSS 분할 Phase 5I**: 온보딩 3장, 초기 정성조사서/성적 입력, 온보딩 MBTI 결과 카드의 `onboarding-*`, `ob1-*`, `ob-mbti-*` 계열을 `screens/onboarding.css`로 분리했다. 마이페이지 정성조사서에서 재사용하는 `ob1-pill`은 import 순서상 `mypage.css`가 후속 override하도록 유지했다. `design-v2.css`는 1,017라인/duplicate hits 240에서 966라인/duplicate hits 235로 감소했고, 신규 `screens/onboarding.css`는 52라인이다.
- **모바일 CSS 분할 Phase 5J**: 플래너 계획 추가 화면의 `planner-add-*`, `planner-step-*`, `planner-choice-*`, `planner-time-input-*`, `planner-form-hint`, `planner-memo-input` 계열을 `screens/planner-add.css`로 분리했다. 플래너 본 화면 CTA인 `planner-add-cta`와 item/date carousel 계열은 기존 화면 책임이라 원본/`screens/planner.css`에 남겼다. `design-v2.css`는 966라인/duplicate hits 235에서 921라인/duplicate hits 234로 감소했고, 신규 `screens/planner-add.css`는 46라인이다.
- **모바일 CSS 분할 Phase 5K**: 온보딩/마이페이지 공용 학습 MBTI 설문·결과 모달의 `mbti-survey-*`, `mbti-result-*` 계열을 `components/mbti-survey.css`로 분리했다. 공용 modal shell은 원본에 남기고 MBTI panel 내부 스타일만 이동했다. `design-v2.css`는 921라인/duplicate hits 234에서 879라인/duplicate hits 234로 감소했고, 신규 `components/mbti-survey.css`는 40라인/duplicate hits 0이다.
- **모바일 CSS 분할 Phase 5L**: 홈 알림 FAB/팝오버, 알림 목록 상세 모달, 수험 일정 캘린더/일정 폼 계열을 `screens/home-overlays.css`로 분리했다. import 순서는 `design-v2.css` → `screens/home-overlays.css` → `screens/home.css`로 두어 홈 최종 density override를 보존했다. `design-v2.css`는 879라인/duplicate hits 234에서 740라인/duplicate hits 217로 감소했고, 신규 `screens/home-overlays.css`는 113라인/duplicate hits 1이다.
- **모바일 CSS 분할 Phase 5M**: 최초 로딩 splash와 잠긴 기능/학습코칭 잠금 overlay 계열의 `splash-*`, `locked-feature-*`, `locked-coach-*`, `lockedFeature` 화면 보정을 `screens/locked-splash.css`로 분리했다. 잠긴 기능 안내는 위치 보정 회귀가 잦았던 영역이라 override 순서를 유지한 채 이동했다. `design-v2.css`는 740라인/duplicate hits 217에서 685라인/duplicate hits 192로 감소했고, 신규 `screens/locked-splash.css`는 58라인이다.
- **모바일 CSS 분할 Phase 5N**: 홈 대학 슬라이더/대학 카드/타이머/목표/리포트/홈 로딩 스켈레톤 잔여 기본 스타일을 `screens/home-base.css`로 분리했다. import 순서는 `home-overlays.css` → `home-base.css` → `home.css`로 두어 홈 기본값 뒤에 최종 density override가 적용되도록 했다. `design-v2.css`는 685라인/duplicate hits 192에서 523라인/duplicate hits 146으로 감소했고, 신규 `screens/home-base.css`는 135라인/duplicate hits 10이다.
- **모바일 CSS 분할 Phase 5O**: 분석 비교/시뮬레이션/가능 대학/이미지 레퍼런스 분석 카드/로딩 stage 기본 스타일을 `screens/analysis-base.css`로 분리했다. import 순서는 `analysis-base.css` → `analysis.css`로 두어 분석 기본값 뒤에 최종 density/gauge override가 적용되도록 했다. `design-v2.css`는 523라인/duplicate hits 146에서 351라인/duplicate hits 77로 감소했고, 신규 `screens/analysis-base.css`는 161라인/duplicate hits 21이다.
- **모바일 CSS 분할 Phase 5P**: 플래너 item/date/donut/empty/premium CTA 기본 스타일을 `screens/planner.css`로 이동했다. 같은 파일 앞쪽에 기본값을 두고 뒤쪽 최종 density override가 이기도록 배치해 기존 cascade를 보존했다. `design-v2.css`는 351라인/`!important` 37회에서 320라인/`!important` 26회로 감소했고, `screens/planner.css`는 171라인이다.
- **모바일 CSS 분할 Phase 5Q**: 랭킹 tier, PRO 리포트/요청 모달, score journey, 홈 공부목표 일부, 공부랭킹 화면 스타일을 `components/insights.css`로 분리했다. import 순서는 `insights.css` → `design-v2.css` → 화면별 CSS로 두어 원래 파일 내부의 "기본값 뒤 bridge 보정" cascade를 보존했다. `design-v2.css`는 320라인/duplicate hits 77에서 191라인/duplicate hits 64로 감소했고, 신규 `components/insights.css`는 110라인/duplicate hits 8이다.
- **모바일 CSS 분할 Phase 5R**: 공통 motion layer, modal shell, theme/mobile bridge를 각각 `foundation/motion.css`, `components/modals.css`, `layout/mobile-bridge.css`로 분리했다. 서비스/결제 잔여는 `screens/service.css`, 분석 잔여 bridge는 `screens/analysis-base.css`로 이동했다. `design-v2.css`는 체크포인트 marker 1라인으로 축소했고 duplicate hits 0이 됐다.
- **모바일 CSS 내부 중복 Phase 5S**: `screens/service.css`의 요금제/결제 이전 디자인 override를 최종 cascade 기준으로 접어 136라인/duplicate hits 48에서 110라인/duplicate hits 13으로 낮췄다. `screens/analysis-base.css`는 로딩 패널, 차트 헤더, ETA 카드처럼 뒤에서 명확히 덮이던 규칙만 합쳐 218라인/duplicate hits 59에서 206라인/duplicate hits 43으로 낮췄다.
- **모바일 CSS 내부 중복 Phase 5T**: `screens/planner.css`의 앞쪽 기본 선언 중 뒤쪽 최종 플래너 레퍼런스 보정으로 완전히 덮이던 `planner-plan-list`, `planner-add-cta`, `planner-premium-*`, `planner-empty-day`, `planner-date-item` 계열을 제거했다. `planner.css`는 171라인/duplicate hits 43/`!important` 95회에서 157라인/duplicate hits 28/`!important` 88회로 감소했다.
- **모바일 CSS 내부 중복 Phase 5U**: `screens/mypage.css`를 `screens/mypage-support.css`, `screens/mypage-data.css`, `screens/mypage.css` final override로 나눴다. import 순서는 support/data/final 순서로 유지해 기존 cascade를 보존했다. 기존 `mypage.css` 247라인/duplicate hits 55에서 final 135라인/duplicate hits 20, support/data 파일 duplicate hits 0으로 낮췄다.
- **모바일 CSS 내부 중복 Phase 5V**: 로그인/회원가입/찾기 화면 CSS를 `auth-signup.css`, `auth-recovery.css`, `auth.css`로 나눴다. 회원가입/약관과 계정 찾기 파일은 duplicate hits 0으로 분리했고, 로그인 final 파일인 `auth.css`는 121라인/duplicate hits 37에서 48라인/duplicate hits 24로 감소했다.
- **모바일 CSS 내부 중복 Phase 5W**: 분석 탭의 신규 통합 카드/게이지/시뮬레이션 UI를 `screens/analysis-unified.css`로 분리했다. `analysis-base.css`는 206라인/duplicate hits 43에서 131라인/duplicate hits 36으로 줄었고, 신규 `analysis-unified.css`는 76라인/duplicate hits 6이다.
- **모바일 CSS 내부 중복 Phase 5X**: 플래너 주/월 캘린더 시트와 일정 편집 계열을 `screens/planner-calendar.css`로 분리했다. `planner-calendar.css`는 70라인/duplicate hits 0으로 분리됐고, `planner.css`는 157라인/duplicate hits 28에서 88라인/duplicate hits 15로 감소했다.
- **모바일 CSS 원본 대비 누락 감사**: HEAD의 기존 `design-v2.css` 최종 cascade와 현재 30개 import 기반 분할 CSS를 selector/property/value 단위로 비교했다. 실제 회귀 가능성이 있던 import 순서(`mobile-bridge` vs `motion`), 플래너 date/empty/CTA 기본 선언, 분석 chart head/badge, 마이 account/social/qualitative 일부 선언을 복원했다. 남은 diff는 대부분 `border`/`padding` shorthand false positive 또는 최근 의도한 분석 게이지 디자인 변경이다. 검증은 `npm run check`, `npm run build`, `git diff --check`, `tools/audit_css_duplicates.mjs` 통과.
- **CSS 분할 잔여 범위**: 단일 `design-v2.css` 비대화 정리는 완료 상태다. 남은 핵심은 `analysis-base.css`, `auth.css`, `analysis.css`, `mypage.css`, `locked-splash.css`, `home.css`처럼 final override 성격이 남은 파일의 내부 중복 축소와 360/390/430px 시각 스모크다. CSS asset 추출은 별도 배포/cache 검증이 필요한 후속 과제로 둔다.
- **모바일 레이아웃 회귀 보정**: 정적 `css/studycrack-mobile.css`를 fallback 전용으로 축소하는 과정에서 `.app-frame`의 `padding:24px`, `.app-screen`의 `display:grid/place-items:center`가 실제 앱 런타임까지 남아 홈/플래너 등 모든 탭이 좁아지는 회귀가 발생했다. `design-v2.css` 초반에 `#root/.app-shell/.app-frame/.app-screen` reset을 명시하고, fallback CSS에서는 앱 셸 클래스의 grid 정렬/패딩을 제거해 실제 앱 레이아웃 책임을 번들 CSS로 고정했다.
- **추가 보정 계획**: 분석 로딩 전용 화면, 학습코칭 잠금 안내 정중앙 배치, 마이페이지 상단 타일화는 구현/검증 완료 후 `docs/exec-plans/completed/260714_mobile_loading_locked_my_tile_polish.md`로 이관했다.
- **후속 계획**: 모바일 플래너의 실제 시간 범위 입력, 세부 과목/학습 유형 선택, 선택 시 깜빡임 제거, 일정 카드 디자인 개편은 구현 및 검증 완료 후 `docs/exec-plans/completed/260712_mobile_planner_time_detail_rework.md`로 이관했다.
- **플래너 시간 상세 1차 구현**: `plannerAdd`를 JSX 화면으로 승격하고 시작/종료 시간, 과목 대분류, 세부 과목, 학습 유형, 메모 입력을 추가했다. 선택 chip은 native radio + CSS로 처리해 선택 시 전체 화면 재생성 체감을 줄였고, 저장 후 플래너 카드는 `HH:MM - HH:MM` 시간 범위와 `과목 · 세부 · 유형`을 표시한다.
- **플래너 추가 단계형 전환**: 계획 추가 화면을 긴 세로 폼에서 `시간 → 과목 → 유형 → 내용` 4단계 플로우로 변경했다. 한 번에 한 항목 그룹만 보이고, 하단 `이전/다음/계획 저장하기` 영역에서 단계 전환과 저장을 처리한다.
- **알림 FAB/팝오버**: 홈 우하단 알림 버튼과 팝오버를 탭바에서 더 띄워 시각적/터치 여백을 확보했다.
- **알림 목록/상세**: 알림 목록 페이지네이션을 7개 단위로 변경했다. 상세 모달은 하단 시트형에서 중앙 카드형으로 바꾸고, 긴 본문은 모달 내부에서 스크롤되도록 조정했다.
- **홈 인사 말풍선**: 크랙이 말풍선 내부 인사 문구를 한 줄 유지 범위에서 소폭 확대했다.
- **플래너/학습코칭**: 플래너 탭 상단에 인트로 카드를 추가했다. 학습코칭 잠금 화면은 탭 화면처럼 보이도록 뒤로가기 appbar 대신 인라인 잠금 안내를 표시한다.
- **플래너 레퍼런스 보정**: 플래너 탭을 날짜 헤더, 주간 날짜 스트립, 계획 요약, 깊은 블루 멘토 CTA, 빈 상태/추가 CTA 흐름으로 재정리했다. 폰트 스케일은 홈/분석 탭 기준으로 낮춰 통일했고, 360px 이하 폭에서는 날짜와 CTA가 넘치지 않도록 별도 밀도 보정을 추가했다.
- **플래너 캘린더 시트**: 메인 날짜 스트립은 선택 날짜가 속한 1주일 7개만 표시하도록 바꿨다. 상단 인트로의 캘린더 중복 아이콘은 체크리스트/펜 CSS 아이콘으로 교체했고, 캘린더 버튼 클릭 시 하단 시트는 `주/월` 전환과 Apple Calendar식 주간 시간 그리드 레이아웃으로 열린다.
- **캘린더 시트 CSS 안정화**: 하단 캘린더 시트 내부 버튼이 기본 회색 버튼처럼 보이는 문제를 막기 위해 정적 `css/studycrack-mobile.css`에도 캘린더 전용 reset/grid 스타일을 추가했다.
- **캘린더 전환 안정화**: 캘린더 시트 전용 overlay/panel animation을 제거하고, 시트 높이를 고정해 `주/월` 전환 때 위치가 흔들리지 않게 했다. 내부 grid에는 좌우 padding과 frame을 추가해 edge-to-edge로 답답해 보이던 문제를 줄였다.
- **캘린더 이동/상세 계획**: 플래너 날짜 상태를 `YYYY-MM-DD`로 통일하고 레거시 일자 데이터는 호환 변환한다. 캘린더 화살표는 `주` 모드에서 ±7일, `월` 모드에서 ±1개월 이동하며 월 경계를 넘어간다. 시트 내부에는 선택일 상세 계획 패널을 추가해 항목 수정과 계획 추가 진입이 가능하도록 했다.
- **본문형 플래너 캘린더**: 사용자 피드백에 따라 `주/월` 캘린더를 하단 모달에서 제거하고 플래너 본문에 직접 노출했다. 날짜 헤더 아래에서 세그먼트, 이전/오늘/다음 이동, 주간 strip 또는 월간 grid가 바로 전환되며, 캘린더 버튼은 모달 open이 아니라 주/월 보기 전환으로 동작한다.
- **하단 여백/빈 상태 정리**: 학습코칭 잠금 안내를 중앙 overlay 카드로 조정했다. 플래너/학습코칭 최초 빈 상태는 전용 compact class로 밀도를 낮추고, 주요 탭의 중복 하단 padding과 플래너 `planner-bottom-space`를 정리해 최하단 빈 공간을 줄였다.
- **잠금/로딩 후속 보정**: 학습코칭 잠금 화면은 하단 탭바 위 가용 영역 기준으로 정중앙에 오도록 `lockedFeature` 화면 전용 중앙 정렬을 추가했다. 분석 `AI 분석` 로딩 중에는 예전 `.analysis-v2.loading .card` 최소 높이 규칙이 상단 타일을 비정상적으로 키우지 않도록 상단 카드 높이와 padding을 고정했다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-08 — 모바일 홈/분석 기준 디자인 통일 Phase A
- **계획 문서**: `docs/exec-plans/completed/260708_mobile_home_analysis_design_unification.md`
- **홈 게이지 구분**: 홈 대학 카드에 `home-result-gauge-panel`과 `home-result-kpi-panel`을 추가해 환산점수 게이지 영역과 하단 해석 KPI 영역을 시각적으로 분리했다. React 화면과 fallback 문자열 renderer를 함께 맞췄다.
- **홈 슬라이더 안정화**: `calc(-index * (100% + gap))` 형태의 CSS 곱셈 계산을 제거하고, JS에서 확정한 `calc(-N% - Npx + offset)` 값을 넘기도록 바꿨다. 홈 외 탭으로 이동할 때 남은 drag offset도 0으로 정리해 2/3지망 카드에서 탭 왕복 후 슬라이드가 멈추는 현상을 줄였다.
- **분석 게이지 단순화**: 분석탭 메인 게이지에서 선택 과목 `+1점 효과` preview segment/pill 렌더링을 제거했다. 게이지는 현재 점수, 합격 100, 안정 150 기준선 중심으로 남겼다.
- **분석 상단/마커 보정**: 분석탭 상단 hero 카드의 `min-height`/padding/icon 크기를 낮춰 다른 탭 대비 큰 상단 여백을 줄였다. 현재 위치 표식은 지도 핀형에서 작은 원형 dot으로 바꿔 게이지 위 시각 부담을 낮췄다.
- **분석 KPI 문구**: 기존 `선택 과목 효과`를 `+원점수 1점 최대 효과`로 변경하고, 선택 row가 아니라 과목별 +1점 시뮬레이션 중 최대 효과 값을 표시하도록 정리했다.
- **분석 간격 통일**: `analysis-unified`, `analysis-boost-card`, `analysis-sim-table` 간격을 낮춰 홈/마이/플래너 쪽 카드 밀도와 더 가깝게 맞췄다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-07 — 모바일 인증 첫 화면/회원가입 진입 보정
- **로그인 보조 모달**: 이메일 찾기와 비밀번호 재설정 모달을 하단 시트형 카드로 재설계하고, 아이콘/입력 그룹/CTA/결과 박스를 인증 화면 톤에 맞췄다.
- **로그인 첫 화면**: 첨부 레퍼런스처럼 연한 blue-gray 배경, 큰 translucent 카드, 상단 원형 로고 배지, 큰 입력창, blue gradient 로그인 버튼, Google/Naver 소셜 버튼, 하단 회원가입 CTA 구조로 재정리했다.
- **로그인 후속 보정**: 원형 로고를 레퍼런스처럼 카드 상단에 걸친 배지로 되돌리되 제목을 가리지 않도록 카드 상단 여백을 확보했다. 전체 글자/입력/버튼 크기와 그라데이션 강도도 줄여 다른 모바일 화면과 밀도를 맞췄다.
- **찾기 모달 재보정**: 이메일 찾기와 비밀번호 재설정 모달에 남아 있던 하단 시트 배치를 제거하고, 화면 중앙 정렬 모달로 고정했다.
- **회원가입 진입**: 회원가입 화면의 상단 appbar `회원가입`/뒤로가기와 내부 `회원가입` 제목을 제거했다. 소셜 계정으로 시작하기 섹션도 제거해 로고 다음 바로 약관 1단계가 시작된다.
- **약관/로고**: 약관 버튼 문구를 `전문보기`로 바꾸고 버튼 스타일과 약관 전문 모달을 정리했다. 회원가입 로고는 배경/필터/그라데이션이 붙지 않도록 평평한 이미지 표시로 고정하고, 약관 1단계 진입 시 과하게 커 보이지 않도록 축소했다.
- **검증**: `node --check studycrack-mobile-app/src/screens/auth/renderers.js`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-06 — active 문서 정리
- **정리 원칙**: 구현과 로컬 검증이 완료된 문서는 `completed/`로 이관하고, 실제 dev 세션 확인만 남은 모바일 항목은 `docs/exec-plans/active/260706_mobile_dev_smoke_backlog.md` 하나로 통합했다.
- **completed 이관**: 모바일 백엔드 결합, 전체 디자인 리워크, 분석/프로필 안정화, 네이티브 인증, 세션/마이/캘린더, 홈/로그인 안정화, 홈 카드/분석 재구축, 분석 게이지/시뮬레이션 표, 목표대학 삭제/시뮬레이션 재정비, 이미지 레퍼런스 분석탭 디자인 문서를 completed로 이동했다.
- **현재 active**: 리마인더 스케줄 진단, 튜터 인증 분리, 튜토리얼 전략 엔진, 환산점수 서브시스템 잔여 정리, KCC 프로모션 실검증, 모바일 dev 스모크 백로그만 남겼다.

---

## 2026-07-06 — 모바일 홈탭 이미지 레퍼런스 재디자인
- **계획 문서**: `docs/exec-plans/completed/260706_mobile_home_image_reference_redesign.md`
- **구조 변경**: 첨부 레퍼런스처럼 홈을 `크랙이 인사/수험 일정 → 지원학과 AI 점수 → 대학 카드 슬라이더 → 오늘 누적 공부 → 오늘 공부 목표/리포트 미리보기` 흐름으로 재구성했다.
- **대학 카드**: 대학별 AI 점수 카드를 큰 단일 카드로 바꾸고, 0~250 게이지, 합격/안정 marker, 현재 점수/부족 점수 KPI를 레퍼런스 톤으로 정리했다. 부족 점수는 `-N점`으로 표시한다.
- **학습 카드**: 오늘 누적 공부는 큰 타이머와 2열 CTA 중심으로, 오늘 공부 목표는 `N% 달성 / 상태 / 목표 시간 / progress / 과목 chip` 구조로 보강했다. 리포트 미리보기와 알림 FAB도 새 카드 톤에 맞췄다.
- **후속 크기 보정**: 레퍼런스 반영 후 실제 홈 화면에서 카드/타이포/타이머가 과하게 커 보여, 홈 전용 CSS scale을 낮추고 360px 이하 중복 보정 규칙까지 정렬했다.
- **검증**: `node --check studycrack-mobile-app/src/screens/home/renderers.js`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-06 — 모바일 분석탭 이미지 레퍼런스 기반 재디자인
- **계획 문서**: `docs/exec-plans/completed/260706_mobile_analysis_image_reference_redesign.md`
- **분석 카드 통합**: 별도 `분석 기준 시험` 박스를 제거하고, 시험 선택을 `희망대학 분석` 카드 상단으로 통합했다. 대학 선택/대학 추가는 같은 카드 안의 보조 control로 낮췄다.
- **게이지 재설계**: 0~250 스케일은 유지하면서 현재 위치 pin, 합격 100/안정 150 marker, 선택 과목 `+1점 효과` preview segment/label을 한 그래프 안에 배치했다. preview 산식은 기존처럼 서버 `afterUiScore` 우선이다.
- **시뮬레이션 카드**: 첨부 레퍼런스처럼 `점수 상승 시뮬레이션` pill, 최고 과목 chip, 큰 best row가 있는 `과목 / +1점 효과 / 판정` 표로 시각 위계를 강화했다.
- **후속 레퍼런스 보정**: 분석 카드 중간의 별도 현재점수/상태 행을 제거하고, 이미지처럼 `합격컷까지 / 선택 과목 효과` 2분할 지표 바로 아래에 게이지가 오도록 다시 맞췄다. 대학 선택은 헤더 내부 보조 컨트롤로 낮췄다.
- **재교정**: 레퍼런스에 없는 대학 선택 보조 컨트롤도 분석 카드에서 제거했다. 게이지는 현재점수 라벨, pin, 합격/안정 marker, `+1점 효과` 말풍선, cyan preview arrow가 한 그래프 안에 보이도록 최종 보정했다.
- **앱 밀도 정렬**: 홈/분석 탭만 다른 탭보다 확대되어 보이던 카드 높이, 제목, 점수, 타이머, CTA, 게이지, 시뮬레이션 row 크기를 다시 낮춰 마이/플래너/요금제 탭의 18px 카드 반경과 14~18px대 타이포 밀도에 맞췄다.
- **게이지 정합 보정**: 분석 게이지 scale에 `50` 라벨을 추가하고, 배경 track/현재 fill을 분리했다. 현재 위치는 지도핀 형태, 합격/안정 marker는 dotted guide, `+1점 효과` preview는 cyan chevron으로 재구성했다.
- **검증**: `node --check studycrack-mobile-app/src/screens/analysis/renderers.js`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.
- **확인 참고**: 로컬 390px 진입은 확인했으나 브라우저가 비로그인 온보딩 상태라 실계정 분석 카드 육안 확인은 남아 있다.

---

## 2026-07-06 — 모바일 알림 상세/분석 +1점 시뮬레이션 보정
- **알림 FAB**: 홈 우하단 알림 패널을 여는 순간 전체 알림이 읽음 처리되던 effect를 제거했다. 알림 항목 클릭 시에만 해당 알림을 읽음 처리한다.
- **알림 상세**: 알림 팝오버 항목 클릭 시 `마이 > 알림` 화면으로 이동한 뒤 해당 알림의 상세 모달을 자동으로 띄운다. 목록 화면에서도 각 알림은 상세 모달로 열리며 본문 전체를 표시한다.
- **분석 시뮬레이션 산식**: `현재 UI 점수 + uiDiff` 추정 표시를 제거하고, `simulate_score_rise`가 내려주는 정확한 `afterUiScore`를 기준으로 +1점 후 위치를 표시하도록 했다.
- **백엔드 시뮬레이션 응답**: `StudyCrack_Analysis`의 과목별 `sim_data`에 `afterUiScore`, `rawNeeded`, `firstPositiveUiDiff`를 추가했다. `rawNeeded`는 대학 내부 환산 상승이 아니라 화면상 UI 점수가 실제로 움직이는 지점을 기준으로 한다.
- **게이지 UI**: +1점 후 위치를 점으로 찍지 않고, 현재 점수바 뒤에 늘어난 구간을 패턴 fill로 이어 붙여 보이게 했다.
- **홈 최초 환산점수 보강**: 홈/분석 렌더 시 `scoreCache`가 비어 있어도 같은 시험의 `analysisResults` 또는 `lastAnalysisSnapshot`을 즉시 merge한 렌더 캐시를 사용하도록 했다. 초기 API binding 지연 시 2.5초 만에 error로 굳던 재시도도 최대 약 40회 backoff로 늘려, 사용자가 모의고사 선택을 건드려야 재계산되는 상황을 줄였다.
- **추가 보정**: JSX 홈/분석의 기준 시험 select를 `defaultValue`에서 controlled `value`로 전환해 로그인 데이터 병합 후 실제 계산 기준과 UI 선택값이 갈라지지 않도록 했다. 사용자 데이터 bootstrap도 `CONFIG/apiFetch` 준비 전에는 즉시 error로 굳지 않고 재시도한다.
- **검증**: 관련 JS/Lambda `node --check`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.
- **배포 참고**: 정확한 `afterUiScore` 반영에는 **StudyCrack_Analysis Lambda 재배포가 필요하다.**

---

## 2026-07-05 — KCC 프로모션 관리자 식별/책임자 표기 정정
- **관리자 태그**: `promotion/kcc01`을 통해 Standard 혜택을 받은 학생은 관리자 학생 목록의 상태/등급 칸과 학생 상세 등급 영역에 `KCC 혜택` 태그를 표시하도록 했다. CSV 등급 표기에도 `STANDARD (KCC)`처럼 구분값을 포함한다.
- **관리자 검색 응답**: `StudyCrack_AdminCore`의 `admin_search`/`admin_search_list` ProjectionExpression에 `promotionClaimKcc01`, `promotionClaims`를 포함했다.
- **표기 정정**: 대표자/책임자 표기 `임태륭`을 `임태룽`으로 일괄 정정했다.
- **배포 참고**: 관리자 목록/CSV에서 KCC 태그가 실제 데이터로 안정 표시되려면 **StudyCrack_AdminCore Lambda 재배포가 필요하다.**

---

## 2026-07-04 — 모바일 분석 게이지/시뮬레이션 표 재정비
- **계획 문서**: `docs/exec-plans/completed/260704_mobile_analysis_gauge_sim_table_polish.md`
- **시뮬레이션 표**: 과목별 상승 효과를 mini graph가 아니라 `과목 / +1점 효과 / 판정` 3열 표로 재구성했다. 최고 반영 과목은 기본 선택, 상단 정렬, 큰 효과 숫자와 `최고 반영` 배지로 강조한다.
- **메인 게이지 연결**: 표 row를 누르면 선택 과목의 `uiDiff`가 상단 환산점수 게이지 preview segment로 반영된다. `uiDiff <= 0`은 preview segment 없이 `변동 대기`로 안내한다.
- **게이지 디자인**: 기존 세로선/분리 라벨 구조를 제거하고, 현재 fill + 선택 효과 preview + 내부 marker + 하단 scale로 재구성했다. fill에는 sheen motion, preview에는 blue/cyan gradient를 적용했다.
- **문구 원칙**: `예상 총점 N점`, `0점에서 N점`처럼 보이는 표현은 피하고 `+1점 효과 +N`, `변동 대기`, `원점수 +N점부터 변화` 중심으로 정리했다.
- **검증**: 관련 JS `node --check`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-04 — 모바일 목표대학 삭제/시뮬레이션 재정비
- **계획 문서**: `docs/exec-plans/completed/260704_mobile_target_delete_simulation_rework.md`
- **삭제 UX**: 홈 대학 카드 `X` 클릭 시 즉시 삭제하지 않고 확인 모달을 띄운다. 삭제 confirm 후 서버 저장이 성공한 경우에만 홈/분석 목록에 반영하고, 실패 시 모달 안에 에러를 표시하며 화면 목록은 유지한다.
- **저장 계약**: 모바일 `targetUnivs` 저장 payload를 웹과 같은 6칸 슬롯 배열(`{ univ, major, date } | null`)로 정렬했다. 서버에서 받은 슬롯은 `targetUnivSlots`로 보존하고, 추가/삭제 모두 슬롯 index를 유지한다.
- **UserCore 보강**: `update_target_univs`에서 입력 배열을 6칸으로 normalize하고, `headers` 오타를 `responseHeaders`로 수정했으며, 실패 로그를 추가했다.
- **시뮬레이션**: 분석 탭에서 `currentScore + gainNum` 방식 표시를 제거했다. `base_ui_score`, `uiDiff`, `needs_backtrace`, `backtrace_plan`, `원점수 +N점 필요` 정보를 반영해 과목별 영향도 리스트와 Standard Exclusive 역산 카드로 재구성했다.
- **검증**: 관련 JS/Lambda `node --check`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.
- **배포 참고**: 실제 삭제 저장 안정화 반영에는 **StudyCrack_UserCore Lambda 재배포가 필요하다.**

---

## 2026-07-04 — 모바일 랭킹/분석 게이지/Basic 시뮬레이션 보정
- **대상**: `studycrack-mobile-app/src/screens/profile/renderers.js`, `studycrack-mobile-app/src/screens/analysis/renderers.js`, `studycrack-mobile-app/src/screens/home/*`, `studycrack-mobile-app/src/styles/design-v2.css`, `studycrack-mobile-app/src/runtime/main.js`, `backend-backup/StudyCrack_Analysis/index.mjs`.
- **랭킹**: 공부 랭킹 화면에 히어로와 중앙 정렬된 내 순위 카드를 추가하고, 포디움/목록/탭 스타일을 모바일 카드 톤으로 정리했다.
- **분석/홈**: 분석 게이지의 합격/안정 라벨 위치를 막대 아래로 내려 상단 설명 박스와 겹치지 않게 했다. 분석 요약의 `안정권까지` 칸과 홈 대학 카드의 `합격 컷` KPI 박스를 제거했다.
- **시뮬레이션**: Basic/Starter는 기간제 28일 구독처럼 만료 처리하지 않고 점수 상승 시뮬레이션을 사용할 수 있도록 프론트 권한 가드와 `StudyCrack_Analysis.checkHasSimAccess`를 맞췄다. 역산 카드 문구는 `Standard Exclusive`, `안정권까지 도달하려면 최소 몇점?`으로 변경했다.
- **검증**: 관련 JS/Lambda `node --check`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.
- **배포 참고**: Basic/Starter 시뮬레이션 권한 보정은 실제 반영에 **StudyCrack_Analysis Lambda 재배포가 필요하다.**

---

## 2026-07-04 — 모바일 홈 최초 환산점수 캐시 키 정렬
- **대상**: `studycrack-mobile-app/src/runtime/main.js`.
- **원인**: 최초 로그인 직후 홈 점수 fetch/cache 저장은 `resolveAnalysisExamMode(state)` 기준으로 동작하는데, 홈 카드 렌더는 여전히 `examKeyOf(state)` 기준으로 캐시를 읽고 있었다. 로그인 직후 표시용 시험키와 실제 입력 성적이 있는 시험키가 잠깐 어긋나면, 계산 결과가 있어도 홈 카드가 다른 캐시 슬롯을 읽어 0/미계산처럼 보일 수 있었다.
- **변경**: 홈 `homeTargets`도 분석/fetch와 동일하게 `resolveAnalysisExamMode(state)`로 캐시를 읽도록 정렬하고, 더 이상 쓰지 않는 `examKeyOf` import를 제거했다.
- **검증**: `node --check studycrack-mobile-app/src/runtime/main.js`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-03 — 모바일 마이 탭 상단/알림/학습 유형 정리
- **대상**: `studycrack-mobile-app/src/screens/mypage/renderers.js`, `studycrack-mobile-app/src/styles/design-v2.css`, `studycrack-mobile-app/src/handlers/service-handlers.js`, `studycrack-mobile-app/src/runtime/app-state.js`.
- **변경**: 마이 탭 최상단의 단독 appbar 제목을 제거하고 화면 내부 히어로 헤더로 대체했다. 학습 유형 카드는 기존 문구 흐름을 유지하면서 키커, 코드 배지, 태그, CTA 스타일을 정돈했다.
- **알림**: 알림 목록 페이지네이션을 8개에서 5개로 줄이고, 페이지 이동/본문 펼침에서 전역 스크롤 복원 로직을 제거해 알림 설정/알림 목록 화면의 스크롤 체감이 섞이지 않도록 했다.
- **검증**: `node --check`(`mypage/renderers.js`, `service-handlers.js`, `app-state.js`), `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-03 — 모바일 분석탭 선택 대학 반영 보정
- **대상**: `studycrack-mobile-app/src/runtime/main.js`.
- **원인**: 분석 카드 view-model이 `analysisTargetList`를 무시하고 `homeTargetList`만 기준으로 `analysisMajorOptions`/`normalizedTargetMajor`/`analysisScoreView`를 만들고 있었다. 그래서 분석탭 select에서 다른 대학을 골라도 홈 리스트 첫 대학으로 다시 보정되어 카드와 대학명이 반응하지 않는 것처럼 보였다.
- **변경**: 분석탭 파생 대상 목록을 `analysisTargetList + homeTargetList` union으로 바꾸고, 점수 캐시 조회 키도 fetch와 같은 `resolveAnalysisExamMode(state)`를 사용하도록 정렬했다.
- **검증**: `node --check studycrack-mobile-app/src/runtime/main.js`, `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-03 — 모바일 시뮬레이션 403 재발 방지
- **대상**: `studycrack-mobile-app/src/runtime/main.js`, `studycrack-mobile-app/src/runtime/session.js`.
- **원인**: `simulate_score_rise`는 백엔드에서 `currentSubscription/pendingSubscription`의 active 기간과 trial 잔여 조건까지 확인한다. 반면 모바일은 `userTier/selectedPlan` 표시값만 보고 Basic 이상이면 호출해, 로컬 저장 플랜값 또는 표시용 tier와 실제 서버 권한이 어긋날 때 403이 계속 발생했다.
- **변경**: 점수 시뮬레이션 API 호출 조건만 백엔드와 같은 active 구독/기간/트라이얼 조건으로 강화했다. `get_user_analysis`의 `univChangeRemaining`도 모바일 user state에 병합해 trial 판정 재료를 맞췄다.
- **검증**: `node --check`(`main.js`, `session.js`), `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-03 — 모바일 홈 AI 점수 403/초기 0점 원인 분리
- **대상**: `studycrack-mobile-app/src/runtime/persistence.js`, `studycrack-mobile-app/src/runtime/main.js`, `studycrack-mobile-app/src/runtime/session.js`.
- **API 분리**: 홈/분석 최초 점수 fetch는 `analyze_my_targets`만 호출하도록 바꾸고, `simulate_score_rise`는 `fetchMobileScoreSimulation`으로 분리했다. Free 계정은 시뮬레이션 API를 호출하지 않아 403 재시도 로그가 홈 진입에 섞이지 않는다.
- **시뮬레이션 조건부 로드**: Basic 이상에서 기본 분석이 `ready`가 된 뒤에만 시뮬레이션을 별도 호출한다. 시험/대학 변경 시 이전 시뮬레이션 응답 토큰을 무효화해 늦은 응답이 현재 캐시를 덮지 못하게 했다.
- **초기 시험키 보정**: 사용자 정량 데이터 선택 우선순위를 `jun/may/mar/.../active`로 바꿔, 드롭다운에 없는 `active`가 최초 payload에 잡혀 화면의 기본 시험과 분석 기준이 어긋나는 상황을 줄였다.
- **검증**: `node --check`(`persistence.js`, `main.js`, `session.js`), `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-03 — 모바일 진입점 `studycrack-mobile.html` 통일
- **대상**: `studycrack-mobile.html`, `studycrack-mobile-preview.html`, `studycrack-mobile-app/src/runtime/main.js`, `studycrack-mobile-app/src/runtime/persistence.js`, 모바일 active 문서.
- **진입점 통일**: 실제 모바일 앱 런타임은 `studycrack-mobile.html` 한 곳으로 본다. 별도 preview HTML은 더 이상 필요하지 않아 삭제했고, 앞으로 dev/prod 테스트 링크도 `studycrack-mobile.html` 기준으로 고정한다.
- **문서/주석 정리**: active 문서의 dev 테스트 경로를 `studycrack-mobile.html` 기준으로 바꾸고, 코드 주석의 `프리뷰/런타임` 표현을 `HTML 셸`/`로컬 점검` 표현으로 정리했다.
- **검증**: `npm run check`, `npm run build`, `node --check`(`studycrack-mobile-app/src/runtime/main.js`, `persistence.js`), `git diff --check` 통과. Vite 500kB chunk 경고는 기존 대형 번들 경고다.

---

## 2026-07-03 — KCC 프로모션 모바일 타이포/헤더 링크 보정
- **대상**: `promotion_kcc01.html` 스타일(`css/promotion-kcc01.css`)과 홈 헤더 이벤트 링크(`index.html`, `css/style.css`).
- **모바일 최적화**: 900px/520px 이하에서 KCC 페이지 히어로 제목, 안내 문구, 매치보드, 팀 선택 카드, 혜택 섹션, 신청/약관 모달의 폰트·패딩·카드 높이를 낮춰 모바일 화면 밀도를 정리했다.
- **헤더 링크**: 데스크톱/모바일 모두 `StudyCrack X KCC` 문구를 유지한다. 모바일 메뉴에서는 다른 링크와 같은 행 정렬을 쓰고, 노란 왼쪽 강조선과 옅은 배경만 적용해 과한 배지 느낌을 제거했다.
- **검증**: `git diff --check` 통과.

---

## 2026-07-03 — 6월 실성적 전환 문구 제거 + 보안 점검
- **대상**: `survey.html`, `tutorial.html`, `js/survey.js`, `js/analysis.js`, `js/auth.js`, `js/shared/api.js`, `js/mypage.js`, `js/change-password.js`, `studycrack-mobile-app/src/runtime/auth-service.js`.
- **6월 성적 문구**: 6월 모의평가가 실성적 데이터로 반영된 상태에 맞춰 `예상 등급컷 기반 추정치` 안내를 survey 성적 입력, tutorial 성적 입력, analysis 합격 예측 리포트, analysis 사이드바 정량 상세에서 제거했다.
- **보안 점검**: 공개 번들 기준 비밀키/토큰/개인키 패턴, 내부 인프라·인증 흐름 과다 설명 주석을 스캔했다. 실제 secret 패턴은 발견되지 않았고, 인증 세부 흐름을 설명하던 프론트 주석은 방어 목적 중심의 일반 주석으로 정리했다.
- **검증**: 관련 JS `node --check`, `git diff --check`, 6월 추정치 문구 잔여 검색, secret 패턴 검색 통과.

---

## 2026-07-03 — 데이터 오류 신고 동선 추가
- **대상**: `survey.html`, `analysis.html`, `qna.html`, `js/qna.js`, `css/style.css`, `css/qna.css`.
- **신고 진입**: 기초조사서/성적 입력 화면과 나만의 솔루션 화면 좌하단에 작지만 눈에 띄는 `데이터 오류 신고` 고정 버튼을 추가했다.
- **QnA 연동**: 버튼 클릭 시 `/qna?category=data_error&title=데이터 오류 신고&source=...`로 이동하고, QnA 작성 모달을 자동으로 열어 `데이터 오류 신고` 유형과 제목을 미리 선택한다.
- **분류 추가**: QnA 유형에 `데이터 오류 신고`를 신설하고, 질문 목록/상세 배지에서도 같은 카테고리명이 표시되도록 매핑과 배지 색상을 추가했다.

---

## 2026-07-02 — KCC 연고전 프로모션 페이지 1차 구현
- **계획 문서**: `docs/exec-plans/completed/260701_kcc_promotion_page.md`
- **페이지**: 사용자 URL은 `/promotion/kcc01`, 정적 파일명은 루트 `promotion_kcc01.html`로 둔다. 기존 웹 헤더를 유지하고, 연세대 팀/고려대 팀 선택 카드, 프로젝트 흐름, STANDARD 1개월 혜택 안내, 신청 CTA를 구성했다.
- **동의 UX**: 신청 모달에 필수 `연고전 프로젝트 참여 및 콘텐츠 활용 동의`와 선택 `마케팅 수신 정보 동의`를 추가했다. 두 항목 모두 상세보기 모달을 제공하며, 마케팅 문구는 기존 소셜 가입 약관 문구를 재사용했다.
- **로그인 복귀**: 비로그인 상태에서 신청하면 `/login?returnUrl=/promotion/kcc01?claim=1&team=...`로 이동하고, 로그인 완료 후 같은 팀 선택 상태로 돌아와 동의 모달을 자동 표시한다.
- **백엔드**: `StudyCrack_UserCore`에 `claim_kcc_promotion` 타입을 추가했다. 필수 동의/팀 allowlist를 서버에서 재검증하고, `promotionClaimKcc01` 조건부 업데이트로 중복 지급을 차단한다. Standard 28일은 현재 상태에 따라 즉시 지급, Standard 연장, 또는 Pro 활성 시 pending 예약으로 반영한다.
- **완료 화면**: `success.html`에 `status=promo&source=kcc01` 전용 완료 문구와 CTA를 추가했다.
- **배포 캐시**: 중첩 HTML도 asset version bump 대상이 되도록 `tools/bump_asset_version.sh`를 수정했다.
- **라우팅 보정**: dev에서 `/promotion/kcc01`이 AccessDenied로 떨어지는 것을 반영해 파일은 루트 `promotion_kcc01.html`로 두고, 배포 워크플로우가 같은 HTML을 S3 key `/promotion/kcc01`로도 복사하도록 했다.
- **공개 진입 보정**: `/promotion/kcc01`과 `/promotion_kcc01.html` 직접 접근을 공개 경로로 허용했다. 랜딩 진입 시에는 로그인으로 보내지 않고, `튜터링 신청하기` 클릭 시에만 로그인 안내 후 `/login?returnUrl=...`로 이동한다.
- **디자인 보강**: KCC 페이지 폰트를 웹 `service/payment` 계열과 맞춰 `Paperlogy`로 정렬하고, 히어로 매치보드·연세대/고려대 팀 선택 카드·신청 모달 팀 선택 UI를 더 단정한 프로젝트 카드 스타일로 재구성했다.
- **홈 노출 보강**: 홈 상단바 `나만의 솔루션` 앞에 `StudyCrack X KCC` 강조 링크를 추가하고, 홈 첫 진입용 포스터형 이벤트 배너 모달을 추가했다. 배너는 CTA/닫기/`3일간 보지 않기`를 제공한다.
- **남음**: 실제 반영에는 **StudyCrack_UserCore Lambda 재배포가 필요하다.** dev 배포 후 `/promotion/kcc01` 진입, 비로그인 신청 → 로그인 복귀 → 동의 → 지급 성공 → 재진입 중복 차단을 확인한다.

---

## 2026-07-01 — 모바일 로그인 후 탭 동기화 + 최초 환산점수 fetch 안정화
- **대상**: 모바일 로그인 직후 홈 진입, 홈 대학별 환산점수 최초 로딩.
- **탭 동기화**: 세션이 있는 상태로 `?screen=authLogin` 또는 `?screen=authSignup`에 진입하면 `screen:'home'`뿐 아니라 `tab:'home'`도 함께 강제한다. 이전 localStorage `activeTab='my'`가 남아 홈 화면인데 하단 네비만 마이로 표시되던 문제를 차단했다.
- **최초 점수 로딩**: 세션 사용자 데이터가 `ready` 되기 전에는 분석/점수 상태를 `empty`로 확정하지 않고 로딩 상태로 둔다. 성적과 목표대학이 준비된 뒤에만 `analyze_my_targets` 요청을 시작한다.
- **API 준비 지연 대응**: 첫 렌더 시점에 `window.apiFetch` 또는 analysis API URL이 아직 준비되지 않으면 250ms 간격으로 짧게 재시도한다. payload가 null로 돌아온 경우도 idle로 풀고 재시도 tick을 올려 최초 3월 점수 요청이 유실되지 않게 했다.
- **응답 가드**: 요청 시그니처 ref를 동기 갱신해 시험 전환/빠른 재렌더 중 오래된 응답이 현재 홈/분석 캐시를 덮지 않도록 했다.
- **검증**: `npm run check`, `npm run build`, `node --check`(`runtime/main.js`, `runtime/app-state.js`), `git diff --check` 통과. Vite 대형 chunk 경고는 기존 경고다.

---

## 2026-07-01 — 모바일 public repo 보안 노출 1차 점검/정리
- **대상**: `studycrack-mobile-app/`, 모바일 HTML, 레거시 `js/studycrack-mobile.js`, 모바일이 로드하는 공용 `js/config.js`/`js/shared/api.js`, 소셜 콜백/인증 주변 파일.
- **직접 endpoint 제거**: `js/config.js`에서 직접 API Gateway `execute-api` URL을 제거하고, local/dev/prod 모두 custom API 도메인 또는 `window.STUDYCRACK_API_BASE_URL` override를 사용하도록 변경했다.
- **디버그 전역 제거**: 레거시 모바일 단일 파일의 `window.__signupDebug`, `window.__signupDraft`, 렌더/초기화 `console.log`를 제거했다. 가입 draft는 전역 대신 `useRef` 내부 상태로 보관한다.
- **임시 진단 제거**: 모바일 Vite 런타임에 남아 있던 `window.__scDiag` API 진단 래퍼를 제거했다.
- **주석 정리**: public 코드에 남아 있던 Lambda/API Gateway/Authorizer/DynamoDB/내부 문서 경로/Phase 명칭/세션 세부 구현 주석을 사용자 보호 의도 중심의 짧은 주석으로 축약했다.
- **검증**: 민감 키워드 재스캔(`execute-api`, `Lambda`, `Authorizer`, `DynamoDB`, `docs/security`, `window.__signupDebug`, `window.__signupDraft`, `window.__scDiag`, AWS key/private key 패턴 등) 0건. `npm run check`, `npm run build`, 주요 순수 JS `node --check`, `git diff --check` 통과. 레거시 `js/studycrack-mobile.js`는 JSX 파일이라 `node --check` 직접 검사는 불가하다.
- **후속(레거시 삭제)**: 실제 HTML이 Vite 번들만 로드함을 확인하고, tracked 레거시 `js/studycrack-mobile.js`를 삭제했다. 재추가 방지를 위해 `.gitignore`에 같은 경로를 추가했다.
- **repo secret scan**: gitleaks/trufflehog/detect-secrets는 로컬 미설치라, tracked 파일 기준 `git grep` 패턴 스캔으로 대체했다. AWS access key/private key/client secret/signKey/webhook secret/direct execute-api/debug 전역 패턴 0건, 배포 프론트/문서의 내부 주석 키워드 0건.
- **문서 규칙 강화**: `README.md`와 `docs/security/frontend.md`에 “JS/HTML/CSS 주석도 공개 표면” 원칙과 금지 주석 목록(인프라 토폴로지, 서버 함수명, 인증 내부 흐름, DB 종류/테이블명, 결제 검증 세부, 내부 문서 경로 등)을 명시했다.

---

## 2026-07-01 — 모바일 분석 탭 전략/시뮬레이션 통합 UI
- **대상**: 모바일 분석 탭의 희망대학 분석, 전략 요약, 점수 상승 시뮬레이션, 역산 안내.
- **구조 변경**: 기존 `요약/시뮬레이션` 탭 분리를 제거하고, 대학 선택 → AI 환산점수 → 합격/안정 기준 게이지 → 과목별 +1점 효과 → Standard 역산 카드가 한 흐름으로 읽히는 통합 분석 화면으로 재구성했다.
- **삭제**: 사용자 혼란이 컸던 `합격 가능성 변화`, `성적 변화 시 가능한 대학` 섹션과 관련 분석 탭 문자열 renderer를 제거했다.
- **시뮬레이션 UX**: Basic 이상은 같은 화면에서 과목별 +1점 칩을 누르면 선택 과목의 상승분이 게이지에 즉시 반영된다. 선택 상태는 순간 하이라이트가 아니라 유지되도록 바꿔 대학별 판단 흐름이 끊기지 않게 했다.
- **역산 UX**: `최소 노력 대비 합격 도달 성적`은 별도 요약 영역이 아니라 시뮬레이션 하단의 Standard 전용 카드로 이동했다. Basic/Free는 화면 이탈 없이 잠금 안내와 업그레이드 CTA를 본다.
- **검증**: `npm run check`, `npm run build`, `node --check`(`screens/analysis/renderers.js`, `handlers/analysis-handlers.js`), `git diff --check` 통과. `.jsx` 직접 `node --check`는 Node가 확장자를 인식하지 못해 Vite build로 검증했다. Vite 대형 chunk 경고는 기존 경고다.

---

## 2026-06-30 — 모바일 마이 탭 성적 입력 휠 피커 보강
- **대상**: 마이 탭 > 성적 정보 > 전체 성적 입력/수정 모달.
- **변경**: 국어/수학 원점수 입력을 숫자 input에서 모바일 휠 피커로 교체했다. 국어는 공통 0~76 / 선택 0~24, 수학은 공통 0~74 / 선택 0~26을 각각 독립 휠로 고른다.
- **탐구**: 탐구 1·2도 과목 선택 + 원점수 휠(0~50) 구조로 바꿔, 기존 작은 숫자 입력칸 대신 아래에서 위로 스와이프하며 점수를 고르는 흐름으로 정리했다.
- **불가능 점수 제외**: 문항 배점상 불가능한 `1점`과 `만점-1점`은 선택지에서 제외했다. 저장 직전 검증도 같은 유효 점수 목록을 사용해 조작된 hidden 값이 들어와도 저장되지 않는다.
- **동작 방식**: 휠은 scroll-snap 기반이며 선택 값은 기존 `data-field` hidden input에 동기화된다. 따라서 기존 `saveScoreSubject`/`persistQuantitative`/분석 fetch 파이프라인은 유지된다.
- **검증**: `npm run check`, `npm run build`, `node --check`(`runtime/main.js`, `handlers/profile-handlers.js`, `screens/profile/renderers.js`), `git diff --check` 통과. Vite의 500kB 초과 경고는 기존 대형 번들 경고다.

---

## 2026-06-27 — 모바일 홈/로그인 UI·환산점수 안정화 완료
- **계획 문서**: `docs/exec-plans/completed/260627_mobile_home_auth_polish.md`
- **로그인 헤더(#1)**: `StudyCrack` + 카피 + 서브를 중앙 정렬 위계로 정리(`design-v2.css` `.auth-unified-card h1`/`.auth-title`).
- **로그인 직후 로딩(#2)**: orbit 스피너 → 홈 레이아웃 스켈레톤(`HomeLoadingPanel`)으로 교체해 체감 로딩·CLS 감소.
- **인사말 동적 폰트(#3)**: `HomeGreeting`이 박스 폭 기준 overflow를 측정해 폰트를 12px까지 축소(이름이 길어도 한 줄 고정). `.home-greeting-fit` nowrap.
- **캘린더 메모 여백(#4)·헤더/X(#5)·추가 버튼 폭(#6)**: 해당 스타일이 `@media(max-width:360px)`에만 갇혀 일반 폰(>360px)에서 누락되던 문제를 base 규칙으로 끌어올림. 메모 상단 패딩 12px, 시트 헤더 flex+X 우상단 고정, "+ 내 일정 추가" pill 폭 축소(행의 1/3). 헤더 카피 "ADMISSION CALENDAR/다가오는 일정" → "입시 캘린더/수험 일정".
- **환산점수 안정화(#7)**: 모의고사 전환 시 0점 플리커 제거. `buildScoreSelectionPatch`가 매핑 시험은 분석 결과를 비우지 않고 `loading`으로 두는 stale-while-revalidate, 빈 시험은 명시적 `empty`. `computeHomeTargets`가 점수 출처를 `confirmed/live/pending/empty`로 구분해 미확정 시 0점 대신 스켈레톤·안내·`갱신 중…`을 표시. JSX `UniversityCard`와 문자열 fallback renderer 동시 반영.
- **검증**: `npm run check`(68파일)·Vite build 통과. 로컬 프리뷰(375px)에서 로그인 헤더 중앙 정렬 확인, 캘린더 헤더/메모/추가버튼·스켈레톤 CSS 적용 측정 확인, `buildHomeDerived` 점수 상태 4시나리오(idle/ready/loading-stale/empty) 단위 확인(어떤 전이에서도 "0점" 확정 표시 없음).
- **참고**: 런타임은 이미 `studycrack-mobile.html` → `studycrack-mobile-app/dist` 번들이라 모듈 소스(`src/`)가 실제 런타임이다(CLAUDE.md의 "런타임 단일 파일" 서술은 갱신 필요). 배포는 `.github/workflows/deploy.yml`이 CI에서 `npm run build` 수행.

---

## 2026-06-26 — 모바일 캘린더·슬라이더·플래너 후속 안정화 완료
- **계획 문서**: `docs/exec-plans/completed/260626_mobile_calendar_slider_planner_followup.md`
- **홈 캘린더**: 문자열 HTML 삽입 시트에서 React 컴포넌트로 이관해 월 이동/날짜 선택 때 전체 시트가 다시 mount되며 깜빡이는 문제를 줄였다. 내 일정 추가 모달은 헤더·기간 입력·분류·메모·sticky action 구조로 정리하고 캘린더 시트보다 높은 layer를 유지한다.
- **홈 대학 슬라이더**: x/y 이동량을 비교해 수평 제스처만 대학 카드 슬라이더가 처리하도록 조정하고, `touch-action: pan-y`/x축 overscroll containment를 추가했다. `?screen=home` 직접 진입 시 하단 탭이 이전 localStorage 값을 따라가던 문제도 함께 수정했다.
- **플래너 캘린더**: `plannerCalendarMode` 상태를 추가해 일/주/월 세그먼트 전환을 구현했다. 주간은 날짜별 계획 개수·시간, 월간은 계획 count badge, 일간은 선택일 계획 목록을 표시한다.
- **검증**: `npm run check`, Vite build, 관련 `node --check` 통과. 로컬 브라우저 390px/320px에서 홈 캘린더 조작·일정 모달 layer·대학 swipe·플래너 일/주/월 전환 확인, overflow 0, 콘솔 error/warn 0건.

---

## 2026-06-26 — 모바일 폭·플래너·요금제 안정화 완료
- **계획 문서**: `docs/exec-plans/completed/260626_mobile_layout_planner_pricing_stabilization.md`
- **타이포그래피/폭**: Paperlogy를 `Pretendard Variable`로 교체하고 모바일 주요 화면의 `min-width:0`, `max-width:100%` 규칙을 보강했다. 분석 막대 차트의 `min-width:480px` 강제를 제거해 320~430px에서 의도하지 않은 가로 overflow가 발생하지 않게 했다.
- **플래너**: 캘린더 시트를 app-frame 기준으로 옮기고 탭바 상단에서 끝나게 했다. 작성 input ref를 실제 런타임에 연결해 과목/시간 선택 시 내용 초기화와 추가 버튼 비활성 문제를 해결했다. 개인 플래너와 작성 화면은 Basic 이상에서 이용 가능하다.
- **홈**: 일정 추가 모달을 캘린더 시트보다 높은 layer로 분리했다. 대학 카드 swipe의 touch/pointer 이중 실행을 제거하고 전환 속도를 조정했으며, 대학 추가 카드를 검색 목적이 분명한 CTA로 재설계했다.
- **요금제/결제**: iOS에서 플랜 표시만 바뀌고 실제 결제 상태는 남던 오류를 수정했다. 첨부 레퍼런스처럼 플랜명·가격·핵심 혜택·CTA·추천 대상 순서의 단일 상세 카드로 단순화하고 Basic/Starter 결제 단위를 별도로 처리했다.
- **검증**: `npm run check`, Vite build, 관련 `node --check`, `git diff --check` 통과. 320/390/430px 주요 화면 overflow 0, 플래너 입력→추가, 캘린더/일정 modal layer, 대학 swipe, 플랜 선택→결제 상태/URL 유지, 콘솔 error/warn 0건 확인.

---

## 2026-06-25 — 홈 캘린더 D-day 일정 요약 추가
- 홈 우상단 캘린더 버튼을 `D-XX` 단독 표시에서 `D-XX + 가장 가까운 일정명` 2줄 구조로 변경했다.
- 긴 공식 일정명은 홈용 축약 함수로 정리한다. `2027학년도 대학수학능력시험`은 `수능`, 교육청 괄호가 붙은 학력평가는 괄호를 제거해 표시한다.
- 버튼 폭은 제한하고 일정명은 한 줄 말줄임 처리해 홈 인사 영역을 밀지 않도록 했다. JSX 홈과 문자열 fallback renderer를 동일하게 반영했다.
- `npm run check`, Vite build, 축약 문구 단위 확인, `git diff --check` 통과.

---

## 2026-06-25 — 모바일 수험 일정 Phase 6 서버 저장 완료
- **백엔드**: `StudyCrack_UserCore`에 개인 일정 조회/추가·수정/삭제 type 3종을 추가했다. JWT 사용자 본인의 학생 레코드만 접근하며 서버 UUID, 최대 100건, 제목·메모 길이, ISO 날짜, category allowlist를 검증한다.
- **동시성**: 일정 배열 갱신 시 읽은 기존 배열을 조건으로 확인해 다른 기기의 변경을 조용히 덮어쓰지 않는다. 충돌 시 `409`와 재시도 안내를 반환한다.
- **프론트 연결**: 모바일 부트에서 서버 개인 일정을 로드하고, 생성 시 서버 발급 ID와 서버 전체 목록을 반영한다. 수정·삭제도 서버 응답 목록을 단일 기준으로 사용하며 저장 중 중복 제출을 막는다.
- **세션/격리**: 일정 API에서 인증 만료가 발생하면 기존 조용한 모바일 로그인 이동을 사용한다. 로그인 계정에서는 사용자 비구분 localStorage 일정을 초기 노출하지 않아 계정 전환 시 다른 사용자의 일정이 보이지 않게 했다. localStorage fallback은 미로그인 로컬 프리뷰에만 유지한다.
- **검증**: `npm run check`, Vite build, UserCore/프론트 관련 JS `node --check`, `git diff --check`, 가짜 UserCore 기반 생성→수정→삭제 계약 테스트 통과.
- **배포**: 실제 dev/prod 반영에는 **StudyCrack_UserCore Lambda 재배포가 필요하다.** 재배포 후 개인 일정 CRUD·새로고침 유지와 Phase 1 인증 만료 사이클을 dev에서 확인한다.

---

## 2026-06-24 — 모바일 세션·마이페이지·홈 일정/알림 개편 Phase 1~5 구현
- **계획 문서**: `docs/exec-plans/completed/260624_mobile_session_mypage_calendar_polish.md`(현재 Phase 1~6 구현 완료, UserCore 재배포·dev 스모크 대기).
- **P0 세션 만료(Phase 1)**: `js/shared/api.js` 만료 오류에 `code='AUTH_EXPIRED'`+`status` 부여(예상 만료는 `console.error` 제외). `session.js`는 만료만 throw, 네트워크/CORS는 기존대로 null. `main.js` 단일 가드 `expireMobileSessionSilently()`로 alert 없이 `?screen=authLogin` 1회 이동(동시 403 다중에도 1회). `HomeScreen profileReady`에 `error` fallback 추가해 무한 로딩 제거. → 인증 변경이라 dev 스모크 필수.
- **구독 통합(Phase 2)**: 백엔드 무변경. `mapUserToStatePatch`가 `currentSubscription/pendingSubscription/gracePeriodUntil` 병합, 마이페이지 중복 `OO 이용 중` 카드 제거 + 상단 카드/상세 모달에 플랜·이용 종료 예정일·예약 플랜 요약. Basic/Starter는 평생 이용, Standard/Pro/Trial은 endDate 기준.
- **모달 공통화(Phase 3)**: `--mobile-modal-width`+overlay safe-area 토큰, 계정/성적 모달 viewport 직접 계산 제거. 약관 모달 header/scroll-body 구조 + panel overflow 닫고 radius 20px 보장(하단 잘림 해소).
- **알림 FAB/시트(Phase 4)**: 우상단 bell 제거, 탭바 위 우하단 알림 FAB(미읽음 badge), 중앙 모달→bottom-sheet. 시트/캘린더는 app-frame 직속 렌더로 스크롤 컨테이너가 아닌 프레임 기준 하단 고정(스크롤 anchor 버그 회피).
- **수험 일정 캘린더(Phase 5, 개인 일정만)**: 신규 `constants/admission-calendar.js`(공식 데이터는 확정 전까지 비움), `derived.js buildCalendarDerived`(최근접·D-day·월간 그리드), 홈 우상단 캘린더 버튼+D-day, `components/calendar-sheet.js`, `handlers/calendar-handlers.js`(신규 group). 개인 일정은 localStorage(`admissionCalendar`) 보존.
- **사용자 결정**: 공식 일정 날짜는 개인 일정만 먼저(잘못된 공식 날짜 노출 금지), 백엔드는 다음(Phase 6 UserCore 3종 type + Lambda 재배포 후속).
- **검증(LOCAL)**: `npm run check`(68), `npm run build`, `node --check js/shared/api.js`, `git diff --check` 통과. 프리뷰 390×844에서 마이 구독 요약/상세 모달 폭(304, overflow 0), 약관 모달 radius 20px·body-only 스크롤, 알림 FAB(우하단, badge)·bottom-sheet, 캘린더 시트(월간 그리드·today 마킹·추가/수정/삭제·localStorage 유지·D-DAY badge·월 이동), 콘솔 error 0건 확인. dev 스모크는 Phase 1 인증 변경분 필요.

---

## 2026-06-24 — 모바일 세션·마이페이지·홈 일정/알림 후속 계획 수립
- **계획 문서**: `docs/exec-plans/completed/260624_mobile_session_mypage_calendar_polish.md`
- **P0 세션 문제**: 모바일 경로가 공용 인증 모듈에서 public route로 분류되고, `fetchCurrentUser()`가 `Auth expired`를 `null`로 삼키면서 클라이언트 세션 값과 `userLoadStatus='error'`가 결합해 홈 로딩 화면에 머무는 원인을 확인했다. 만료 부트스트랩 `401/403`은 alert 없이 모바일 세션을 정리하고 `?screen=authLogin`으로 한 번만 이동하도록 계획했다.
- **마이페이지/모달**: 중복 `OO 이용 중` 카드는 제거하고 상단 계정·구독 카드에 현재 플랜과 이용 종료 예정일을 통합한다. 백엔드가 이미 제공하는 `currentSubscription/pendingSubscription`을 모바일 state에 연결한다. 계정/성적/약관 모달은 app frame 기준 공통 폭, safe-area, header/body/sticky action 구조로 정리한다.
- **홈 개편**: 알림은 우하단 FAB + 알림 바텀시트로 이동하고, 우상단은 수험 일정 캘린더 진입점과 D-day badge로 바꾼다.
- **캘린더 데이터**: 수능·모의평가·학력평가·원서 접수 공식 일정은 연도별 정적 데이터로 관리하고, 사용자 개인 일정만 `StudyCrack_Students.admissionCalendar`에 저장한다. 개인 일정 CRUD를 위해 UserCore 신규 type 3종을 추가하는 방안을 채택했다.
- **실행 순서**: P0 세션 종료 → 구독 정보 통합 → 모달 공통화 → 알림 FAB/시트 → 공식 캘린더 프론트 → 개인 일정 백엔드 저장. UserCore 변경 후 Lambda 재배포가 필요하며, 인증 변경은 dev 로그인→새로고침→새 탭→만료→재로그인→로그아웃 스모크를 머지 조건으로 둔다.

---

## 2026-06-24 — 모바일 인증 화면 전환 안정화 + 단계형 회원가입
- **원인**: 로그인/회원가입 화면이 문자열 HTML renderer 경로에 남아 있어 `authSubmitting`, 찾기 모달 open, 인증 상태 변경마다 인증 화면 DOM 전체가 교체됐다. 이때 화면 진입 animation과 이미지/입력 재생성이 겹쳐 로그인 클릭 시 번쩍임, 이메일·비밀번호 찾기 모달 진입 시 끊김이 발생했다.
- **구조 변경**: `AuthLoginScreen`/`AuthSignupScreen`을 React 화면으로 이관하고 screen registry에 등록했다. 로그인 카드와 입력 DOM은 상태 변경 중 유지되며, 찾기 모달만 별도로 mount된다. 찾기 backdrop/modal에는 공통 `overlayFadeIn` + `surfaceLiftIn` motion을 연결했다.
- **회원가입 순서**: 기존 장문 단일 폼을 `1. 필수/선택 약관 → 2. 이름·성별·생년월일 + 휴대폰 인증 → 3. 이메일 인증 → 4. 비밀번호·가입 경로·프로모션 코드` 4단계로 재구성했다. 각 단계는 필수 조건을 통과해야 다음으로 이동하고, 이전 단계로 돌아가도 입력값과 인증 상태가 유지된다.
- **백엔드 계약**: Auth Lambda의 기존 `send_sms_auth`, `send_email_auth`, `verify_code`, `update_profile` 및 Cognito 가입 흐름을 그대로 사용한다. 백엔드 소스 변경은 없다.
- **검증(LOCAL)**: `npm run check`, Vite build, `git diff --check` 통과. 390×844 로컬 브라우저에서 로그인 오류 후 이메일 입력 보존, 이메일/비밀번호 찾기 dialog mount, backdrop/modal animation 적용, 약관 전체동의 5종 반영, 1→2단계 이동, 이전→다음 이동 후 이름 보존, 문서 가로 overflow 0을 확인했다. 실제 SMS/이메일 발송 및 로그인→새로고침→새 탭→로그아웃은 dev 스모크가 필요하다.

---

## 2026-06-24 — 모바일 전역 모션 부드러움 정리
- **진단**: 기존 모바일 CSS에는 일부 transition이 있었지만 화면 전환, 모달/시트 진입, 리스트 카드 등장, 탭 active 상태, 게이지/그래프 easing이 화면별로 달라 전환이 딱딱하게 끊겨 보일 수 있었다.
- **변경**: `design-v2.css` 하단에 전역 motion refinement layer를 추가했다. 공통 motion token(`--motion-fast/base/slow/page`, `--ease-enter/standard/spring`)을 두고, 화면 진입은 `mobileScreenEnter`, 카드/리스트는 `contentRiseIn`, 모달/시트/검색/약관/드로어는 `overlayFadeIn` + `surfaceLiftIn`/`bottomSheetIn`/`drawerSlideIn`으로 통일했다.
- **화면 루트 배선**: 문자열 renderer와 JSX 화면 모두 같은 motion selector를 타도록 `app-shell`에 `screen` 옵션과 `data-screen`을 추가했고, JSX 기반 `home`, `analysis`, `planner` 루트에도 각각 `data-screen`을 붙였다.
- **상호작용 보강**: 버튼/탭/카드 active 피드백은 짧은 translate+scale로 정리하고, 하단 탭 active indicator, 홈/점수 슬라이더, 지원학과 게이지, 분석 그래프/진행 막대는 같은 easing을 쓰도록 보정했다. `prefers-reduced-motion: reduce`에서는 transition/animation을 즉시 종료하도록 접근성 가드를 추가했다.
- **검증(LOCAL)**: `scripts/check-source.mjs`, Vite build, `node --check`(`app-shell.js`, `main.js`), `git diff --check` 통과. `.jsx` 직접 `node --check`는 Node가 확장자를 인식하지 못해 제외하고 Vite build로 확인했다. Vite build는 기존 대형 chunk 경고만 유지된다.

---

## 2026-06-24 — 모바일 홈/프로필/소셜 로그아웃 후속 보강
- **대상 문제**: 실세션 로딩이 느릴 때 홈에 mock 이름 `김지민`이 노출되는 문제, PRO 리포트 미리보기 위치, locked 탭의 하단 네비 active 표시 누락, 마이페이지 상단 계정 카드 기능 부족, 성적 정보 모달의 모바일 overflow, Naver 소셜 로그아웃 후 자동 재로그인 흐름.
- **홈/리포트**: 실세션에서는 사용자 데이터가 `ready`가 될 때까지 홈 로딩 패널을 보여주고, 이름 fallback은 `회원`으로 제한했다. PRO 리포트 미리보기는 오늘 공부 목표 하단으로 옮기고 주간 리포트 미리보기와 함께 표시한다.
- **권한/성적 UI**: Basic/Free가 학습코칭·플래너 탭을 누를 때도 해당 탭 active/음영 상태가 유지되도록 lockedFeature 이동 전에 탭 상태를 동기화했다. 성적 정보 화면은 `내 성적` 문구와 과목별 카드형 목록으로 바꾸고, 성적 입력 모달은 모바일 폭에서 좌우 overflow가 나지 않도록 전폭 카드/단일 컬럼 구조로 정리했다.
- **마이페이지 프로필**: 상단 계정 카드를 프로필 상세 모달로 확장했다. 프로필 사진 확대/파일 선택/업로드 저장, 이름 변경, 전화번호 인증 변경, 소셜 로그인 관리 진입을 한 곳에 묶었고, Standard/Pro 사용자는 배정 튜터 정보를 조회해 볼 수 있게 했다.
- **소셜/로그아웃**: 모바일·웹 Naver OAuth authorize URL에 `auth_type=reauthenticate`를 추가해 로그아웃 후 조용한 기존 네이버 세션 재사용을 줄였다. 모바일 로그아웃 정리 함수는 `clearClientSession()` 사용 여부와 무관하게 `socialReturnUrl`/`socialEntry`/`socialState`/`socialLinkMode`를 앞뒤로 제거한다.
- **백엔드 소스 보강**: `backend-backup/StudyCrack_UserCore/index.mjs`의 `get_user_analysis` 응답에 모바일 계정 화면용 `email/socialEmail/linkedProviders/marketingAgreed/marketingAgreedAt`을 추가했고, `update_member_info`에서 `profileImage` 저장을 허용하도록 로컬 Lambda 소스를 수정했다. 실제 dev/prod 반영에는 UserCore Lambda 재배포가 필요하다.
- **검증(LOCAL)**: 번들 Node로 `scripts/check-source.mjs`, Vite build, `node --check`(`js/auth.js`, `StudyCrack_UserCore/index.mjs`, 모바일 profile/main/session/auth-service 렌더러), `git diff --check` 통과. Vite build는 기존과 동일하게 500kB 초과 chunk 경고만 발생했다.
- **남음(dev 필수)**: 인증 흐름 변경이 포함되어 dev 배포 후 학생 계정 로그인 → 새로고침 → 새 탭 → 로그아웃, Naver 재로그인, 모바일 소셜 복귀, 프로필 사진 저장, Standard/Pro 튜터 정보 조회를 실세션으로 확인해야 한다.

---

## 2026-06-23 — 모바일 프로필/분석 안정화 계획 수립
- **계획 문서**: `docs/exec-plans/completed/260623_mobile_analysis_profile_stabilization.md` 작성.
- **대상 문제**: 로그인 직후 mock 사용자 `김지민` 노출, 분석 탭 디자인/플랜 권한 불일치, 분석 결과가 홈 이동 후 0점으로 회귀하는 상태 보존 문제, 계정 정보 전화번호 변경 UX/검증 부족.
- **핵심 방향**: 실세션에서는 mock 사용자/Pro 플랜을 노출하지 않고, Basic 이상은 점수 상승 시뮬레이션을 사용할 수 있게 하되 역산/최소 노력 도달 성적은 Standard/Pro 잠금 프리뷰로 분리한다. 분석 fetch는 기존 성공 결과를 즉시 비우지 않고 마지막 성공 snapshot을 유지한다. 전화번호 변경은 기존 SMS 인증 흐름을 웹 마이페이지 수준으로 노출/검증한다.
- **구현 상태**: 1차 구현 완료. `DEFAULT_USER`의 실사용 이름/플랜 fallback을 비우고, 마이페이지 표시 fallback을 `회원`/`미구독`으로 분리했다. 분석 권한은 `canUseScoreSimulation`(Basic 이상)과 `canUseReverseProjection`(Standard 이상)으로 분리했고, Basic은 시뮬레이션 탭에 머물며 역산/도달 성적만 잠금 프리뷰를 본다. 분석 결과는 `lastAnalysisSnapshot`을 유지해 홈/분석 이동 중 0점으로 회귀하지 않도록 했다. 계정 정보 화면은 이름 변경/전화번호 인증 변경 액션을 동등하게 노출하고, 전화번호 미등록 안내와 인증 재전송 UX를 보강했다.
- **후속 정렬**: 웹 `js/analysis.js`도 상품 문구와 맞춰 Basic/Starter/Trial 이상에서 점수 상승 시뮬레이션을 허용하도록 수정했다. 역산/합격권 도달 경로 CTA는 기존처럼 Standard/Pro 전용으로 유지한다. 모바일 분석 화면은 `stale` 상태에서 이전 분석 결과를 먼저 보여주는 중임을 안내하는 배너를 추가했다.
- **검증(LOCAL)**: 번들 Node로 `scripts/check-source.mjs`, Vite build, `node --check js/social-callback.js`, `git diff --check` 통과. 단위 확인으로 snapshot 기반 분석 점수 유지와 Basic 시뮬레이션/역산 잠금 분기를 확인했다. dev 실세션에서 로그인 직후 이름 표시, Basic/Standard/Pro 권한, 홈↔분석 점수 유지, 전화번호 SMS 변경을 확인해야 한다.

---

## 2026-06-23 — 모바일 자체 인증 Phase E 1차 (학생 전용 role guard + 로그아웃 정합성)
- **진행 상태**: Phase E의 프론트 1차를 구현했다. 모바일은 학생 앱이므로 `get_user_analysis` 응답의 `role`이 `student`가 아니면 세션 부트 직후 차단한다.
- **역할 차단**: `mapUserToStatePatch`가 `role`을 `user.role`에 반영한다. 모바일 런타임은 세션 사용자 조회 후 `role !== student`이면 Auth `logout`을 호출해 서버 세션 정리를 시도하고, 클라이언트 세션을 지운 뒤 튜터는 `/tutor/login`, 관리자는 `/admin/login`으로 보낸다.
- **로그아웃 보강**: 모바일 설정의 로그아웃은 기존처럼 화면 state만 바꾸지 않고 Auth `logout` → `clearClientSession` → `authLogin` 순서로 정리한다. dev/prod의 쿠키 세션 잔존을 막기 위한 변경이다.
- **dev 재현 후 보강**: `?screen=authLogin` 직접 진입은 로그인 성공 후 reload 시에도 같은 query가 남아 로그인 화면을 다시 강제하는 문제가 있었다. 세션이 있으면 `authLogin`/`authSignup` screen override를 무시하고 home으로 부팅하게 수정했다. 또한 로그아웃 후 새로고침에서 이전 모바일 세션이 살아나는 문제를 줄이기 위해 모바일 인증 정리 함수를 공통화하고 Cognito SDK 저장 키, `idToken`, 기존 로컬 세션 키, sessionStorage를 함께 정리한 뒤 `studycrack-mobile.html?screen=authLogin`으로 `replace`한다.
- **소셜 복귀 후속 보강**: 모바일 소셜 시작에서 저장한 `socialReturnUrl`은 `socialEntry=mobile`일 때만 사용하고, 콜백 오류/취소/완료 후 즉시 제거한다. 오래 남은 모바일 복귀값이 일반 웹 소셜 로그인에 섞이는 상황을 막기 위한 조치다. 마이페이지 소셜 연동은 콜백 후 `/studycrack-mobile.html?screen=accountInfo`로 돌아오도록 정렬했다.
- **dev 소셜 복귀 보강**: 소셜 로그인은 성공하지만 완료 후 웹 `/`/`/welcome`으로 빠지는 재현이 있었다. 모바일 OAuth 시작 시 `state`에 `mobile` 표시를 추가하고, 복귀 URL을 sessionStorage뿐 아니라 localStorage fallback에도 저장한다. `/social-callback`은 백엔드에는 기존 `delete_reauth` 목적만 전달하고, 모바일 표시가 있으면 복귀값 누락 시에도 `/studycrack-mobile.html`로 돌아온다.
- **검증(LOCAL)**: `npm run check`, `npm run build`, `node --check js/social-callback.js`, `git diff --check` 통과. 단위 확인으로 `role=tutor` 매핑, 모바일 로그아웃의 Auth `logout` 호출/세션 정리/goto 흐름, 마이페이지 소셜 연동 복귀 경로, 모바일 세션 키 정리를 확인했다.
- **남음(dev 필수)**: 실제 학생/튜터/관리자 계정으로 모바일 진입, 튜터·관리자 차단, 학생 로그인 → 새로고침 → 새 탭 → 로그아웃 후 재진입 차단을 확인해야 한다.
- **후속 정리**: 실제 런타임인 `studycrack-mobile.html`/preview가 Vite 번들만 로드하는 것을 확인했고, 모듈 소스의 회원가입 웹 위임 fallback(`signupSuccess → /signup?returnUrl`)을 제거했다. `js/studycrack-mobile.js`에 남은 옛 문구는 현재 HTML에서 로드되지 않는 레거시 단일 파일이다.
- **LOCAL 사전 스모크**: 렌더러/핸들러 직접 import 기반으로 authLogin/authSignup/analysis를 점검했다. 로그인·회원가입 화면의 Google/Naver 노출, 네이티브 가입 CTA, 선택 마케팅 약관, 웹 위임 링크 부재, 회원가입 fallback 무해화, Basic 시뮬레이션 탭의 `setAnalysisMode`, stale 분석 안내를 확인했다. 이 과정에서 Basic 시뮬레이션 활성 탭에 남아 있던 불필요한 `data-target="proIntro"` 속성을 제거했다.

---

## 2026-06-23 — 모바일 자체 인증 Phase D 1차 (소셜 로그인 모바일 복귀)
- **진행 상태**: Phase D의 프론트 1차를 구현했다. 모바일 로그인/회원가입의 Google/Naver 버튼이 더 이상 웹 `/login`/`/signup`으로 위임되지 않고, 모바일 핸들러에서 provider별 OAuth authorize URL을 직접 생성한다. 소셜 신규/기존 여부는 기존 Auth Lambda `social_callback` 응답(`requiresTerms`, `pendingSignupToken`)과 `/social-callback` 약관 모달 흐름을 그대로 사용한다.
- **모바일 복귀 처리**: 소셜 시작 시 기존 `socialState`와 함께 `socialReturnUrl`(모바일 앱 HTML 경로)과 `socialEntry=mobile`을 sessionStorage에 저장한다. `/social-callback`은 로그인/회원가입 완료 후 이 값이 안전한 내부 경로이면 `/welcome` 또는 `/` 대신 모바일 앱으로 복귀한다. 마이페이지 소셜 계정 연동(`linkSocial`)은 같은 복귀값을 저장하되 `?screen=accountInfo`로 돌아오게 해 콜백 후 웹 `/mypage`로 튀는 문제를 방지했다.
- **보안/호환성**: 복귀 URL은 `/...`로 시작하고 `//`, 백슬래시, `/social-callback` 자체를 제외한 내부 경로만 허용한다. 기존 웹 소셜 로그인 기본 라우팅과 신규 소셜 약관 모달은 유지했다. 백엔드 Lambda 코드는 변경하지 않았다.
- **검증(LOCAL)**: `npm run check`, `node --check js/social-callback.js`, `npm run build`, `git diff --check` 통과. 단위 확인으로 Google/Naver authorize URL, `socialState`, `socialReturnUrl`, `socialEntry` 저장을 검증했다. 로컬 프리뷰에서 로그인/회원가입 양쪽 소셜 버튼이 `ssoSuccess` + `data-provider=google|naver`로 렌더되는 것을 확인했다.
- **남음(dev 필수)**: 실제 Google/Naver OAuth round-trip은 콜백 URL allowlist가 dev/prod 중심이라 LOCAL에서 완료 검증 불가. dev 배포 후 기존 소셜 로그인, 신규 소셜 약관 동의 후 가입, 모바일 복귀, 마이페이지 소셜 연동 복귀, 새로고침/새 탭/로그아웃 1사이클을 확인해야 한다.

---

## 2026-06-23 — 모바일 자체 인증 Phase C (이메일 회원가입 네이티브화)
- **진행 상태**: `docs/exec-plans/completed/260623_mobile_native_auth.md` 기준 Phase C를 구현했다. Phase A/B의 모바일 자립형 Cognito 로그인 위에 회원가입 화면을 웹 위임 CTA에서 네이티브 이메일 가입 폼으로 교체했다. 이후 Phase D 1차에서 Google/Naver 버튼은 모바일 소셜 시작 흐름으로 전환됐다.
- **회원가입 플로우**: 모바일에서 이메일 인증번호 발송/확인(`send_email_auth`/`verify_code`), SMS 인증번호 발송/확인(`send_sms_auth`/`verify_code`), 비밀번호 정책 검증, 이름/성별/생년월일/전화번호/유입경로/프로모션 코드 입력, 필수 약관 4종 + 선택 마케팅 동의까지 수집한다. 완료 시 Cognito `signUp()` → Auth `update_profile` → `loginWithPassword` 자동 로그인 재부팅 흐름을 탄다. 백엔드 Lambda 코드는 변경하지 않고 기존 Auth type만 재사용했다.
- **상태/UX 보강**: 회원가입 진행 중 검증 상태 변경이나 약관 전문보기 모달 때문에 입력값이 사라지지 않도록 `signupForm`/`signupTerms` 임시 state를 추가했다. 약관 전문보기는 기존 모바일 약관 모달을 재사용하되 회원가입 전용 액션(`openSignupTermsModal`)으로 분리해 마이페이지 약관 핸들러와 충돌하지 않게 했다. 약관 전체동의, 필수 4종/선택 마케팅 체크 상태도 state 기반으로 보존된다.
- **검증(LOCAL)**: `npm run check`(65 files), `npm run build`, `git diff --check` 통과. 로컬 프리뷰에서 회원가입 화면에 필수 약관 4개+마케팅 1개, `회원가입 완료` CTA, 웹 위임 문구 제거를 확인했다. 빈 제출 시 `이메일 형식을 확인해주세요.` 에러 표시, 약관 모달(`개인정보 처리방침`) 본문 표시, 모달 오픈 후 이메일 입력값 보존, 전체동의 체크 5개 동시 반영을 확인했다. 실제 이메일/SMS 발송과 가입 완료는 dev 실세션에서 검증 필요.
- **남음**: Phase D(소셜 로그인/소셜 신규 가입 모바일 복귀), Phase E(튜터/관리자 차단·세션 일관성), dev 배포 후 이메일 로그인/회원가입/소셜/새로고침/새 탭/로그아웃 1사이클 스모크.

---

## 2026-06-23 — 모바일 자체 인증 Phase A+B (이메일/비밀번호 네이티브 로그인)
- **배경**: 모바일은 자체 로그인이 없어 웹 `/login` 위임으로만 계정 진입이 됐다. 계획 `docs/exec-plans/completed/260623_mobile_native_auth.md`에 따라 모바일 자체 로그인/회원가입/소셜을 단계 구현 시작(사용자 결정: 모바일 자립형 `auth-service.js`, Cognito SDK npm 번들링, Phase A+B 먼저).
- **Phase A(기반)**: `amazon-cognito-identity-js`를 모바일 Vite 의존성으로 추가하고, `src/runtime/auth-service.js`에 `loginWithPassword`를 구현했다. 웹 `js/auth.js`의 검증된 흐름과 동치 — Cognito `authenticateUser` → sessionStorage `accessToken`/`idToken`(Bearer) 저장 + Auth Lambda `register_login_cookies`로 httpOnly 쿠키 등록(LOCAL은 cross-site 쿠키 미적용이라 refreshToken만 보관). 토큰 동기화/세션 정리는 `js/shared/api.js` 전역(`syncTokensFromAuthResponse`/`clearClientSession`)을 재사용. **백엔드 Lambda 코드 변경 없음**(기존 type 재사용).
- **Phase B(로그인 UI)**: `auth/renderers.js` 로그인 화면을 이메일/비밀번호 폼 + 에러 표시 + 제출중 상태로 교체. `auth-handlers.js` `loginSuccess`를 네이티브 로그인으로 바꾸고, 성공 시 토큰/쿠키가 설정된 상태로 앱을 재부팅(`window.location.reload`)해 R2a(세션 → home, 실데이터) 부트를 그대로 탄다. 빈 입력 검증·Cognito 에러 한글 매핑 포함. 이메일/비번 찾기는 기존에 이미 모바일에서 Auth Lambda로 직접 동작하므로 그대로 유지. 소셜(`ssoSuccess`)·회원가입(`signupSuccess`)은 Phase C/D 전까지 웹 위임 유지.
- **상태 배선**: `authError`/`authSubmitting` state 추가(자동 setter 생성). 로그인 입력/에러 스타일은 `design-v2.css`에 추가.
- **검증(LOCAL)**: `npm run check`(65), `npm run build`, `git diff --check` 통과. 프리뷰 390×844에서 로그인 폼 렌더, 빈 제출 시 "이메일과 비밀번호를 입력해주세요." 표시, **잘못된 자격증명 제출 시 실제 Cognito 왕복 → `NotAuthorizedException` → "이메일 또는 비밀번호가 올바르지 않습니다." 매핑** 및 버튼 복구, 콘솔 JS error 0건·가로 overflow 0(scrollWidth 390) 확인. 버튼 배경 solid 브랜드(`#4c79ee`).
- **남음(dev 스모크 필수)**: 실제 학생 계정 로그인 → 쿠키 등록(register_login_cookies, LOCAL은 CORS로 미검증) → 재부팅 후 home 실데이터 → 새로고침 → 새 탭 → 로그아웃 1사이클을 dev 배포 후 검증해야 머지 가능. 이후 Phase C(회원가입: 이메일/SMS 인증 + 약관 + Cognito 가입), Phase D(소셜 네이티브 + `/social-callback` 모바일 복귀), Phase E(튜터/관리자 차단·세션 일관성) 진행.
- **참고**: `package.json`/`package-lock.json`에 Cognito 의존성 추가(배포 `npm ci`가 설치). 번들 약 465K→577K.

## 2026-06-23 — 모바일 플래너(#5) 표면 Quiet Strategy Console 폴리시
- **진단**: today 앵커 현행화 이후 남은 #5 항목은 플래너 표면(카드/CTA/빈 상태) 시각 디테일 정렬이었다. SKY MENTOR 프리미엄 CTA는 inset 하이라이트 box-shadow와 카피 text-shadow가 남아 방금 평탄화한 eta 카드보다 광고지 느낌이 강했고, 빈 날짜 상태는 "선택한 날짜의 플래너가 없습니다."만 보여 다음 액션을 제안하지 않았다(계획 #5 빈 상태 원칙 미충족).
- **변경**: `design-v2.css`에 플래너 폴리시 override를 추가해 (1) `.planner-premium-cta` box-shadow의 inset 흰색 하이라이트를 제거하고 단일 soft shadow + `--primary-dark` border로 평탄화, badge/제목의 text-shadow를 제거해 eta 카드와 동일한 console 톤으로 맞췄다. (2) 빈 상태를 제목+안내 2줄 카드로 재구성하고, 마크업(`renderers.js`·`PlannerScreen.jsx` 1:1)을 `아직 등록한 계획이 없어요` + `N일에 학습을 추가해 하루 목표를 만들어 보세요.`(선택 날짜 인지)로 바꿔 바로 아래 `+ N일 계획 추가하기` CTA가 다음 액션이 되게 했다.
- **검증**: `npm run check`(64), `npm run build`(85 modules), `git diff --check` 통과. 로컬 프리뷰 390×844에서 premium CTA 제목 `text-shadow:none`·box-shadow inset 제거(단일 `rgba(52,78,143,.16)`), 빈 날짜(20일) 선택 시 다음-액션 빈 상태 카드 표시, 콘솔 error 0건·가로 overflow 0(scrollWidth 390) 확인.

## 2026-06-22 — 모바일 플래너(#5) today 앵커 현행화 (고정 "2024년 5월" 제거)
- **진단**: 모바일 플래너/홈 "오늘"은 백엔드 `get_planner`/`get_study` API가 없고 `FIXED_TODAY_DATE = '2024-05-14'` 고정 mock 앵커 + localStorage seed로만 동작하는 로컬 데모였다. 그 결과 플래너 헤더(`renderers.js`·`PlannerScreen.jsx`)와 캘린더 시트가 2026년 사용자에게도 "2024년 5월"·요일 "(화)"·31일 그리드를 고정 표시했고, 잠금 프리뷰(`renderLockedFeaturePreview`)도 "2024년 5월 14일"과 vivid `#2563EB` 도넛을 썼다.
- **변경**: 백엔드 실데이터가 없으므로 앵커를 런타임 현재 날짜로 현행화했다. (1) `mock-data.js`의 `FIXED_TODAY_DATE`를 `new Date()` 기반 `YYYY-MM-DD`로 계산하고, `DEFAULT_PLANNER_ITEMS`의 `date`와 `app-state.js`의 `selectedDate` 기본값을 오늘 일자(day-of-month)로 재키잉해 홈/플래너 데모가 항상 오늘 기준으로 일관되게 채워지도록 했다. (2) `derived.js` `buildPlannerDerived`가 앵커에서 `plannerMonthLabel`/`plannerMonthDays`/`selectedPlannerWeekday`를 단일 출처로 파생하고, 요일 계산을 `new Date(2024,4,…)` 하드코딩에서 실제 연·월로 바꾸고 날짜 strip/캘린더 그리드를 월 일수로 클램프했다. (3) 플래너 문자열 renderer와 JSX 양쪽의 "2024년 5월"·"(화)"·31일 하드코딩을 파생값으로 교체(DOM 1:1 동기화 유지), 잠금 프리뷰 날짜도 현재 월/일 라벨로, 도넛 `#2563EB`→`#4c79ee`로 정렬했다. 홈 "오늘 누적 공부"는 기존대로 `FIXED_TODAY_DATE`의 day-of-month를 키로 쓰므로 재키잉된 seed와 자동 정합된다.
- **검증**: `npm run check`(64), `npm run build`(85 modules), `git diff --check` 통과. 로컬 프리뷰 390×844에서 플래너 헤더 "2026년 6월 22일 (월)", 캘린더 시트 "2026년 6월"·30일, localStorage 초기화 후 seed 4항목이 오늘(22일)에 표시·날짜 strip 22 중심·active(월/22), 홈 "오늘" 섹션 정상(stale "2024년"/NaN 없음), 콘솔 error 0건·가로 overflow 0(scrollWidth 390) 확인. 플래너는 백엔드 무관·localStorage 전용이라 LOCAL로 완전 검증된다(dev 스모크 불요).

---

## 2026-06-22 — 모바일 온보딩(#7)/eta 카드 Quiet Strategy Console 정렬
- **진단**: 전체 디자인 개편(`260622_mobile_app_total_design_rework`)에서 요금제/성적입력/홈/분석/마이는 console 톤으로 정리됐지만, 계획 #7(Auth/온보딩)은 아직 옛 vivid-blue 잔재가 남아 있었다. 온보딩 ob3/ob4의 MBTI 진단 결과 카드가 인라인 `#2563EB`/`#1D4ED8`/`text-shadow`로 그려졌고, 분석/온보딩 게이지·상태 색 기본값이 `#2563EB`였으며, 온보딩 히어로 SVG(on1/on2)는 브랜드(`#4c79ee`)와 다른 `#0B6BFF`/`#4A8DFF`/`#BFD8FF` 블루를 사용했다. 또한 분석/온보딩 공용 `.analysis-v2-eta-card`/`.on-eta-card`에 `etaShine` shimmer 애니메이션이 남아, rework가 다른 곳에서 제거한 "광고지형 shine" 원칙과 어긋났다.
- **변경**: (1) `design-v2.css`에서 eta 카드의 `:before` shimmer와 `@keyframes etaShine`를 제거하고 border를 `--primary-dark` solid로 정렬했다. (2) `.ob-mbti-result` 토큰 클래스(`--primary` border, `--primary-soft` bg, `--primary-dark` 텍스트, text-shadow 제거)를 추가하고, ob3/ob4의 인라인 MBTI 결과 카드를 `renderMbtiResultCard` 헬퍼 + 새 클래스로 교체해 중복을 제거했다. (3) 분석/온보딩 렌더러의 게이지·상태 색 기본값 `#2563EB`→`#4c79ee`(브랜드 primary), 온보딩 히어로 SVG의 `#0B6BFF`→`#4c79ee`, `#4A8DFF`→`#8aa9f1`, `#BFD8FF`→`#c7d8f8`로 브랜드 블루 계열로 정렬했다. 점수 기반 semantic 상태색(합격컷 미만 주황 등)은 derived 그대로 유지된다.
- **검증**: `npm run check`(64 files), `npm run build`(85 modules), `git diff --check` 통과. 로컬 프리뷰 390×844에서 on1 히어로 차트가 브랜드 블루(`#4c79ee`/`#c7d8f8`)로 렌더, ob5의 `.on-eta-card`가 `::before content:none`·`animation:none`·solid `#344e8f`로 shimmer 제거 확인, ob4 가로 overflow 0(scrollWidth 390)·콘솔 error 0건, ob4 게이지가 점수 기반 semantic 색으로 정상 동작함을 확인했다.
- **프리뷰 플러밍**: 로컬 정적 검증용 `tools/static-preview.mjs`(저장소 루트 기준 정적 서버) 추가, `.claude/launch.json`을 node 실행으로 갱신(샌드박스에서 `python3 -m http.server`의 cwd 권한 오류 회피). 배포와 무관한 dev 전용 도구다.

---

## 2026-06-22 — 모바일 마이페이지 계정/약관 보강 + 전체 디자인 개편 계획
- **즉시 수정 1-3번**: 모바일 약관 보기 모달에 `openTermsModal`/`closeTermsModal` 액션을 연결하고, 웹 약관 상수 본문을 안전하게 escape해 표시하도록 수정했다. 계정 정보 화면은 웹 `mypage.html` 기준으로 기본 인적사항, 이메일, 전화번호 변경, 비밀번호 변경, 마케팅 수신 동의, 소셜 계정 연동 Google/Naver 섹션을 추가했다. 전화번호 변경은 웹과 동일하게 SMS 인증번호 전송 → 인증 후 `update_member_info` 저장 흐름으로 구현했다.
- **세션 매핑**: `get_user_mypage`가 내려주는 `email`, `socialEmail`, `phone`, `marketingAgreed`, `marketingAgreedAt`, `authProvider`, `linkedProviders`를 모바일 state의 `user`에 병합하도록 확장했다.
- **계획 문서**: 요금제 디자인, 성적정보 단일 화면 입력, 전체 앱 디자인 컨셉 재정비는 `docs/exec-plans/completed/260622_mobile_app_total_design_rework.md`에 별도 계획으로 작성했다.
- **디자인 개편 1차 구현**: 성적 정보 입력 모달을 6단계 이전/다음 방식에서 국어/수학/영어/한국사/탐구 2과목 단일 화면 입력 방식으로 교체했다. 요금제/결제 화면은 Basic/Starter/Standard/Pro compact selector + 선택 플랜 상세 + capability grid 구조로 재구성했다. 새 selector는 iOS Safari DOM active 보정 대상에도 포함했다.
- **공통 톤 보강**: `Quiet Strategy Console` 방향에 맞춰 성적 정보, 요금제, 결제, 홈/분석/플래너/코칭/마이/정성조사 주요 표면에 neutral background, 단정한 card border/shadow, 브랜드 단색 CTA 스타일을 적용했다.
- **성적 입력 후속 보강**: 성적 정보 모달에 필수 항목 남은 개수, 카드별 누락 표시, 인라인 힌트, 하단 저장 상태를 추가했다. 영어/한국사는 모바일 터치에 맞는 segmented grade control로 교체하고 전폭 카드로 배치해 내부 가로 overflow를 제거했다.
- **분석/잠금/요금제 톤 통일 2차**: 분석 화면에 실제 로딩 패널을 렌더링하고, 시뮬레이션 차트의 기준 시험 배지를 선택된 `scoreExamType` 기준으로 표시하게 했다. 분석 카드/게이지/CTA, 잠금 기능 프리뷰 패널, 요금제/결제 selector와 상세 카드 표면을 같은 neutral console 톤으로 재정렬했다.
- **홈 화면 최종 정리**: 홈 인사말을 실제 `user.name` 기반으로 바꾸고, 지원대학 카드/오늘 누적 공부/플래너 카드/랭킹 카드의 카드 표면, CTA, 게이지, metric tile, badge를 같은 neutral console 체계로 정리했다. 랭킹 카드의 강한 티어 배경과 shine 효과는 제거했다.
- **마이/고객센터/정성조사서 톤 통일**: 마이페이지/계정 정보/고객센터/정성조사서의 설정 리스트, 문의 row, 입력 폼, 빈 상태, 소셜 계정 row를 같은 neutral console 표면으로 정리했다. 고객센터 빈 상태의 기존 shimmer pseudo-element는 제거해 불필요한 내부 overflow를 막았다.
- **CSS override 정리**: `design-v2.css`에 누적된 홈/잠금 기능 일부 중복 선언을 구조 속성과 최종 시각 보정 속성으로 분리했다. 최근 보정 블록이 최종 색상·크기·여백을 담당하도록 두고, 앞쪽 선언은 레이아웃 구조만 남겨 이후 수정 시 덮어쓰기 충돌 가능성을 줄였다.
- **요금제/결제 후속 정리**: 모바일 플랜 상세 카드에 핵심 결과/열리는 기능 요약 strip을 추가하고, 긴 혜택 리스트는 주요 4개 + 추가 혜택 count로 정리했다. 결제 화면에는 결제 기간 선택과 3단계 진행 안내를 추가했다. 모바일 `openWebPayment`는 선택한 `plan`과 `duration`을 query로 전달하고, 웹 `payment.js`는 `?plan=basic|starter|standard|pro` 진입 시 해당 price row를 자동 선택해 checkout 섹션을 열도록 보강했다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. 로컬 프리뷰에서 약관 본문 표시(body length 2586), 계정 정보 섹션 3개, 전화번호 변경 모달, 마케팅 토글, Google/Naver 소셜 row, 콘솔 error 0건 확인.
- **추가 검증**: 로컬 프리뷰 390×844에서 `scoreInfo` 단일 성적 모달(과목 카드 6개, 단계 버튼 제거), `proIntro`/`payment` 플랜 selector 4개와 capability 4칸, `accountInfo`, `lockedFeature`, `home`, `analysis`, `planner`, `strategy` 렌더 및 콘솔 error 0건 확인. 후속으로 430×932에서 성적정보 카드/성적 입력 모달 가로 overflow 0건과 콘솔 error 0건을 확인했다. 430px 모바일 프레임에서 `analysis`, `proIntro`, `payment`, `lockedFeature` 가로 overflow 0건과 콘솔 error 0건을 추가 확인했다. 390px/430px 모바일 프레임에서 `home` 가로 overflow 0건과 콘솔 error 0건을 확인했다. 430px 모바일 프레임에서 `my`, `customerSupport`, `accountInfo`, `qualInfo` 가로 overflow 0건과 콘솔 error 0건을 확인했다. CSS override 정리 후 430px 모바일 프레임에서 더미 세션 기준 `home`, `analysis`, `coach`, `my`, `customerSupport`, `settings`, `accountInfo`, `qualInfo` 가로 overflow 0건을 재확인했다. `planner` 날짜 row는 의도된 가로 스크롤 오프스크린 항목만 감지됐고 문서 `scrollWidth`는 430px로 정상이다. 요금제/결제 후속 정리 후 430px 모바일 프레임에서 `proIntro`, `payment`, Basic 잠금 `lockedFeature` 가로 overflow 0건을 확인했고, 모바일 결제 이동 URL에 `source=mobile_app&plan=pro&duration=8주`가 포함되는 것과 웹 `payment.html?plan=pro` 자동 선택을 확인했다.

## 2026-06-22 — exec-plans active 정리
- **completed 이관**: 모바일 모듈화(`260611_studycrack_mobile_app_modularization`), Phase7 state/effect 인벤토리(`260613_phase7_app_state_inventory`), Phase7 Vite 런타임 스위치(`260613_studycrack_mobile_app_phase7_build`), 모바일↔웹 디자인 통일(`260620_mobile_web_design_unification`) 문서를 `docs/exec-plans/completed/`로 이동했다.
- **active 유지**: 리마인더 스케줄 복구, 튜터 auth 인프라/dev 스모크, 튜토리얼 전략 projection dev 스모크, 모바일 백엔드 통합 dev 실세션 스모크, 모바일 전체 디자인 재정비 후속 QA만 active에 남겼다.
- **정리 원칙**: 문서의 본래 목표가 완료된 것은 completed로 보내고, 실 dev 세션 스모크처럼 아직 검증이 남은 항목은 관련 active 문서 하나에서만 추적한다.

---

## 2026-06-21 — 모바일 앱 색감/스플래시 브랜드 보강
- **진단**: 모바일 화면들이 웹 브랜드 토큰을 일부 따르지만 카드/배경/탭/잠금/결제 표면의 색감이 화면별로 따로 놀고, 최초 스플래시는 실제 웹 StudyCrack 로고가 아니라 임의 심볼을 사용하고 있었다.
- **변경**: 모바일 전용 루트 토큰을 더 부드러운 브랜드 블루 톤(`--bg #F6F8FE`, `--primary-soft #EEF4FF`, `--line #D8E3F4`)으로 조정하고, 주요 카드/요금제/결제/분석 로딩/잠금 오버레이 표면에 공통 보더·섀도·soft-blue 배경을 적용했다. 스플래시는 임의 번개/카드 마크를 제거하고 실제 `studycrack_logo_wo_bg.png` 로고와 `mascots/crack_hi.png` 크랙이를 함께 노출하도록 변경했다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. 로컬 프리뷰에서 스플래시 실제 로고/크랙이 이미지 로딩 완료, 기존 임의 심볼 DOM 제거, 새 배경 스타일 반영을 확인했다.
- **후속 보정**: 홈의 지원학과 AI 점수 카드에서 선택 드롭다운과 중복되던 기준 시험 보조 문구를 제거했다. 학습코칭/플래너 권한 부족으로 진입하는 `lockedFeature` 화면도 하단 탭바를 유지하도록 변경했다. 로컬 프리뷰에서 홈 기준 span 0개, 잠금 화면 하단 탭 5개를 확인했다.
- **후속 보정 2차**: 홈 지원대학 250점 게이지를 색 띠형 트랙에서 단정한 neutral track + 브랜드 단색 fill로 변경하고, 모의고사 변경 시 width transition을 명시했다. PRO/플래너 업그레이드 문구는 `PRO 리포트 미리보기`, `Standard부터`, `Standard 기능 보기`로 정리했다. 오늘 누적 공부 펼침 영역은 실제 `button` 렌더 구조에 맞춰 과목 row/detail row/빈 상태 스타일을 새로 적용했다.

---

## 2026-06-21 — 모바일 앱 UX 후속 2차: QnA·요금제·정성조사·분석 기준 정합성
- **진단**: 고객센터/SKY튜터 QnA 내역이 긴 카드형으로 세로 공간을 과하게 사용했고, 모바일 요금제에는 웹에 존재하는 Starter 플랜이 빠져 있었다. 정성조사서는 필드가 카드별로 쪼개져 글자 크기와 정렬이 입력 폼답지 않았다. 홈 지원학과 카드 점수는 서버 환산점수가 아니라 간이 평균 점수를 사용해 분석탭 환산점수와 달라질 수 있었다.
- **변경**: QnA/문의 내역을 목록형 row UI로 변경하고 긴 본문/답변은 한 줄 요약으로 접히게 했다. `PLAN_META`에 Starter를 추가하고, 요금제/결제 화면을 Basic/Starter/Standard/Pro 4단계로 정렬했다. 정성조사서는 단일 폼 카드 구조로 바꾸고 필드 라벨/타일/textarea 밀도를 낮췄다. 잠금 기능 오버레이는 화면 중앙 쪽으로 올리고, 홈의 PRO/플래너 진입도 실제 대상 화면을 타게 하여 `lockedFeature` 프리뷰 흐름을 사용하게 했다.
- **분석 정합성**: 백엔드 `StudyCrack_Analysis`는 이미 `examMode`별 스코어보드를 지원한다. 모바일 홈 카드가 서버 `converted_score`를 우선 사용하도록 변경하고, 홈/분석탭 모두 `scoreExamType` 선택기를 노출해 같은 시험 기준으로 환산되게 했다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. 로컬 프리뷰 390×844에서 `proIntro` 플랜 카드 4개, `payment` 탭 4개, `qualInfo` 필드 5개, `analysis`/`home` 기준 시험 선택기, 홈 PRO/플래너 target, `lockedFeature` 오버레이 위치, 콘솔 error 0건 확인.

---

## 2026-06-21 — 모바일 앱 UX 후속: 스플래시·잠금 프리뷰·플랜/결제/분석 로딩 정리
- **진단**: 최초 스플래시가 `og-image.jpg`를 로고처럼 필터 처리해 흰 사각 이미지 깨짐처럼 보일 수 있었고, Standard/Pro 잠금 탭은 사용자가 누른 기능 맥락 없이 요금제 화면으로 바로 이동했다. 플랜/결제 화면도 웹 `service.html`/`payment.html` 대비 가격·혜택 구조가 투박했고, 분석 로딩은 카드 전체를 skeleton으로 가려 화면이 깨지는 듯 보일 여지가 있었다.
- **변경**: 스플래시 로고 이미지를 CSS 기반 브랜드 마크로 교체해 이미지 경로 의존을 제거했다. 권한 부족 시 `lockedFeature` 화면으로 이동하도록 바꿔 학습코칭/플래너/PRO 기능 프리뷰를 흐리게 보여주고 Standard/Pro 전용 안내를 오버레이한다. 모바일 플랜/결제 화면은 웹 결제 기준 가격 행(정가/주간가/4주 총액)과 혜택 리스트 구조로 재정렬했다. 분석 화면은 별도 로딩 패널을 추가하고 기존 카드 skeleton 전면 가림을 해제했다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. 로컬 프리뷰 390×844에서 스플래시 이미지 태그 0개/흰 로고 박스 제거, `lockedFeature` 프리뷰+CTA 2개 렌더, `proIntro` 가격 카드 3개, `payment` 안전 결제 안내 표시 확인.
- **제한**: 브라우저 검사 환경에서 `localStorage`를 직접 조작할 수 없어 Basic 세션 탭 클릭을 실세션으로 재현하지는 못했다. 코드 경로는 `beforeGoto`가 권한 부족 시 `proIntro` 대신 `lockedFeature`로 이동하도록 변경됐으며, 실제 Basic/Standard 세션은 dev 배포 후 확인 필요하다.

---

## 2026-06-21 — 모바일 런타임 스위치: Babel/CDN 제거 + Vite 번들 실연결
- **변경**: 실제 `studycrack-mobile.html`에서 React UMD CDN, `@babel/standalone`, `type="text/babel"` 레거시 `js/studycrack-mobile.js` 로드를 제거하고, 프리뷰에서 검증하던 `js/config.js` → `js/shared/api.js` → `studycrack-mobile-app/dist/studycrack-mobile.bundle.js` 순서로 연결했다. 이로써 프로덕션 모바일 HTML도 모듈 런타임/Vite 번들을 사용한다.
- **배포 확인**: `.github/workflows/deploy.yml`은 이미 배포 시 `studycrack-mobile-app`에서 `npm ci && npm run build`를 수행하고, `studycrack-mobile-app/dist/*`를 `no-cache, no-store, must-revalidate`로 업로드한다. 따라서 dist는 gitignore 상태를 유지하고, 배포 때 산출물이 생성된다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. 로컬 `studycrack-mobile.html`을 390×844로 열어 온보딩 부팅, 12초 fallback 미발동, `?screen=my`, `?screen=proIntro` 직접 진입, 하단 탭 5개, 요금제 가격 정렬, 콘솔 error 0건 확인.
- **제한**: dev 실세션 스모크는 아직 별도 배포 후 필요하다. 특히 웹 로그인 쿠키 공유 → 모바일 진입 → 새로고침 → 로그아웃, 분석 API 200/403/503, Q&A/알림/리포트 실데이터 흐름은 dev에서 확인해야 한다.

---

## 2026-06-21 — 모바일 웹 정책 정합성 후속: 요금제·마이·문의·탭 게이트
- **진단**: 모바일 프리뷰의 요금제 금액/설명이 웹 `payment.html` 기준과 달랐고, 마이페이지에서 목표대학을 편집하는 모바일 전용 흐름이 남아 있었다. 고객센터는 이메일 문의 중심이라 웹 `/qna`의 직접 1:1 문의 흐름과 달랐으며, 권한 없는 하단 탭은 숨김 처리라 사용자가 기능 존재를 알기 어려웠다.
- **변경**: 모바일 모듈 소스와 레거시 단일 JS 모두 Basic/Standard/Pro 가격·기능을 웹 기준으로 정렬했다. 마이페이지/계정 정보에서 목표대학 편집·표시를 제거하고, 목표대학은 분석 탭에서 관리하도록 안내했다. 고객센터에는 1:1 문의 작성/문의 내역 표면을 추가하고 이메일 문의를 제거했다(레거시 단일 JS는 웹 `/qna`로 위임). 하단 탭은 모든 플랜에서 5개를 노출하고, 잠긴 Standard/Pro 기능은 요금제 안내로 유도한다.
- **검증**: `npm run check`, `npm run build` 통과. 로컬 프리뷰 390×844에서 마이페이지 목표대학 문구 제거, 고객센터 1:1 문의 작성/내역 노출, 이메일 문의 제거, Standard `49,000원 / 4주`, Pro `149,000원 / 4주`, Basic 기능 문구 반영 확인. 레거시/모듈/번들에서 오래된 문구(`299,000원`, `이메일 문의`, `목표 대학:` 등) 검색 0건.
- **제한**: 프리뷰 기본 mock 계정은 Pro라 잠금 안내 클릭 경로를 Basic 세션으로 직접 재현하지 못했다. 다만 탭 액션은 `beforeGoto`/권한 게이트를 경유하도록 코드 경로를 확인했고, Basic/Standard 실제 세션에서는 해당 분기로 이동한다.

---

## 2026-06-20 — 모바일 auth 최종 점검: 웹 로그인/회원가입 정책 정렬
- **진단**: 실제 웹 로그인/회원가입은 Google/Naver만 지원하고 약관은 웹 회원가입/소셜 콜백 약관 모달에서 처리하지만, 모바일 auth 표면에는 카카오/Apple 버튼 및 단일 런타임의 내부 fake 로그인/가입 완료 흐름이 남아 있었다.
- **변경**: 모바일 로그인/회원가입 화면의 소셜 버튼을 Google/Naver로 정렬하고, 회원가입 화면에는 웹에서 실제 입력받는 항목(이메일 인증, 비밀번호, 이름, 성별, 생년월일, 전화번호 인증, 유입 경로, 프로모션 코드)과 약관 전체/필수 4종/선택 마케팅 동의를 요약 표시했다. 실제 CTA는 모두 `/login?returnUrl=...`, `/signup?returnUrl=...`로 위임해 검증된 웹 인증/약관 플로우를 타도록 했다. 배포용 단일 JS(`js/studycrack-mobile.js`)와 분할 소스(`studycrack-mobile-app/src/screens/auth/renderers.js`)를 함께 정렬했다.
- **검증**: `npm run check`, `npm run build`, `git diff --check` 통과. 로컬 프리뷰 390×844에서 authLogin/authSignup 콘솔 오류 0건, overflow 0건, 카카오/Apple 노출 없음, Google/Naver만 노출 확인. CTA 클릭 시 각각 `/login?returnUrl=...`, `/signup?returnUrl=...` 이동 확인.
- **제한**: `studycrack-mobile.html`은 React/Babel을 외부 CDN에서 불러와 로컬 브라우저 검증이 CDN 접근 제한에 막힘. 실제 배포용 단일 JS는 정적 문자열/핸들러 검사로 확인하고, 화면 검증은 자기완결 번들 프리뷰로 수행했다.

---

## 2026-06-20 — 모바일 ↔ 웹 디자인 통일 D5: 스크린샷 검증
- **검증 범위**: 로컬 프리뷰(`studycrack-mobile-preview.html`)를 390×844 모바일 뷰포트로 열고 `home`, `analysis`, `planner`, `my`, `authLogin` 화면을 캡처했다.
- **결과**: 5개 화면 모두 콘솔 에러 0건. 대표 버튼/카드/입력/탭바 스타일이 D4 목표값(`card shadow 0 2px 8px`, `button shadow 0 3px 8px`, radius 12/16px 중심)으로 반영됐다. 자동 overflow 검사에서도 버튼/카드/주요 패널 텍스트 밀림 0건. `analysis`는 초기 700ms 캡처가 스켈레톤 상태라 3.5초 후 최종 상태를 재캡처했다.
- **제한**: 웹 대표 페이지 병렬 캡처는 로컬 정적 서버에서 clean URL rewrite(`/login`)가 없어 404로 제한됨. 웹 비교는 기존 `style.css` 토큰 기준과 모바일 계산 스타일 기준으로 대체했다.

---

## 2026-06-20 — 모바일 ↔ 웹 디자인 통일 D4: 컴포넌트 밀도 정렬
- **진단**: D3 이후 radius는 정리됐지만 카드/CTA/입력/배지의 shadow·패딩·focus ring은 여전히 앱형으로 강했다. 특히 `--shadow-soft`, `--shadow-card`, `--card-shadow-primary/secondary`와 하단 override가 반복적으로 큰 elevation을 부여했다.
- **변경**: 모바일 전용 CSS와 V2 CSS에서 공통 카드 shadow를 낮추고, CTA/버튼 shadow는 웹 primary 기준의 얕은 그림자로 정렬했다. 온보딩 카드/CTA, 분석/결제/코칭 카드, planner sheet, premium CTA, 입력 focus ring, pill 선택지의 패딩과 보더 밀도를 줄였다. 랭킹 티어/모달/프레임처럼 의도적으로 떠야 하는 표면은 유지했다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 다음 단계는 D5 스크린샷 기반 home/analysis/planner/my/auth 시각 검증.

---

## 2026-06-20 — 모바일 ↔ 웹 디자인 통일 D3: radius 스케일 정렬
- **진단**: D2 이후에도 모바일 화면의 카드/패널/모달/시트가 18~32px 반경을 다수 사용했고, 하단 `Premium UI Polish System`의 `--card-radius: 24px`가 앞선 카드 반경을 다시 크게 덮어쓰고 있었다.
- **변경**: `css/studycrack-mobile.css`와 `studycrack-mobile-app/src/styles/design-v2.css`에서 카드/패널/모달/시트/주요 CTA를 `--radius-sm/md/lg` 체계로 정렬했다. 프레임·홈/분석/코칭/결제/랭킹/대학추가/로딩 카드의 과한 라운드를 `--radius-lg` 중심으로 낮추고, 차트 막대는 `--radius-md`/`--radius-sm` 조합으로 정리했다. pill(999px), 원형, 작은 아이콘/배지는 유지했다.
- **검증**: 18px 이상 카드 반경 검색 결과 0건. `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 다음 단계는 D4 컴포넌트 밀도(버튼/카드/입력/배지 패딩·보더·섀도) 정렬.

---

## 2026-06-20 — 모바일↔웹 디자인 통일 분석/계획 (스위치 전 선행)
- **배경**: 런타임 스위치 시 모바일 디자인이 프로덕션이 됨 → 스위치 전 웹과 통일 필요. 모바일이 웹과 느낌이 크게 다름.
- **정량 분기 진단**: 폰트(웹 **Paperlogy** vs 모바일 **Pretendard**), primary(웹 `#4c79ee` vs 모바일 `#2563EB`+그라디언트), text(`#2c2c2c` vs `#0F172A`), card(`#f1f4fb` vs `#fff`), **radius(웹 4~12 샤프 vs 모바일 12~24 라운드)**, 버튼(단색 vs 그라디언트).
- **원인**: 모바일 V2(design-v2.css)는 모놀리식 designV2StyleTag에서 추출된 독립 재디자인 → 웹과 별도 진화(공유 토큰 없음).
- **방향**: **모바일 → 웹 정렬**(강제). `css/style.css`=23개 페이지 블라스트라 웹 변경 금지, 모바일 CSS만 변경.
- **계획**: `docs/exec-plans/completed/260620_mobile_web_design_unification.md` — D0(토큰)→D1(폰트)→D2(색)→D3(radius)→D4(컴포넌트)→D5(검증). **착수 전 4개 결정 필요**(폰트 통일/ radius 철학/ 그라디언트/ 통일 강도).

---

## 2026-06-20 — R6b: 알림 읽음 처리 + 권한 정책 확인 (커밋 `9bb8772`)
- **알림 mark-read**: 모달 열릴 때 미읽음이 있으면 낙관적 업데이트(notiList isRead=true) + 서버 `student_read_notification`(`notiId='all'` 일괄). `persistence.markMobileNotificationsRead` + main.js `notifModalOpen` effect.
- **Basic/Standard 권한 정책은 이미 완료 확인**(`de629b0`): `main.js` `PLAN_RANK`(free/trial=0, basic/starter=1, standard=2, pro=3) + `SCREEN_REQUIREMENTS`(strategy/planner/weekly=standard, report/proElite/tutor=pro) + `getEffectiveTier`(userTier←get_user computedTier) → `canAccessStandard`/`canAccessPro`로 화면·탭·시뮬레이션 게이팅. 추가 작업 불필요.
- **검증(프리뷰)**: 빈 목록일 때 read 호출 없이 no-op, 회귀 없음. happy-path는 dev 세션 필요. `npm run check`(64)+`vite build`.
- **백엔드 데이터 통합 사실상 완료** — 남은 건 R7(실 dev 스모크 + 최종 런타임 스위치=프로덕션 컷오버, 명시 승인 필요).

---

## 2026-06-20 — R6a: 모바일 알림 서버 연결 (커밋 `1b115e8`)
- **진단**: 홈 알림 모달이 하드코딩(주간 코칭/PRO 리포트/플래너 고정 3개)이라 실제 알림과 무관했다. 백엔드 `/api/noti` `student_get_notifications`는 이미 제공(Lambda 수정 불필요).
- **변경**(qna/리포트와 동일 패턴): `persistence.js`에 `fetchMobileNotifications`/`normalizeNotifications`, `app-state.js`에 `notiList`/`notiStatus`, `main.js`에 `getNotiApiBinding` + 쿠키 세션 시 1회 로드 effect(미인증 스킵), `renderNotificationModal`이 `notiList`를 렌더(빈/로딩/에러 안내, 서버 title/body는 `escapeHtml`로 XSS 방지). 호출부(renderHomeView·HomeScreen.jsx) ctx 전달.
- **검증(프리뷰)**: 미인증 시 `/api/noti` 0회·하드코딩 제거·"새 알림 없음"; 세션 시뮬 시 `student_get_notifications` 1회 발사 후 localhost 실패→"불러오지 못했습니다" graceful. 실알림 렌더는 dev 세션 필요. `npm run check`(64)+`vite build`. 변경 전부 `studycrack-mobile-app/` 한정.
- **다음(R6b)**: dev 세션 스모크(분석 200/403/503·인증 1사이클), Basic/Standard 권한 표시 정책, 알림 mark-read, 최종 런타임 스위치.

---

## 2026-06-20 — 모바일 ↔ 웹 디자인 통일 D2: 색·CTA 평탄화
- **진단**: D0/D1 이후에도 모바일 CSS 하단의 중복 `:root` 블록들이 vivid blue/purple 토큰으로 다시 덮어쓰고 있었다. 또한 주요 CTA와 PRO/분석/플래너 프리미엄 버튼에 보라/파랑 그라디언트와 shimmer가 남아 웹 버튼 톤과 어긋났다.
- **변경**: 모바일 전용 CSS의 중복 토큰 블록을 웹 기준 primary/text/card 값으로 재정렬하고, vivid blue/purple literal을 토큰 참조로 치환했다. `btn-primary`, `cta-button`, `analysis-convert-btn`, PRO 요청/상단 버튼, 플래너 프리미엄 CTA는 primary 또는 primary-dark 단색으로 평탄화하고 버튼성 shimmer pseudo-element를 제거했다. 차트/등급/로딩 skeleton의 의미성 그라디언트는 D4/D5 시각 검증 대상으로 남겼다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 대상 모바일 CSS/HTML에서 vivid blue/purple literal, Pretendard, Google Fonts 참조 제거 확인. 다음 단계는 D3 radius 스케일 정렬.

## 2026-06-20 — 모바일 ↔ 웹 디자인 통일 D0/D1: 토큰·폰트 정렬
- **진단**: 모바일 기본 CSS는 Pretendard, vivid blue/purple, white card, 쿨 슬레이트 텍스트를 사용해 웹 `style.css`의 Paperlogy, soft primary, warm text, blue-gray card 토큰과 분리되어 있었다. 프리뷰/런타임 HTML도 Google Fonts Pretendard를 로드하고 있었다.
- **변경**: 모바일 전용 `css/studycrack-mobile.css`의 루트 토큰을 웹 기준 primary/purple/text/card와 radius 스케일로 정리하고, body 폰트를 `Paperlogy` 계열로 바꿨다. `studycrack-mobile.html`/`studycrack-mobile-preview.html`의 폰트 링크를 Paperlogy jsdelivr로 교체하고 불필요한 Google Fonts preconnect를 제거했다. V2 CSS의 직접 Pretendard 지정은 `inherit`로 변경했다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 대상 모바일 파일에서 `Pretendard`, `fonts.googleapis`, `fonts.gstatic` 참조 제거 확인. 다음 단계는 D2 색/버튼 평탄화.

## 2026-06-20 — 모바일 인증 표면 정리: 내부 fake 가입 폼 제거
- **진단**: 모바일 인증 핸들러는 이미 웹 `/login`·`/signup`으로 위임하지만, 렌더러에는 이메일/전화번호 인증과 약관 동의를 모바일 내부에서 완료할 수 있는 것처럼 보이는 가입 폼이 남아 있었다. 직접 가입 버튼도 fake 인증 상태에 따라 비활성화되어 실제 웹 가입으로 이동하지 못할 수 있었다.
- **변경**: 모바일 로그인 화면은 입력 폼 대신 웹 로그인 CTA로 정리하고, 소셜 로그인 버튼도 동일하게 웹 로그인으로 위임한다. 모바일 회원가입 화면은 웹 회원가입 CTA 표면으로 바꾸어 약관 동의, 전화번호 인증, 소셜 가입을 검증된 웹 가입 화면에서 처리하게 했다. 직접 진입 가능한 아이디/비밀번호 찾기 화면의 정적 입력 폼도 로그인 화면의 실제 모달로 안내하도록 정리했다. 더 이상 쓰이지 않는 fake 가입 인증 핸들러, signup/login 입력 state, 특정 이메일 찾기 fallback도 제거했다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 직접 렌더 테스트로 authSignup의 fake 인증 폼, authLogin의 가짜 이메일/비밀번호 입력, authFindId/authFindPw의 정적 입력 폼 제거 확인. 검색으로 fake 가입 인증 액션/문구와 특정 전화번호 fallback 제거 확인.

## 2026-06-20 — 모바일 주간 점검 첨부 파일 업로드 연결
- **진단**: 모바일 코칭 시트의 플래너/모의고사 사진 선택은 로컬 File 객체만 보관하고 서버 저장 payload에는 포함하지 않았다. 백엔드 `StudyCrack_FileService`는 `planner`, `mock_exams` 폴더에 대한 presigned POST를 이미 제공하므로 Lambda 수정 없이 연결 가능했다.
- **변경**: `/api/file` `get_presigned_url`로 선택 파일을 S3에 업로드한 뒤, 플래너 사진 URL은 `plannerFiles`, 모의고사 사진 URL은 `mockExam.proofFile/proofFiles`에 담아 `save_weekly_check` payload로 저장한다. 파일 업로드 실패 시 주간 점검 제출을 중단하고 오류를 표시한다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 직접 테스트로 presigned payload, S3 FormData 업로드 순서, weekly payload URL 반영, 업로드 실패 분기 확인.

## 2026-06-20 — 모바일 학습 코칭 제출 저장 연결
- **진단**: 모바일 `strategy`의 코칭 시트는 주간 점검 읽기 API와 분리되어 있었고, 완료 버튼은 서버 저장 없이 제출 alert만 띄웠다. 또한 모듈 런타임에는 코칭 단계 본문 렌더와 기본 과목 행 자동 채움이 제대로 연결되지 않아 실제 작성 흐름이 불완전했다.
- **변경**: 코칭 8단계 본문을 모듈 renderer에 연결하고, 플래너/공부기록 기반 기본 과목 행을 자동 생성한다. 완료 시 `/api/report` `save_weekly_check`로 학습 달성도, 모의고사 응시 정보, 추이, 단계별 답변을 저장하고, 응답 성공 시 `weeklyReports` 목록에 즉시 반영한다. 현재 모바일 파일 선택은 S3 업로드가 아니므로 사진은 선택 사항으로 낮추고 저장 payload에는 포함하지 않는다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 직접 테스트로 payload 생성, 코칭 저장 성공/실패 분기, 기본 과목 행 생성, 단계 렌더 escape 확인.

## 2026-06-20 — 모바일 PRO 리포트 요청 저장 연결
- **진단**: 모바일 `report`/`proElite`의 리포트 목록은 실제 API를 읽지만, `전략 리포트 요청하기`는 alert만 띄우고 서버에 저장하지 않았다. 사용자는 요청이 접수된 것으로 오해할 수 있고, 튜터/관리자 화면에는 아무 요청도 생기지 않는 상태였다.
- **변경**: `/api/report` `request_pro_report`를 호출하는 모바일 저장 헬퍼를 추가하고, 요청 모달 제출 시 서버 저장 후 같은 `reportKey`의 pending 리포트를 목록에 즉시 반영한다. 제출 중 중복 클릭을 막고, 서버/네트워크 오류는 alert로 표시한다. 요청 textarea도 HTML escape 처리했다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 직접 테스트로 payload, 성공 시 목록 prepend, 실패 alert, textarea escape 확인.

## 2026-06-20 — 모바일 SKY튜터 Q&A 표면 정리: 실제 QnA API 연결
- **진단**: 모바일 `tutor` 화면이 실제 질문 내역과 무관하게 고정 예시 질문/답변을 보여주고 있었다. 백엔드 `StudyCrack_QnaChat`는 이미 학생용 `get_qna_list`와 `save_qna`를 제공하므로 모바일에서 정적 목업을 유지할 이유가 없었다.
- **변경**: 세션이 있을 때 `/api/qna` `get_qna_list`를 호출해 `qnaHistory` state에 저장한다. 튜터 화면은 실제 질문 제목/내용/답변 상태/답변 내용을 렌더링하고, `새 질문 작성` 모달은 `save_qna`로 저장한 뒤 목록에 즉시 반영한다. 사용자/서버 문자열은 HTML escape 처리한다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 직접 테스트로 `get_qna_list` 정규화, 빈 상태, 답변 완료 렌더, 정적 예시 문구 제거, 작성 핸들러 성공/실패 분기 확인.

## 2026-06-20 — 모바일 학습 코칭/주간 점검 표면 정리: 실제 weekly API 연결
- **진단**: 모바일 `strategy`/`weekly` 화면이 실제 `StudyCrack_WeeklyReports` 데이터와 무관하게 수행률 82%, 목표 90%, 과목별 정적 피드백, 월별 PDF 리포트 목록을 보여주고 있었다. 백엔드 `get_weekly_reports`는 학생 본인 조회 시 튜터가 최종 제출하지 않은 draft 피드백을 숨기므로 모바일에서 안전하게 읽을 수 있다.
- **변경**: 세션이 있을 때 `/api/report` `get_weekly_reports`를 호출해 `weeklyReports` state에 저장한다. 학습 코칭 화면은 실제 제출 이력/피드백 도착 상태만 표시하고, 주간 점검 화면은 최신 주간 리포트의 튜터 피드백만 렌더링한다. 정적 수행률/정적 과목 피드백/월별 PDF mock 목록과 관련 상수·핸들러를 제거했다. 서버 문자열은 HTML escape 처리한다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 직접 테스트로 `get_weekly_reports` 응답 정규화, 빈 상태, 튜터 피드백 렌더, 정적 문구 제거, XSS escape 확인.

## 2026-06-20 — 모바일 PRO 리포트 표면 정리: 실제 목록 API 연결/정적 PDF 제거
- **진단**: 모바일 `report`/`proElite` 화면이 실제 `StudyCrack_ProReports` 데이터와 무관하게 고정 날짜, 고정 상세 리포트, 정적 샘플 PDF를 보여주고 있었다. `get_pro_reports`는 이미 학생용 안전 응답(`key`, `reportLink`, `status`, `updatedAt`)을 제공하므로 모바일에서 mock 목록을 유지할 이유가 없었다.
- **변경**: 세션이 있을 때 `/api/report` `get_pro_reports`를 호출해 `proReports` state에 저장한다. PRO 리포트 화면은 실제 발행 목록만 표시하며, `reportLink`가 있는 `sent/published` 항목만 다운로드 가능하게 했다. 정적 샘플 PDF fallback과 고정 리포트 상세 내용을 제거하고, 직접 상세 화면 진입 시 목록에서 실제 PDF를 선택하라는 안내만 표시한다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 직접 테스트로 `get_pro_reports` 응답 정규화, 실제 링크/준비 중 렌더 분기, 다운로드 링크 없음 alert, 정적 샘플 문구 제거 확인.

## 2026-06-20 — 모바일 결제 표면 정리: checkoutPlan 분리/가짜 완료 제거
- **진단**: 모바일 앱의 결제 화면이 `selectedPlan`을 현재 구독 플랜과 결제 후보 플랜으로 동시에 사용하고 있어, 결제 카드를 눌러보는 것만으로 마이페이지의 현재 플랜 표시가 바뀔 수 있었다. 또한 앱 내부 `paymentComplete` 화면은 실제 NICEPAY 결제 없이 완료처럼 보이는 위험한 mock 표면이었다.
- **변경**: 현재 구독 표시는 `selectedPlan`으로 유지하고, 결제 화면 선택값은 `checkoutPlan`으로 분리했다. 모바일 결제 CTA는 내부 완료 화면으로 이동하지 않고 기존 웹 `/payment?source=mobile_app`로 이동시켜 전화번호 확인, checkoutData 생성, NICEPAY 인증은 검증된 웹 결제 플로우가 담당한다. 직접 `paymentComplete`에 진입해도 완료 문구 대신 웹 결제 페이지 이동 안내만 표시한다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 직접 렌더/핸들러 테스트로 `selectedPlan` 기본값 유지, `checkoutPlan` 선택 반영, `openWebPayment` 이동 URL, fake 완료 문구 제거 확인.

## 2026-06-20 — 모바일 분석탭 후속 마무리: 시뮬레이션 mock 제거/도달 성적 정리
- **진단**: Basic 계정 또는 `simulate_score_rise` 권한/응답이 없는 상태에서도 분석탭의 `최소 노력 대비 합격 도달 성적`, `합격 가능성 변화`, `성적 변화 시 가능한 대학`이 예전 mock/휴리스틱 숫자로 채워질 수 있었다. 특히 도달 성적 카드는 서버 시뮬레이션과 무관하게 과목별 자체 공식으로 점수를 올려 실제 데이터처럼 보였다.
- **변경**: 시뮬레이션 결과가 없으면 mock sim row를 만들지 않고 빈/잠금 상태로 분리했다. 도달 성적 카드는 서버 `simulate_score_rise.sim_data`의 과목별 효율 상위 2개를 기준으로 목표 원점수를 산정하며, 표기상 혼동을 줄이기 위해 총점 문구를 `AI 점수`/`예상 AI 점수`로 정리했다. 하드코딩된 가능 대학(국민대/숭실대/세종대)은 제거하고 실제 분석 대상 기반으로만 렌더링한다.
- **검증**: `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과. 렌더러 직접 테스트로 Basic 잠금, Standard 시뮬레이션 없음, Standard 시뮬레이션 있음, target score 합격선 산정 케이스 확인.

## 2026-06-20 — 모바일 dev 스모크 후속 수정: 성적 표시/플랜 게이트
- **진단**: dev Basic 계정에서 로그인/세션, 대학 추가, `analyze_my_targets`는 정상. 다만 성적정보 화면은 DB `quantitative`의 시험별 `std/pct/grd`를 직접 표시하지 않고 모바일 간이 공식/로컬 저장소 값을 보여주고 있었고, 입력하지 않은 시험에도 이전 점수가 남아 있었다. 마이페이지에는 실제 Basic 배지와 별도로 `Pro 플랜 이용 중` mock 카드가 하드코딩되어 있었다.
- **변경**: 성적정보 표가 선택 시험의 DB `quantitative[scoreExamKey]`를 우선 표시하도록 수정. DB에 없는 시험을 선택하면 점수 칸은 모두 `-`로 비운다. Basic 계정에서는 하단 탭에서 `학습 코칭`/`플래너`를 숨기고, 해당 기능 직접 이동 시 Standard 이상 안내 후 요금제 화면으로 보낸다. 마이페이지 구독 카드는 실제 `selectedPlan` 기준 문구로 변경.
- **검증**: 로컬 Basic mock 프리뷰에서 5월 성적은 서버 `std/pct/grd` 그대로 표시, 6월 미입력 성적은 전부 `-`, 마이페이지 Pro 하드코딩 제거, Basic 하단 탭 `홈/분석/마이`만 표시, console error 0 확인. `scripts/check-source.mjs`, `vite build`, `git diff --check` 통과.

## 2026-06-19 — R5a 완료: 모바일 대학 검색 서버 카탈로그 연결
- **변경**: 모바일 런타임이 세션이 있을 때 `/api/analysis`의 `get_univ_list_only`를 호출해 대학/학과 카탈로그를 받아오고, `univName + majors[]` 응답을 `서울대학교 경영대학` 형태의 검색 후보로 정규화한다.
- **보강**: API 카탈로그가 있으면 검색 결과는 서버 카탈로그 기준으로만 구성하고, 정적 추천 후보는 추천 카드 영역에만 남도록 분리했다. 대학 검색 입력/검색 버튼이 실제 `analysisSearchTerm` state를 갱신하도록 연결해 분리 런타임에서도 필터링이 즉시 동작한다.
- **검증**: 로컬 Vite 프리뷰 mock 세션에서 `get_user_analysis` + `get_univ_list_only` 호출 확인, `전산` 검색 시 `카이스트 전산학부`만 남고 console error 0 확인.
- **다음(R5b 후보)**: `analyze_my_targets`/`convert_score` 기반 분석·합격 예측 실데이터화, 또는 리포트/결제/알림 유료 기능 API 연결.

## 2026-06-19 — R5b 완료: 모바일 분석 API 1차 연결
- **변경**: 모바일 런타임이 실제 정량 데이터(`user.quantitative[scoreExamKey]`)와 목표대학을 바탕으로 `/api/analysis` `analyze_my_targets`와 `simulate_score_rise`를 호출한다. `scoreExamKey`를 state에 추가해 5월/6월 등 선택 시험 기준 `examMode`가 API에 정확히 전달되도록 했다.
- **보강**: 분석 화면 derived가 서버 `converted_score`/`status`/`color`를 우선 사용하고, 시뮬레이션 탭의 과목별 효율 row는 `simulate_score_rise.sim_data`를 우선 사용한다. 시뮬레이션 권한이 없거나 응답이 비어 있으면 기존 mock derived로 graceful fallback한다.
- **검증**: `scripts/check-source.mjs`(64 files), `vite build`(85 modules), `git diff --check`, 로컬 브라우저 mock 세션에서 `analyze_my_targets`/`simulate_score_rise` 호출 및 summary 서버 점수/상태(`142점`, `안정 (A)`) 반영 확인. derived 직접 검증으로 `수학 +6.7점` 추천 row 및 대학별 바 데이터 반영 확인.
- **다음(R5c 후보)**: 실제 dev 세션에서 분석 API 200/403/503 케이스 스모크, Basic/Standard 권한별 시뮬레이션 노출 정책 정리, 리포트/결제/알림 API 연결.

## 2026-06-19 — R4 완료: 모바일 데이터 write 저장 연결
- **변경**: 모바일 런타임에 `update_target_univs`/`update_quan`/`update_qual` 저장 헬퍼를 추가하고, 목표대학 추가·삭제, 마이 프로필 목표대학 수정, 성적 수정 저장, 정성조사서 저장 액션에서 서버 저장을 호출하도록 연결. 목표대학 문자열은 `{ univ, major, date }` payload로 변환한다.
- **보강**: 성적 수정 모달 renderer를 모듈 런타임에 연결해 `성적 수정하기 → 6단계 → 저장` 플로우가 실제로 동작하게 했다. 탐구 선택지에 과탐 I/II 과목을 포함해 DB에서 읽은 `생명과학Ⅱ` 등도 그대로 유지된다. `qualitative`도 boot 시 모바일 정성조사서 state로 병합한다.
- **검증**: `scripts/check-source.mjs`(64 files), `vite build`(85 modules), `git diff --check`, 로컬 브라우저 프리뷰 mock 세션 검증. `update_target_univs`, `update_quan`, `update_qual` payload 정상 및 console error 0 확인.
- **다음(R5 후보)**: 분석/리포트/결제 등 유료 기능 API 연결 또는 대학 검색/추천을 서버 데이터(`get_univ_list_only`) 기반으로 전환.

## 2026-06-19 — R3 완료: 모바일 실데이터 read 매핑 (성적·목표대학)
- **변경**: 모바일 boot 사용자 로드를 `get_user_analysis`로 확장하고, 응답의 `quantitative`/`targetUnivs`를 모듈 state에 병합. 최신 시험 우선순위(`active → jun → may → mar ...`)로 `scores`/`scoreState`/`scoreEditState`/`scoreExamType`을 구성하고, 목표대학은 문자열 리스트로 정규화해 `targetMajor`/`homeTargetList`/`analysisTargetList`에 반영.
- **효과**: 웹 로그인 세션이 있는 사용자는 모바일 홈/분석/성적정보에서 mock 성적·대학 대신 DB의 최신 성적과 목표대학을 읽어 표시한다. 값이 비어 있는 과목은 기존 state를 유지해 부분 데이터가 화면을 0점으로 덮지 않도록 했다.
- **검증**: `scripts/check-source.mjs`(63 files), `vite build`(84 modules), `git diff --check`, 로컬 브라우저 프리뷰 mock 세션 검증. 홈 이름/목표대학 2개, 성적 정보 표(국/수/영/탐1/탐2/한국사), 분석 대상 옵션 반영 및 console error 0 확인.
- **다음(R4)**: 성적 수정/목표대학 변경을 서버 `update_quan`/`update_target_univs`에 저장하고 실패 시 로컬 상태와 DB 상태가 어긋나지 않도록 처리.

## 2026-06-19 — R2 완료: 진짜 인증 게이트 (커밋 `bbede13`, `e630370`)
- **백엔드 연결 확정**(dev): 웹 로그인 후 모바일 진입 시 `get_user` 200 + 실데이터(예시학생/basic)가 화면 반영됨 — R1 바인딩으로 인사말/이름/등급 실데이터화 성공. 진단 표면 제거.
- **R2a**(`bbede13`): 세션 인지 부팅 라우팅 — 로그인(쿠키 세션)이면 온보딩 스킵하고 바로 home(실데이터), 미로그인은 on1.
- **R2b**(`e630370`): "계정 없이 로그인 통과" 제거 — 모바일 loginSuccess/ssoSuccess mock → 웹 `/login?returnUrl=<모바일경로>`, signupSuccess → `/signup`. `js/auth.js`에 로그인 성공 후 returnUrl 복귀 추가(open-redirect 방지: 동일 출처 절대경로만).
- **검증(프리뷰)**: 미로그인→온보딩 / 세션→home / 로그인 버튼→`/login?returnUrl=...` 리다이렉트. `npm run check`(63)+`vite build`+`auth.js node --check`.
- **⚠️ dev 스모크 의무**(auth.js 인증 변경): 머지 시 ① 모바일 로그인 버튼→웹 로그인→모바일 자동복귀 ② returnUrl 없는 일반 웹 로그인(정상 /로 이동) ③ 로그인→새로고침→로그아웃 1사이클.
- **다음(R3)**: get_user의 성적(`data.quantitative`)·목표대학(`data.targetUnivs`) 실데이터 매핑.

---

## 2026-06-16 — R1: 실데이터 UI 바인딩 + get_user 진단 (커밋 `7dd9018`)
- **R0(정적 분석)**: 웹 소비처가 읽는 get_user 실 필드명 확인 — `data.name`/`data.computedTier`/`data.qualitative`/`data.quantitative`/`data.targetUnivs`. → B3a 매핑(name/computedTier)은 **이미 정확**했음. 진짜 문제는 UI 바인딩 + 데이터 경로.
- **R1 변경**: ① `HomeScreen.jsx` 인사말 하드코딩 "지민님" → `state.user.name` 바인딩. ② `mapUserToStatePatch`: `computedTier`→`selectedPlan`(표시 통일)+`userTier`. ③ **진단 표면** `window.__scSession`/`window.__scGetUser` 추가.
- **검증(프리뷰)**: 인사말 state 기반 표시, 미인증 게이트 차단, 세션 시뮬 시 get_user 호출→Failed to fetch(CORS) 정확 기록. `npm run check`(63)+`vite build`.
- **다음(즉시)**: dev 재배포 → 모바일 진입(웹 로그인 상태) → 콘솔/주소창에서 `window.__scGetUser`, `window.__scSession` 확인 → 원인 3택(세션 미감지 / get_user 401·CORS / 데이터 오는데 바인딩) 확정 → 마무리.

---

## 2026-06-16 — 백엔드 결합 방향 전환: "진짜 연결" (계획 재작성)
- **dev 스모크 2차**: 웹 `/login` 로그인 후 모바일 진입해도 **데이터 전혀 반영 안 됨**(이름/등급 mock 유지). → 점진 "쿠키만 공유" 접근 한계 확인. 사용자 결정: **처음부터 제대로 된 실제 연결**.
- **진단(복합)**: ① 홈 인사말 "지민님"이 `HomeScreen.jsx`에 **하드코딩**, 마이 등급은 `selectedPlan` 읽는데 B3a는 `userTier`에 매핑 → **state↔UI 필드 불일치** ② get_user 실응답(상태/필드명) **미검증** ③ 로그인 자체가 여전히 mock.
- **재작성 로드맵**(`260616_mobile_backend_integration.md`): **R0** get_user 실응답 확정(선결) → **R1** UI 실데이터 바인딩(de-hardcode + 필드 통일) → **R2** mock 로그인 제거 + 게이트 → **R3** 전체 read → **R4** write → **R5** 분석/리포트/결제.
- **즉시 행동(R0)**: dev에서 실로그인 상태 get_user 응답(HTTP 상태 + 필드명) 확보 필요. 사용자 DevTools 캡처 공유 또는 dev 테스트 계정 제공 시 Chrome MCP 점검. 그 응답 기준으로 R1 진행.

---

## 2026-06-16 — dev 스모크 1차 결과 (모바일 앱 dev 배포 후 렌더 확인)
- **배포**: 사용자가 dev에 반영(원격 머지/push — 로컬 `dev-mobile-main`엔 머지 기록 없음, HEAD `e56d792` 유지). GitHub Actions 모바일 빌드+배포 동작.
- **1차 결과(사용자 확인)**: `dev.studycrack.co.kr/studycrack-mobile-preview.html`에서 모바일 앱이 **렌더됨("어느정도 뜸")**. → 번들이 dev에 정상 빌드·배포·로드되고, 공유 변경(config.js `window.CONFIG`, api.js public route)도 함께 반영됨. **백엔드 결합 토대가 실 dev 환경에서 구동 시작.**
- **미확정/후속 확인 필요**: ① `get_user` 200 + 실데이터(이름/등급이 mock 김지민/Pro → 실제로 대체되는지) ② 로그인→새로고침→로그아웃 1사이클 ③ 화면별 세부 동작/스타일 이상 여부. 구체 증상/스크린샷 확보 시 B3b(전체 데이터 매핑) 또는 버그픽스로 진행.
- **참고**: dev 웹(로그인 등)도 공유 파일 2개 반영 — 웹 로그인 1사이클 정상 여부도 함께 확인 권장.

---

## 2026-06-16 — 모바일 앱 dev 스모크 배포 플러밍 (커밋 `e56d792`)
- **목적**: B1/B2a/B3a 백엔드 결합을 실세션으로 검증하려면 모듈 앱이 dev에 배포돼야 함(현재 dev는 모놀리식 모바일만 서빙, 번들은 프리뷰 전용·gitignored).
- **변경**: `deploy.yml`에 모바일 빌드 스텝(Setup Node + `npm ci` + `npm run build`) 추가 → CI 파일시스템에 `dist/` 생성돼 S3 sync 포함. `node_modules` sync 제외. 번들 no-cache(+CF 무효화). `studycrack-mobile-preview.html` gitignore/info-exclude 해제 후 커밋(dev 진입점). 프로덕션 `studycrack-mobile.html`(모놀리식) 불변.
- **검증**: 로컬 `npm ci`+`vite build` 통과(CI 패리티 — 빌드 깨짐 없음 확인), deploy.yml YAML 유효.
- **핸드오프(배포는 사용자)**: `dev-mobile-main` → `dev` 머지(push) → GitHub Actions 배포 → `dev.studycrack.co.kr/studycrack-mobile-preview.html`에서 웹 `/login` 로그인 후 진입 → `get_user` 200/실데이터(name/tier mock 대체) + 로그인→새로고침→로그아웃 1사이클 스모크.
- **주의**: dev 머지 시 공유 파일 2개(config.js window.CONFIG, api.js public route)도 dev 웹에 반영 — 둘 다 additive 안전이나 웹 로그인 1사이클도 함께 확인 권장.

---

## 2026-06-16 — 모바일 백엔드 결합 B3a: 세션 인지 get_user 로드 (커밋 `125d773`)
- **변경**: `src/runtime/session.js`(`fetchCurrentUser`=apiFetch로 get_user POST, `mapUserToStatePatch`=name/computedTier 안전 최소 매핑) + `main.js` 1회 boot useEffect(`window.hasClientSession()`이면 fetch→patch). `app-state.js`에 `userTier` 필드.
- **가산형**: 쿠키 세션 있을 때만 실데이터 병합, 미인증/실패 시 데모(mock) 유지 → 회귀 없음.
- **검증(프리뷰)**: 미인증 시 `/api/user` 호출 0회·mock 유지; 세션 시뮬(localStorage.userId) 시 get_user 1회 발사 후 localhost CORS/가짜세션으로 graceful 실패·mock 유지·리다이렉트 없음. 실데이터 매핑은 dev 세션 필요. `npm run check`(63)+`vite build`.
- **⚠️ git 이슈 발견**: `.git/info/exclude`에 `studycrack-mobile-app/`가 있어(다른 브랜치용 로컬 제외) dev-mobile-main에서 **신규 파일이 조용히 누락**됨 → session.js를 `git add -f`로 복구. 신규 파일은 `-f` 필요(또는 해당 줄 제거 검토).
- **다음(B3b)**: get_user 전체 매핑(성적/대학) + dev 세션 검증.

---

## 2026-06-16 — 모바일 백엔드 결합 B2a: 쿠키 인증 apiFetch 재사용 (커밋 `97649c6`)
- **결정**: 인증 범위 **A(쿠키 세션 공유)**. 모바일은 웹과 동일 도메인이라 웹 로그인 쿠키를 공유 → 번들에 인증 재구현 없이 웹 `js/shared/api.js`(검증된 단일 출처) 재사용.
- **변경**: `js/shared/api.js`는 classic 스크립트라 top-level 함수가 window에 노출됨 → 모바일 HTML에 `config.js`→`api.js`→번들 순 로드. `main.js` ctx에 `apiFetch`/`hasClientSession`/`redirectToLogin` 주입. `PUBLIC_ROUTES_PREFIX`에 `/studycrack-mobile` 추가(미인증 강제 리다이렉트 방지, 앱 내부 게이트).
- **검증(프리뷰)**: window.apiFetch/hasClientSession 노출, 미인증 비리다이렉트, `apiFetch(get_user)`가 `/local/api/user`로 요청 발사 후 public route라 graceful reject(localhost CORS/미세션). `npm run check`(62)+`vite build`.
- **주의**: `js/shared/api.js`는 인증 모듈 — 변경은 additive(public route 면제)지만 **실인증 성공은 동일도메인 dev + 실세션 필요 → dev 스모크 의무**.
- **다음(B2b/B3)**: 로그인 게이트 UI(loginSuccess mock→웹 /login 유도), 이어서 `get_user`로 프로필/등급/대학 실데이터화.

---

## 2026-06-16 — 모바일 앱 백엔드 결합 착수: B1 Foundation (커밋 `7698e02`)
- **목적**: 모바일 앱을 데모(mock)에서 실제 백엔드 결합으로 전환. 전체 진단 + 로드맵은 `docs/exec-plans/completed/260616_mobile_backend_integration.md`.
- **B1 변경**: `js/config.js`에 `window.CONFIG = CONFIG` 노출(웹은 bare CONFIG라 무영향, 번들 IIFE가 읽도록). `main.js` ctx에 `authApiUrl`/`apiBase` 주입. 프리뷰 HTML에 config.js 로드(실제 런타임 studycrack-mobile.html은 이미 로드).
- **검증**: `window.CONFIG.api.auth`가 LOCAL URL로 노출, 아이디찾기 모달 find_email이 `/local/api/auth`로 실제 POST 발사(네트워크 확인). localhost origin CORS로 ERR_FAILED지만 게이트웨이 도달=배선 정상(동일도메인 dev/prod 통과 예상). `npm run check`(62)+`vite build`.
- **다음(B2)**: 웹 `js/shared/api.js`의 쿠키기반 `apiFetch`(401 refresh) 모듈 포팅 + 세션 인지(미인증 시 `/login` 유도). 인증 범위 결정(쿠키 세션 공유 A vs 자체 로그인 B) 선행.

---

## 2026-06-15 — studycrack-mobile-app Phase 7 시간 기반 화면 effect 연결
- **목적**: 새 런타임에서 원본 `useEffect`로 해제되던 상태가 빠져 화면이 멈춘 듯 보이는 문제 방지. 대상은 슬라이드 motion class, analysis ETA skeleton/loading, ob3/ob5 분석 오버레이.
- **변경**: `runtime/main.js`에 `homeSlideMotion` 420ms cleanup, `scoreSlideMotion` 380ms cleanup, analysis summary ETA `1→2→3` 타이머(1.5s/4.5s), analysis loading class 2s 해제, `ob3IsAnalyzing` 1.5s 해제 및 `ob5` 직접 진입 시 오버레이 즉시 해제 연결.
- **검증**: bundled Node `scripts/check-source.mjs`(62 source files), `vite build`(83 modules, bundle 362.13kB/gzip 113.39kB), `git diff --check` 통과. 로컬 Vite 프리뷰에서 analysis 초기 ETA/loading 표시 → 4.8s 후 ETA CTA/로딩 해제, `ob5` 직접 진입 loading overlay 없음, console error 0 확인.
- **다음 단위**: 스크롤 가드 보강 또는 잔여 문자열 화면 JSX 이관 → 최종 `studycrack-mobile.html` 스위치(+deploy.yml, 원본 인라인 designV2StyleTag 제거).

---

## 2026-06-15 — studycrack-mobile-app Phase 7 splash/onboarding 초반 진입 연결
- **목적**: 새 런타임 초기 상태 `screen:'splash'`가 registry 미등록으로 홈 fallback되는 문제를 해소하고, 원본처럼 `splash → on1` 첫 소개 화면으로 자동 진입하도록 연결.
- **변경**: `onboarding/renderers.js`에 `renderSplashScreen`/`renderOn1Screen`/`renderOn2Screen`/`renderOn3Screen` 추가, `screen-registry.js`에 `splash/on1/on2/on3` 등록. `runtime/main.js`가 모듈 로드 직후 및 mount effect에서 `window.__studycrackAppBooted`/`window.__studycrackAssetSrc`를 세팅하고, `screen === 'splash'`일 때 900ms 후 `on1`로 replace 이동.
- **검증**: bundled Node `scripts/check-source.mjs`(62 source files), `vite build`(83 modules, bundle 360.53kB/gzip 113.15kB), `git diff --check` 통과. 로컬 Vite 프리뷰에서 splash 노출 후 on1 자동 전환, on2/on3 직접 렌더, console error 0 확인. 페이지 내부 스크립트 기준 boot flag true 확인(브라우저 read-only evaluate의 `window` 커스텀 값은 격리되어 false로 보일 수 있음).
- **다음 단위**: 스크롤 가드/화면별 잔여 effect → 나머지 문자열 화면 JSX 이관 → 최종 `studycrack-mobile.html` 스위치(+deploy.yml, 원본 인라인 designV2StyleTag 제거).

---

## 2026-06-14 — studycrack-mobile-app Phase 7 onboarding 후반/score-journey 연결
- **목적**: 원본 온보딩 플로우의 `ob3 → ob4 → ob5` 후반 화면이 모듈 registry에 없어 fallback으로 흐르던 구간 복구. 동시에 analysis 요약/ob5에서 `scoreJourneyCard`가 제목만 보이던 누락을 공용 helper로 연결.
- **변경**: `components/score-journey.js` 신설(`renderScoreJourneyCard`, `scoreTierClass`), `runtime/main.js` ctx에 `scoreJourneyCard`/`scoreTierClass`/`updatePossibleUnivSlider` 주입, `runtime/derived.js`에서 `analysisTargetScore` 반환, `onboarding/renderers.js`에 `renderOb4Screen`/`renderOb5Screen` 추가, `screen-registry.js`에 `ob4`/`ob5` 등록.
- **검증**: bundled Node `scripts/check-source.mjs`(62 source files), `vite build`(83 modules), `git diff --check` 통과. 로컬 Vite 프리뷰에서 `?screen=ob4`, `?screen=ob5`, `?screen=analysis` 렌더 확인 — `ob5/analysis` score-journey 카드 표시, console error 0.
- **다음 단위**: splash/onboarding 초기 진입 effect(`splash → on1`, asset resolve/fallback) → 나머지 화면 JSX 이관 → 최종 `studycrack-mobile.html` 스위치(+deploy.yml, 원본 인라인 designV2StyleTag 제거).

---

## 2026-06-14 — studycrack-mobile-app Phase 7 analysis 화면 JSX 이관
- **목적**: JSX dual-mode 이관 3번째 화면. analysis는 요약/시뮬레이션 탭 전환과 검색 모달이 있어, 우선 화면 컨테이너·상단 탭을 React 트리로 올리고 본문/모달은 기존 문자열 renderer를 leaf로 임베드해 회귀 범위를 제한.
- **변경**: `src/screens/analysis/AnalysisScreen.jsx` 신설, `analysis/renderers.js`의 요약/시뮬레이션/검색 모달 helper export, `screen-registry.js`의 `MOBILE_SCREEN_COMPONENTS.analysis` 등록. `data-action`/`data-analysis-mode` 유지로 기존 위임 핸들러 불변.
- **검증**: bundled Node로 `scripts/check-source.mjs`(61 source files), `vite build`(82 modules, bundle 345.17kB/gzip 108.51kB), `git diff --check` 통과.
- **다음 단위**: score-journey 스와이프·splash/온보딩 init 플로우 등 잔여 effect → 나머지 화면 JSX 이관 → 최종 `studycrack-mobile.html` 스위치(+deploy.yml, 원본 인라인 designV2StyleTag 제거).

---

## 2026-06-14 — studycrack-mobile-app Phase 7 localStorage 영속 (커밋 `d9fbefc`)
- **목적**: 새로고침 간 상태 유지. 원본 `initializeApp`의 동기 로드분 + per-key 저장 effect 1:1(async 자산/온보딩 플로우 제외).
- **변경**: `app-state.js` `hydrateAppState(state, storage)`(scores/notifications 머지, plannerItems는 `normalizePlannerItems`, studyRecords/studySubjectRecords/selectedPlan/targetMajor/tab 대체 — createInitialAppState는 순수 유지, 런타임이 적용). `main.js` `createInitialAppStateWithScreenParam`가 하이드레이션 적용 + per-key 저장 `useEffect`(객체/배열은 `safeStringifySet`, 문자열 selectedPlan/selectedUniversity/activeTab는 raw setItem).
- **검증(프리뷰)**: 타이머 2s→정지 시 studyRecords 저장 → 새로고침 후 00:00:02 유지(하이드레이션), 플래너 완료 토글 저장 → 새로고침 후 done 유지(정규화 보존). `npm run check`(61)+`vite build`, 콘솔 에러 0.
- **다음 단위**: 잔여 effect(스크롤 가드·score-journey 스와이프·splash/온보딩 init 플로우) → 잔여 화면 JSX → 최종 `studycrack-mobile.html` 스위치(+deploy.yml, 원본 인라인 designV2StyleTag 제거).

---

## 2026-06-14 — studycrack-mobile-app Phase 7 고위험 effect: 라이브 타이머 + 슬라이더 제스처 (커밋 `f739ee9`, `9e4b049`)
- **목적**: JSX 기반(planner·home) 위에서 가장 위험한 effect 두 가지를 연결.
- **라이브 타이머(`f739ee9`)**: `src/runtime/timer-ops.js`(`createTimerOps` — setInterval 1s로 ref 증가 + `[data-study-base-seconds]` textContent 직접 갱신, state 미경유). `main.js` ctx 배선 + `buildDerivedContext(state, ref.current)`. `derived.js` `buildHomeDerived(state, liveStudySeconds)` — `todayStudySeconds=base+live`로 재렌더 시 표시/랭킹/진행률 일관, 활성 과목 breakdown에도 live 가산. 검증: 공부 시작→틱(00:00:02), 진행중↔대기 재렌더 중 유지, 정지 시 경과가 studyRecords 반영·ref 리셋·인터벌 정리.
- **슬라이더 제스처(`9e4b049`)**: `createGestureHandlers`는 있었으나 main.js가 `attachGestureListeners` 미호출 + ctx 의존값 누락이었음. `useEffect([events])`로 부착(매 렌더 새 ctx→스테일 방지, 홈 move는 DOM-direct라 thrash 없음), ctx에 touch refs(모듈 레벨)+`isIOSSafari`+`getHomeSliderState`(순수 DOM)+`setHomeSlideDom`(원본 DOM-direct→state 경유로 변경, JSX 트랙 유지한 채 transition). 검증(합성 PointerEvent): 왼쪽 스와이프→다음, 오른쪽→이전, 임계 미만→무변화.
- **핵심 교훈**: 원본의 DOM-direct 갱신(슬라이더)은 이 런타임의 state→DOM 재렌더와 충돌 → JSX 트랙 보존 + state 경유로 해소. rAF 의존(센터링/탭-스냅)은 헤드리스 미발화라 useLayoutEffect/직접호출로 견고화. setInterval은 헤드리스에서도 발화.
- **다음 단위**: 잔여 effect(localStorage 영속/스크롤 가드/score-journey 스와이프) → 잔여 화면 JSX → 최종 `studycrack-mobile.html` 스위치(+deploy.yml, 원본 인라인 designV2StyleTag 제거).

---

## 2026-06-14 — studycrack-mobile-app Phase 7 home 화면 JSX 이관 (커밋 `042bec0`)
- **목적**: JSX dual-mode 이관 2번째 화면. home의 보존 대상은 **KPI 슬라이더 트랙(`.home-kpi-track`)** — 문자열 경로는 매 setState마다 트랙을 재생성해 transform transition이 끊겨 슬라이드가 점프. JSX로 트랙 노드를 유지하면 transform(`--home-slide-x`) 변화에 CSS transition이 적용됨.
- **변경**: `src/screens/home/HomeScreen.jsx`(renderHomeView JSX 1:1 — 대학 카드/트랙/인디케이터/요약·목표·랭킹 카드는 React 노드, 오버레이·breakdown·탭바는 문자열 leaf), `home/renderers.js`(leaf 재사용 helper export), `screen-registry.js`(home 등록).
- **검증**: `npm run check`(60)+`vite build`. 프리뷰 `?screen=home` — 트랙 노드가 무관 재렌더/슬라이드 전환에도 **보존(sameNode)**, transform `-0→-1` 갱신(transition 적용), 시각 동일, planner 회귀 없음.
- **주의**: 초기 `splash` 화면은 `getScreenComponent('splash')=null`이라 **문자열 경로(splash→home fallback)** 로 렌더 → JSX HomeScreen은 home 탭 진입(screen='home') 시 사용. splash 자체의 JSX/전환은 후속 effect 단계.
- **다음 단위**: 잔여 화면 JSX 이관 또는 고위험 effect(라이브 타이머·제스처) → 공유 셸/오버레이 .jsx화 → 최종 `studycrack-mobile.html` 스위치.

---

## 2026-06-14 — studycrack-mobile-app Phase 7 JSX 실제-React-트리 전환 (planner 파일럿, 커밋 `ee855ae`)
- **목적/결정**: 셸이 `dangerouslySetInnerHTML`로 매 setState마다 화면을 통째 교체해 scrollLeft 등 imperative DOM 상태가 리셋되는 문제를, **정석(실제 React 트리/JSX)** 으로 해결. 한 번에 전부가 아니라 **planner 화면 dual-mode 파일럿**으로 시작.
- **변경**:
  - `src/screens/planner/PlannerScreen.jsx`(신규) — plannerMain을 JSX로 1:1 번역. 날짜 스트립을 진짜 React 노드로 두어 재렌더 간 scrollLeft 보존. 탭바·오버레이 시트는 스크롤 무관이라 기존 문자열 renderer를 leaf로 임베드(범위 한정). `data-action` 보존 → 위임 핸들러 불변.
  - `src/app/screen-registry.js` — dual-mode: `MOBILE_SCREEN_COMPONENTS`(JSX) + `getScreenComponent`. 미등록 화면은 문자열 경로 폴백(점진 이관).
  - `src/runtime/main.js` — 조건부 렌더(JSX 트리 vs 문자열 주입) + planner 센터링 `useLayoutEffect`(commit 후 동기, rAF 비의존 → 헤드리스 포함 전 환경 동작). ctx에 `dimmed`/`tabBarHtml` 추가.
  - `vite.config.js`(esbuild jsx 'automatic') / `scripts/check-source.mjs`(.jsx는 `vite build`가 검증, node --check 제외).
- **발견**: `requestAnimationFrame` 콜백은 헤드리스 프리뷰에서 안 발화 → 센터링을 rAF 대신 `useLayoutEffect` 동기 실행으로 바꿔 해결(더 견고). smooth 스크롤은 내부 rAF라 헤드리스에서 관측 불가하나 'auto' 초기 센터는 검증됨.
- **검증**: `npm run check`(60 .js) + `vite build`(78 모듈). 프리뷰 — 날짜 스트립 scrollLeft가 무관한 재렌더(달력 open/close)에도 **보존**(동일 노드 유지), 초기 진입 선택일 **센터(291)**, planner 시각/스타일 동일, home/my/analysis 문자열 화면 회귀 없음.
- **다음 단위**: 나머지 화면 JSX 점진 이관(home 슬라이더 등 스크롤/제스처 우선) → 탭바/오버레이 공유 컴포넌트 .jsx화 → 라이브 타이머 등 잔여 effect → 최종 `studycrack-mobile.html` 스위치(+deploy.yml, 원본 인라인 designV2StyleTag 제거).

---

## 2026-06-14 — studycrack-mobile-app Phase 7 스크롤 비-setter 연산 연결 (커밋 `7ed0e66`)
- **목적**: 비-setter 연산 중 안전 축(window 스크롤 보존 + 날짜 센터링 함수)을 연결. 라이브 타이머(setInterval+ref)는 effect 묶음으로 보류.
- **변경**: `src/runtime/scroll-ops.js`(`createScrollOps` — 원본 window 스크롤 헬퍼 1:1 이식, iOS 가드 ref는 모듈 레벨 holder). `main.js` ctx에 `preserveScroll`/`preserveScrollAfterStateChange`/`preserveY`/`afterSafariViewportStable`/`restoreIfUnexpectedTopJump`/`markStableScrollPosition`/`centerPlannerDate` 배선(핸들러 스텁 기본값 → 실제 구현).
- **발견(중요)**: 이 셸은 setState마다 `dangerouslySetInnerHTML`로 innerHTML을 통째 교체해 `scrollLeft`가 리셋됨(원본 React reconciliation은 보존). 그래서 `centerPlannerDate` 함수는 정확히 동작하나(date 14 목표 291 검증), **자동 센터링 트리거는 deps 미변경 재렌더 후 다시 안 돌아 사라짐** → 렌더 모델/스크롤 가드(고위험 effect) 묶음에서 해결 예정. `preserveScroll` 계열은 window 레벨이라 셸과 무관하게 즉시 동작.
- **검증**: `npm run check`(60), `vite build`, 프리뷰 — 날짜 선택(18→11)/렌더 회귀 없음.
- **다음 단위**: 고위험 effect(localStorage 영속 → 라이브 타이머 → 제스처 → 스크롤 가드/센터링 트리거) → HTML 스위치.

---

## 2026-06-14 — studycrack-mobile-app Phase 7 derived 잔여 이식 (커밋 `c17179b`)
- **목적**: "안전한 것부터" 원칙으로, 렌더러를 건드리지 않는 순수 state 파생분(home ranking/breakdown, score-info)을 채워 기본값 렌더를 실제 데이터로 교체.
- **변경**: `src/runtime/derived.js`
  - `buildHomeDerived` 확장: `todayRecord`/`todayStudySeconds`(정지 상태=누적 기록, 라이브 ref 미포함)/`todayPlannerProgress`/`todaySubjectsWithTimer`/`plannedScheduleOptions`/`breakdownSubjects`/`breakdownDetailMap`/`myRank`/`percentile`/`rankingProgress`/`rankTier`/`rankTierLabel`.
  - `scoreMetric` 헬퍼(원점수→표준/백분위/등급) + `buildScoreInfoDerived`(`scoreInfoDetailList` 표 본문 HTML, plannerViewDonutGradient 선례처럼 문자열 파생). `buildDerivedContext`에 합류.
  - `plannerBadges`는 impact-engine 서브그래프(topHighImpactSubject 등)라 별도 단위 보류(빈 배열 기본값=비파괴).
- **검증**: `npm run check`(59), `vite build`, 프리뷰 — score-info 표 7행 환산값 정확(82→표준100/백분위84/3등급), home breakdown 실항목(수학2/영어1/탐구1) 렌더, ranking 124등/BRONZE 회귀 없음.
- **다음 단위**: 비-setter 연산(스크롤/centerPlannerDate/라이브 타이머) → 고위험 effect → HTML 스위치. derived 잔여 중 plannerBadges/coaching 기본행은 impact-engine과 함께 후속.

---

## 2026-06-14 — studycrack-mobile-app Phase 7 design-v2 스타일 연결
- **증상**: `studycrack-mobile-preview.html`에서 폰트/정렬이 어긋나고 일부 버튼(예: `planner-add-cta`)·플래너 도넛 등이 무스타일로 렌더. 진단 결과 V2 재디자인 CSS(약 165개 클래스)가 원본 런타임 `js/studycrack-mobile.js`의 인라인 `designV2StyleTag`(<style> 주입, 1894~2184줄)에만 존재하고, 프리뷰가 로드하는 `css/studycrack-mobile.css`(V1)에는 없어서 모듈 renderer가 내보낸 V2 클래스가 전부 미적용이었음(리네임 회귀 아님).
- **변경**: `studycrack-mobile-app/src/styles/design-v2.css` 신설(인라인 블록 1895~2183줄 verbatim 추출, V1 뒤 로드되어 동일 specificity 우선). `src/runtime/main.js`가 `import '../styles/design-v2.css'` → Vite IIFE 빌드가 CSS를 번들에 주입(`createElement("style")`+`document.head.appendChild`, 원본 designV2StyleTag와 동일 메커니즘). 별도 `<link>` 불필요, 프리뷰 HTML 불변.
- **검증**: `npm run check` 59개, `vite build` 성공(323kB), 프리뷰에서 이전 미적용 클래스(`planner-add-cta`/`planner-date-item`/`planner-donut`/`planner-days-carousel`/`planner-item-main`) 전부 규칙 적용 확인, planner(날짜 캐러셀+도넛+CTA)·analysis(세그먼트 탭+결과 카드)·home 정상 렌더 스크린샷 확인.
- **다음 단위**: 비-setter 도메인 연산/고위험 effect 연결, `studycrack-mobile.html` 스위치(+deploy.yml 캐시 패턴).

### 후속: 마이 탭 home fallback 정정 (커밋 `959aa6b`)
- **증상**: 마이 탭이 홈과 동일 렌더. 원인은 screen id 불일치 — 탭은 `screen='my'`(원본/`MAIN_TAB_SCREENS` 동일)인데 모듈 레지스트리가 `myPage`로 등록 → fallback(home).
- **변경**: `src/app/screen-registry.js`의 `myPage` 키 두 곳(NAMES 배열 + renderer map)을 `my`로 정정. 원본 `screenRenderers`와 1:1 대조 결과 **이 하나만** 어긋났음(나머지 id 동일).
- **검증**: `npm run check`(59), `vite build`, 프리뷰 `?screen=my`에서 실제 마이페이지 렌더 확인.
- **알려진 잔여(별도 묶음)**: 초기 `screen:'splash'`는 레지스트리에 없어 home fallback(원본 splash는 타이머/effect 전환 → 고위험 effect 묶음에서 처리). 온보딩 `ob4`/`ob5` 미등록(ob1~3만 포팅).

---

## 2026-06-13 — studycrack-mobile-app Phase 7 Step 2-e (analysis derived)
- **변경(커밋 `a0368d3`)**: `derived.js`에 `buildAnalysisDerived`(analysisSelected+sim, 추천/검색, gauge, status, majorOptions, simRows, simulationTargets) 추가, `buildDerivedContext`가 planner+home+analysis 집계. 공유 `computeHomeTargets` 헬퍼 추출.
- **검증**: analysis 화면 요약/시뮬 렌더, gauge·sim 모놀리식 일치, home/planner 회귀 없음, 전체 32화면 throw 0, `npm run check` 59개, `vite build` 성공.
- **다음 단위**: 비-setter 연산(스크롤/타이머/refs), 고위험 effect(localStorage/타이머/제스처), HTML 스위치.

---

## 2026-06-13 — studycrack-mobile-app Phase 7 Step 2-d (home derived)
- **변경(커밋 `bad5eb6`)**: `derived.js`에 `buildHomeDerived`(liveCurrentScore, homeTargets 대학 카드, today 플래너 요약) 추가, `buildDerivedContext`가 planner+home 집계. 공유 헬퍼로 중복 제거.
- **검증**: home 화면 실제 대학 카드(score 73) 렌더, 전체 32화면 throw 0, planner 회귀 없음, `npm run check` 59개, `vite build` 성공.
- **다음 단위**: analysis derived(추천/시뮬레이션), home 잔여(ranking/breakdown), 비-setter 연산, 고위험 effect, HTML 스위치.

---

## 2026-06-13 — studycrack-mobile-app Phase 7 Step 2-c (전체 화면 렌더 검증 + planner derived)
- **목적**: 런타임 셸이 전 화면을 안전하게 렌더하는지 확인하고, 화면별 derived view-model 공급 시작.
- **변경(커밋 `a5ad1c8`)**: `src/runtime/derived.js`(`buildPlannerDerived`/`buildDerivedContext`, 모놀리식 플래너 계산 1:1 이식), `main.js`가 derived를 ctx에 spread.
- **검증**: 전체 화면 렌더 smoke **32개 throw 0/empty 0**, `npm run check` 59개, planner 화면 실제 항목 카드 렌더, `vite build` 성공.
- **다음 단위**: home/analysis derived 이식, 비-setter 연산(스크롤/타이머/refs), 고위험 effect, HTML 스위치.

---

## 2026-06-13 — studycrack-mobile-app Phase 7 Step 2-b (도메인 setter 일괄 연결)
- **목적**: 분리된 도메인 핸들러(auth/planner/profile/service/analysis)가 런타임 상태 컨테이너를 실제로 구동하도록 ctx setter 연결.
- **변경(커밋 `8a5078c`)**: `app-state.js`에 `createStateSetters`(상태 키 → `set<Key>` 자동 생성, 값/updater 함수 지원, 127개) 추가. `main.js`가 생성 setter를 ctx에 spread.
- **검증**: `npm run check` 58개, **dispatch→handler→setter→state 엔드투엔드 smoke**(`openProRequestModal`/`openDrawer`가 컨테이너 state 실제 변경), `vite build` 성공.
- **다음 단위**: 비-setter 연산(스크롤/타이머/refs) + 화면별 derived view-model 공급 → 고위험 effect → HTML 스위치.

---

## 2026-06-13 — studycrack-mobile-app Phase 7 Step 2 (상태 컨테이너 + 내비게이션 백본)
- **목적**: 런타임 셸이 모놀리식 `App()` state를 인수하도록 단일 상태 컨테이너와 내비게이션 백본을 구축.
- **변경(커밋 `671d703`)**:
  - `src/runtime/app-state.js`: `createInitialAppState()`(약 104+ 필드 컨테이너) + `createNavigationOps()`(순수 goto/back, history + 메인탭 동기화, node 테스트 가능).
  - `src/components/icon.js`: 원본 `i()` → `renderIcon` 이식.
  - `src/runtime/main.js`: `useReducer` 컨테이너 + 내비 백본 + 실제 셸 helper(icon/appbar/layout/tabbar, dimmed 계산) + 전체 action dispatch + input/change/blur 연결. 미연결 도메인 연산은 no-op.
- **검증**: `npm run check` 58개, nav node smoke(goto/back/탭동기화/history/no-op/fallback 정확), `vite build` 성공(287kB/gzip 94kB).
- **주의**: 화면별 derived view-model·localStorage/타이머/스크롤/제스처 effect는 미연결(후속). HTML 불변.
- **다음 단위**: 도메인 연산/setter 연결(저위험 모달·폼부터) → derived view-model 공급 → 고위험 effect 이관 → HTML 스위치(+deploy.yml).

---

## 2026-06-13 — studycrack-mobile-app Phase 7 착수 (상태 인벤토리 + Vite 스캐폴드)
- **목적**: 모듈 소스를 실제 런타임으로 구동하기 위한 빌드 파이프라인 + 런타임 셸 기반 마련. Phase 7은 "Vite 추가"만이 아니라 **모놀리식 `App()` state/effect를 모듈 소스로 이관(wiring)** 하는 작업까지 포함.
- **변경**:
  - `docs/exec-plans/completed/260613_phase7_app_state_inventory.md`: `App()`의 `useState ~104`/`useRef 27`/`useEffect 31` 도메인별 인벤토리 + 셸 이관 우선순위(고위험: 스크롤 가드/타이머/제스처).
  - `studycrack-mobile-app/`: `package.json`(react/react-dom/vite + dev/build/preview), `vite.config.js`(IIFE 단일 번들, dist/ gitignore), `src/runtime/main.js`(최소 React 셸, `createMobileAppKernel` 렌더 + data-action goto dispatch, **literal JSX 미사용**). 커밋 `7e3d6e0`.
  - `.gitignore`: `studycrack-mobile-app/dist/`(빌드 산출물) 추가.
- **검증**: `npm install` 성공, `npm run build` 성공(66 모듈 → 281kB/gzip 91kB, 번들에 renderer 마크업 포함), `npm run check` 56개 `node --check` 통과.
- **주의**: 당시 `studycrack-mobile.html`은 Babel standalone + 모놀리식 로드(불변)였고, HTML 스위치는 deploy.yml 캐시 패턴 확장과 함께 마지막 분리 커밋으로 미뤘다. 자립 사양: `docs/exec-plans/completed/260613_studycrack_mobile_app_phase7_build.md`.
- **다음 단위**: 셸 state 컨테이너 구축(저위험 폼/모달부터) + 전체 dispatch 연결 + localStorage 영속 effect 이관.

---

## 2026-06-13 — studycrack-mobile-app Phase 6 컴포넌트화(비-JSX) 1차 완료
- **목적**: 분리된 string renderer 위에 공용 컴포넌트 경계를 세워 중복 보일러플레이트를 제거하고, 화면별 renderer를 의미 단위로 정리(JSX 문법 전환 없이, 현 하네스로 검증 가능한 범위).
- **변경(커밋 묶음, `35e390f`~`ef6b6f4`)**:
  - `src/components/` 신설: `app-bar`, `app-shell`, `tab-bar`, `mascot-bubble`(공용 셸), `modal`·`sheet`(공용 오버레이), `terms-modal`·`grade-buttons`·`mbti-modal`(공유 조각) + `index.js` barrel. 모두 입력 주입형 순수 함수(문자열 반환).
  - `src/app/screen-registry.js`: 중복 인라인 셸 제거, default `appbar`/`layout`을 `renderAppBar`/`renderAppShell`로 교체, `renderMissingScreen` 중복 래퍼 정리.
  - `src/screens/onboarding/renderers.js`: ob1/ob2/ob3 공통 셸을 `renderOnboardingScreen`으로 단일화(3화면 출력 바이트 동일), MBTI 모달을 데이터 기반 `renderMbtiModal`로 추출.
  - 앱 전역 `home-modal`/`planner-sheet` 오버레이를 공용 `renderModal`/`renderSheet`로 통일: home(대학/알림/과목시트), mypage(프로필수정/로그아웃/회원탈퇴), service(PRO요청), planner(달력/수정 시트). drawer(`<aside>`)·coach-sheet(`<section>`)는 패턴 달라 제외.
  - `src/screens/planner/renderers.js`: 인라인 항목 카드를 `renderPlannerItemCard`로 추출.
  - 약관/학년 조각 dedup(auth·mypage·onboarding·profile 중복 제거), `GRADE_STATUS_OPTIONS` 상수를 `constants/options.js`로 승격.
  - `studycrack-mobile-app/README.md`, `src/README.md`: Phase 6 상태/컴포넌트 설명 갱신.
- **검증**: 매 커밋 `npm run check`(최종 **55개 소스** `node --check`) + 출력 **바이트/DOM 동일성** smoke + `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)·기존 웹 프론트는 변경하지 않음. `data-action` 계약·localStorage 키 불변.
- **다음 단위**: Phase 7(Vite/React 빌드 전환 + 모듈 소스 런타임 연결). 자립 사양: `docs/exec-plans/completed/260613_studycrack_mobile_app_phase7_build.md`.

---

## 2026-06-13 — studycrack-mobile-app Phase 5 앱 entry/screen registry 커밋·검증 완료
- **목적**: Phase 5 registry/kernel(`src/app/`)을 커밋하고 검증해 Phase 6 착수 기반 확정.
- **변경**: `src/app/`(`screen-registry.js`, `mobile-app.js`, `index.js`), `src/index.js` 커밋(`35e390f`). 모듈화 exec-plan의 Phase 번호 정리(registry=Phase 5, JSX=6, 빌드=7) 및 stale 상태 문구 갱신.
- **검증**: `npm run check`(45→55개 소스 증가), `git diff --check` 통과.
- **주의**: 런타임 미연결 상태 유지(준비 공간). `docs/`·CLAUDE.md는 `.gitignore` 대상이라 git 추적 제외(사용자 결정 "현 상태 유지").

---

## 2026-06-12 — studycrack-mobile-app Phase 5 앱 entry/screen registry 준비
- **목적**: 분리된 screen renderer와 handler group을 실제 앱 entry에서 조립할 수 있는 최소 kernel을 마련.
- **변경**:
  - `studycrack-mobile-app/src/app/screen-registry.js`: screen id별 renderer registry와 `renderMobileScreen` 추가.
  - `studycrack-mobile-app/src/app/mobile-app.js`: `createMobileAppKernel` 추가.
  - `studycrack-mobile-app/src/app/index.js`, `studycrack-mobile-app/src/index.js`: app/root barrel export 추가.
  - `README.md`, `src/README.md`: Phase 상태와 app 디렉토리 설명 갱신.
- **검증**: app kernel render/dispatch smoke와 정적 검사 예정.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 빌드 도구/Vite 준비 또는 실제 React entry 작성.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 handler group 조립
- **목적**: 분리된 domain handler들을 실제 App entry에서 한 번에 생성할 수 있도록 조립 레이어를 추가.
- **변경**:
  - `studycrack-mobile-app/src/handlers/mobile-handlers.js`: `createMobileActionHandlerGroups`, `createMobileActionHandlers`, `createMobileActionDispatcher`, `createMobileEventHandlers` 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: mobile handler 조립 레이어 export 연결.
  - `README.md`, `src/README.md`: Phase 상태와 handlers 설명 갱신.
- **검증**: mobile handler dispatcher smoke와 정적 검사 예정.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 앱 entry 생성 또는 런타임 전환 준비.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 gesture handler 분리
- **목적**: 홈 대학 카드 슬라이더와 성적 카드 swipe gesture를 모듈로 분리해 App 내부 `useEffect` 이벤트 바인딩을 줄임.
- **변경**:
  - `studycrack-mobile-app/src/handlers/gesture-handlers.js`: `startGesture`, `moveGesture`, `endGesture`, `cancelGesture`, `attachGestureListeners` 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: gesture handler export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: gesture handler smoke와 정적 검사 예정.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 handler group 실제 App dispatch 연결.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 form handler 분리
- **목적**: 대형 App 내부에 남아있는 `onInput`, `onChange`, `onBlur` 입력 이벤트를 handler 모듈로 분리해 dispatch 연결 전 마지막 이벤트 병목을 줄임.
- **변경**:
  - `studycrack-mobile-app/src/handlers/form-handlers.js`: 성적 숫자 제한, 파일 첨부, 대학 검색 live term, 회원가입 입력 검증, 코칭 row/answer 동기화, iOS Safari select 지연 동기화 handler 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: form handler export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: form handler smoke와 정적 검사 예정.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 handler group 실제 App dispatch 연결 또는 gesture/touch handler 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 analysis handler 분리
- **목적**: 분석/대학 검색/점수 view/슬라이더 action을 도메인 handler로 분리.
- **변경**:
  - `studycrack-mobile-app/src/handlers/analysis-handlers.js`: 분석 모드, 성적 view, 홈 슬라이드, possible-univ 슬라이더, 대학 검색/추가/삭제, 시뮬레이션 강조 handler 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: analysis handler export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: analysis handler smoke와 정적 검사 예정.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 handler group을 실제 App dispatch에 연결할지, 잔여 input/change handler 분리로 갈지 결정.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 service handler 분리
- **목적**: 서비스/결제/코칭/PRO 리포트 및 홈 공통 overlay action을 도메인 handler로 분리.
- **변경**:
  - `studycrack-mobile-app/src/handlers/service-handlers.js`: 요금제/기간 선택, 대학 모달, drawer/알림 모달, PRO 요청/다운로드, 코칭 요청 sheet handler 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: service handler export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: service handler smoke와 정적 검사 예정.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 analysis/home 잔여 action 또는 handler 통합 연결 검토.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 profile handler 분리
- **목적**: 성적 수정/정성조사/MBTI/프로필/설정 계열 action을 도메인 handler로 분리해, 후속 App 연결 시 프로필 관련 상태 변경을 한 파일에서 검증 가능하게 함.
- **변경**:
  - `studycrack-mobile-app/src/handlers/profile-handlers.js`: 성적 수정, 정성조사 저장, MBTI, 프로필 수정, 알림/FAQ, 로그아웃/탈퇴, 고객센터 handler 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: profile handler export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: profile handler smoke와 정적 검사 예정.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 service/home 잔여 handler 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 planner handler 분리
- **목적**: 플래너/공부 타이머 계열 action을 도메인 handler로 분리해, 후속 App 연결 시 `onClick` 대형 분기를 줄일 수 있게 함.
- **변경**:
  - `studycrack-mobile-app/src/handlers/planner-handlers.js`: 날짜/달력/수정 sheet, 과목/시간 선택, 항목 추가/삭제/완료, 공부 시작/정지, breakdown handler 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: planner handler export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, planner handler smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 profile/service handler 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 auth handler 분리
- **목적**: 대형 `onClick`에서 인증/회원가입 계열 action을 분리하기 위한 handler group 추가.
- **변경**:
  - `studycrack-mobile-app/src/handlers/auth-handlers.js`: 이메일 찾기, 비밀번호 재설정, 이메일/전화번호 인증, 약관 모달/동의, 회원가입 완료, 로그인/SSO 성공 handler 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: auth handler export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, auth handler smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 planner/profile/service handler 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 4 action dispatch/navigation handler 분리
- **목적**: 대형 `onClick`을 도메인별 handler로 나누기 위한 첫 단계로, 공통 action dispatch와 navigation handler contract를 앱 소스에 마련.
- **변경**:
  - `studycrack-mobile-app/src/handlers/action-utils.js`: action element/action 추출, overlay self-click, keep-scroll action 유틸 추가.
  - `studycrack-mobile-app/src/handlers/dispatch.js`: handler group 기반 `createActionDispatcher`, `mergeHandlerGroups` 추가.
  - `studycrack-mobile-app/src/handlers/navigation-handlers.js`: `goto`, `back`, `tab`, `drawerGoto`, `goRanking`, `completeOnboarding`, `startStandard`, `retryInit`, `noopModal` handler 추가.
  - `studycrack-mobile-app/src/handlers/index.js`: handlers barrel export 추가.
  - `src/handlers/.gitkeep` 제거, `README.md` Phase 상태 갱신.
- **검증**: `npm run check` 통과, handlers smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 auth/planner/profile/service handler 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 3 profile renderer 분리
- **목적**: 남아 있던 랭킹/정성조사서/성적 정보 화면을 앱 전용 renderer module로 분리해 Phase 3 screen renderer 분리 범위를 사실상 마무리.
- **변경**:
  - `studycrack-mobile-app/src/screens/profile/renderers.js`: 공부 랭킹, 정성조사서, 성적 정보 renderer와 helper 함수 추가.
  - `studycrack-mobile-app/src/screens/profile/index.js`: profile renderer barrel export 추가.
  - `studycrack-mobile-app/src/screens/index.js`: profile renderer export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, profile renderer smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 Phase 4 handler 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 3 service renderer 분리
- **목적**: 코칭/리포트/요금제/결제 계열 화면을 앱 전용 renderer module로 분리해, 서비스 기능별 handler와 실제 결제/API 연동을 후속 단계에서 분리 가능하게 함.
- **변경**:
  - `studycrack-mobile-app/src/screens/service/renderers.js`: 학습 코칭, 주간 점검, 보고서, 보고서 상세, PRO EXCLUSIVE, SKY튜터, 요금제, 결제, 결제 완료 renderer와 helper 함수 추가.
  - `studycrack-mobile-app/src/screens/service/index.js`: service renderer barrel export 추가.
  - `studycrack-mobile-app/src/screens/index.js`: service renderer export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, service renderer smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 남은 정성조사서/성적 정보/랭킹 renderer 분리 또는 Phase 4 handler 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 3 analysis renderer 분리
- **목적**: 분석과 대학 추가 화면을 앱 전용 renderer module로 분리해, 이후 API 연동/계산 로직 정리와 화면 UI 정리를 분리해서 진행할 수 있게 함.
- **변경**:
  - `studycrack-mobile-app/src/screens/analysis/renderers.js`: 대학 추가, 분석 전략 요약, 점수 상승 시뮬레이션, 대학 검색 모달 renderer와 helper 함수 추가.
  - `studycrack-mobile-app/src/screens/analysis/index.js`: analysis renderer barrel export 추가.
  - `studycrack-mobile-app/src/screens/index.js`: analysis renderer export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, analysis renderer smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 coaching/report/payment renderer 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 3 planner renderer 분리
- **목적**: 플래너 메인/추가 화면을 앱 전용 renderer module로 분리해, 플래너 계산과 이벤트 handler를 후속 단계에서 독립적으로 정리할 수 있게 함.
- **변경**:
  - `studycrack-mobile-app/src/screens/planner/renderers.js`: 플래너 메인, 날짜 스트립, 과목별 도넛, 항목 리스트, 달력 sheet, 수정 sheet, 플래너 추가 화면 renderer 추가.
  - `studycrack-mobile-app/src/screens/planner/index.js`: planner renderer barrel export 추가.
  - `studycrack-mobile-app/src/screens/index.js`: planner renderer export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, planner renderer smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 analysis renderer 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 3 mypage/settings renderer 분리
- **목적**: 마이페이지와 설정 계열 화면을 앱 전용 module로 분리해, 사용자 설정/약관/계정 handler를 후속 단계에서 작게 나눌 수 있게 함.
- **변경**:
  - `studycrack-mobile-app/src/screens/mypage/renderers.js`: 마이페이지, 알림 설정, 고객센터, 설정, 약관 보기, 계정 정보, 개인정보/서비스 약관 화면 renderer와 모달 helper 추가.
  - `studycrack-mobile-app/src/screens/mypage/index.js`: mypage/settings renderer barrel export 추가.
  - `studycrack-mobile-app/src/screens/index.js`: mypage/settings renderer export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, mypage/settings renderer smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 planner renderer 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 3 home renderer 분리
- **목적**: 홈 화면의 가장 큰 문자열 renderer를 앱 전용 screen module로 분리해 이후 handler/API 연결 단위를 작게 만들기.
- **변경**:
  - `studycrack-mobile-app/src/screens/home/renderers.js`: 홈 상단 요약, 목표 대학 슬라이더, 대학 선택 모달, 공부 기록/타이머, 오늘 플래너, 랭킹, 알림 모달, drawer renderer와 helper 함수 추가.
  - `studycrack-mobile-app/src/screens/home/index.js`: home renderer barrel export 추가.
  - `studycrack-mobile-app/src/screens/index.js`: home renderer export 연결.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, home renderer smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 mypage/settings 또는 planner renderer 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 3 auth renderer 분리
- **목적**: 로그인/회원가입 계열 화면을 앱 전용 screen renderer module로 분리해 `screenRenderers` 해체를 계속 진행.
- **변경**:
  - `studycrack-mobile-app/src/screens/auth/renderers.js`: `authLogin`, `authFindId`, `authFindPw`, `authSignup` renderer 추가.
  - `studycrack-mobile-app/src/screens/auth/index.js`: auth renderer barrel export 추가.
  - `studycrack-mobile-app/src/screens/index.js`: auth renderer export 연결.
  - 회원가입 약관 모달은 신규 앱 소스 기준 `src/constants/terms.js`의 `TERMS_CONTENT` 사용.
  - `README.md`: Phase 상태 갱신.
- **검증**: `npm run check` 통과, auth renderer smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 home renderer 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 3 onboarding renderer 분리
- **목적**: 단일 앱 파일의 `screenRenderers`를 화면별 module로 분리하기 위한 첫 단계로, 의존성이 비교적 낮은 onboarding 초반 화면을 앱 소스 트리로 이동.
- **변경**:
  - `studycrack-mobile-app/src/screens/onboarding/renderers.js`: `ob1`, `ob2`, `ob3` renderer와 progress/helper 함수 추가.
  - `studycrack-mobile-app/src/screens/onboarding/index.js`, `studycrack-mobile-app/src/screens/index.js`: screen renderer barrel export 추가.
  - `studycrack-mobile-app/src/screens/.gitkeep` 제거.
  - `README.md`, `src/README.md`: Phase 상태와 screen renderer 역할 갱신.
- **검증**: `npm run check` 통과, onboarding renderer smoke 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단위는 auth/signup renderer 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 2 storage/state 유틸 분리
- **목적**: 단일 앱 파일 안의 localStorage, planner item normalization, scroll position 저장/복원 로직을 앱 전용 state 유틸로 분리.
- **변경**:
  - `studycrack-mobile-app/src/state/storage.js`: storage key map, `safeParse`, JSON 저장, string/object/array read, 시험 성적 map read/write, startup error append 유틸 추가.
  - `studycrack-mobile-app/src/state/planner-storage.js`: `buildPlannerId`, `normalizePlannerItems`, planner item grouping 유틸 추가.
  - `studycrack-mobile-app/src/state/scroll-storage.js`: scroll position read/save, navigation scroll snapshot, restore 유틸 추가.
  - `studycrack-mobile-app/src/state/index.js`: state barrel export 추가.
  - `src/state/.gitkeep` 제거.
- **검증**: `npm run check` 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단계는 onboarding/auth/home 중심 screen renderer 분리.

---

## 2026-06-12 — studycrack-mobile-app Phase 1 정적 상수 분리
- **목적**: 단일 `js/studycrack-mobile.js`에 섞여 있던 정적 데이터와 mock 데이터를 앱 전용 소스 트리로 먼저 분리해 이후 import 전환 기반을 마련.
- **변경**:
  - `studycrack-mobile-app/src/constants/terms.js`: 약관/개인정보/서비스/환불/마케팅 전문 분리.
  - `studycrack-mobile-app/src/constants/universities.js`: 홈 대학 profile, 분석 profile, 추천/검색 seed 분리.
  - `studycrack-mobile-app/src/constants/options.js`: 탐구 과목, 시험 선택 옵션 분리.
  - `studycrack-mobile-app/src/constants/ranking.js`: 랭킹 mock data 분리.
  - `studycrack-mobile-app/src/constants/index.js`: constants barrel export 추가.
- **검증**: `npm run check` 통과, `git diff --check` 통과.
- **주의**: 기존 런타임 파일(`studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`)은 아직 변경하지 않음. 다음 단계는 storage/state 유틸 분리.

---

## 2026-06-11 — studycrack-mobile-app 모듈화 계획 착수
- **목적**: `js/studycrack-mobile.js` 4,830 lines / `css/studycrack-mobile.css` 3,198 lines 규모의 단일 앱 초안을 계속 개발 가능한 구조로 분리.
- **결정**:
  - 앱 소스 최상위 폴더명은 `studycrack-mobile-app/`으로 고정.
  - 기존 웹 프론트 파일은 건드리지 않고 모바일 앱 전용 소스 트리에서만 구조화.
  - 기능/API 연동보다 상수, state/storage, screen renderer, handler, component 분리를 먼저 진행.
  - Vite/React 빌드 전환은 구조 분리 후 별도 단계로 수행.
- **계획 문서**: `docs/exec-plans/completed/260611_studycrack_mobile_app_modularization.md`
- **현재 착수 범위**: Phase 0 — 앱 소스 폴더 골격과 migration note 작성. 기존 `studycrack-mobile.html` 런타임은 아직 변경하지 않음.

---

## 2026-06-11 — Front_Draft 모바일 앱 프론트 선별 이관
- **목적**: 오래된 `Front_Draft` 브랜치를 통째로 머지하지 않고, 최신 `dev` 기준 새 브랜치 `dev-mobile-main`에 모바일 앱 프론트 파일만 선별 이관.
- **변경**:
  - `origin/dev` 기준 `dev-mobile-main` 브랜치 생성.
  - `origin/Front_Draft`에서 앱 전용 파일만 이관: `studycrack-mobile.html`, `js/studycrack-mobile.js`, `css/studycrack-mobile.css`, 앱 참조 이미지 3개.
  - 기존 웹 파일(`analysis`, `mypage`, `survey`, 루트 홈페이지/로그인/결제 등)은 이관하지 않아 merge conflict와 최근 웹 수정 회귀를 회피.
  - `studycrack-mobile.html`: 현재 API 설정을 읽을 수 있도록 `js/config.js` 로드 추가, Babel 런타임 컴파일 지연을 고려해 fallback 타이머를 12초로 보정.
  - `js/studycrack-mobile.js`: public JS의 API 전환 TODO 주석 제거, 존재하지 않는 `assets/IMG_2648.jpeg` 및 샘플 PDF 경로 정리, MBTI PDF 다운로드 버튼을 `맞춤 공부법 PDF 준비 중` disabled 상태로 변경.
- **검증**:
  - `git diff --check -- studycrack-mobile.html js/studycrack-mobile.js css/studycrack-mobile.css` 통과.
  - 로컬 정적 서버에서 `http://127.0.0.1:8765/studycrack-mobile.html` 모바일 viewport `390x844` 확인.
  - 첫 온보딩 화면, 크랙이 이미지, `다음` 버튼 렌더 확인.
  - 브라우저 콘솔 error 0건 확인.
- **남은 작업**: `dev-mobile-main` push 후 `origin/Front_Draft` 삭제. 모바일 앱 백엔드 실연동과 빌드 파이프라인 전환은 별도 후속 작업.

---

## 2026-06-11 — BASIC 플랜 점수 상승 시뮬레이션 안내/권한 정합화
- **목적**: BASIC 플랜이 점수 상승 시뮬레이션을 제공하는 것처럼 보이는 안내 문구를 제거하고, 분석 페이지의 실제 잠금 정책을 `Standard 이상` 문구와 일치시킴.
- **확인**:
  - `StudyCrack_Analysis`의 `simulate_score_rise` 백엔드 권한은 이미 `standard`/`pro`/`trial`만 허용. `basic` 및 `test→basic`은 접근 불가 상태.
  - `analysis.html` 문구는 이미 `(Standard 이상)`으로 표기.
  - 불일치 지점은 메인 프로그램 탭, 서비스 소개 플랜 표, 결제 페이지 BASIC 카드, 프론트 `starter` 잠금 누락.
- **변경**:
  - `js/script.js`: 메인 프로그램 BASIC 리스트에서 `점수 상승 시뮬레이션 제공` 제거 → `현재 점수 기준 목표 대학 위치 진단`으로 교체. STANDARD 리스트에는 `점수 상승 시뮬레이션 제공` 명시.
  - `service.html`: BASIC PLAN 리스트에서 시뮬레이션 문구 제거, STANDARD PLAN에 시뮬레이션 제공 명시.
  - `payment.html`: BASIC 가격 카드에서 시뮬레이션 문구 제거, STANDARD 카드에 시뮬레이션 제공 명시. 실제 제공 예시 캡션에 `(STANDARD 이상)` 추가.
  - `js/analysis.js`: 점수 상승 시뮬레이션 프론트 잠금 대상을 `free/basic/starter`로 변경해 화면 문구 `(Standard 이상)`과 일치.
- **검증**: `node --check js/script.js`, `node --check js/analysis.js`, `node --check backend-backup/StudyCrack_Analysis/index.mjs`, `git diff --check` 통과.
- **남은 작업**: 프론트 배포 필요. dev에서 `/`, `/service`, `/payment`, `/analysis` 플랜/시뮬레이션 문구와 BASIC/STARTER 잠금 상태 스모크 필요.

---

## 2026-06-09 — MBTI PDF 보고서 다운로드 프론트 비활성화
- **목적**: 현재 튜토리얼/탐구 MBTI 추천 과목 흐름과 기존 유형별 PDF 다운로드 흐름이 맞지 않아, 사용자가 오래된 PDF 보고서를 받는 기대를 갖지 않도록 프론트 다운로드 경로를 일시 비활성화.
- **변경**:
  - `analysis.html`/`js/analysis.js`: MBTI가 있는 사용자에게 보이던 `[유형] 보고서 다운받기` 버튼을 disabled `보고서 준비 중` 상태로 변경하고, `get_mbti_pdf_url` 호출 함수 제거.
  - `mbti_survey.html`: 외부 직접 접속 결과 화면의 `분석 보고서 PDF 다운로드` 버튼을 disabled 상태로 변경하고, `update_mbti_promo` 다운로드 호출 제거.
  - `mbti_download.html`: 전용 다운로드 페이지를 `준비 중` 안내 페이지로 변경하고 코드 입력/다운로드 버튼 및 보고서 URL 발급 로직 제거.
  - `js/script.js`/`css/style.css`: 메인 MBTI 플랜 CTA의 `/mbti/download` 링크를 제거하고 `맞춤 공부법 PDF 준비 중` 표시로 변경.
  - `welcome.html`, `promo.html`: 보고서 수령을 암시하던 문구를 `맞춤 분석` 중심 문구로 변경.
  - `js/tutorial.js`: 더 이상 쓰이지 않는 MBTI PDF 다운로드 함수 제거.
  - `docs/frontend-reference.md`: 제거된 튜토리얼/분석 PDF 다운로드 프론트 함수 및 API 호출 기록 정리.
- **검증**: `node --check js/analysis.js`, `node --check js/tutorial.js`, `node --check js/script.js`, `git diff --check` 통과.
- **남은 작업**: 프론트 배포 필요. dev에서 `/analysis`, `/mbti_download`, `/mbti_survey`, 메인 MBTI 플랜 CTA가 다운로드/API 호출 없이 준비 중 상태로 보이는지 스모크 필요.

---

## 2026-06-09 — 결제 이탈 방어 모달 + Typeform 설문 연결
- **목적**: 결제 의도가 확인된 사용자가 `/payment` 플랜 선택 이후 또는 `/checkout` 최종 결제 직전 이탈하려 할 때, 즉시 설문을 띄우지 않고 먼저 혜택 안내형 방어 모달을 노출.
- **변경**:
  - `js/payment-exit-guard.js`: 공통 이탈 방어 모듈 추가. 링크 이탈, 뒤로가기 버튼, 브라우저 back을 커스텀 모달로 처리. `beforeunload` 기본 경고는 UX 충돌로 제거.
  - `css/payment-exit-guard.css`: 방어 모달, 중앙 배치형 놀란 크랙이 이미지, 액션 버튼, Typeform 전용 오버레이 스타일 추가. 모바일 첫 모달 타이포/버튼/마스코트 크기 축소.
  - `payment.html`, `checkout.html`: 공통 CSS/JS 로드.
  - `payment.html`: 플랜 선택 링크의 `#checkout` 기본 hash 이동을 제거해 `/payment#checkout` 히스토리 누적 방지.
  - `js/payment.js`: 플랜 선택 후 결제 섹션이 열린 상태에서만 이탈 방어 활성화. 전화번호 미등록 상태와 `/checkout` 이동은 방어 제외.
  - `js/checkout.js`: 최종 결제 전 이탈 방어 활성화. 뒤로가기 버튼은 `/payment`로 명시 이동. NICEPAY 결제 진행 중에는 방어 제외.
  - `설문 참여하고 할인 받기` 클릭 시 방어 모달을 닫고 별도 Typeform 오버레이에서 `01KSFFXNN2R95QMDJC34YZAAYY`를 lazy-load로 표시. PII hidden field 전달 없음.
  - 세션 1회 노출 제한을 제거해 사용자가 이탈을 시도할 때마다 방어 모달이 뜨고, 명시적인 `그냥 나가기` 선택 시에만 해당 이동을 허용.
- **검증**: `node --check js/payment-exit-guard.js`, `node --check js/payment.js`, `node --check js/checkout.js`, `git diff --check` 통과.
- **남은 작업**: 프론트 배포 필요. dev에서 `/payment` 플랜 선택 후 내부 링크/브라우저 뒤로가기, `/checkout` 뒤로가기/결제 버튼/NICEPAY 오류 복귀 흐름 스모크 필요.

---

## 2026-06-09 — 튜토리얼 MBTI 추천 탐구 과목 노출
- **원인**: `/tutorial` MBTI 결과 카드는 유형명·설명·traits만 렌더링하고, 탐구 MBTI PDF의 핵심인 추천 탐구 과목 매핑을 노출하지 않았음.
- **변경**:
  - `js/tutorial.js`: 16개 MBTI 유형별 추천 탐구 과목 매핑 `MBTI_RECOMMENDED_INQUIRY_SUBJECTS` 추가.
  - `ISDR`: 원본 PDF에 구체 과목명이 없어 같은 D/R 계열의 과학 과목 반복 출현과 IS 계열의 패턴/기준 고정 성향을 반영해 `화학Ⅰ`, `물리Ⅰ`, `정치와 법` 3과목으로 보정.
  - MBTI 결과 카드에 `추천 탐구 과목` 칩 섹션 추가.
  - URL/DB에서 복원한 MBTI 코드를 16개 허용 코드로 정규화한 뒤 저장·렌더링하도록 보강.
  - `css/tutorial.css`: 추천 과목 칩/안내문 스타일 추가.
  - `docs/algorithms/tutorial-recommendation.md`: 추천 탐구 과목 노출 기준과 `ISDR` 보정 근거 기록.
- **추가 보강**:
  - `tutorial.html`, `css/tutorial.css`: MBTI 직접 선택의 `이 유형으로 분석 시작` 버튼에서 모바일 줄바꿈/들여쓰기 span을 제거하고, 버튼 내부 텍스트를 중앙 정렬로 고정.
  - `js/tutorial.js`, `css/tutorial.css`: MBTI 결과 카드의 유형 해석과 추천 탐구 과목을 2단 패널 구조로 재배치해 좌우 균형과 시선 흐름을 보강. 모바일에서는 단일 컬럼으로 전환.
- **검증**: `node --check js/tutorial.js`, `git diff --check` 통과.
- **남은 작업**: 프론트 배포 필요. dev에서 `/tutorial?mbti_completed=true&mbti_result=ISDR` 진입 시 추천 과목 3개가 노출되는지 스모크 필요.

---

## 2026-06-09 — 관리자 공지 단체전송 부분 실패 내성 보강
- **원인 재진단**: `sendAlimtalkBulk()`에는 Solapi 일부 실패를 카운트로 반환하는 보정이 들어가 있었지만, `admin_manual_notice` 전체 흐름에는 여전히 `await Promise.all(dbPutPromises)`와 보낸 공지함 저장 `PutCommand`가 남아 있어 인앱 알림 저장 1건 실패 또는 로그 저장 실패가 Lambda 전체 500으로 전파될 수 있었음. 따라서 전화번호 없음/마케팅 미동의는 skip되더라도, 단체 발송 규모가 커져 DynamoDB 개별 저장 실패가 섞이면 관리자 화면에는 여전히 “서버 오류”로 보일 수 있음.
- **변경**:
  - `StudyCrack_Notification`: `admin_manual_notice` 대상 userId를 중복 제거/검증하고 제목·내용 누락 시 400 반환.
  - 인앱 공지 저장을 대상자별 `catch`로 감싸 일부 실패는 `inAppReport`로 반환. 성공 저장된 대상에게만 외부 알림톡 후보를 구성.
  - 전화번호 없음/전화번호 형식 오류/마케팅 미동의/템플릿 없음은 `solapiReport.skipped`로 분리 집계.
  - 보낸 공지함 기록 저장 실패도 전체 500으로 만들지 않고 `sentLogSaved=false`로 반환.
  - `js/admin/notices.js`: 성공/실패 리포트를 관리자 alert에 표시.
- **검증**: `node --check backend-backup/StudyCrack_Notification/index.mjs`, `node --check js/admin/notices.js`, `git diff --check` 통과.
- **남은 작업**: 프론트 배포 + `StudyCrack_Notification` Lambda 재배포 필요. dev에서 ① 전화번호 없는 유저 포함 ② 마케팅 미동의 포함 ③ 큰 그룹 단체전송 ④ 보낸 공지함 기록 확인 스모크 필요.

### 503 재진단 후 2차 보강
- **증상**: 배포 후에도 관리자 단체전송에서 `POST /api/noti`가 API Gateway 레벨 `503 Service Unavailable` 반환. 이는 Lambda가 `{ statusCode: 500 }`으로 반환한 오류가 아니라, 요청 처리 중 timeout/throttle/통합 실패가 발생했을 가능성이 높음.
- **추가 원인**: `admin_manual_notice`가 여전히 대상 전체를 한 요청 안에서 DynamoDB Query/Put `Promise.all`로 동시에 실행하고, Solapi `send-many/detail`도 최대 1000건을 한 번에 호출해 대량 대상에서 Lambda/API Gateway 제한에 걸릴 수 있었음.
- **추가 변경**:
  - `StudyCrack_Notification`: DynamoDB 대상 조회/저장 동시성을 20개로 제한.
  - Solapi bulk chunk를 80건으로 축소하고, 외부 요청 timeout 12초 적용.
  - Solapi 응답 카운트 파싱을 `groupInfo`, `successCount`, `failedCount` 계열 필드까지 호환.
  - `js/admin/notices.js`: 단체전송 대상을 프론트에서 80명(알림톡 포함) 또는 120명(인앱만) 단위로 나눠 순차 호출하고, chunk별 결과를 합산 표시.
- **검증**: `node --check backend-backup/StudyCrack_Notification/index.mjs`, `node --check js/admin/notices.js`, `git diff --check` 통과.

---

## 2026-06-09 — 튜토리얼 2과목 상승 전략 엔진 1·2차 구현
`docs/exec-plans/completed/260609_tutorial_strategy_projection.md`

- **진단**: 현재 튜토리얼 과목 추천은 `currentScore >= 80` 구간에서 `uiGap=20` 고정 → 총 상승량 `+7`이 자주 나오고, greedy 배분 때문에 한 과목에 점수가 몰림. MBTI는 과목 보조 가중치로만 쓰여 결과 설명과 연결성이 약함.
- **변경**:
  - `StudyCrack_Analysis`: 튜토리얼 전용 `tutorial_strategy_projection` API 추가.
  - 기본 전략은 2과목 조합, 총 `+14~24` 원점수 상승을 우선 탐색.
  - 수학 `+1/+2` 금지 등 과목별 현실적 문항 단위 bucket 적용.
  - MBTI는 계산 보조 가중치와 결과 설명 문장에 모두 반영.
  - 최상위권(`elite_ceiling`), 일반(`normal_growth`), 저점 상승 가능(`low_but_projectable`), 목표 불일치(`target_mismatch`) 4개 모드로 분기.
  - 낮은 점수 + 의치한약수 희망 케이스는 억지 직접 추천 대신 `현실 1차 목표` / `계열 인접 목표` / `장기 목표`로 분리.
  - `js/tutorial.js`: 마지막 단계에서 신규 API를 우선 호출하고 실패 시 legacy greedy fallback 유지. 신규 전략의 `boostedRawScores`로 미래 대학 추천 재호출.
  - 미래 대학 추천 2차 정교화: 낮은 점수대는 `현재 기준` / `1차 목표` / `계열 인접`, 목표 불일치는 `1차 목표` / `계열 인접` / `장기 발판` 순서로 단계별 후보를 1개씩 구성.
  - 계열 인접 stream 매핑 추가: 의치한약수 희망자가 직접 후보 부족 시 `간호/보건`, `자연/공학` 후보를 함께 탐색.
  - 낮은 점수대 모드는 카드 정렬을 점수순으로 재섞지 않고 전략 단계 순서를 보존.
  - `css/tutorial.css`: 전략 근거 문장 스타일 추가.
  - `docs/algorithms/tutorial-recommendation.md`: 신규 API 중심 사양으로 갱신.
- **검증**: `node --check backend-backup/StudyCrack_Analysis/index.mjs`, `node --check js/tutorial.js`, `git diff --check` 통과.
- **남은 작업**: 프론트 배포 + `StudyCrack_Analysis` Lambda 재배포 필요. dev에서 최상위권/일반/저점/의치한약수 목표 불일치 4케이스 튜토리얼 스모크 필요.

### +7 단일과목/과도한 안정권 후보 재보강
- **원인**:
  - 신규 `tutorial_strategy_projection`이 실패하거나 배포되지 않은 환경에서는 프론트 legacy `calcGreedySubjectPlan()`이 여전히 효율 1순위 과목에 `+7`을 먼저 몰아주는 구조였음.
  - 추천대학 API는 후보 3개 보장을 위해 UI `20~220`, 부족 시 `5~240`까지 넓게 허용하고, 기본 모드에서 분포 기반 후보를 랜덤 3개로 잘라 UI `170~180`대 과도한 안정권 후보가 섞일 수 있었음.
- **변경**:
  - `js/tutorial.js`: legacy fallback도 최소 총 `+14`점 이상을 목표로 하며, 서로 다른 2과목의 현실적 bucket 조합을 먼저 선택하도록 변경.
  - `js/tutorial.js`: 추천대학 프론트 랭킹을 높은 점수순이 아니라 UI `90~135`, 이상점 `108` 근처 우선으로 변경. 후보 부족 시 `70~160`까지 완화.
  - `StudyCrack_Analysis`: `get_tutorial_recommendations`의 최종 후보 선정도 UI `108` 근처를 우선하고, `170~180`대 후보는 최종 3개에서 후순위로 밀리도록 변경. 기본 모드 랜덤 3개 선별 제거.
  - `docs/algorithms/tutorial-recommendation.md`: legacy fallback 및 추천대학 UI 점수대 정책 갱신.
- **검증**: `node --check backend-backup/StudyCrack_Analysis/index.mjs`, `node --check js/tutorial.js`, `git diff --check` 통과.
- **남은 작업**: 프론트 배포 + `StudyCrack_Analysis` Lambda 재배포 필요. dev에서 ① 국어/수학 88점대 케이스 ② 일반 점수대 ③ 낮은 점수대 ④ 신규 전략 API 실패 fallback 강제 케이스를 스모크 권장.

---

## 2026-06-09 — 5월/6월 성적 입력 과탐 II 선택지 복구
- **원인**: `tutorial.html`, `survey.html`의 탐구 선택 `<select>`에 과학탐구 I 과목만 있고 `물2/화2/생2/지2` 선택지가 누락됨. `StudyCrack_Analysis`, `StudyCrack_UserCore`는 이미 과탐 II 매핑과 5월/6월 스코어보드 과학II 처리를 지원.
- **변경**:
  - `tutorial.html`: 탐구1/탐구2 과학탐구 optgroup에 `물리학Ⅱ`, `화학Ⅱ`, `생명과학Ⅱ`, `지구과학Ⅱ` 추가.
  - `survey.html`: 탐구1/탐구2 과학탐구 optgroup에 동일 선택지 추가.
- **남은 작업**: 프론트 배포 필요. dev에서 5월/6월 모드 각각 튜토리얼·survey 탐구 과목 선택 → 원점수 입력 → 표준점수/백분위/등급 환산 확인.

---

## 2026-06-09 — 소셜 신규 약관 모달 전체동의 추가
- **변경**:
  - `social-callback.html`: 신규 소셜 회원가입 약관 모달 상단에 `약관 전체 동의` 체크박스 추가.
  - `js/social-callback.js`: 전체동의 체크 시 필수 약관 4종 + 선택 마케팅 동의를 함께 토글하고, 개별 체크박스 상태 변경 시 전체동의 상태를 동기화.
  - `css/auth.css`: 소셜 약관 모달 전체동의 행 스타일 보강.
- **추가 보강**:
  - `social-callback.html`: 약관 `전문보기`가 `/signup` 새 창으로 이동하던 링크를 소셜 콜백 페이지 내부 모달로 변경.
  - `js/social-callback.js`: 표준이용약관, 서비스 이용약관, 개인정보 처리방침, 환불 규정, 마케팅 정보 수신 동의 전문을 안전하게 `textContent`로 렌더링.
  - `css/auth.css`: 소셜 약관 모달에 최대 높이/내부 스크롤을 적용해 선택 마케팅 동의 항목이 작은 화면에서 가려지지 않도록 보강.
- **남은 작업**: 프론트 배포 필요. dev에서 완전 신규 소셜 계정 → 약관 모달 → 전체동의 체크/해제 → 가입 완료 스모크 권장.

---

## 2026-06-08 — 로그인 쿠키 등록 최적화 + 지연 계측
- **목적**: 일반/튜터 로그인 3~4초 체감 지연의 남은 병목(불필요한 Auth 왕복 + Cognito 재호출)을 줄이고, CloudWatch/브라우저 콘솔에서 단계별 ms를 확인할 수 있게 함.
- **기존 완료 조치 확인**: `register_refresh_cookie ∥ get_login_profile` 병렬화, `get_login_profile` 경량 API, 로그인 직후 identity 재조회 TTL 스킵은 이미 적용된 상태.
- **변경**:
  - `StudyCrack_Auth`: 신규 `register_login_cookies` 타입 추가. Cognito SDK가 발급한 `accessToken`/`idToken`을 JWKS로 검증한 뒤, 기존 `at`/`rt` 만료와 신규 쿠키 세팅을 한 응답에서 처리. 정상 경로에서 `REFRESH_TOKEN_AUTH` 재호출 제거.
  - `StudyCrack_Auth`: 요청 시작 로그에서 raw body 일부를 찍던 부분을 제거해 토큰/민감값 CloudWatch 노출 가능성 차단.
  - `js/auth.js`: 일반/튜터 로그인 직후 별도 `clearServerSessionCookies()` 대기를 제거하고, `register_login_cookies` 우선 사용. 실패 시 기존 `register_refresh_cookie`로 폴백하되 폴백 전 서버 쿠키 삭제를 수행해 계정 전환 안전성 유지.
  - `js/auth.js`: `[auth_timing]` 콘솔 계측 추가(`submit`, `cognito_success`, `identity_start`, `cookie_register_done`, `identity_done`).
  - `StudyCrack_Auth`, `StudyCrack_UserCore`: `[AuthTiming]`, `[UserCoreTiming]` CloudWatch 로그 추가.
- **남은 작업**: 프론트 배포 + `StudyCrack_Auth`, `StudyCrack_UserCore` Lambda 재배포 필요. dev에서 일반 로그인/튜터 로그인 각각 로그인 → 새로고침 → 새 탭 진입 → 로그아웃 1사이클 및 CloudWatch timing 확인.

---

## 2026-06-08 — 소셜 신규 판정 후 약관 동의 + 마케팅 동의 시각 저장
- **목적**: 소셜 OAuth 후 기존 계정 여부를 먼저 확정하고, 실제 신규 회원가입일 때만 필수 약관과 선택 마케팅 동의를 받음. 기존 소셜 로그인/동일 이메일 기존 계정 연동은 약관을 반복 요구하지 않음. 모든 학생은 가입 후 마이페이지에서 동의/철회 가능.
- **변경**:
  - `signup.html`, `login.html`, `js/auth.js`: 소셜 버튼 클릭 시 사전 약관 모달을 제거하고 바로 OAuth로 이동.
  - `StudyCrack_Auth`: `social_callback`에서 provider 신원 확인 후 기존 소셜 Cognito 계정 또는 동일 이메일 기존 학생 계정이 있으면 로그인/연동 진행. 둘 다 없을 때만 `SOCIAL_PENDING_*` 10분 TTL 임시 레코드를 만들고 200(`requiresTerms`) 반환.
  - `social-callback.html`, `js/social-callback.js`: `requiresTerms` 응답을 받은 신규 사용자에게만 약관/마케팅 동의 모달 표시. 동의 후 `social_complete_signup`으로 Cognito/DB 생성 및 로그인 완료.
  - `StudyCrack_Auth`: 신규 소셜 학생 생성 시 `termsAgreed`, `termsAgreedAt`, `marketingAgreed`, 마케팅 동의 시 `marketingAgreedAt`, `marketingConsentUpdatedAt` 저장. 이메일 가입도 마케팅 동의 시각 저장.
  - `mypage.html`, `js/mypage.js`, `css/mypage.css`: 마이페이지 `마케팅 수신 동의` 토글 + 동의 시각 표시 추가. 라벨 줄바꿈 방지.
  - `StudyCrack_UserCore`: `update_member_info`에서 `marketingAgreed` 저장 허용 + boolean 강제. 동의 시 `marketingAgreedAt`, 철회 시 `marketingRevokedAt`, 모든 변경 시 `marketingConsentUpdatedAt` 저장.
- **남은 작업**: 프론트 배포 + `StudyCrack_Auth`, `StudyCrack_UserCore` Lambda 재배포 필요. 변경 후 dev에서 ① 기존 소셜 계정 로그인 시 약관 미노출 ② 동일 이메일 기존 계정 소셜 연동 시 약관 미노출 ③ 완전 신규 소셜 계정만 콜백 약관 모달 → 가입 완료 → DB 약관/마케팅 시각 저장 → 마이페이지 표시/철회 스모크 권장.

---

## 2026-06-07 — 관리자 공지 마케팅 동의 필터 강화
- **확인 결과**: 일반/튜터 이메일 가입에는 `chkMarketing` 선택 동의가 있으나, 소셜 신규 가입 흐름(`social-callback`)에는 마케팅 수신 동의 UI가 없음. 마이페이지에도 동의 변경 UI 없음.
- **기존 문제**: `admin_manual_notice` 외부 알림톡 필터가 `marketingAgreed === false`만 제외해, 값이 없는 소셜 사용자(`undefined`)가 발송 대상에 포함될 수 있었음.
- **변경**:
  - `StudyCrack_Notification`: 마케팅성 외부 발송은 `marketingAgreed === true`인 학생만 통과.
  - `StudyCrack_Auth`: 소셜 신규 학생 생성 시 `marketingAgreed=false`를 명시 저장.
- **남은 작업**: `StudyCrack_Notification`, `StudyCrack_Auth` Lambda 재배포 필요. 소셜 사용자에게 동의를 받을 별도 UI/플로우는 추후 추가 필요.

---

## 2026-06-07 — 관리자 공지 알림톡 템플릿 조회 CORS 수정
- **증상**: 관리자 `알림 관리 > 새 공지 발송`에서 알림톡 옵션/공지 발송 준비 단계 오류 가능.
- **원인**: `StudyCrack_Notification`의 `admin_get_alimtalk_templates` 응답만 `responseHeaders` 없이 반환되어 브라우저 CORS 검사를 통과하지 못함. 같은 Lambda의 `admin_manual_notice` 등 다른 관리자 응답은 헤더 포함.
- **변경**: `backend-backup/StudyCrack_Notification/index.mjs` 템플릿 목록 응답에 `headers: responseHeaders` 추가.
- **남은 작업**: `StudyCrack_Notification` Lambda 재배포 필요.

---

## 2026-06-07 — 결제 전화번호 미등록 안내 개선
- **배경**: 기존 소셜 로그인 사용자 중 전화번호가 없는 계정은 결제 섹션에서 `전화번호 등록 필요` 상태로 막히지만, 바로 어디로 가야 하는지 혼동 가능.
- **변경**: `js/payment.js`의 전화번호 미등록 경고 메시지에 `/mypage` 이동 버튼 추가. `css/payment.css`에 PC/모바일 반응형 버튼 스타일 추가.
- **배포**: 프론트 배포 필요. 정적 자산 버전은 GitHub Actions 배포 워크플로우의 `tools/bump_asset_version.sh`로 갱신.

---

## 2026-06-07 — 튜토리얼 intro 전화번호 수집·인증 (소셜 가입 결제 마찰 해소)
- **배경**: 소셜(구글/네이버) 가입자는 phone 미보유 → 결제 시 차단(`payment.js`). 구글은 OAuth로 전화번호 제공 불가, 네이버는 검수+미검증이라 소셜 의존 부적합 → **직접 입력+SMS 인증** 채택, 기존 `send_sms_auth`/`verify_code` 재사용.
- **위치**: 튜토리얼 **intro 스텝(0)에 임베드**. 일반 가입자는 보유 번호 **prefill(인증됨 간주)**, 소셜 등 미보유자는 **입력+SMS 인증** 후에만 다음 진행(게이트).
- **변경**:
  - `StudyCrack_UserCore` `get_user_analysis` 응답에 `phone`, `authProvider` 추가.
  - `tutorial.html` `tpl-intro`: 전화번호 섹션(prefill / 인증 입력 2모드).
  - `js/tutorial.js`: 로드 시 phone 상태 저장, `setupIntroPhone()`, `handleTutPhoneSend/Verify`(검증 성공 시 `update_member_info`로 저장), `_nextStepCore` intro 게이트.
- **남은 작업**: `StudyCrack_UserCore` Lambda 재배포(phone 응답 필드) + 프론트 배포. 참고: 진행중 유저가 step>0로 복귀 시 intro 게이트 우회 가능하나, 결제페이지 phone 차단이 백스톱으로 유지됨.

---

## 2026-06-07 — 성능 교정 1차 (프론트 고가치 항목, 배포 대기)
`docs/exec-plans/completed/260605_performance_audit.md`

- **배경**: 데이터·유저 적은데 전반 느림 = 콜드스타트 + 비대한 클라이언트 번들. 학생 체감(로그인/나만의 솔루션) 우선.
- **완료(프론트만, 재배포 불필요·프론트 배포로 적용)**:
  - **C1**: 17개 HTML에서 안 쓰는 풀 AWS SDK(~900KB) `<script>` 제거.
  - **C3**: Cognito SDK `<head>`→body 이동(렌더 블로킹 해소) + `analysis.html` pdf.js/html2pdf `defer`.
  - **H3**: 일반/튜터 로그인 `registerRefreshCookie ∥ get_login_profile` 병렬화(직렬 Auth 왕복 1회 제거, logout은 직렬 유지).
  - **M3**: `admin_index.html` chart.js `defer`(+ dev-mock/외부스크립트 점검 — 이미 양호).
- **보류**: C2(효과 작음), M1(관리자 전용·확장성, 학생체감 무관), H4(Authorizer 캐싱 — 보안 리스크, 별도 세션).
- **인프라(사장님 콘솔, 코드無)**: H1/H2 — `StudyCrack_Analysis`/UserCore/Auth에 Provisioned Concurrency 1~2 + 분석 Lambda 메모리 상향.
- **남은 작업**: 프론트 배포(dev/main) → Lighthouse/CloudWatch로 전후 측정.

---

## 2026-06-04 — 튜터가 다른 유저(학생)로 로그인되는 신원 혼선 수정 (코드 완료, 재배포 대기)

- **확정 원인**: 한 Cognito `sub`(`54c85d2c-...`, fbdxodla@yonsei.ac.kr)가 `StudyCrack_Tutors`(예시튜터)와 `StudyCrack_Students`(김태윤) **양쪽 테이블에 동시 등록**됨. `StudyCrack_UserCore`의 `resolveRoleScopedUser()`가 Students를 먼저 조회하므로 해당 sub는 항상 학생으로 확정 → 튜터 로그인이 학생으로 귀결. (캐싱/Authorizer 무관, LOCAL에서도 재현)
- **유령 학생 레코드 발생원**: 튜터 계정으로 튜토리얼/설문/분석/체험구독 사용 시 `update_qual`/`update_quan`/`update_target_univs`/`grant_tutorial_trial`/`update_tutorial_status`/`update_mbti_promo`/`submit_trial_transfer`가 role 검사 없이 `TBL_STUDENTS`에 upsert.
- **코드 수정**: `StudyCrack_UserCore` 진입부(redirectTo 해석 직후)에 역할 분리 가드 추가 — `STUDENT_WRITE_TYPES`이면 sub가 Tutors/Admin에 존재하는지 확인 후 존재 시 403. 유령 레코드 생성 원천 차단.
- **데이터 정리**: 사용자가 `StudyCrack_Students`의 해당 학생 레코드를 수동 삭제 예정(튜터 신분 유지).
- **남은 작업**: `StudyCrack_UserCore` Lambda 재배포 필요. (선택) 다른 sub의 테이블 간 중복 여부 전수 점검.

---

## 2026-06-05 — 구독 전환 통합 (pending 자동 승계 + test→basic + 날짜/알림)
정책 결정(사용자): ① test 권한=basic ② pending 시작=현재 종료 다음(이어받기) ③ 만료 시 자동 승계 ④ 갱신 시 메인페이지 공지.

- **Payment**(`activateSubscription` + Nicepay return 인라인): pending 생성 시 `startDate=current.endDate`(결제 시각 아님), `endDate=+28일`. 현재 구독과 **이음새 없이 연속**.
- **UserCore**: `calcTier`에 `test→basic` 매핑. `promotePendingIfDue` 추가 — 현재 구독 만료+유효 pending이면 `pending→current` 승격(REMOVE pending) + `sendStudentNotification(actionType:'admin_notice')`로 **갱신 공지 1회**(멱등). `resolveRoleScopedUser`에서 호출.
- **Analysis** `checkHasProAccess`: **pending-aware**(current 만료 시 pending 승계) + `test→basic` 재작성. UserCore와 동일 모델(주석 명시).
- **AdminCore** tier 계산: `test→basic` 매핑 추가(이미 pending-aware).
- **검증**: 4개 Lambda `node --check` 통과 + 등급 일관성 시뮬 7케이스 전부 PASS(만료PRO+pendingTEST→basic·sim잠금·403없음 포함).
- **메인페이지 알림**: 기존 `student_get_notifications`(`script.js`) 폴링 + `admin_notice` 모달로 자동 노출 → 추가 프론트 불필요.
- **남은 작업**: **4개 Lambda 재배포**(UserCore/Analysis/Payment/AdminCore). 참고: pending 시작일이 현재 종료일과 동일 타임스탬프(연속)라 표시상 같은 날로 보일 수 있음 — "다음날부터"로 보이게 하려면 프론트 표기 1줄 조정 가능.

---

## 2026-06-05 — 등급 만료 판정 불일치 수정 (calcTier ↔ checkHasProAccess)
- **증상**: PRO 만료(endDate 경과) 계정인데 프론트는 여전히 PRO로 표시 + 시뮬 탭 잠금 안 걸림 → 호출 시 백엔드 403("유료 멤버십 전용").
- **원인**: `StudyCrack_UserCore.calcTier`가 **endDate 만료를 검사하지 않음**(status만 봄) → computedTier='pro' 유지. 반면 `StudyCrack_Analysis.checkHasProAccess`는 endDate 만료 검사 → 403. 두 판정이 어긋남.
- **수정(최종)**: `calcTier` 만료 검사를 **기간제 등급(pro/standard/trial)에만** 적용, 만료 시 free(트라이얼은 preTrialState)로 강등. **basic/starter는 1회 구매(평생)라 만료 제외**.
  - 1차 시도의 함정 2개 교정: ① 만료 PRO가 `return 'basic'` 폴백으로 빠져 mypage가 "평생 이용 가능"(`mypage.js:326`)으로 표시 ② 모든 등급에 startDate+28일 적용 시 평생 BASIC 구매자도 28일 뒤 강등되는 사고.
- **효과**: 만료 PRO/STANDARD → free, 유효 구독 유지, 평생 BASIC 유지. 프론트 시뮬 graceful 잠금 + 403 소멸. checkHasProAccess와 만료 기준 일치.
- **남은 작업**: `StudyCrack_UserCore` Lambda 재배포. (DB 데이터 수정 불필요 — 동적 판정)

---

## 2026-06-05 — 6월 모평 스코어보드 보간 생성 (배포 완료 → 6월 모드 오픈)
`docs/algorithms/jun-scoreboard-interpolation.md`
`docs/exec-plans/completed/260603_jun_scoreboard_preparation.md`

- 6월 등급컷 요약본(`june_mock_exam_grade_cut_preprocess_with_social_science.json`)을 may 보드 구조로 보간해 `2026_jun_scoreboard_final.json` 생성(2.12MB, 22영역). **형식 may와 완전일치 + 단조성/범위 검증 통과**.
- 생성기: `backend-backup/StudyCrack_Analysis/data/_gen_jun_scoreboard.py`.
- ⚠️ 스크린샷 등급컷 기반 **추정치** — 공식 조밀 데이터 확보 시 동일 파일명 교체.
- ✅ `StudyCrack_Analysis` Lambda 재배포 완료(`JUN_NOT_READY` 해제) + 프론트 6월 옵션 오픈(`survey.html`·`tutorial.html`).
- ✅ **추정치 주의 문구**(6월 선택 시에만 노출) 4곳 추가: survey 정량입력, tutorial 성적입력, analysis 합격예측 리포트(`currentExamMode==='jun'`), analysis 사이드바 정량 상세(`examKey==='jun'`).
- **남은 작업**: 운영 스모크 유지. 6월 선택 → 입력 → 환산/분석/시뮬 정상 + 추정치 주의 문구 노출 확인.

---

## 2026-06-04 — 튜터 가입/로그인 전용 흐름 분리 (코드 완료, 인프라+검증 대기)
`docs/exec-plans/active/260604_tutor_auth_separation.md`

- **목적**: 학생/튜터가 같은 입구를 공유하던 구조를 분리해 신원 혼선 재발 방지 + 가입 로직 드리프트 제거.
- **코드 완료**: 공유 가입 코어(`completeSignUp`/`autoLoginAfterSignup`), 튜터 가입 자동로그인, `/tutor/login`(`tutor_login.html`+`handleTutorSignIn`, DB role 검증), 공용 `/login` 튜터 차단, `getRoleLoginPath`/공개경로 튜터 분기.
- **남은 작업**: ① CloudFront/S3 라우팅 `/tutor/login`·`/tutor/signup` 매핑(사용자) ② dev 배포 후 스모크(가입→자동로그인→/mypage/tutor→새로고침→새탭→로그아웃, 튜터의 /login 차단, 학생의 /tutor/login 차단).

---

## 진행 중 플랜 (active)

### 2026-06-09 — 튜토리얼 2과목 상승 전략 엔진 정교화
`docs/exec-plans/completed/260609_tutorial_strategy_projection.md`

- 상태: **부분 완료** — 코드 구현 완료 / dev 스모크 대기.
- 핵심: 한 과목 `+7` 고정 느낌을 없애고, 2과목·현실 문항 단위·8~12주 체감 상승폭·MBTI 설명 연결·극단 점수대 분기까지 포함한 신규 전략 API로 교체.

### 2026-06-04 — 튜터 가입/로그인 전용 흐름 분리
`docs/exec-plans/active/260604_tutor_auth_separation.md`

- 상태: **부분 완료** — 코드 구현 완료 / 인프라 라우팅 + dev 스모크 대기.
- 남은 작업: `/tutor/login`, `/tutor/signup` CloudFront/S3 매핑 추가 후 튜터 가입→자동로그인→마이페이지→새로고침→새탭→로그아웃 및 학생/튜터 입구 차단 스모크.

### 2026-06-01 — 리마인더 스케줄 미발송 진단
`docs/exec-plans/active/260601_reminder_schedule_diagnosis.md`

- **확정 원인**: CloudWatch `/aws/lambda/StudyCrack_Reminder` 로그 스트림 0건 → invocation 자체 미발생 → **H-1(EventBridge 규칙 부재/비활성) + H-3(Lambda Resource-based policy 누락)**.
- **안전 테스트 방안**: Lambda 핸들러에 `event.testPhone` 필터 추가 → 임시 EventBridge 규칙(`{"detail-type":"student-planner-reminder","testPhone":"010-3364-6468"}`)으로 1회 검증 → 정상 시 임시 규칙 삭제 후 운영 cron 3개 등록.
- **운영 cron 3개** (UTC 04:00 = KST 13:00): 일요일/월요일/수요일 각각 `cron(0 4 ? * {SUN|MON|WED} *)` + 해당 `detail-type` Constant Input.
- **남은 작업**: Lambda 재배포 → 임시 cron 검증 → 운영 cron 등록 → 다음 일요일 1차 운영 검증.

### 2026-06-01 — Front_Draft 앱 프론트 선별 이관 (Draft, 미실행)
`docs/exec-plans/completed/260601_front_draft_app_front_only_migration.md`

- 상태: **미완료** — 실행 전 Draft. `origin/Front_Draft`에서 앱 프론트 파일(`studycrack-mobile.{html,js,css}` + 관련 이미지)만 선별 이관 계획. 기존 웹 프론트 절대 미수정.

---

## 운영자 잔여 작업 (코드 완료된 3개 플랜의 후속)

대상 플랜 (모두 `docs/exec-plans/completed/`로 이관됨):
- `260529_vbank_flow_and_test_payment_ux.md`
- `260530_session_expiry_unification.md`
- `260531_nicepay_dev_prod_key_separation.md`

### 1️⃣ AWS Lambda 환경변수

**`StudyCrack_Payment`**
- 추가: `NICEPAY_DEV_CLIENT_KEY`, `NICEPAY_DEV_SECRET_KEY`, `NICEPAY_PROD_CLIENT_KEY`, `NICEPAY_PROD_SECRET_KEY`
- (선택) 추가: `NOTIFICATION_LAMBDA_NAME=StudyCrack_Notification`
- 삭제 가능: 기존 `NICEPAY_CLIENT_KEY`, `NICEPAY_SECRET_KEY`, `SOLAPI_*`, `ADMIN_PHONE`

**`StudyCrack_Notification`**
- 추가: `SOLAPI_TPL_PAYMENT_BASIC`, `_STARTER`, `_STANDARD`, `_PRO`, `ADMIN_PHONE`

### 2️⃣ Lambda 재배포 + Alias 업데이트
- `StudyCrack_Payment` 새 zip 업로드 → publish version → DEV/PROD alias 둘 다 새 version으로 이동
- `StudyCrack_Notification` 새 zip 업로드 → publish version → alias 업데이트

### 3️⃣ AWS IAM — `StudyCrack_Payment-role-101l8rm8`
- 제거: `StudyCrack_Notifications` 테이블 PutItem 권한
- 추가: `lambda:InvokeFunction` (Resource: `arn:aws:lambda:ap-northeast-2:235270182853:function:StudyCrack_Notification`)

### 4️⃣ NicePay 콘솔 webhook URL 등록 (각 콘솔 1곳씩, 한 콘솔에 두 URL 금지)
- 테스트 가맹점 콘솔 → `https://api.dev.studycrack.co.kr/api/payment-notify`
- 운영 가맹점 콘솔 → `https://api.studycrack.co.kr/api/payment-notify`

### 5️⃣ (선택) Cognito User Pool Access Token 유효기간 점검
- dev에서 "세션 만료가 빨라" 보고됨 — User Pool → App client → Access token expiration 확인 후 1h~24h로 조정 권장.

### 6️⃣ 회귀 테스트
- **260529**: 16종 결제 시나리오 (카드/vbank × testpay 1/2 × 정상/오입금/webhook 재발사 등)
- **260530**: 9종 세션 만료 시나리오 (학생/튜터/관리자 만료, 결제 도중 만료 시 checkoutData 보존, 공개경로 401, 동시 401 싱글톤, 401·403 redirect 흐름, 배너 표시 등)
- **260531**: dev/prod 결제 격리 확인 (각 콘솔 거래 내역 비교)

### 7️⃣ 프론트엔드 배포
GitHub Actions(`.github/workflows/deploy.yml`)에 push만 하면 자동.

---

## 최근 완료

- 2026-07-17: 모바일 최초 로딩 높이 체인 및 홈 카드 간격 정리 — `docs/exec-plans/completed/260717_mobile_loading_home_tile_spacing.md`
  - `#root` → `.app-shell` → `.app-frame` → `.splash-v2` 높이 체인을 `100dvh` 기준으로 고정해 splash가 위로 몰리거나 아래가 잘리는 문제를 보정.
  - 홈 전용 `--home-screen-gap`을 도입해 카드 사이 간격을 공통 탭보다 넓게 분리. 360px 이하에서는 14px로 축소.
  - `오늘 누적 공부`, `오늘 공부 목표`, `리포트 미리보기`, `내 공부 랭킹` 카드의 surface/head/badge/CTA/리포트 타일/랭킹 진행바 정렬을 같은 홈 카드 시스템으로 통일.
  - 검증: `npm run check`, `npm run build`, `git diff --check` 통과. Vite 500KB chunk warning은 기존 번들 구조 경고.

- 2026-07-17: 모바일 탭 공통 간격 및 홈 대학 카드 겹침 재보정 — `docs/exec-plans/completed/260717_mobile_tile_spacing_university_card_recheck.md`
  - 공통 탭 stack gap `--mobile-screen-gap`을 18px로 상향하고 홈 전용 gap도 18px로 정렬. 360px 이하에서는 16px.
  - `.home-section`에 `display:grid`와 `gap:16px`를 명시해 지원학과 기준 카드와 대학 슬라이더가 붙는 문제를 보정.
  - 홈 대학 카드 상단을 `제목 / 점수 / 삭제 버튼` 3열 grid로 바꾸고, 삭제 버튼을 absolute가 아닌 static grid item으로 이동해 `0점`과 `X` 겹침 제거.
  - CSS 감사 결과 `design-v2.css`는 2,103줄, 223KB, duplicate hits 847, `!important` 410회로 여전히 구조 정리 필요. 이번 수정으로 중복 수치는 증가하지 않음.
  - 검증: `npm run check`, `npm run build`, `git diff --check`, `node tools/audit_css_duplicates.mjs` 통과.

- 2026-07-17: 모바일 CSS 중복 정리 Phase 4A~4B 1차 — `docs/exec-plans/completed/260715_mobile_css_bloat_duplication_audit.md`
  - 홈 계열 초기/중간 override를 제거하고, 최종 home redesign/density 섹션으로 source of truth를 이동.
  - mobile layout final block의 불필요한 `!important`를 제거.
  - 수치 변화: `design-v2.css` 2,103 lines / 223KB / duplicate hits 847 / `!important` 410회 → 2,026 lines / 215KB / duplicate hits 771 / `!important` 277회.
  - 번들 크기: 819.39KB(gzip 228.74KB) → 811.63KB(gzip 227.76KB).
  - 검증: `npm run check`, `npm run build`, `git diff --check`, `node tools/audit_css_duplicates.mjs` 통과.

- 2026-07-17: 모바일 CSS 중복 정리 Phase 4C~4D 1차 — `docs/exec-plans/completed/260715_mobile_css_bloat_duplication_audit.md`
  - 분석 탭 게이지(`analysis-main-gauge-*`)의 구조/최종 디자인값을 한 source of truth로 통합.
  - 점수 상승 시뮬레이션 표(`analysis-sim-*`)의 큰 버전 + density override 중복을 compact 규칙으로 통합.
  - 수치 변화: `design-v2.css` 2,026 lines / 215KB / duplicate hits 771 / `!important` 277회 → 1,967 lines / 209KB / duplicate hits 709 / `!important` 273회.
  - 번들 크기: 811.63KB(gzip 227.76KB) → 806.14KB(gzip 226.78KB).
  - 검증: `npm run check`, `npm run build`, `git diff --check`, `node tools/audit_css_duplicates.mjs` 통과.

- 2026-07-17: 모바일 CSS 중복 정리 Phase 4E 카드 계층 1차 — `docs/exec-plans/completed/260715_mobile_css_bloat_duplication_audit.md`
  - 홈 대학 카드(`home-result-card-v3`, `home-add-univ-card`)와 `home-kpi-track`의 분산 override를 최초 정의 위치로 통합.
  - 분석 카드(`analysis-boost-card`, `analysis-v2-compare-card`)를 독립 source of truth로 정리하고 불필요한 `!important`를 제거.
  - 수치 변화: `design-v2.css` 1,967 lines / 209KB / duplicate hits 709 / `!important` 273회 → 1,959 lines / 209KB / duplicate hits 694 / `!important` 265회.
  - 번들 크기: 806.14KB(gzip 226.78KB) → 805.73KB(gzip 226.72KB).
  - 검증: `npm run check`, `npm run build`, `git diff --check`, `node tools/audit_css_duplicates.mjs` 통과.

- 2026-06-03: LOCAL 환경 학생 로그인 활성화 — `docs/exec-plans/completed/260603_local_env_login_activation.md`
  - **원인 1 (인프라)**: HTTP API `StudyCrack_CookieAuthorizer`의 Identity Sources가 `$request.header.Cookie` 단독 → LOCAL은 SameSite=Lax 크로스-사이트 쿠키 제약으로 Cookie 헤더 부재 → API Gateway가 Authorizer Lambda invoke 자체를 skip하고 401. CloudWatch에 `Authorization failed` 로그 0건이 결정적 단서였음.
  - **원인 2 (프론트)**: `silent_refresh`/`register_refresh_cookie`/`clearServerSessionCookies`가 모두 쿠키 의존 → LOCAL은 refresh 사이클 불가.
  - **조치 (인프라, 사용자 콘솔 수동)**: `StudyCrack_CookieAuthorizer` → Identity Sources 비움 + Caching TTL 0 (방안 X 수정판). HTTP API는 라우트별 Authorizer가 전 스테이지 공유라 별도 LOCAL Authorizer 신설은 불가했음.
  - **조치 (프론트, 3-edit)**: `js/auth.js` `registerRefreshCookie`, `js/shared/api.js` `tryRefreshToken`/`clearServerSessionCookies`에 `IS_LOCAL` 분기 추가. LOCAL은 body 기반 `refresh_token` 경로로 위임. dev/prod는 dead branch라 회귀 위험 0 (확인 완료).
  - **사각지대**: dev/prod의 "sessionStorage 비고 at 쿠키만 살아있는" cookie-only 경로는 LOCAL에서 재현 불가 → 인증 흐름 변경 PR은 LOCAL 통과만으로 검증 완료로 보지 않고 dev 스모크 1사이클 의무화 (운영 가드).
  - **후속**: 소셜 로그인 LOCAL 활성화, 관리자 로그인 LOCAL 활성화(admin_login.html inline 호출), 결제 LOCAL 활성화는 별도 플랜.

- 2026-06-02: PRO 리포트 일정 명시 UX (격주 2회차) — `docs/exec-plans/completed/260602_pro_report_schedule_ux.md`
  - **원래 버그**: 1주차 마감 후 PRO 유저 전원이 "접수 마감됨"으로 잠기던 문제. `renderProDashboard`의 단일 `deadlineDate`가 결제일 기준 첫 일요일에 영구 고정된 게 원인.
  - **신규 UI**: 결제 시점 기준 R1·R2 마감일/수령일을 카드로 명시. 현재 회차는 좌측 4px 강조 바 + 원형 회차 배지 + 상태 라벨(✓완료/신청 가능/대기/종료). `pendingSubscription` PRO·active이면 "다음 멤버십 일정 카드"를 추가 노출해 연속성 강조.
  - **마감 게이트**: 단일 플래그 → `windowState` 5상태(`r1`/`r2`/`closed`/`pending_active`/`expired`)로 전환.
  - **디자인 보강**: PRO 섹션 전체를 light theme(`#f9f9fb` + 푸른 텍스트)로 모바일/PC 통일. 보고서 보관함만 의도적으로 dark 유지.
  - **부수 fix**: `checkout.html` 결제수단 카드 그리드 `repeat(3,1fr)` → `repeat(2,1fr)`. 가상계좌/카드 두 카드가 가로 너비 반반 차지.
  - 백엔드 변경 없음. dev에서 사용자가 직접 회귀 확인 완료.

- 2026-06-01: 프론트 주석 보안 정리 — `docs/exec-plans/completed/260601_frontend_comment_security_cleanup.md`
  - 번들 노출 전제로 등급 1~3 주석을 `docs/security/architecture-notes.md`(인증/인프라/결제) + `docs/algorithms/tutorial-recommendation.md`(MBTI/Greedy/학습기간)로 이관. 코드 옆에는 §참조만 남김.
  - 동작 변경 1건: `/payment?testpay=1|2` 파라미터를 prod 환경에서 무시(`js/payment.js` 진입부 가드). 백엔드 정가 검증·등급 락은 이미 완비됨을 확인.
  - `CLAUDE.md` Golden Principles에 "프론트 주석은 외부 노출 전제" 원칙 신설. 향후 새 알고리즘/인증 흐름은 docs에 사양화 후 §참조만 코드에 남김.

- 2026-06-01: `js/analysis.js` 리팩토링 (모듈 분리) — `docs/exec-plans/completed/260531_analysis_js_refactor.md`
  - `js/analysis.js` 4,372줄 → 2,366줄(-46%). 신규 모듈 `js/analysis/backtrace.js`(979줄), `js/analysis/coaching.js`(1,080줄). 세 파일이 같은 글로벌 스코프 공유. Phase 3 dev 회귀(13종)는 별도 진행.

- 2026-05-31: NicePay dev/prod 가맹점 키 분리 — `docs/exec-plans/completed/260531_nicepay_dev_prod_key_separation.md`
  - `js/config.js`에서 `IS_DEV||IS_LOCAL` 분기로 NicePay clientId 자동 선택. 백엔드는 **런타임 alias 감지** 방식(env에 양쪽 키 모두 저장, `context.invokedFunctionArn`의 alias suffix로 선택, 미상 시 DEV fallback). 운영자 잔여 작업 1️⃣·2️⃣ 참고.

- 2026-05-30: 세션 만료 처리 일원화 (apiFetch 통합 + 재로그인 UX) — `docs/exec-plans/completed/260530_session_expiry_unification.md`
  - `js/shared/api.js`가 단일 인증 모듈. auth.js 슬림화, 5개 페이지 자체 apiFetch 삭제, 18개 HTML에 shared/api.js 로드, `localStorage.clear()` 7곳 allowlist(`clearClientSession`) 통일(`checkoutData` 보존), 로그인 페이지 만료 사유 배너 추가. 후속 패치(`const` 중복 해소 + HTTP API Authorizer 403 처리)도 포함.

- 2026-05-29: 가상계좌 결제 흐름 정상화 & 테스트 결제 UX 정리 — `docs/exec-plans/completed/260529_vbank_flow_and_test_payment_ux.md`
  - vbank 발급 분기 + `/payment-notify` webhook + 오입금 처리(`computeExpectedAmount` 단일화, `amount_mismatch` 마킹, NicePay `0000` 응답으로 재시도 차단, 영수증 부재 fallback 정가 검증). 알림 발송은 Payment → Notification Lambda 위임으로 전환. 티어별 알림톡 템플릿 4종 분리. checkout에서 실시간 계좌이체 옵션 제거. 운영자 잔여 작업 1️⃣~4️⃣·6️⃣ 참고.

- 2026-05-29: API 응답 최소화 (Response Minimization) 보안 강화 — `docs/exec-plans/completed/260529_api_response_minimization.md`
  - **Phase 1 (P0)**: 학생 `get_user` 응답에서 `subscriptionBid` 즉시 제거. 호출 목적별 신규 type `get_user_mypage` / `get_user_payment` / `get_user_analysis` 도입(명시적 allowlist). `get_tutor_info` 응답에서 튜터 `name`(실명)·`phone` 제거. 프론트 6곳(mypage/payment/survey/analysis/tutorial/social-callback) 마이그레이션.
  - **Phase 2 (P1)**: `tutor_get_profile` 신규 — 정산/계좌/authorized 분리. `tutor_get_student_detail` allowlist에서 `currentSubscription/pendingSubscription` 통째 노출 제거(`{tier,status}` 축약). 튜터의 학생 PII(email/phone/createdAt) 응답에서 제외 + 사이드바 UI 동시 가림.
  - **Phase 3 (P2)**: `admin_search_list` 신규 — 검색 리스트 화면용 lite 응답. CSV 내보내기 시점에만 무거운 `admin_search` 별도 fetch. `admin_get_tutor_list` + `admin_get_tutor_detail` lazy-load 분리. `admin_get_all_qna` 응답에서 phone을 끝 4자리만 노출.
  - **Phase 4 (P2)**: `get_pro_reports`에서 호출자 manager 여부(`isManager`)로 분기 — 학생 응답에서 `draft`/`rejectReason` 미포함. `requesterRole` body 파라미터는 인가 분기에 사용하지 않고 JWT/DB 기반 검증으로만 권한 판별.
  - **부수**: 학교 일원화(`students.school` → `qualitative.school` 단일 소스). 역추적 엔진 dual-subject 표점 보정. `admin_detail.html` 정보 탭 리디자인.

- 2026-05-27: 관리자 대시보드 자산 버전 충돌 패치 (`4256abb`)
- 2026-05-26: 관리자 디테일 페이지 데이터 로딩 안정화 (`a6a00da`, `d8c494b`, `e0a2baf`, `d2786ce`, `2719d8a`) + 토큰 갱신 단일 Promise 락 도입 + 전 페이지 자산 버전 일괄 정렬
- 2026-05-25: 세션 만료 처리 1차 패치 (`2886fa6`) — `isPublicRoute()` 도입, 401 시 분기
- 2026-05-25: 튜터 마이페이지 닉네임 alias 캐시 (`966edd6`)
- 2026-05-25: 역추적 엔진 2.0 디자인 반영 (`5671af3`, `208dfbf`, `3e7af22`)
- 2026-05-26: `00_urgent_issue.md` / `01_admin_detail_page_update.md` 완료 이관

---

## 메모

- `docs/exec-plans/active/`에는 진행 중 문서만 유지한다.
- 완료 문서는 `docs/exec-plans/completed/`로 즉시 이관한다.
- 현재 active 플랜은 위 상단의 `현재 active 계획` 7개만 유지한다. 구현과 로컬 검증이 끝난 후 dev 실세션 확인만 남는 모바일 항목은 `260706_mobile_dev_smoke_backlog.md`로 통합한다.
- **2026-08-12 로컬 모바일 실행 명령**: `studycrack-mobile-app`에 `npm run local`(프로덕션 번들 빌드 후 저장소 루트 정적 서버 실행)과 `npm run local:serve`(기존 빌드 재사용)를 추가했다. `tools/static-preview.mjs`의 기본 포트를 `3000`으로 통일하고 `/studycrack-mobile` clean URL을 `studycrack-mobile.html`로 연결했으며, 로컬 검증 중 오래된 번들이 남지 않도록 `Cache-Control: no-store`를 적용했다.
- **2026-08-13 모바일 외부 폰트 404 제거**: `studycrack-mobile.html`의 Google Fonts 원격 stylesheet와 preconnect를 제거하고 모바일 기본 폰트를 Pretendard·Apple 시스템 한글 폰트 순서로 통일했다. 홈 타이머도 전역 폰트를 상속한다. Noto Sans KR 분할 `woff2` CDN 404는 백엔드와 무관하며, 이 변경으로 앱 초기 네트워크 오류 목록에서 제거된다.
