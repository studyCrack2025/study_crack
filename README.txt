# 🎓 StudyCrack (스터디크랙) - 입시 컨설팅 플랫폼

**StudyCrack**은 수험생을 위한 1:1 맞춤형 입시 컨설팅 및 학습 관리 웹 플랫폼입니다.
AWS Serverless 아키텍처를 기반으로 구축되어, 별도의 서버 관리 없이 로그인, 데이터 저장, 결제 연동 기능을 수행합니다.

## 🛠 Tech Stack (기술 스택)

### Frontend

* **HTML5 / CSS3**: 시멘틱 마크업 및 반응형 디자인 (Mobile-First)
* **JavaScript (ES6+)**: Vanilla JS를 사용한 DOM 조작 및 비동기 통신 (`fetch`, `async/await`)

### Backend (Serverless)

* **AWS Cognito**: 사용자 인증 (회원가입, 로그인, SMS 인증)
* **AWS Lambda**: 백엔드 비즈니스 로직 처리 (Node.js 18.x)
* **AWS DynamoDB**: NoSQL 데이터베이스 (학생 정보, 상담 일지, 성적 데이터 저장)

### External APIs

* **Solapi (CoolSMS)**: 카카오톡 알림톡 및 문자 발송 (채널 추가 버튼 등 템플릿 연동)
* **Stripe**: (예정) 결제 시스템 연동

---

## 📂 Project Structure (폴더 구조)

```bash
StudyCrack/
├── index.html           # 메인 랜딩 페이지 (서비스 소개)
├── login.html           # 로그인 페이지
├── signup.html          # 회원가입 페이지 (기본/세부 정보 입력)
├── payment.html         # 컨설팅 프로그램 신청 및 결제 페이지
├── mypage.html          # 마이페이지 (기초조사서, 성적 입력)
│
├── css/                 # 스타일시트 디렉토리
│   ├── style.css        # 공통 스타일 (헤더, 푸터, 레이아웃)
│   ├── auth.css         # 로그인/회원가입 전용 스타일
│   ├── payment.css      # 결제 폼 전용 스타일
│   └── mypage.css       # 마이페이지(탭, 성적표) 전용 스타일
│
├── js/                  # 자바스크립트 로직 디렉토리
│   ├── config.js        # AWS Cognito 설정 파일 (API Key 관리)
│   ├── auth.js          # 인증 로직 (가입, 로그인, 로그아웃, 상태체크)
│   ├── script.js        # 메인 UI 로직 (모달, 네비게이션)
│   ├── payment.js       # 결제 처리 및 Lambda 통신
│   └── mypage.js        # 마이페이지 데이터 로드/저장 로직
│
└── assets/              # 정적 리소스 (이미지 등)
    └── images/
        └── study_cracked_logo.png

```

---

## ✨ Key Features (주요 기능)

### 1. 사용자 인증 (Auth)

* **AWS Cognito 연동**: 이메일 아이디 기반 회원가입 및 로그인.
* **세분화된 가입 절차**:
* 기본 정보(이름, 성별, 생년월일)는 Cognito 표준 속성(Attributes)으로 저장.
* 세부 정보(학교, 희망 계열, 유입 경로)는 `ClientMetadata`를 통해 Lambda로 전송.


* **Post Confirmation Trigger**: 회원가입 완료 시 Lambda가 트리거되어 DynamoDB에 초기 학생 데이터를 자동 생성.

### 2. 마이페이지 (Student Management)

* **탭(Tab) 기반 UI**: 내 정보 / 정성 데이터 / 정량 데이터(성적) 탭 분리.
* **기초 조사서**: 학생의 현재 상태(고3/N수), 희망 대학(1~5지망) 수집.
* **성적 관리**: 3월~수능까지 7개 주요 시험의 과목별 표준점수/백분위/등급 저장 및 로드.
* **상태 배지 시스템**: 조사서 작성 여부에 따라 '미작성/작성중/완료' 배지 자동 업데이트.

### 3. 알림 시스템 (Notification)

* **Kakao AlimTalk**: Solapi API를 활용하여 결제 완료/상담 배정 시 알림톡 자동 발송.
* **Template Matching**: 알림톡 템플릿(채널 추가 버튼 포함)과 100% 일치하는 데이터 구조(`buttons` 배열 등) 구현.

---

## ⚙️ Configuration (설정 방법)

프로젝트 실행을 위해서는 `js/config.js` 파일에 AWS 설정값이 필요합니다.

```javascript
// js/config.js 예시
const CONFIG = {
    cognito: {
        userPoolId: 'ap-northeast-2_XXXXXXXXX', // AWS Cognito User Pool ID
        clientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX'    // AWS Cognito App Client ID (Public, No Secret)
    },
    api: {
        lambdaUrl: 'https://YOUR_LAMBDA_URL...'   // (Optional) 백엔드 API 엔드포인트
    }
};

```

---

## 🏗 AWS Architecture

1. **Client**: 웹 브라우저 (HTML/JS)
2. **Auth Flow**:
* Client → AWS Cognito (Sign Up)
* Cognito → AWS Lambda (Post Confirmation) → DynamoDB (`PutItem`)


3. **Data Flow**:
* Client → AWS Lambda (API) → DynamoDB (Get/Update Student Data)



---

## 🚀 Future Roadmap

* [ ] Stripe 결제 모듈 연동 및 결제 내역 DB 저장
* [ ] 관리자(Admin) 대시보드 페이지 구현 (학생 목록 조회 및 상담 배정)
* [ ] AWS CloudFront + S3를 이용한 정적 웹 호스팅 배포

---

© 2026 Study Crack. All rights reserved.