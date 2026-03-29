# 🎓 StudyCrack (스터디크랙) - 데이터 기반 입시 컨설팅 플랫폼

**StudyCrack**은 수험생과 입시 전문가(Tutor)를 연결해주는 **1:1 맞춤형 입시 컨설팅 및 학습 관리 웹 플랫폼**입니다.
AWS Serverless 아키텍처와 **API Gateway**를 기반으로 설계되어 강력한 보안성과 확장성을 자랑하며, 학생의 멤버십 등급(Basic, Standard, Pro)에 따라 정밀한 AI 성적 분석과 주간 플래너 첨삭 등 차별화된 입시 솔루션을 제공합니다.

---

## 🚀 Deployment & CI/CD (배포 및 환경 분리 파이프라인)

안정적인 무중단 서비스 운영과 안전한 테스트를 위해, 프론트엔드와 백엔드 모두 **개발(Dev)**과 **운영(Prod)** 환경으로 완벽하게 분리되어 있습니다.

### 1. Frontend 배포 파이프라인 (GitHub Actions)
GitHub Repository의 브랜치(Branch) 관리를 통해 S3 버킷과 CloudFront로 자동 배포됩니다. AWS 인증은 보안이 강화된 **OIDC(OpenID Connect)** 방식을 사용합니다.

* **개발 환경 (`dev` 브랜치)**
  * `dev` 브랜치에 코드가 푸시되면 GitHub Actions가 작동하여 **개발용 S3 버킷**(`dev.studycrack.co.kr`)으로 자동 배포합니다.
  * 테스트 URL(`https://d17e...cloudfront.net`)에서 실제 유저에게 영향을 주지 않고 UI 및 API 통신을 미리 검증할 수 있습니다.
* **운영 환경 (`main` 브랜치)**
  * 개발 환경에서 검증이 끝난 코드를 `main` 브랜치로 **Merge(병합)**하면, **운영용 S3 버킷**(`studycrack.co.kr`)으로 자동 배포되고 CloudFront 캐시가 즉시 무효화됩니다.

### 2. Backend 환경 분리 (API Gateway & Lambda)
API Gateway의 **스테이지(Stage)**와 Lambda의 **별칭(Alias)**을 결합하여 완벽한 백엔드 라우팅 체계를 구축했습니다.

* **Lambda 버전 관리 및 별칭**
  * `DEV` 별칭: 항상 코드의 최신 상태(`$LATEST`)를 가리킵니다. 개발 중인 코드가 즉시 반영됩니다.
  * `PROD` 별칭: 테스트가 완료되어 고정된 '특정 버전(예: 버전 1, 버전 2)'만을 가리킵니다.
* **API Gateway 동적 라우팅**
  * 통합 요청(Integration Request)에 함수 이름을 직접 명시하지 않고, 동적 변수(`${stageVariables.lambdaAlias}`)를 사용합니다.
  * 프론트엔드에서 `/dev/` 경로로 요청하면 `DEV` 별칭의 람다가, `/prod/` 경로로 요청하면 `PROD` 별칭의 람다가 실행됩니다.

### 3. 스마트 라우팅 (Smart API Routing)
프론트엔드 코드(`js/config.js`)는 현재 실행 중인 도메인(`window.location.hostname`)을 스스로 감지합니다. 로컬 PC나 개발용 도메인에서 접속 시 자동으로 API 주소에 `/dev/`를 삽입하고, 공식 운영 도메인 접속 시 `/prod/`를 삽입하여 코드를 수정할 필요 없이 안전하게 API를 호출합니다.

### 📌 표준 개발 및 업데이트 워크플로우
1. **[개발]** 로컬에서 작업한 코드를 GitHub `dev` 브랜치에 푸시합니다. Lambda 코드는 콘솔에서 수정 및 저장(`$LATEST`)합니다.
2. **[검증]** 개발용 도메인에 접속하여 새 기능과 API가 정상 작동하는지 테스트합니다.
3. **[백엔드 배포]** Lambda 콘솔에서 [새 버전 발행]을 클릭하여 코드를 고정하고, `PROD` 별칭이 해당 새 버전을 가리키도록 수정합니다.
4. **[프론트엔드 배포]** GitHub에서 `dev` 브랜치를 `main` 브랜치로 Merge 하면 유저 화면에 업데이트가 릴리즈됩니다.
5. **[긴급 롤백]** 백엔드에 치명적인 오류 발생 시, Lambda `PROD` 별칭을 이전 버전으로 변경하여 단 10초 만에 롤백합니다. 프론트엔드는 GitHub에서 이전 커밋으로 Revert 합니다.

---

## 🛠 Tech Stack (기술 스택)

### Frontend
* **HTML5 / CSS3**: 반응형 웹 디자인 (Mobile, Tablet, Desktop), 모바일 마법사(Wizard) UI 및 다크/라이트 테마 제어
* **JavaScript (ES6+)**: `Vanilla JS` 기반의 가벼운 SPA 라우팅 및 모달 제어, `fetch` API를 활용한 비동기 통신
* **Libraries**: `Chart.js` (데이터 시각화), `PDF.js` & `html2pdf.js` (피드백 리포트 PDF 렌더링 및 다운로드)

### Backend (AWS Serverless)
* **AWS API Gateway**: REST API 엔드포인트 통합 관리, CORS 및 라우팅 처리
* **AWS Cognito**: 사용자 인증(User Pool) 및 Bearer Token 기반 API 접근 제어
* **AWS Lambda**: 비즈니스 로직 처리 (유저 관리, 결제, 성적 환산, 매칭 로직 등 마이크로서비스 연동)
* **AWS DynamoDB**: NoSQL 데이터베이스 (유저 프로필, 성적, 주간 학습 기록, 결제 로그 통합 저장)
* **AWS S3**: 학생 플래너 이미지 및 모의고사 성적표 등 정적 파일 스토리지

### External Integration
* **Stripe / 무통장입금**: 신용카드 결제 및 Webhook 연동 (결제 자동화)
* **Solapi (CoolSMS) / AWS SES**: 관리자 알림, 카카오 알림톡 및 마케팅 메일 발송

---

## ✨ Key Features (주요 기능)

### 1. 👨‍🎓 사용자(학생) 서비스
* **목표 대학 설정 및 시뮬레이션 (`analysis.html`)**: 내 환산 점수와 목표 대학 입결을 비교하고, 과목별 점수 상승 시 합격 확률 변화를 차트로 시뮬레이션
* **주간 학습 점검 및 코칭 (`mypage.html`)**: 매주 플래너와 학습 달성률을 입력하고, 전문가의 심층 코칭 리포트를 PDF 형태로 제공받는 기능
* **기초조사서 (`survey.html`)**: 성적(정량) 및 진로/가치관(정성) 데이터를 입력하여 컨설팅의 기초 자료로 활용
* **결제 시스템 (`checkout.html`, `payment.html`)**: 멤버십(Basic, Standard, Pro) 결제 및 무통장 입금 연동

### 2. 👨‍🏫 전문가(튜터) 서비스
* **튜터 전용 공간 (`mypage_tutor.html`, `signup_tutor.html`)**: 컨설턴트 가입 및 전용 마이페이지 제공
* **학생 매칭 및 리포트 작성**: 배정된 학생의 주간 학습 데이터를 확인하고 피드백 리포트를 작성하여 전달

### 3. ⚙️ 관리자(Admin) 시스템
* **통합 대시보드 (`admin_index.html`)**: 결제 현황, 신규 가입자, 튜터-학생 매칭 현황 등 전체 지표 시각화
* **학생 상세 관리 (`admin_detail.html`)**: 특정 학생의 성적 추이, 상담 히스토리, 결제 내역 등을 심층 조회하고 관리 (강제 탈퇴, 등급 UP 등)
* **Q&A 및 알림 관리 (`qna.html`)**: 1:1 문의 응대 및 전체/타겟 유저 대상 공지 발송 시스템

---

## 📂 Project Structure (디렉토리 구조)

프로젝트는 역할과 도메인에 따라 직관적으로 분리되어 있습니다.

```text
StudyCrack/
├── index.html                  # 메인 랜딩 페이지
├── login.html                  # 사용자 로그인
├── signup.html                 # 일반 학생 회원가입
├── signup_tutor.html           # 전문가(튜터) 전용 회원가입
├── welcome.html                # 가입 환영 및 온보딩 페이지
├── change-password.html        # 비밀번호 변경
│
├── mypage.html                 # 학생 마이페이지 (정보 관리)
├── analysis.html               # [핵심] 입시 분석 및 솔루션 (목표대학, 시뮬레이션, 코칭)
├── survey.html                 # 학생 기초조사서 및 성적 입력 폼
├── qna.html                    # 1:1 고객센터 및 문의
│
├── payment.html                # 멤버십 안내 및 결제 선택
├── checkout.html               # 카드 결제 연동 페이지
├── checkout-transfer.html      # 무통장 입금 안내 페이지
├── success.html                # 결제 완료 처리
├── promo.html                  # 프로모션 및 이벤트 페이지
│
├── mypage_tutor.html           # 튜터 전용 마이페이지 및 학생 관리
├── admin_index.html            # 총괄 관리자 대시보드
├── admin_detail.html           # 관리자용 학생 상세 관리 페이지
│
├── css/                        # 도메인별 스타일시트
│   ├── style.css               # 공통 스타일, GNB/Footer, 타이포그래피
│   ├── analysis.css            # 분석 솔루션 전용 (차트, 마법사 UI 등)
│   ├── auth.css                # 로그인/회원가입 관련
│   ├── admin_theme.css         # 관리자 페이지 공통 레이아웃
│   ├── admin_detail.css        # 관리자 상세 페이지
│   ├── mypage.css              # 학생 마이페이지
│   ├── mypage_tutor.css        # 튜터 마이페이지
│   └── payment.css, survey.css, qna.css, checkout.css 등
│
├── js/                         # 도메인별 비즈니스 로직
│   ├── config.js               # 전역 설정 (API URL, 상수 등)
│   ├── auth.js                 # Cognito 토큰 발급 및 세션 검증
│   ├── script.js               # 공통 UI 제어 및 이벤트 리스너
│   ├── analysis.js             # [핵심] 분석 로직, 차트 렌더링, 모바일 위저드 UI
│   ├── admin_ui.js             # 관리자 화면 동적 제어
│   ├── admin_detail.js         # 관리자 상세 데이터 Fetch 및 DOM 조작
│   ├── mypage_tutor.js         # 튜터 시스템 API 연동
│   └── survey.js, payment.js, qna.js, checkout.js 등
│
└── assets/                     # 정적 리소스
    ├── backgrounds/            # 배경 및 워터마크 이미지
    ├── features/               # 기능 설명용 일러스트/아이콘
    ├── fonts/                  # 웹 폰트 파일
    └── images/                 # 로고 및 범용 이미지
```

---

## 🔐 Security & Operations (보안 및 운영)

* **인증 인가**: AWS Cognito `idToken`을 활용하여 클라이언트에서 모든 API 요청 헤더에 Authorization 포함. API Gateway Authorizer가 유효성 검증.
* **XSS 방지**: 데이터 바인딩 시 `escapeHtml` 등 자체 이스케이프 함수를 거쳐 DOM에 주입하여 프론트엔드 취약점 최소화.
* **DynamoDB 파서 적용**: 서버에서 넘어오는 AWS DynamoDB 특유의 데이터 포맷(N, S, M, L)을 클라이언트용 순수 JSON 객체로 자동 파싱(`parseDynamoItem`)하여 사용 편의성 증대.

---

> **📅 Last Updated:** 2026년 3월 30일 (월) - 자동 배포(CI/CD) 및 Dev/Prod 환경 분리 아키텍처 적용 완료