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
