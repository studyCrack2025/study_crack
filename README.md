# 🎓 StudyCrack (스터디크랙) - 입시 컨설팅 플랫폼

**StudyCrack**은 수험생을 위한 1:1 맞춤형 입시 컨설팅 및 학습 관리 웹 플랫폼입니다.
AWS Serverless 아키텍처를 기반으로 구축되어, 회원 관리부터 결제, 데이터 분석, 상담 관리까지 통합된 올인원 솔루션을 제공합니다.

## 🛠 Tech Stack (기술 스택)

### Frontend

* **HTML5 / CSS3**: 시멘틱 마크업 및 모바일 친화적 반응형 디자인
* **JavaScript (ES6+)**: Vanilla JS를 활용한 SPA(Single Page Application) 수준의 동적 UI 구현
* **Chart.js**: 관리자 대시보드 내 매출 및 통계 데이터 시각화

### Backend (Serverless)

* **AWS Cognito**: 사용자 인증 (회원가입, 로그인, SMS/이메일 인증, 세션 관리)
* **AWS Lambda**: 비즈니스 로직 처리 (API 엔드포인트 역할)
* `StudyCrack_API`: 유저/관리자 데이터 조회, 수정, 통계 집계
* `StudyCrack_Payment`: 결제 프로세싱, 구글 시트 로깅, 알림 발송


* **AWS DynamoDB**: NoSQL 데이터베이스 (학생 정보, 결제 이력, 정성/정량 데이터 통합 관리)

### External Tools

* **Stripe**: 신용카드 결제 시스템 연동
* **Google Sheets API**: 실시간 주문 대장 자동화 (백업 DB)
* **Solapi (CoolSMS)**: 결제 및 상태 변경 알림톡 발송

---

## ✨ Key Features (주요 기능)

### 1. 사용자(학생) 시스템

* **회원 관리**: 이메일 아이디 및 전화번호 인증을 통한 회원가입, 자동 로그인 유지
* **마이페이지 (계정 관리)**:
* 개인정보(이름, 학교, 연락처) 수정 및 비밀번호 변경
* **멤버십 티어 시스템**: 최근 결제 상품에 따라 4단계(Basic, Standard, Pro, Black) 등급 자동 적용 및 전용 뱃지/테두리 UI 노출


* **기초조사서 (Survey)**:
* 마이페이지와 분리된 독립적인 입력 환경 제공
* **정성 데이터**: 진로 희망, 지원 대학(1~5지망), 입시 가치관 등 상세 조사
* **정량 데이터**: 모의고사 및 수능 과목별 성적 입력 및 저장



### 2. 결제 및 멤버십

* **상품 신청**: 로그인 정보 기반 주문서 자동 작성 기능
* **실시간 결제 처리**: Stripe 연동을 통한 즉시 결제 및 결과 처리
* **자동 등급 조정**: 결제 완료 시 DynamoDB 내역 업데이트 및 멤버십 등급 즉시 반영

### 3. 관리자(Admin) 시스템

* **전용 대시보드**:
* **통계 요약**: 총 회원 수, 누적 매출, 당월 매출 실시간 집계
* **데이터 시각화**: 기간별(주/월/분기) 매출 추이 꺾은선 그래프, 상품별 판매 비중 도넛 차트 제공


* **학생 관리**:
* 이름/이메일/전화번호 기반 학생 검색
* 전체 학생 목록 조회 및 유료/무료 회원 식별 뱃지 표시


* **상세 조회 (Deep Dive)**:
* 특정 학생의 기초조사서(정성/정량) 열람 기능
* 관리자 전용 **상담 메모** 작성 및 저장 기능



---

## 📂 Project Structure (폴더 구조)

```bash
StudyCrack/
├── index.html              # 메인 랜딩 페이지
├── login.html              # 로그인 페이지
├── signup.html             # 회원가입 (이메일/SMS 인증)
├── mypage.html             # 마이페이지 (계정 정보, 티어 확인)
├── survey.html             # [NEW] 기초조사서 입력 (정성/정량 데이터)
├── payment.html            # 컨설팅 상품 결제
├── success.html            # 결제 완료 및 티어별 안내 메시지
├── admin.html              # [NEW] 관리자 대시보드 (통계, 차트)
├── admin_student_detail.html # [NEW] 학생 상세 조회 및 메모 관리
│
├── css/                    # 스타일시트
│   ├── style.css           # 공통 스타일
│   ├── auth.css            # 인증 관련 (로그인/가입)
│   ├── admin.css           # 관리자 페이지 전용 스타일
│   ├── survey.css          # 조사서 폼 스타일
│   └── mypage.css          # 티어별(Gold/Black 등) UI 스타일 포함
│
├── js/                     # 비즈니스 로직
│   ├── config.js           # AWS 설정
│   ├── auth.js             # 인증 및 세션 관리
│   ├── admin.js            # 관리자 통계/검색 로직 (Chart.js 연동)
│   ├── survey.js           # 조사서 데이터 처리
│   └── payment.js          # 결제 프로세스
│
└── assets/                 # 이미지 및 리소스

```

---

## 💾 Data Flow (데이터 흐름)

1. **회원가입**: Cognito 인증 → `userid` 생성 → DynamoDB 초기 데이터 적재
2. **결제**: 클라이언트 요청 → Lambda (Google Sheet 로깅) → Stripe 결제 → Webhook → DynamoDB `payments` 배열 업데이트 (`list_append`)
3. **통계**: 관리자 접속 → Lambda가 전체 유저 스캔 및 `payments` 데이터 집계 → 프론트엔드에서 기간별(주/월) 재가공 후 차트 렌더링
