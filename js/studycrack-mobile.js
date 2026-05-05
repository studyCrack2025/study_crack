const { useState, useEffect, useRef } = React;

const CRACKY_SRC = './assets/images/3A1D897F-252E-4096-AEF2-C4FA7CA6689D.png';
const scoreTierClass = (score) => {
  const n = Number(score) || 0;
  if (n <= 100) return 'score-tier-low';
  if (n <= 150) return 'score-tier-mid';
  return 'score-tier-high';
};
const ONBOARDING_LOGO_SRC = './assets/images/og-image.jpg';
const STUDYCRACK_LOGO_SRC = './assets/images/studycrack_logo_wo_bg.png';
const HOME_FALLBACK_HTML = `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="center init-loading"><h3>스터디크랙 홈</h3><p class="sub">앱을 불러왔어요. 계속 이용해 주세요.</p></div></div></div></div>`;
let initialScrollY = 0;
const DEFAULT_USER = { name: '김지민', targetUniversity: '연세대학교 경영학과', plan: 'Pro' };
const DEFAULT_SCORES = { korean: 82, math: 68, english: 77, inquiry1: 70, inquiry2: 66 };
const DEFAULT_NOTIFICATIONS = { planner: true, weekly: true, report: true, billing: true };
const FIXED_TODAY_DATE = '2024-05-14';
const SCROLL_STORAGE_KEY = 'studycrack_scroll_positions_v1';
const DEFAULT_PLANNER_ITEMS = [
  { id: 'pl-default-1', date: '14', subject: '수학', content: '개념 학습', start: '10:00', end: '12:00', minutes: 120, dot: 'math' },
  { id: 'pl-default-2', date: '14', subject: '영어', content: '독해 문제 풀이', start: '13:00', end: '14:30', minutes: 90, dot: 'eng' },
  { id: 'pl-default-3', date: '14', subject: '탐구', content: '실전문제', start: '15:00', end: '17:00', minutes: 120, dot: 'sci' },
  { id: 'pl-default-4', date: '14', subject: '수학', content: '오답 풀이', start: '19:00', end: '22:00', minutes: 180, dot: 'math' }
];
const PRO_ELITE_REPORTS = [
  { week: '26년 4월 4주차', desc: '심화 집중 루트 + 과목별 우선순위', fileName: 'studycrack-pro-report-26-04-w4.pdf' },
  { week: '26년 4월 3주차', desc: '중간 점검 + 리밸런싱 전략', fileName: 'studycrack-pro-report-26-04-w3.pdf' },
  { week: '26년 4월 2주차', desc: '약점 보강 로드맵 + 실행 체크', fileName: 'studycrack-pro-report-26-04-w2.pdf' },
  { week: '26년 4월 1주차', desc: '실전 루틴 안정화 + 시간 배분', fileName: 'studycrack-pro-report-26-04-w1.pdf' },
  { week: '26년 3월 4주차', desc: '오답 패턴 정리 + 단원 회독', fileName: 'studycrack-pro-report-26-03-w4.pdf' },
  { week: '26년 3월 3주차', desc: '과목 밸런스 조정 + 약점 보강', fileName: 'studycrack-pro-report-26-03-w3.pdf' },
  { week: '26년 3월 2주차', desc: '모의고사 리커버리 + 집중 강화', fileName: 'studycrack-pro-report-26-03-w2.pdf' },
  { week: '26년 3월 1주차', desc: '기본기 리빌드 + 학습 체력 관리', fileName: 'studycrack-pro-report-26-03-w1.pdf' },
  { week: '26년 2월 4주차', desc: '개념 정착 로드맵 + 주간 점검', fileName: 'studycrack-pro-report-26-02-w4.pdf' }
];
const PRO_ELITE_REPORT_PDF_PATH = './assets/features/feat_pro_report.pdf';
const SCORE_LABELS = { korean: '국어', math: '수학', english: '영어', inquiry1: '탐구1', inquiry2: '탐구2' };

const safeParse = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`${key} parse failed`, error);
    return fallback;
  }
};
const isInvalidRequiredSelectValue = (v) => {
  const value = String(v ?? '').trim();
  return !value || ['선택', '과목 선택', '선택하세요', '미선택'].includes(value);
};

const resolveAssetPath = async (path, fallback) => {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok ? path : fallback;
  } catch (_) {
    return fallback;
  }
};
const buildPlannerId = () => `pl-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const normalizePlannerItems = (items = []) => items.map((item, idx) => ({
  ...item,
  id: item.id || `pl-legacy-${idx}-${item.subject || 'item'}`,
  date: item.date || '14'
}));
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error('[APP_INIT_ERROR]', error);
  }
  render() {
    if (this.state.hasError) {
      return <div className="app-shell"><div className="app-frame"><div className="screen app-screen app-content"><div className="center init-loading"><h3>앱을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.</h3></div></div></div></div>;
    }
    return this.props.children;
  }
}

function i(name, primary) {
  const c = primary ? 'icon primary' : 'icon';
  const map = {
    home: `<svg viewBox="0 0 24 24" class="${c}"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" class="${c}"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" class="${c}"><path d="M15 17H5l2-2v-4a5 5 0 1 1 10 0v4l2 2z"/><path d="M9 17a3 3 0 0 0 6 0"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" class="${c}"><path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5M12 18h.01"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" class="${c}"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 4-6"/></svg>`,
    target: `<svg viewBox="0 0 24 24" class="${c}"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" class="${c}"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>`,
    user: `<svg viewBox="0 0 24 24" class="${c}"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>`,
    report: `<svg viewBox="0 0 24 24" class="${c}"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" class="${c}"><path d="M9 6l6 6-6 6"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" class="${c}"><path d="M4 5h16v11H8l-4 4z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" class="${c}"><path d="M20 6L9 17l-5-5"/></svg>`,
    bolt: `<svg viewBox="0 0 24 24" class="${c}"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`
  };
  return map[name] || map.chart;
}

function mascotBubble(text, size = 'sm') {
  const mascotSrc = (window.__studycrackAssetSrc && window.__studycrackAssetSrc.crackySrc) || CRACKY_SRC;
  const sizeClass = size === 'lg' ? 'cracky-lg' : size === 'md' ? 'cracky-md' : 'cracky-sm';
  return `<div class="mascot"><div class="mascot-badge"><img src="${mascotSrc}" class="cracky-img ${sizeClass}" alt="크랙이"/></div><div class="bubble">${text}</div></div>`;
}

function App() {
  console.log('APP_RENDER_START');
  const [screen, setScreen] = useState('splash');
  const [tab, setTab] = useState('home');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFadeOut, setLoadingFadeOut] = useState(false);
  const [error, setError] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedUniversityIndex, setSelectedUniversityIndex] = useState(0);
  const [user, setUser] = useState(DEFAULT_USER);
  const [selectedPlan, setSelectedPlan] = useState(DEFAULT_USER.plan);
  const [duration, setDuration] = useState('4주');
  const [targetMajor, setTargetMajor] = useState(DEFAULT_USER.targetUniversity);
  const [targetOpen, setTargetOpen] = useState(false);
  const [analysisTargetList, setAnalysisTargetList] = useState(['연세대학교 경영학과', '고려대학교 경영대학', '강서대학교 G2빅데이터경영학과']);
  const [homeTargetList, setHomeTargetList] = useState(['연세대학교 경영학과', '고려대학교 경영대학', '강서대학교 G2빅데이터경영학과']);
  const [analysisSearchOpen, setAnalysisSearchOpen] = useState(false);
  const [analysisSearchTerm, setAnalysisSearchTerm] = useState('');
  const [analysisMode, setAnalysisMode] = useState('summary');
  const [analysisEtaStage, setAnalysisEtaStage] = useState(1);
  const [analysisHighlightedSubject, setAnalysisHighlightedSubject] = useState('');
  const [analysisBarProjectionTarget, setAnalysisBarProjectionTarget] = useState('');
  const [activeScoreView, setActiveScoreView] = useState('target');
  const [homeSlideIndex, setHomeSlideIndex] = useState(0);
  const [homeSlideMotion, setHomeSlideMotion] = useState('');
  const [scoreSlideMotion, setScoreSlideMotion] = useState('');
  const [homeDragOffset, setHomeDragOffset] = useState(0);
  const [scoreDragOffset, setScoreDragOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState('14');
  const [plannerCalendarOpen, setPlannerCalendarOpen] = useState(false);
  const [universityModalOpen, setUniversityModalOpen] = useState(false);
  const [plannerDraft, setPlannerDraft] = useState({ subject: '', content: '', durationChoice: '', customMinutes: '' });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupBirth, setSignupBirth] = useState('');
  const [signupGender, setSignupGender] = useState('female');
  const [signupEmailVerified, setSignupEmailVerified] = useState(false);
  const [signupPhoneVerified, setSignupPhoneVerified] = useState(false);
  const [signupTermsAll, setSignupTermsAll] = useState(false);
  const [signupTermsRequired, setSignupTermsRequired] = useState(false);
  const [signupEmailSending, setSignupEmailSending] = useState(false);
  const [signupPhoneSending, setSignupPhoneSending] = useState(false);
  const [signupEmailCodeSent, setSignupEmailCodeSent] = useState(false);
  const [signupPhoneCodeSent, setSignupPhoneCodeSent] = useState(false);
  const [signupEmailCode, setSignupEmailCode] = useState('');
  const [signupPhoneCode, setSignupPhoneCode] = useState('');

  const [openTermsType, setOpenTermsType] = useState('');
  const termsContentMap = {
    standard: { title: '스터디크랙 이용약관', body: `제 1 장 총 칙
제 1 조【 목 적 】
1. 회원규칙은 공정거래법 및 기타 전기통신사업법 및 동법 시행령에 의하여 (주)스터디크랙(이하 "회사"라 한다)가 제공하는 스터디크랙에서 운영하는 모든 서비스(이하 "서비스 "라 한다)의 이용조건, 절차 그리고 회원규칙에 관한 사항을 규정함을 목적으로 합니다.
제 2 조【 공지 및 적용 】
1. 이 규정의 내용은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력을 발생합니다.
2. 회사는 이 규정을 변경할 수 있으며, 변경된 규정은 제1항과 같은 방법으로 공지함으로 써 효력을 발생합니다.
제 3 조【 규정 외 준칙 】
1. 이 규정에 명시되지 않은 사항은 공정거래법 전기통신기본법, 전기통신사업 법 및 기타 관련법령의 규정에 의합니다.
제 4 조【 용어의 정의 】
1. 이 규정에서 사용하는 용어의 정의는 다음과 같습니다.
1) 회 원 : 회사와 서비스 이용계약을 체결한 자
2) 아이디 : 회원 식별과 회원의 서비스 이용을 위하여 회원이 선정한 문자와 숫자의 조합
3) 비밀번호 : 회원의 비밀 보호를 위함.
4) 운영자 : 서비스의 전반적인 관리와 원활한 운영을 위하여 회사에서 선정한 사람
5) 해 지 : 회사 또는 회원이 서비스 개통 후 이용계약을 해약하는 것
제 2 장 서비스 이용계약
제 5 조【 회원 가입 】
1. 아래 "위의 이용약관에 동의하십니까?" 라는 물음에 회원이 "동의" 단추를 누르면 이 규정에 동의하는 것으로 간주됩니다.
2. 이용계약은 회원의 이용신청에 대하여 회사가 승낙함으로써 성립합니다.
3. 회원으로 가입하기 위해서는 스터디크랙에서 요청하는 개인 신상정보를 제공해야 합니다.
4. 아이디 변경 등 개인 정보의 변경은 관리자에게 온라인으로 요청함으로써 가능합니다.
제 6 조【 서비스 이용/제한 】
1. 회원은 특별한 사정이 없으면 연중무휴, 1일 24시간 스터디크랙을 이용할 수 있습니다. 그러나 정기점검 등 필요한 경우 미리 고지한 날/시간에는 이용이 제한될 수 있습니다.
2. 다른 이용자 또는 제 3자를 비방하거나 중상 모략으로 명예를 손상시키거나 공공질서 혹은 법규에 위반되는 내용이 게재되어 있을 경우. 저작권 등 기타 권리를 침해하는 내용인 경우에도 삭제가 가능합니다.
제 7 조【 스터디크랙의 의무 】
1. 스터디크랙은 특별한 사정이 없는 한 회원가입 후 즉시 서비스를 제공하고 보다 나은 서비스를 계속적 안정적으로 서비스하기 위해 노력합니다.
2. 스터디크랙은 이용자의 개인 신상 정보를 본인의 승낙 없이 타인에게 누설, 배포 하지 않습니다. 다만, 의료기사법, 공정거래법 ,전기통신관련법령 등 관계법령에 따른 국가기관 등의 요구가 있는 경우에는 예외로 합니다.
3. 스터디크랙은 이용자로부터 제기되는 의견이나 불만이 정당하다고 인정할 경우에는 즉시 처리 합니다. 다만, 즉시 처리가 곤란한 경우에는 이용자에게 그 사유와 처리일정을 통보합니다.
제 8 조【 이용자의 의무 】
1. ID와 비밀 번호에 관한 모든 관리의 책임은 이용자에게 있습니다. 따라서 자신의 아이디가 부정하게 사용된 경우, 이용자은 반드시한국교육컨설팅에 그 사실을 통보해야 합니다. 또 이용자는 이 약관 및 관계법령에서 규정한 사항을 준수하여야 합니다.
제 9 조【 정보의 제공 】
1. 회사는 회원이 서비스 이용 중 필요가 있다고 인정되는 다양한 정보에 대해서 전자우편, 유선매체, 서신우편 등의 방법으로 회원에게 제공할 수 있습니다.
제 3 장 계약해지 및 이용제한
제10조【 계약해지 및 이용제한 】
1. 회원이 이용계약을 해지하고자 하는 때에는 회원 본인이 온라인을 통해 회사에 해지신청을 하여야 합니다.
2. 회사는 회원이 다음 각 호의 1에 해당하는 행위를 하였을 경우 사전통지 없이 이용계약을 해지하거나 또는 기간을 정하여 서비스 이용을 중지할 수 있습니다.
1) 타인의 서비스 idl 및 비밀번호를 도용한 경우
2) 서비스 운영을 고의로 방해한 경우
3) 가입한 이름이 실명이 아닌 경우
4) 공공질서 및 미풍양속에 저해되는 내용을 고의로 유포시킨 경우
5) 회원이 국익 또는 사회적 공익을 저해할 목적으로 서비스 이용을 계획 또는 실행하는 경우
6) 타인의 명예를 손상시키거나 불이익을 주는 행위를 한 경우
7) 기타 회사가 정한 이용조건에 위반한 경우
제 4 장 손해배상 등
제11조【 손해배상 】
1. 회사는 서비스 요금이 무료인 동안의 서비스 이용과 관련하여 회원에게 발생한 어떠한 손해에 관하여도 책임을 지지 않습니다.
2. 서비스 유료화 이후에 관하여는 별도로 정합니다.
제12조【 면책조항 】
1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.
2. 회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.
3. 회사는 회원이 서비스를 이용하여 기대하는 손익이나 서비스를 통하여 얻은 자료로 인한 손해에 관하여 책임을 지지 않습니다.
4. 회사는 회원이 서비스에 게재한 정보, 자료, 사실의 신뢰도, 정확성 등 내용에 관하여는 책임을 지지 않습니다.
제13조【 관할법원 】
1. 요금 등 서비스 이용으로 발생한 분쟁에 대해 소송이 제기될 경우 회사의 본사 소재지를 관할하는 법원을 관할법원으로 합니다.` },
    privacy: { title: '개인정보 처리방침', body: `스터디크랙은 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고,
관련 법령을 준수하여 개인정보를 처리합니다.
1. 수집하는 개인정보 항목
- 필수 항목: 이름, 연락처, 학년, 성적 정보, 계열, 희망 대학
- 선택 항목: 학습 성향, 목표 대학, 상담 참고 정보
2. 개인정보 수집 방법
- 홈페이지 입력폼 및 설문지
- 상담 신청 및 서비스 이용 과정
- 결제 및 고객 응대 과정
3. 개인정보 수집 및 이용 목적
- 입시 컨설팅 및 학습 전략 분석
- 상담 및 서비스 제공
- 서비스 안내 및 고객 응대
4. 개인정보 처리의 법적 근거
- 정보주체의 동의
- 서비스 제공을 위한 계약의 이행
5. 개인정보 보유 및 이용 기간
- 서비스 종료 후 5년간 보관
- 단, 관계 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관
※ 보유 기간의 근거: 전자상거래 관련 법령, 소비자 분쟁 대응, 세무·회계 처리
6. 개인정보의 파기 절차 및 방법
- 보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.
- 전자적 파일 형태: 복구 불가능한 방식으로 삭제
- 종이 문서: 분쇄 또는 소각
7. 개인정보 제공
스터디크랙은 이용자의 개인정보를 제3자에게 제공하지 않습니다.
단, 법령에 따른 요청이 있는 경우는 예외로 합니다.
8. 개인정보 처리 위탁
현재 스터디크랙은 개인정보 처리 업무를 외부에 위탁하지 않습니다.
향후 위탁이 발생할 경우 관련 법령에 따라 사전 고지하겠습니다.
9. 이용자의 권리
이용자는 언제든지 본인의 개인정보에 대해 열람, 수정, 삭제를 요청할 수 있습니다.
10. 개인정보 보호 책임자
- 책임자: 임태륭
- 문의처: contact@studycrack.co.kr` },
    service: { title: '서비스 이용약관', body: `제1조 (서비스 성격)
스터디크랙은 수험생의 성적, 지원 성향, 대학별 전형 구조 및 공개된 입시 자료를 기반으로 입시 전략 및 학습 방향에 대한 분석과 자문을 제공하는 컨설팅 서비스입니다.
본 서비스는 합격을 보장하거나 특정 결과를 약속하는 서비스가 아닙니다.
제2조 (서비스 내용)
제공되는 서비스는 다음을 포함할 수 있습니다.
1. 성적 자료 기반 대학 지원 전략 분석
2. 대학별 전형 구조 해석 및 비교
3. 학습 방향 및 과목 전략에 대한 자문
4. 참고용 분석 자료 및 보고서 제공
※ 모든 내용은 의사결정을 돕기 위한 참고 자료이며, 최종 지원 및 선택의 책임은 이용자 본인에게 있습니다.
제3조 (합격 비보장)
스터디크랙은 입시 결과에 대한 합격, 불합격, 충원 여부 등 어떠한 결과도 보장하지 않습니다.
입시는 매년 지원자 동향, 모집 인원, 외부 변수에 따라 달라질 수 있으며, 이에 대한 결과 책임은 이용자 본인에게 귀속됩니다.
제4조 (자료 제공의 정확성)
이용자가 제공한 성적, 지원 정보, 희망 사항 등이 사실과 다르거나 누락된 경우, 분석 결과의 정확성은 보장되지 않습니다.
제5조 (데이터 출처 및 해석의 한계)
본 서비스는 공개된 입시 자료 및 이용자가 제공한 정보를 기반으로 분석을 수행합니다.
제공되는 분석, 비교, 시뮬레이션 결과는 스터디크랙의 해석 및 산출 방식에 따른 참고 자료이며,
특정 대학, 교육기관, 입시 기관의 공식 입장이나 결과를 대변하지 않습니다.
입시 제도, 전형 방식, 모집 인원, 데이터 기준은 변동될 수 있으며,
이로 인해 실제 결과와 차이가 발생할 수 있습니다.
제6조 (지적재산권)
스터디크랙이 제공한 보고서, 분석 자료, 문서의 저작권은 스터디크랙에 있으며,
이용자는 개인적 목적 외 제3자 제공, 복제, 배포를 할 수 없습니다.
제7조 (분쟁 해결)
본 약관에 명시되지 않은 사항은 관계 법령 및 일반 상관례를 따릅니다.
제8조 (자동화 서비스의 한계)
스터디크랙이 제공하는 자동 분석, 추천, 시뮬레이션 결과는
공개된 데이터와 입력 정보를 기반으로 산출된 참고 자료이며,
실제 입시 결과와 차이가 발생할 수 있습니다.
제9조 (시스템 오류 면책)
다음 사유로 발생한 손해에 대해 책임을 지지 않습니다.
1. 시스템 오류, 서버 장애
2. 데이터 지연, 누락
3. 외부 기관 데이터 변경
제10조 (책임 제한)
스터디크랙의 손해배상 책임은
해당 이용자가 지급한 최근 3개월 이용 요금 총액을 초과하지 않습니다.
단, 스터디크랙의 고의 또는 중과실로 인한 손해는 본 조항의 제한을 적용하지 않습니다
구독 서비스 해지·환불 정책
제1조 (구독 기간)
- 구독 서비스는 월 단위 또는 연 단위로 제공됩니다.
- 디지털 콘텐츠 특성상 결제 즉시 서비스가 제공되며, 이용 개시 이후에는 청약철회가 제한됩니다.
제2조 (해지)
- 이용자는 언제든지 다음 결제일 이전까지 해지를 요청할 수 있습니다.
- 해지 시 다음 결제일부터 요금이 청구되지 않습니다.
제3조 (환불)
- 이미 결제된 이용 요금은 환불되지 않습니다.
- 무료 체험 기간이 있는 경우, 체험 종료 후 자동 결제됩니다.
제4조 (결과 책임)
구독 서비스에서 제공되는 정보는 참고용이며,
입시 결과 및 의사결정에 대한 책임은 이용자 본인에게 있습니다.` },
    refund: { title: '환불규정', body: `스터디크랙은 맞춤형 분석 및 컨설팅 서비스 특성상
아래와 같은 환불 규정을 적용합니다.
1. 분석 착수 전
- 결제 완료 후 분석 착수 이전에 환불을 요청한 경우: 전액 환불
※ 분석 착수란 이용자가 제공한 자료를 기반으로
자료 검토, 전략 설계, 분석 작업 중 하나라도 개시된 시점을 의미합니다.
2. 분석 진행 중
- 분석이 이미 개시된 경우: 환불 불가
(자료 검토, 전략 설계, 분석 작업이 포함됩니다)
3. 보고서 제공 후
- 보고서 또는 분석 자료가 이용자에게 전달 완료된 경우: 환불 불가
4. 기타 환불 불가 사유
- 단순 변심
- 결과에 대한 주관적 불만족
- 합격, 불합격, 충원 여부 등 입시 결과에 따른 환불 요청
※ 본 서비스는 의사결정을 돕기 위한 분석 및 자문 서비스로,
입시 결과에 대한 책임은 이용자 본인에게 있습니다.
5. 예외 사항
- 스터디크랙의 귀책 사유로 인해
서비스 제공이 불가능하거나 중대한 하자가 발생한 경우에는
관련 법령에 따라 환불이 이루어질 수 있습니다.` },
    marketing: { title: '마케팅 수신 정보 동의', body: `“스터디크랙”(이하 “회사”)는 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 및 「개인정보 보호법」 등 관계 법령에 따라 광고성 정보를 전송하기 위해 이용자의 사전 동의를 받고 있습니다.

1. 목적 
- 이메일 및 문자(SMS/LMS)를 통한 광고성 정보 전송 
- 스터디크랙 서비스, 이벤트, 혜택, 맞춤 입시 전략 및 합격 사례 안내 

2. 이용 항목 
- 휴대폰번호, 이메일주소 

3. 보유 및 이용 기간 
- 회원 탈퇴 또는 동의 철회 시까지 

※ 본 동의는 선택 사항이며, 동의하지 않아도 서비스 이용에는 제한이 없습니다. 
※ 이용자는 언제든지 수신 거부를 할 수 있습니다.` }
  };
  const [signupEmailTimerSeconds, setSignupEmailTimerSeconds] = useState(0);
  const [signupPhoneTimerSeconds, setSignupPhoneTimerSeconds] = useState(0);
  const [mbtiModalOpen, setMbtiModalOpen] = useState(false);
  const [mbtiAnswers, setMbtiAnswers] = useState({ q1: '', q2: '', q3: '', q4: '' });
  const [mbtiResult, setMbtiResult] = useState('');
  const [ob2SkippedNoScore, setOb2SkippedNoScore] = useState(false);
  const [strongSubject, setStrongSubject] = useState('');
  const [weakSubject, setWeakSubject] = useState('');
  const [studyHours, setStudyHours] = useState('');
  const [studyDifficulty, setStudyDifficulty] = useState('');
  const [scoreEditOpen, setScoreEditOpen] = useState(false);
  const [scoreEditStep, setScoreEditStep] = useState(1);
  const [scores, setScores] = useState(DEFAULT_SCORES);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [openFaq, setOpenFaq] = useState('');
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [proRequestModalOpen, setProRequestModalOpen] = useState(false);
  const [proRequestText, setProRequestText] = useState('');
  const [proEliteMonth, setProEliteMonth] = useState('26년 4월');
  const [addingUniversity, setAddingUniversity] = useState(false);
  const [showStudyBreakdown, setShowStudyBreakdown] = useState(false);
  const [expandedBreakdownSubject, setExpandedBreakdownSubject] = useState('');
  const [studySubjectSheetOnlyPlanned, setStudySubjectSheetOnlyPlanned] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [plannerItems, setPlannerItems] = useState(DEFAULT_PLANNER_ITEMS);
  const [plannerEditIndex, setPlannerEditIndex] = useState(null);
  const [studyRecords, setStudyRecords] = useState(() => safeParse('studyRecords', []));
  const [studySubjectRecords, setStudySubjectRecords] = useState(() => safeParse('studySubjectRecords', []));
  const [studyTimerRunning, setStudyTimerRunning] = useState(false);
  const studyTimerSecondsRef = useRef(0);
  const studyTimerIntervalRef = useRef(null);
  const [activeStudySubject, setActiveStudySubject] = useState('');
  const [activePlannerItemId, setActivePlannerItemId] = useState('');
  const [studySubjectSheetOpen, setStudySubjectSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [coachingSubmitted, setCoachingSubmitted] = useState(false);
  const [coachingSheetOpen, setCoachingSheetOpen] = useState(false);
  const [coachingStep, setCoachingStep] = useState(1);
  const [coachingMonth, setCoachingMonth] = useState('26년 4월');
  const [coachingSubjectRows, setCoachingSubjectRows] = useState([]);
  const [coachingPlannerFiles, setCoachingPlannerFiles] = useState([]);
  const [coachingExamType, setCoachingExamType] = useState('');
  const [coachingExamFiles, setCoachingExamFiles] = useState([]);
  const [coachingExamScores, setCoachingExamScores] = useState({});
  const [coachingTrend, setCoachingTrend] = useState('');
  const [coachingDropReasons, setCoachingDropReasons] = useState([]);
  const [coachingAnswers, setCoachingAnswers] = useState({ step4Reason: '', step5: '', step6: '', step7: '', step8: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ob3IsAnalyzing, setOb3IsAnalyzing] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingLoadingText, setOnboardingLoadingText] = useState('');
  const [scoreState, setScoreState] = useState({ korean: { type: '', common: '', elective: '' }, math: { type: '', common: '', elective: '' }, english: '', history: '', inquiry1: { subject: '', score: '' }, inquiry2: { subject: '', score: '' } });
  const [scoreEditState, setScoreEditState] = useState({ korean: { type: '화법과작문', common: '', elective: '' }, math: { type: '확률과통계', common: '', elective: '' }, english: '', history: '', inquiry1: { subject: '', score: '' }, inquiry2: { subject: '', score: '' } });
  const [obGradeStatus, setObGradeStatus] = useState('고1/2 재학');
  const [obSchoolName, setObSchoolName] = useState('');
  const [obGed, setObGed] = useState(false);
  const [obTrack, setObTrack] = useState('예체능');
  const [obGoalText, setObGoalText] = useState('');
  const [obQuestionText, setObQuestionText] = useState('');
  const [obExamType, setObExamType] = useState('3월 모의고사');
  const [scoreExamType, setScoreExamType] = useState('3월 모의고사');
  const [obScoreInputs, setObScoreInputs] = useState({});
  const loadingStartedAtRef = useRef(Date.now());
  const loadingExitTimerRef = useRef(null);
  const loadingDoneRef = useRef(false);
  const plannerContentRef = useRef('');
  const plannerCustomMinutesRef = useRef('');
  const coachingAutoFilledRef = useRef(false);
  const coachingDirtyRowsRef = useRef({});
  const screenScrollRef = useRef({});
  const scrollPersistRafRef = useRef(null);
  const touchStartXRef = useRef(null);
  const touchLastXRef = useRef(null);
  const touchTargetRef = useRef('');
  const touchCardRef = useRef(null);
  const suppressClickUntilRef = useRef(0);
  const lastStableScrollYRef = useRef(0);
  const scrollGuardRef = useRef({ until: 0, y: 0, restoring: false });
  const renderStableScrollYRef = useRef(0);
  const renderStableScreenRef = useRef('');
  const ob2SelectSyncTimerRef = useRef(null);
  const v2eSelectSyncTimerRef = useRef(null);
  const isIOSSafari = () => {
    if (typeof navigator === 'undefined') return false;
    return /iP(ad|hone|od)/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
  };
  const safeScrollIntoView = (el, options) => {
    if (!el?.scrollIntoView) return;
    if (isIOSSafari()) return;
    if ((window.scrollY || window.pageYOffset || 0) >= 50) return;
    el.scrollIntoView(options);
  };
  const preserveScrollAfterStateChange = (callback) => {
    const y = window.scrollY || window.pageYOffset || 0;
    callback();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (Math.abs((window.scrollY || window.pageYOffset || 0) - y) > 80) {
          window.scrollTo({ top: y, left: 0, behavior: 'auto' });
        }
      });
    });
  };
  const safeScrollTo = (...args) => {
    if (isIOSSafari()) return;
    window.scrollTo(...args);
  };
  const markStableScrollPosition = () => {
    if (!isIOSSafari()) return;
    const y = window.scrollY || window.pageYOffset || 0;
    if (y > 0) lastStableScrollYRef.current = y;
  };
  const restoreIfUnexpectedTopJump = () => {
    if (!isIOSSafari()) return;
    if (scrollGuardRef.current.restoring) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const nowY = window.scrollY || window.pageYOffset || 0;
        if (nowY === 0 && lastStableScrollYRef.current > 80) {
          scrollGuardRef.current.restoring = true;
          safeScrollTo({ top: lastStableScrollYRef.current, left: 0, behavior: 'auto' });
          requestAnimationFrame(() => {
            scrollGuardRef.current.restoring = false;
          });
        }
      });
    });
  };
  const afterSafariViewportStable = (callback) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  };
  const preserveY = (callback) => {
    const y = window.scrollY || window.pageYOffset || 0;
    callback();
    afterSafariViewportStable(() => {
      if (y > 0 && (window.scrollY || window.pageYOffset || 0) === 0) {
        safeScrollTo({ top: y, left: 0, behavior: 'auto' });
      }
    });
  };
  const runAfterViewportStable = (callback) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  };
  const preserveOB5Scroll = (callback) => {
    if (typeof window === 'undefined' || screen !== 'ob5' || !isIOSSafari()) {
      callback();
      return;
    }
    const y = window.scrollY;
    callback();
    runAfterViewportStable(() => {
      if (y > 0 && window.scrollY === 0) {
        safeScrollTo({ top: y, left: 0, behavior: 'auto' });
      }
    });
  };

  useEffect(() => {
    console.log('[MOUNT]', 'App');
    return () => console.log('[UNMOUNT]', 'App');
  }, []);

  useEffect(() => {
    console.log('[WRAPPER_STATE]', { screen, loading, tab });
  }, [screen, loading, tab]);
  const keepScrollPosition = (durationMs = 380) => {
    const y = window.scrollY || window.pageYOffset || 0;
    const started = Date.now();
    const lock = () => {
      const now = window.scrollY || window.pageYOffset || 0;
      if (Math.abs(now - y) > 0) safeScrollTo({ top: y, left: 0, behavior: 'auto' });
      if (Date.now() - started < durationMs) requestAnimationFrame(lock);
    };
    requestAnimationFrame(lock);
    setTimeout(() => {
      const now = window.scrollY || window.pageYOffset || 0;
      if (Math.abs(now - y) > 0) safeScrollTo({ top: y, left: 0, behavior: 'auto' });
    }, durationMs + 20);
  };

  const goto = (next, addHistory = true) => {
    if (!next || next === screen) return;
    const currentY = window.scrollY || window.pageYOffset || 0;
    screenScrollRef.current[screen] = currentY;
    if (typeof screenScrollRef.current[next] !== 'number') screenScrollRef.current[next] = currentY;
    try {
      localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(screenScrollRef.current));
    } catch (_err) {
      // noop
    }
    if (addHistory && screen !== next) setHistory((h) => [...h, screen]);
    setScreen(next);
    if (['home', 'analysis', 'strategy', 'planner', 'my'].includes(next)) setTab(next);
  };

  const back = () => {
    screenScrollRef.current[screen] = window.scrollY || window.pageYOffset || 0;
    try {
      localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(screenScrollRef.current));
    } catch (_err) {
      // noop
    }
    if (!history.length) return goto('home', false);
    const clone = [...history];
    const prev = clone.pop();
    setHistory(clone);
    setScreen(prev);
  };

  useEffect(() => {
    lastStableScrollYRef.current = window.scrollY || window.pageYOffset || 0;
    renderStableScrollYRef.current = lastStableScrollYRef.current;
    renderStableScreenRef.current = screen;
    const onNativeScroll = () => {
      lastStableScrollYRef.current = window.scrollY || window.pageYOffset || 0;
      renderStableScrollYRef.current = lastStableScrollYRef.current;
      renderStableScreenRef.current = screen;
    };
    window.addEventListener('scroll', onNativeScroll, { passive: true });
    return () => window.removeEventListener('scroll', onNativeScroll);
  }, [screen]);

  useEffect(() => {
    // 스크롤 강제 복원은 iOS/Safari에서 "스크롤 초기화"처럼 보이는 점프를 유발할 수 있어 비활성화합니다.
    // 스크롤 위치는 아래 persist 로직(localStorage 저장)으로만 유지합니다.
    scrollGuardRef.current = { until: 0, y: 0, restoring: false };
  }, []);


  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCROLL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') screenScrollRef.current = parsed;
      }
    } catch (_err) {
      // noop
    }
  }, []);

  useEffect(() => {
    const persist = () => {
      if (scrollPersistRafRef.current) cancelAnimationFrame(scrollPersistRafRef.current);
      scrollPersistRafRef.current = requestAnimationFrame(() => {
        try {
          localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(screenScrollRef.current));
        } catch (_err) {
          // noop
        }
      });
    };
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      if (y === 0 && lastStableScrollYRef.current > 80) {
        console.trace('[IOS_SCROLL_TOP_JUMP]', { screen, lastStable: lastStableScrollYRef.current });
      }
      screenScrollRef.current[screen] = y;
      persist();
    };
    const onBeforeUnload = () => {
      screenScrollRef.current[screen] = window.scrollY || window.pageYOffset || 0;
      try {
        localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(screenScrollRef.current));
      } catch (_err) {
        // noop
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (scrollPersistRafRef.current) cancelAnimationFrame(scrollPersistRafRef.current);
    };
  }, [screen]);

  useEffect(() => {
    // Intentionally do not force-scroll on render/screen change.
    // Forced restoration has caused visible jump-to-top/jitter on user interactions.
  }, [screen]);

  useEffect(() => {
    const previousY = renderStableScrollYRef.current || 0;
    const previousScreen = renderStableScreenRef.current || screen;
    const nowY = window.scrollY || window.pageYOffset || 0;
    if (previousScreen === screen && previousY > 40 && nowY <= 2) {
      requestAnimationFrame(() => safeScrollTo({ top: previousY, left: 0, behavior: 'auto' }));
    }
  });

  useEffect(() => {
    if (screen === 'splash') {
      const t = setTimeout(() => goto('on1'), 900);
      return () => clearTimeout(t);
    }
  }, [screen]);

  useEffect(() => {
    if (screen === 'analysis') setActiveScoreView('target');
  }, [screen]);
  useEffect(() => {
    if (screen !== 'planner') return;
    requestAnimationFrame(() => {
      const currentStrip = document.querySelector('.planner-date-strip');
      const selectedBtn = currentStrip?.querySelector(`[data-planner-date="${selectedPlannerDate}"]`);
      safeScrollIntoView(selectedBtn, { behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }, [screen, selectedPlannerDate]);


  useEffect(() => {
    if (!homeSlideMotion) return;
    const t = setTimeout(() => setHomeSlideMotion(''), 420);
    return () => clearTimeout(t);
  }, [homeSlideMotion]);

  useEffect(() => {
    if (!scoreSlideMotion) return;
    const t = setTimeout(() => setScoreSlideMotion(''), 380);
    return () => clearTimeout(t);
  }, [scoreSlideMotion]);

  useEffect(() => {
    if (screen !== 'analysis' || analysisMode !== 'summary') return;
    setAnalysisEtaStage(1);
    const t1 = setTimeout(() => setAnalysisEtaStage(2), 1500);
    const t2 = setTimeout(() => setAnalysisEtaStage(3), 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [screen, analysisMode, targetMajor]);

  useEffect(() => {
    if (screen !== 'analysis') return;
    setIsAnalyzing(true);
    const t = setTimeout(() => {
      armScrollGuard(1200);
      setIsAnalyzing(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [screen, targetMajor]);

  useEffect(() => {
    if (screen !== 'ob3') return;
    setOb3IsAnalyzing(true);
    const t = setTimeout(() => {
      armScrollGuard(1200);
      if (isIOSSafari()) {
        const loading = document.querySelector('.onboarding-shell .loading-overlay');
        if (loading) {
          const wrap = document.createElement('div');
          wrap.innerHTML = `<div class="card ob-card ob-period-card on-eta-card"><span class="eyebrow">현재 학습분석 기반</span><b>Standard 이용 시 평균 3개월 내 도달 예상</b><p>주간 플래너 피드백과 학습 방향 코칭 제공</p></div>`;
          loading.replaceWith(wrap.firstChild);
          return;
        }
      }
      setOb3IsAnalyzing(false);
    }, 1500);
    return () => {
      clearTimeout(t);
      setOb3IsAnalyzing(false);
    };
  }, [screen]);

  useEffect(() => {
    if (!isIOSSafari()) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if ((window.scrollY || window.pageYOffset || 0) === 0 && initialScrollY > 0) window.scrollTo(0, initialScrollY);
      });
    });
  }, []);

  useEffect(() => {
    if (!coachingSheetOpen || coachingStep !== 1 || !coachingAutoFilledRef.current) return;
    const nextAutoRows = buildDefaultCoachingSubjects();
    setCoachingSubjectRows((prev) => {
      const prevBySource = new Map(prev.filter((r) => r.sourceId).map((r) => [r.sourceId, r]));
      return nextAutoRows.map((row) => {
        const prevRow = prevBySource.get(row.sourceId);
        if (!prevRow) return row;
        if (coachingDirtyRowsRef.current[prevRow.id]) return prevRow;
        return { ...row, detail: prevRow.detail || row.detail, planned: prevRow.planned || row.planned, actual: prevRow.actual || row.actual };
      });
    });
  }, [coachingSheetOpen, coachingStep, plannerItems, todayStudySeconds, studySubjectRecords]);

  useEffect(() => {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  }, []);

  const finishLoading = () => {
    if (loadingDoneRef.current) return;
    loadingDoneRef.current = true;
    const completeLoading = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      afterSafariViewportStable(() => {
        setLoading(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (y > 0 && (window.scrollY || window.pageYOffset || 0) === 0) {
              safeScrollTo({ top: y, left: 0, behavior: 'auto' });
            }
          });
        });
      });
    };
    const elapsed = Date.now() - loadingStartedAtRef.current;
    const waitMs = Math.max(0, 1300 - elapsed);
    loadingExitTimerRef.current = setTimeout(() => {
      setLoadingFadeOut(true);
      setTimeout(completeLoading, 320);
    }, waitMs);
  };

  const initializeApp = async () => {
    let fallbackTimer;
    try {
      console.log('[APP_INIT_START]');
      setLoading(true);
      setLoadingFadeOut(false);
      loadingDoneRef.current = false;
      loadingStartedAtRef.current = Date.now();
      setError(false);
      fallbackTimer = setTimeout(() => {
        setScreen('on1');
        finishLoading();
      }, 3000);

      const savedUser = safeParse('user', DEFAULT_USER);
      const savedPlan = localStorage.getItem('selectedPlan') || savedUser.plan || DEFAULT_USER.plan;
      const savedTarget = localStorage.getItem('selectedUniversity') || savedUser.targetUniversity || DEFAULT_USER.targetUniversity;
      const savedTab = localStorage.getItem('activeTab') || 'home';
      const savedItems = safeParse('plannerItems', DEFAULT_PLANNER_ITEMS);
      const savedScore = safeParse('scores', DEFAULT_SCORES);
      const savedNotifications = safeParse('notifications', DEFAULT_NOTIFICATIONS);

      setSelectedPlan(savedPlan);
      setTargetMajor(savedTarget);
      setTab(savedTab);
      setUser({
        name: savedUser?.name || DEFAULT_USER.name,
        targetUniversity: savedTarget || DEFAULT_USER.targetUniversity,
        plan: savedPlan || DEFAULT_USER.plan
      });
      setPlannerItems(normalizePlannerItems(Array.isArray(savedItems) ? savedItems : DEFAULT_PLANNER_ITEMS));
      setScores({ ...DEFAULT_SCORES, ...(savedScore || {}) });
      setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(savedNotifications || {}) });

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('init-timeout')), 2500));
      const crackySrc = await resolveAssetPath(CRACKY_SRC, './assets/images/studycrack_logo_wo_bg.png');
      const onboardingLogoSrc = await resolveAssetPath(ONBOARDING_LOGO_SRC, './assets/images/studycrack_logo_wo_bg.png');
      window.__studycrackAssetSrc = { crackySrc, onboardingLogoSrc };
      await Promise.race([fetch(onboardingLogoSrc), timeoutPromise]).catch(() => null);
      await resolveAssetPath('./assets/76220C96-DE85-4148-A6AC-7BD5881821A0.png', null);
      await resolveAssetPath('./assets/IMG_2648.jpeg', null);

      setScreen('on1');
      console.log('[APP_INIT_SUCCESS]');
    } catch (e) {
      console.error('[APP_INIT_ERROR]', e);
      setError(true);
      setScreen('on1');
    } finally {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      finishLoading();
    }
  };

  useEffect(() => {
    initializeApp();
    return () => {
      if (loadingExitTimerRef.current) clearTimeout(loadingExitTimerRef.current);
    };
  }, []);

  const applyScoreExamSelection = (value) => {
    setScoreExamType(value);
    const map = getExamScoresMap();
    const picked = map[value];
    if (!picked) {
      setScores((prev) => ({ ...prev, korean: 0, math: 0, english: 0, inquiry1: 0, inquiry2: 0 }));
      setScoreEditState((prev) => ({ ...prev, korean: { ...prev.korean, common: '', elective: '' }, math: { ...prev.math, common: '', elective: '' }, english: '', inquiry1: { ...prev.inquiry1, score: '' }, inquiry2: { ...prev.inquiry2, score: '' } }));
      return;
    }
    setScores((prev) => ({ ...prev, korean: Number(picked.korean || 0), math: Number(picked.math || 0), english: Number(picked.english || 0), inquiry1: Number(picked.inquiry1 || 0), inquiry2: Number(picked.inquiry2 || 0) }));
    setScoreEditState((prev) => ({ ...prev, korean: { ...prev.korean, common: Math.floor(Number(picked.korean || 0) * 0.75), elective: Math.round(Number(picked.korean || 0) * 0.25) }, math: { ...prev.math, common: Math.floor(Number(picked.math || 0) * 0.74), elective: Math.round(Number(picked.math || 0) * 0.26) }, english: picked.englishGrade ? String(picked.englishGrade) : '', inquiry1: { ...prev.inquiry1, score: picked.inquiry1 ? String(picked.inquiry1) : '' }, inquiry2: { ...prev.inquiry2, score: picked.inquiry2 ? String(picked.inquiry2) : '' } }));
  };

  const applyObExamSelection = (value) => {
    setObExamType(value);
    const map = getExamScoresMap();
    const picked = map[value] || {};
    const setVal = (key, val) => {
      const el = document.querySelector(`[data-score-key="${key}"]`);
      if (el) el.value = val ?? '';
    };
    setVal('korean_common', picked.korean ? Math.max(0, Math.floor(Number(picked.korean) * 0.75)) : '');
    setVal('korean_elective', picked.korean ? Math.max(0, Math.round(Number(picked.korean) * 0.25)) : '');
    setVal('math_common', picked.math ? Math.max(0, Math.floor(Number(picked.math) * 0.74)) : '');
    setVal('math_elective', picked.math ? Math.max(0, Math.round(Number(picked.math) * 0.26)) : '');
    setVal('english_grade', picked.englishGrade || '');
    setVal('inquiry1_raw', picked.inquiry1 || '');
    setVal('inquiry2_raw', picked.inquiry2 || '');
  };

  useEffect(() => {
    window.__studycrackAppBooted = true;
  }, []);

  useEffect(() => {
    localStorage.setItem('scores', JSON.stringify(scores));
  }, [scores]);

  useEffect(() => {
    localStorage.setItem('plannerItems', JSON.stringify(plannerItems));
  }, [plannerItems]);

  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('studyRecords', JSON.stringify(studyRecords));
  }, [studyRecords]);

  useEffect(() => {
    localStorage.setItem('studySubjectRecords', JSON.stringify(studySubjectRecords));
  }, [studySubjectRecords]);

  useEffect(() => () => {
    if (studyTimerIntervalRef.current) clearInterval(studyTimerIntervalRef.current);
  }, []);
  useEffect(() => {
    if (signupEmailTimerSeconds <= 0) return;
    const id = setInterval(() => setSignupEmailTimerSeconds((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [signupEmailTimerSeconds]);
  useEffect(() => {
    if (signupPhoneTimerSeconds <= 0) return;
    const id = setInterval(() => setSignupPhoneTimerSeconds((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [signupPhoneTimerSeconds]);

  useEffect(() => {
    localStorage.setItem('selectedPlan', selectedPlan);
    localStorage.setItem('selectedUniversity', targetMajor);
    localStorage.setItem('activeTab', tab);
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: user?.name || DEFAULT_USER.name,
        targetUniversity: targetMajor || DEFAULT_USER.targetUniversity,
        plan: selectedPlan || DEFAULT_USER.plan
      })
    );
  }, [selectedPlan, targetMajor, tab, user]);

  const appbar = (title, showBack) => `<div class="appbar">${showBack ? '<button class="back-btn" data-action="back">←</button>' : '<div style="width:36px"></div>'}<div class="title">${title}</div></div>`;
  const tabBtn = (k, label, iconName) => `<button class="${tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}">${i(iconName, tab===k)}<span>${label}</span></button>`;
  const tabbarDimmed = Boolean(
    coachingSheetOpen
    || studySubjectSheetOpen
    || plannerCalendarOpen
    || plannerEditIndex !== null
    || drawerOpen
    || universityModalOpen
    || scoreEditOpen
    || logoutModalOpen
  );
  const tabbar = () => `<div class="tabbar bottom-tab ${tabbarDimmed ? 'is-muted' : ''}">${tabBtn('home','홈','home')}${tabBtn('analysis','분석','chart')}${tabBtn('strategy','학습 코칭','target')}${tabBtn('planner','플래너','calendar')}${tabBtn('my','마이','user')}</div>`;
  const layout = (inner, withTab) => `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content ${tabbarDimmed ? 'modal-lock' : ''}">${inner}</div>${withTab ? tabbar() : ''}</div></div>`;
  const quickMini = (action, iconName, label) => `<button class="quick-mini-item" data-action="goto" data-target="${action}"><span class="quick-mini-icon">${i(iconName,false)}</span><span class="quick-mini-label">${label}</span></button>`;
  const universityProfiles = {
    '연세대학교 경영학과': {
      rate: 68, rank: '상위 32%', score: 323, cut: 335, gap: -12,
      impact: [
        ['수학', '90%', '+12점 → +18%', ''],
        ['탐구', '66%', '+6점 → +9%', '#14b8a6'],
        ['국어', '52%', '+4점 → +6%', '#f59e0b'],
        ['영어', '46%', '+3점 → +5%', '#ef4444']
      ],
      strategy: ['수학 2등급 → 1등급', '탐구 1과목 집중', '영어 유지']
    },
    '고려대학교 경영학과': {
      rate: 61, rank: '상위 39%', score: 319, cut: 334, gap: -15,
      impact: [
        ['수학', '88%', '+11점 → +15%', ''],
        ['탐구', '64%', '+5점 → +8%', '#14b8a6'],
        ['국어', '58%', '+5점 → +7%', '#f59e0b'],
        ['영어', '42%', '+2점 → +4%', '#ef4444']
      ],
      strategy: ['수학 고난도 집중', '탐구 개념+실전 병행', '국어 비문학 훈련']
    },
    '성균관대학교 글로벌경영학과': {
      rate: 73, rank: '상위 27%', score: 328, cut: 336, gap: -8,
      impact: [
        ['수학', '84%', '+8점 → +12%', ''],
        ['탐구', '72%', '+6점 → +10%', '#14b8a6'],
        ['국어', '54%', '+3점 → +5%', '#f59e0b'],
        ['영어', '50%', '+3점 → +4%', '#ef4444']
      ],
      strategy: ['수학 실수 최소화', '탐구 고정 1등급', '영어 1등급 유지']
    },
    '한양대학교 경영학부': {
      rate: 65, rank: '상위 35%', score: 321, cut: 333, gap: -12,
      impact: [
        ['수학', '86%', '+10점 → +14%', ''],
        ['탐구', '68%', '+6점 → +9%', '#14b8a6'],
        ['국어', '50%', '+3점 → +5%', '#f59e0b'],
        ['영어', '44%', '+2점 → +3%', '#ef4444']
      ],
      strategy: ['수학 개념 복습 강화', '탐구 과목 편차 축소', '국어 시간 배분 훈련']
    }
  };
  const targetOptions = Object.keys(universityProfiles);
  const selectedUniversity = universityProfiles[targetMajor] || universityProfiles['연세대학교 경영학과'];
  const analysisProfiles = {
    '연세대학교 경영학과': {
      score: 86, verdict: '도전', verdictColor: '#2563EB', aiGrade: '도전',
      comment: '합격선 근처까지 접근했습니다. 영향도가 큰 과목부터 보완하면 가능성이 올라갑니다.',
      sim: [['국어', '+13.1점', '가장 합격 상승에 유리합니다.', true], ['수학', '+13.1점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['세사', '+8.2점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['동사', '+8.2점', '점수 상승으로 합격 가능성이 높아집니다.', false]]
    },
    '고려대학교 경영대학': {
      score: 71, verdict: '소신지원', verdictColor: '#F97316', aiGrade: '소신지원',
      comment: '상향 지원 구간입니다. 반드시 다른 군에 안정 카드를 확보하세요.',
      sim: [['국어', '+13.1점', '가장 합격 상승에 유리합니다.', true], ['수학', '+13.1점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['세사', '+8.2점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['동사', '+8.2점', '점수 상승으로 합격 가능성이 높아집니다.', false]]
    },
    '강서대학교 G2빅데이터경영학과': {
      score: 238, verdict: '초안정', verdictColor: '#22C55E', aiGrade: '초안정',
      comment: '최초 합격/장학금 유력 구간입니다. 더 높은 대학을 과감하게 상향 지원해보는 전략이 필요합니다.',
      sim: [['국어', '+4.2점', '현재 합격권에서 안정성 강화에 유리합니다.', true], ['수학', '+3.8점', '상위 대학 도전 전략에 유리합니다.', false], ['세사', '+2.1점', '기본 유지가 중요합니다.', false], ['동사', '+2.1점', '기본 유지가 중요합니다.', false]]
    },
    '가천대학교 관광경영학과': {
      score: 250, verdict: '초안정', verdictColor: '#22C55E', aiGrade: '초안정',
      comment: '최초 합격/장학금 유력 구간입니다. 더 높은 대학을 과감하게 상향 지원해보는 전략이 필요합니다.',
      sim: [['국어', '+4.2점', '현재 합격권에서 안정성 강화에 유리합니다.', true], ['수학', '+3.8점', '상위 대학 도전 전략에 유리합니다.', false], ['세사', '+2.1점', '기본 유지가 중요합니다.', false], ['동사', '+2.1점', '기본 유지가 중요합니다.', false]]
    },
    '성균관대학교 글로벌경영학과': { score: 120, verdict: '합격권', verdictColor: '#2563EB', aiGrade: '합격권', comment: '합격권 안에서 안정성을 높일 수 있는 구간입니다.', sim: [['국어', '+9.2점', '점수 상승으로 합격 가능성이 높아집니다.', true], ['수학', '+10.4점', '핵심 상승 과목입니다.', false], ['세사', '+6.4점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['동사', '+6.4점', '점수 상승으로 합격 가능성이 높아집니다.', false]] },
    '서강대학교 경영학부': { score: 102, verdict: '도전', verdictColor: '#2563EB', aiGrade: '도전', comment: '합격선 근처까지 접근했습니다. 영향도가 큰 과목부터 보완하면 가능성이 올라갑니다.', sim: [['국어', '+10.8점', '핵심 과목 보완이 필요합니다.', true], ['수학', '+11.2점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['세사', '+6.6점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['동사', '+6.6점', '점수 상승으로 합격 가능성이 높아집니다.', false]] },
    '한양대학교 경영학부': { score: 98, verdict: '도전', verdictColor: '#F97316', aiGrade: '도전', comment: '합격선 근처까지 접근했습니다. 영향도가 큰 과목부터 보완하면 가능성이 올라갑니다.', sim: [['국어', '+11.0점', '핵심 과목 보완이 필요합니다.', true], ['수학', '+11.8점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['세사', '+7.4점', '점수 상승으로 합격 가능성이 높아집니다.', false], ['동사', '+7.4점', '점수 상승으로 합격 가능성이 높아집니다.', false]] }
  };
  const analysisBaseProfile = analysisProfiles[targetMajor] || analysisProfiles['연세대학교 경영학과'];
  const liveCurrentScore = Math.round((Number(scores.korean||0)+Number(scores.math||0)+Number(scores.english||0)+Number(scores.inquiry1||0)+Number(scores.inquiry2||0))/5);
  const analysisSelected = { ...analysisBaseProfile, score: liveCurrentScore, sim: (analysisBaseProfile.sim||[]).map((r,idx)=>{ const boost = Math.max(0, Math.round((liveCurrentScore-60)/10)); const g = Number(String(r[1]).replace(/[^0-9.-]/g,'')) || 0; return [r[0], `+${(g+boost).toFixed(1)}점`, r[2], idx===0]; }) };
  const analysisSearchPool = ['연세대학교 경영학과', '고려대학교 경영대학', '성균관대학교 글로벌경영학과', '서강대학교 경영학부', '한양대학교 경영학부'];
  const analysisRecommended = ['가천대학교 관광경영학과', '강서대학교 G2빅데이터경영학과', '고려대학교 경영대학'];
  const analysisSearchList = analysisSearchPool.filter((name) => name.includes(analysisSearchTerm.trim()));
  const analysisGaugeFill = Math.min((analysisSelected.score / 250) * 100, 100);
  const analysisGaugeColor = analysisSelected.score >= 150 ? '#22C55E' : analysisSelected.score >= 100 ? '#2563EB' : '#F97316';
  const analysisStatus = analysisSelected.score >= 150 ? '초안정' : analysisSelected.score >= 100 ? '적정' : '위험';
  const analysisStatusColor = analysisSelected.score >= 150 ? '#22C55E' : analysisSelected.score >= 100 ? '#0B6BFF' : '#F97316';
  const analysisTargetScore = Math.min(analysisSelected.score + 34, 180);
  const analysisWeeks = Math.max(3, Math.ceil((Math.max(100 - analysisSelected.score, 0) || 12) / 3));
  const analysisCurrentPct = Math.min((analysisSelected.score / 250) * 100, 100);
  const analysisTargetPct = Math.min((analysisTargetScore / 250) * 100, 100);
  const analysisSimRows = analysisSelected.sim.map(([subject, gain, desc], idx) => {
    const gainNum = Number(String(gain).replace(/[^0-9.]/g, '')) || 0;
    return { subject, gain, desc, gainNum, idx };
  });
  const analysisSimMax = Math.max(...analysisSimRows.map(({ gainNum }) => gainNum), 0);
  const analysisSimRecommendedIndex = analysisSimRows.findIndex(({ gainNum }) => gainNum === analysisSimMax);
  const proEliteMonths = Array.from(new Set(PRO_ELITE_REPORTS.map((report) => report.week.split(' ').slice(0, 2).join(' '))));
  const proEliteFilteredReports = PRO_ELITE_REPORTS.filter((report) => report.week.startsWith(proEliteMonth));
  const onboardingProgress = (step) => `<div class="ob-progress"><span>${step}/3</span><div class="ob-dots"><i class="${step>=1?'active':''}"></i><i class="${step>=2?'active':''}"></i><i class="${step>=3?'active':''}"></i></div></div>`;
  const mbtiDone = Object.values(mbtiAnswers).every(Boolean);
  const gaugeTotal = 250;
  const gaugeCurrent = Math.max(0, Math.min(gaugeTotal, Math.round(analysisSelected.score)));
  const gaugeTarget = Math.max(gaugeCurrent, Math.min(gaugeTotal, Math.round(analysisTargetScore)));
  const gaugePass = 100;
  const gaugeSafe = 150;
  const gaugeCurrentPct = Math.min((gaugeCurrent / gaugeTotal) * 100, 100);
  const gaugeTargetPct = Math.min((gaugeTarget / gaugeTotal) * 100, 100);
  const gaugePassPct = (gaugePass / gaugeTotal) * 100;
  const gaugeSafePct = (gaugeSafe / gaugeTotal) * 100;
  const totalMinutes = plannerItems.reduce((acc, item) => acc + item.minutes, 0);
  const totalHour = Math.floor(totalMinutes / 60);
  const totalMinute = totalMinutes % 60;
  const plannerWeekDates = Array.from({ length: 15 }, (_, idx) => {
    const day = Math.min(31, Math.max(1, Number(selectedDate) - 7 + idx));
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(2024, 4, day).getDay()];
    return { day: String(day), weekday };
  });
  const selectedPlannerDate = selectedDate;
  const plannerItemsByDate = plannerItems.reduce((acc, item) => {
    const dateKey = item.date || '14';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});
  const plannerViewItems = plannerItemsByDate[selectedPlannerDate] || [];
  const plannerViewMinutes = plannerViewItems.reduce((acc, item) => acc + (item.minutes || 0), 0);
  const plannerViewHour = Math.floor(plannerViewMinutes / 60);
  const plannerViewMinute = plannerViewMinutes % 60;
  const plannerViewSubjectMinutes = plannerViewItems.reduce((acc, item) => {
    const key = item.subject || '기타';
    acc[key] = (acc[key] || 0) + (item.minutes || 0);
    return acc;
  }, {});
  const plannerViewPalette = { 국어: '#8B5CF6', 수학: '#3B82F6', 영어: '#14B8A6', 탐구: '#F97316', 기타: '#64748B' };
  const plannerViewSubjectStats = Object.entries(plannerViewSubjectMinutes)
    .filter(([, minutes]) => minutes > 0)
    .map(([subject, minutes]) => ({
      subject,
      minutes,
      percent: plannerViewMinutes ? Math.round((minutes / plannerViewMinutes) * 100) : 0,
      color: plannerViewPalette[subject] || plannerViewPalette['기타']
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const plannerViewDonutGradient = plannerViewSubjectStats.length
    ? `conic-gradient(${plannerViewSubjectStats.map((item, idx) => {
      const start = plannerViewSubjectStats.slice(0, idx).reduce((sum, cur) => sum + cur.percent, 0);
      const end = Math.min(100, start + item.percent);
      return `${item.color} ${start}% ${end}%`;
    }).join(',')})`
    : 'conic-gradient(#E2E8F0 0 100%)';
  const plannerEditItem = plannerItems.find((item) => item.id === plannerEditIndex) || null;
  const todayDateKey = String(Number(FIXED_TODAY_DATE.split('-')[2]));
  const todayPlannerItems = plannerItemsByDate[todayDateKey] || [];
  const todayPlannerTotalMinutes = todayPlannerItems.reduce((acc, item) => acc + (item.minutes || 0), 0);
  const todayPlannerTotalSeconds = todayPlannerTotalMinutes * 60;
  const formatMinutesLabel = (minutes) => {
    const safeMinutes = Math.max(0, Number(minutes) || 0);
    const hour = Math.floor(safeMinutes / 60);
    const min = safeMinutes % 60;
    if (hour && min) return `${hour}시간 ${min}분`;
    if (hour) return `${hour}시간`;
    return `${min}분`;
  };
  const todayPlannerSubjectSummary = Object.entries(
    todayPlannerItems.reduce((acc, item) => {
      const key = item.subject || '기타';
      acc[key] = (acc[key] || 0) + (item.minutes || 0);
      return acc;
    }, {})
  )
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([subject, minutes]) => `${subject} ${formatMinutesLabel(minutes)}`);
  const subjectMinutes = plannerItems.reduce((acc, item) => {
    acc[item.subject] = (acc[item.subject] || 0) + item.minutes;
    return acc;
  }, {});
  const subjectRatio = Object.entries(subjectMinutes).map(([subject, minutes]) => ({
    subject,
    minutes,
    percent: totalMinutes ? Math.round((minutes / totalMinutes) * 100) : 0
  }));
  const plannerMinutesBySubject = {
    수학: subjectMinutes['수학'] || 0,
    국어: subjectMinutes['국어'] || 0,
    영어: subjectMinutes['영어'] || 0,
    탐구: subjectMinutes['탐구'] || 0
  };
  const highImpactSubjects = ['수학', '탐구'];
  const topHighImpactSubject = highImpactSubjects.sort((a, b) => plannerMinutesBySubject[b] - plannerMinutesBySubject[a])[0];
  const topHighImpactMinutes = plannerMinutesBySubject[topHighImpactSubject];
  const secondaryHighImpactSubject = highImpactSubjects.find((s) => s !== topHighImpactSubject) || '탐구';
  const lowImpactFocus = plannerMinutesBySubject['영어'] > plannerMinutesBySubject['수학'] + 60;
  const plannerBadges = [
    '최근 플래너 반영됨',
    topHighImpactMinutes >= 180 ? `${topHighImpactSubject} 집중 학습 중` : `${topHighImpactSubject} 보완 필요`,
    lowImpactFocus
      ? '효율 점검 필요'
      : plannerMinutesBySubject[secondaryHighImpactSubject] < 120
        ? `${secondaryHighImpactSubject} 보완 필요`
        : '학습 밸런스 양호'
  ];
  const plannerReflectionPositive = `${topHighImpactSubject} 집중 학습 (${topHighImpactMinutes}분)`;
  const plannerReflectionPositiveSub = '합격 가능성 상승 기여';
  const warningSubject = plannerMinutesBySubject['탐구'] < 120 ? '탐구' : lowImpactFocus ? '영어' : secondaryHighImpactSubject;
  const plannerReflectionWarning = `${warningSubject} ${warningSubject==='영어'?'효율 점검':'학습 부족'}`;
  const plannerReflectionWarningSub = warningSubject === '영어' ? '시간 분배 조정 필요' : '전략상 보완 필요';
  const highRatio = subjectRatio.find((item) => item.percent >= 40);
  const lowRatio = subjectRatio.find((item) => item.percent <= 10);
  const plannerFeedback = highRatio
    ? { tone: 'warn', icon: '⚠️', text: `${highRatio.subject} 비중이 높아요. 다른 과목 균형이 필요해요.` }
    : lowRatio
      ? { tone: 'info', icon: '📊', text: `${lowRatio.subject} 비중이 부족합니다. 전략상 손해 가능성이 있어요.` }
      : { tone: 'info', icon: '📊', text: '과목 비중이 균형적으로 유지되고 있어요. 지금 흐름을 유지해요.' };
  const canSubmitPlanner = Boolean(plannerDraft.subject && plannerDraft.durationChoice);
  const inquirySubjects = ['생활과 윤리','윤리와 사상','한국지리','세계지리','동아시아사','세계사','경제','정치와 법','사회·문화','물리학','화학','생명과학','지구과학'];
  const inquiryOptions = (selected = '') => `<option value="">과목 선택</option>${inquirySubjects.map((s)=>`<option value="${s}" ${selected===s?'selected':''}>${s}</option>`).join('')}`;
  const ScoreEditModal = () => {
    const step = scoreEditStep;
    const previewRaw = step === 1 ? (Number(scoreEditState.korean.common || 0) + Number(scoreEditState.korean.elective || 0))
      : step === 2 ? (Number(scoreEditState.math.common || 0) + Number(scoreEditState.math.elective || 0))
        : step === 5 ? Number(scoreEditState.inquiry1.score || 0)
          : step === 6 ? Number(scoreEditState.inquiry2.score || 0)
            : 0;
    const previewMetric = scoreMetric(previewRaw);
    const preview = `<div class="on-dummy-result"><b>표준점수 ${previewMetric.std}</b><b>백분위 ${previewMetric.pct}</b><b>등급 ${step===3 ? (Number(scoreEditState.english || 0) || '-') : step===4 ? (Number(scoreEditState.history || 0) || '-') : previewMetric.grade}</b></div>`;
    const body = step === 1
      ? `<h4>국어</h4><select class="planner-input" data-field="v2e-korean-type"><option value="화법과작문" ${scoreEditState.korean.type==='화법과작문'?'selected':''}>화법과작문</option><option value="언어와매체" ${scoreEditState.korean.type==='언어와매체'?'selected':''}>언어와매체</option></select><input class="planner-input" data-field="v2e-korean-common" value="${scoreEditState.korean.common}" type="number" placeholder="공통 원점수"/><input class="planner-input" data-field="v2e-korean-elective" value="${scoreEditState.korean.elective}" type="number" placeholder="선택 원점수"/>${preview}`
      : step === 2
        ? `<h4>수학</h4><select class="planner-input" data-field="v2e-math-type"><option value="확률과통계" ${scoreEditState.math.type==='확률과통계'?'selected':''}>확률과통계</option><option value="미적분" ${scoreEditState.math.type==='미적분'?'selected':''}>미적분</option><option value="기하" ${scoreEditState.math.type==='기하'?'selected':''}>기하</option></select><input class="planner-input" data-field="v2e-math-common" value="${scoreEditState.math.common}" type="number" placeholder="공통 원점수"/><input class="planner-input" data-field="v2e-math-elective" value="${scoreEditState.math.elective}" type="number" placeholder="선택 원점수"/>${preview}`
        : step === 3
          ? `<h4>영어</h4><select class="planner-input" data-field="v2e-english"><option value="">등급 선택</option>${[1,2,3,4,5,6,7,8,9].map((n)=>`<option value="${n}" ${String(scoreEditState.english)===String(n)?'selected':''}>${n}등급</option>`).join('')}</select>`
          : step === 4
            ? `<h4>한국사</h4><select class="planner-input" data-field="v2e-history"><option value="">등급 선택</option>${[1,2,3,4,5,6,7,8,9].map((n)=>`<option value="${n}" ${String(scoreEditState.history)===String(n)?'selected':''}>${n}등급</option>`).join('')}</select>`
            : step === 5
              ? `<h4>탐구1</h4><select class="planner-input" data-field="v2e-inq1-subject">${inquiryOptions(scoreEditState.inquiry1.subject)}</select><input class="planner-input" data-field="v2e-inq1-score" value="${scoreEditState.inquiry1.score}" type="number" placeholder="원점수"/>${preview}`
              : `<h4>탐구2</h4><select class="planner-input" data-field="v2e-inq2-subject">${inquiryOptions(scoreEditState.inquiry2.subject)}</select><input class="planner-input" data-field="v2e-inq2-score" value="${scoreEditState.inquiry2.score}" type="number" placeholder="원점수"/>${preview}`;
    return `<div class="home-modal-overlay" data-action="closeScoreEdit"><div class="home-modal score-edit-modal v2-step-modal" data-action="noopModal"><p class="home-modal-title">성적 수정</p><p class="sub">${step}/6</p>${body}<div class="v2-step-actions"><button class="btn btn-secondary" data-action="scoreStepPrev" ${step===1?'disabled':''}>이전</button>${step===6?'<button class="btn btn-primary" data-action="saveScoreEdit">저장</button>':'<button class="btn btn-primary" data-action="scoreStepNext">다음</button>'}</div></div></div>`;
  };
  const onboarding = (step, title, subtitle, cardContent, bubbleText, target, cta = '다음') => `
    <div class="app-shell"><div class="app-frame">
      <div class="screen app-screen app-content">
        <div class="onboarding-screen">
          <img src="${ONBOARDING_LOGO_SRC}" class="onboarding-logo logo" alt="StudyCrack 로고"/>
          <div class="onboarding-copy"><h2>${title}</h2><p>${subtitle}</p></div>
          ${cardContent}
          <div class="onboarding-speech">
            <img src="${CRACKY_SRC}" class="onboarding-speech-char crackie" alt="크랙이"/>
            <p class="onboarding-speech-text">${bubbleText}</p>
          </div>
          <div class="onboarding-footer">
            <div class="page-indicator"><i class="${step===1?'active':''}"></i><i class="${step===2?'active':''}"></i><i class="${step===3?'active':''}"></i></div>
            <button class="onboarding-next" data-action="goto" data-target="${target}">${cta}</button>
          </div>
        </div>
      </div></div>
    </div>
  `;

  const scoreMetric = (raw) => {
    const n = Math.max(0, Number(raw) || 0);
    const std = Math.min(160, Math.round(n * 0.95 + 22));
    const pct = Math.min(99, Math.max(1, Math.round(n * 0.9 + 10)));
    const grade = pct >= 96 ? 1 : pct >= 89 ? 2 : pct >= 77 ? 3 : pct >= 64 ? 4 : pct >= 52 ? 5 : pct >= 40 ? 6 : pct >= 28 ? 7 : pct >= 16 ? 8 : 9;
    return { std, pct, grade };
  };
  const updateText = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => { el.textContent = value ?? '-'; });
  };
  const readScoreInputValue = (key) => {
    const el = document.querySelector(`[data-score-key="${key}"], [data-field="${key}"]`);
    return Number(el?.dataset?.pendingValue ?? el?.value ?? 0);
  };
  const updateScoreDerivedDomFromInputs = () => {
    const koreanRaw = readScoreInputValue('korean_common') + readScoreInputValue('korean_elective');
    const mathRaw = readScoreInputValue('math_common') + readScoreInputValue('math_elective');
    const inquiry1Raw = readScoreInputValue('inquiry1_raw');
    const inquiry2Raw = readScoreInputValue('inquiry2_raw');
    const k = scoreMetric(koreanRaw);
    const m = scoreMetric(mathRaw);
    const i1 = scoreMetric(inquiry1Raw);
    const i2 = scoreMetric(inquiry2Raw);
    updateText('[data-derived="korean-standard"]', k.std);
    updateText('[data-derived="korean-percentile"]', k.pct);
    updateText('[data-derived="korean-grade"]', k.grade);
    updateText('[data-derived="math-standard"]', m.std);
    updateText('[data-derived="math-percentile"]', m.pct);
    updateText('[data-derived="math-grade"]', m.grade);
    updateText('[data-derived="inquiry1-standard"]', i1.std);
    updateText('[data-derived="inquiry1-percentile"]', i1.pct);
    updateText('[data-derived="inquiry1-grade"]', i1.grade);
    updateText('[data-derived="inquiry2-standard"]', i2.std);
    updateText('[data-derived="inquiry2-percentile"]', i2.pct);
    updateText('[data-derived="inquiry2-grade"]', i2.grade);
  };
  const syncScoreInputsFromDom = () => {
    const get = (k) => {
      const el = document.querySelector(`[data-score-key="${k}"]`);
      return Number(el?.dataset?.pendingValue ?? el?.value ?? 0);
    };
    return {
      korean_common: get('korean_common'),
      korean_elective: get('korean_elective'),
      math_common: get('math_common'),
      math_elective: get('math_elective'),
      english_grade: get('english_grade'),
      inquiry1_raw: get('inquiry1_raw'),
      inquiry2_raw: get('inquiry2_raw')
    };
  };
  const readOb1Value = (field) => {
    const el = document.querySelector(`[data-field="${field}"]`);
    if (field === 'obGradeStatus' && !el) {
      const activeGrade = document.querySelector('.ob1-pill[data-action="setObGradeStatus"].active')?.getAttribute('data-ob-grade');
      if (activeGrade) return String(activeGrade);
    }
    return String(el?.dataset?.pendingValue ?? el?.value ?? '');
  };
  const readOb1FormValuesFromDom = () => ({
    obSchoolName: readOb1Value('obSchoolName'),
    obGradeStatus: readOb1Value('obGradeStatus'),
    obTrack: readOb1Value('obTrack'),
    obGoalText: readOb1Value('obGoalText'),
    obQuestionText: readOb1Value('obQuestionText')
  });
  const isObSurveyScreen = () => screen === 'ob1' || screen === 'qualInfo';
  const EXAM_OPTIONS = ['3월 모의고사','5월 모의고사','6월 평가원','7월 모의고사','9월 평가원','10월 모의고사','수능','기타'];
  const getExamScoresMap = () => {
    try { return JSON.parse(localStorage.getItem('examScoresByType') || '{}') || {}; } catch { return {}; }
  };
  const saveExamScoresMap = (map) => localStorage.setItem('examScoresByType', JSON.stringify(map || {}));
  const signupPasswordRuleValid = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(signupPassword);
  const signupPasswordMatchValid = signupPassword && signupPasswordConfirm && signupPassword === signupPasswordConfirm;
  const signupPasswordValid = signupPasswordRuleValid && signupPasswordMatchValid;
  const signupSubmitEnabled = signupEmailVerified && signupPhoneVerified && signupPasswordValid && signupTermsRequired;
  const formatSignupTimer = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const preserveSignupScroll = (fn) => {
    const y = window.scrollY || window.pageYOffset || 0;
    fn();
    requestAnimationFrame(() => safeScrollTo({ top: y, left: 0, behavior: 'auto' }));
  };
  const updateSignupPasswordMatchUi = () => {
    const msgEl = document.querySelector('[data-signup-pw-match]');
    if (!msgEl) return;
    const pw = document.querySelector('[data-field="signupPassword"]')?.value ?? '';
    const pwc = document.querySelector('[data-field="signupPasswordConfirm"]')?.value ?? '';
    if (!pw || !pwc) {
      msgEl.style.display = 'none';
      msgEl.textContent = '';
      msgEl.classList.remove('ok', 'bad');
      return;
    }
    const matched = pw === pwc;
    msgEl.style.display = 'block';
    msgEl.classList.toggle('ok', matched);
    msgEl.classList.toggle('bad', !matched);
    msgEl.textContent = matched ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.';
  };
  const syncSignupFromDom = () => {
    const pick = (field) => document.querySelector(`[data-field="${field}"]`)?.value ?? '';
    const email = pick('signupEmail');
    const phone = pick('signupPhone');
    const pw = pick('signupPassword');
    const pwc = pick('signupPasswordConfirm');
    const name = pick('signupName');
    const birth = pick('signupBirth');
    const emailCode = pick('signupEmailCode');
    const phoneCode = pick('signupPhoneCode');
    const genderEl = document.querySelector('input[name="signupGender"]:checked');
    const gender = genderEl?.getAttribute('data-gender') || signupGender;
    preserveSignupScroll(() => {
      if (email !== '') setSignupEmail(email);
      if (phone !== '') setSignupPhone(phone);
      if (pw !== '') setSignupPassword(pw);
      if (pwc !== '') setSignupPasswordConfirm(pwc);
      if (name !== '') setSignupName(name);
      if (birth !== '') setSignupBirth(birth);
      if (emailCode !== '') setSignupEmailCode(emailCode);
      if (phoneCode !== '') setSignupPhoneCode(phoneCode);
      if (gender) setSignupGender(gender);
    });
    updateSignupPasswordMatchUi();
    return { email, phone, pw, pwc, name, birth, emailCode, phoneCode, gender };
  };
  const homeTargets = homeTargetList.map((major) => {
    const profile = analysisProfiles[major] || analysisSelected;
    const score = Number(liveCurrentScore || Math.round((scores.korean + scores.math + scores.english + scores.inquiry1 + scores.inquiry2) / 5));
    const cut = 100;
    const gap = score - cut;
    return {
      major,
      score,
      cut,
      gap: gap > 0 ? `+${gap}` : String(gap),
      rank: score >= 150 ? '안정' : score >= 100 ? '합격권' : '도전',
      rate: Math.round(Math.min(99, Math.max(20, (score / 150) * 100)))
    };
  });
  const analysisMajorOptions = Array.from(new Set([...(analysisTargetList || []), ...(homeTargetList || [])])).filter(Boolean);
  const normalizedTargetMajor = analysisMajorOptions.includes(targetMajor) ? targetMajor : (analysisMajorOptions[0] || targetMajor || '');
  const scoreRows = [
    [scoreEditState.korean.type || '국어', scores.korean, 'raw'],
    [scoreEditState.math.type || '수학', scores.math, 'raw'],
    ['영어', scores.english, 'grade-only'],
    [scoreEditState.inquiry1.subject || '탐구1', scores.inquiry1, 'raw'],
    [scoreEditState.inquiry2.subject || '탐구2', scores.inquiry2, 'raw']
  ];
  const scoreInfoDetailList = scoreRows.map(([subject, raw, type]) => {
    if (type === 'grade-only') {
      const englishGrade = Number(scoreEditState.english || 0) || Math.min(9, Math.max(1, Math.round((100 - Number(raw || 0)) / 12.5) + 1));
      return `<div class="score-info-detail-row"><b>${subject}</b><span>-</span><span>-</span><span>-</span><span>${englishGrade}</span></div>`;
    }
    const m = scoreMetric(raw);
    const rawText = Number(raw) > 0 ? raw : '-';
    const stdText = Number(raw) > 0 ? m.std : '-';
    const pctText = Number(raw) > 0 ? m.pct : '-';
    const grdText = Number(raw) > 0 ? m.grade : '-';
    return `<div class="score-info-detail-row"><b>${subject}</b><span>${rawText}</span><span>${stdText}</span><span>${pctText}</span><span>${grdText}</span></div>`;
  }).join('') + `<div class="score-info-detail-row"><b>한국사</b><span>-</span><span>-</span><span>-</span><span>${Math.max(1, Number(scoreEditState.history || 3) || 3)}</span></div>`;
  const todayKey = FIXED_TODAY_DATE;
  const todayRecord = studyRecords.find((item) => item.date === todayKey);
  const liveStudySeconds = studyTimerSecondsRef.current;
  const todayStudySeconds = (todayRecord?.studyTime || 0) + liveStudySeconds;
  const todayPlannerProgress = todayPlannerTotalSeconds ? Math.min(100, Math.round((todayStudySeconds / todayPlannerTotalSeconds) * 100)) : 0;
  const formatHms = (total) => {
    const hh = String(Math.floor(total / 3600)).padStart(2, '0');
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };
  const formatHourMin = (total) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}시간 ${m}분`;
  };
  const syncLiveStudyTimerUi = (liveSeconds) => {
    document.querySelectorAll('[data-study-base-seconds]').forEach((node) => {
      const baseSeconds = Number(node.getAttribute('data-study-base-seconds')) || 0;
      node.textContent = formatHms(baseSeconds + liveSeconds);
    });
  };
  const startLiveStudyTimer = () => {
    if (studyTimerIntervalRef.current) clearInterval(studyTimerIntervalRef.current);
    studyTimerIntervalRef.current = setInterval(() => {
      studyTimerSecondsRef.current += 1;
      syncLiveStudyTimerUi(studyTimerSecondsRef.current);
    }, 1000);
  };
  const stopLiveStudyTimer = () => {
    if (studyTimerIntervalRef.current) {
      clearInterval(studyTimerIntervalRef.current);
      studyTimerIntervalRef.current = null;
    }
  };
  const todayGoalSeconds = 3 * 3600;
  const todayGoalPercent = Math.min(Math.round((todayStudySeconds / todayGoalSeconds) * 100), 100);
  const subjectPalette = { 수학: '#3B82F6', 영어: '#10B981', 탐구: '#F59E0B', 국어: '#8B5CF6', 기타: '#64748B' };
  const todaySubjectRecord = studySubjectRecords.find((item) => item.date === todayKey) || { date: todayKey, subjects: {} };
  const todaySubjectsWithTimer = { ...todaySubjectRecord.subjects };
  if (studyTimerRunning && activeStudySubject) {
    todaySubjectsWithTimer[activeStudySubject] = (todaySubjectsWithTimer[activeStudySubject] || 0) + liveStudySeconds;
  }
  const todaySubjectRows = Object.entries(todaySubjectsWithTimer).filter(([, sec]) => sec > 0);
  const subjectChipSource = Object.entries({ 국어: todaySubjectsWithTimer['국어'] || 0, 수학: todaySubjectsWithTimer['수학'] || 0, 영어: todaySubjectsWithTimer['영어'] || 0, 탐구: todaySubjectsWithTimer['탐구'] || 0, ...todaySubjectsWithTimer });
  const visibleSubjectChips = subjectChipSource.slice(0, 4);
  const hiddenSubjectCount = Math.max(subjectChipSource.length - 4, 0);
  const plannedSubjectOptions = Array.from(new Set(todayPlannerItems.map((item) => `${item.subject}${item.content ? ` - ${item.content}` : ''}`)));
  const plannedScheduleOptions = todayPlannerItems.map((item) => ({ id: item.id, subject: item.subject || '기타', label: `${item.subject || '기타'}${item.content ? ` - ${item.content}` : ''}` }));
  const breakdownSubjects = Array.from(new Set(['국어', '수학', '영어', '탐구', '기타', ...Object.keys(todaySubjectsWithTimer), ...todayPlannerItems.map((item) => item.subject || '기타')]));
  const breakdownDetailMap = breakdownSubjects.reduce((acc, subject) => {
    const rows = todayPlannerItems.filter((item) => (item.subject || '기타') === subject).map((item) => ({
      content: item.content || '학습 내용 없음',
      plannedHour: ((item.minutes || 0) / 60),
      actualHour: ((item.doneMinutes || 0) / 60)
    }));
    acc[subject] = rows;
    return acc;
  }, {});
  const buildDefaultCoachingSubjects = () => {
    const rows = todayPlannerItems.map((item, idx) => {
      const subject = item.subject || '기타';
      const plannedHour = ((item.minutes || 0) / 60);
      const actualHour = (((todaySubjectRecord.subjects && todaySubjectRecord.subjects[subject]) || todayStudySeconds || 0) / 3600);
      return { id: `plan-${idx}-${subject}`, sourceId: item.id || `plan-${idx}`, subject, detail: item.content || '', planned: plannedHour ? plannedHour.toFixed(1) : '', actual: actualHour ? actualHour.toFixed(1) : '', removable: true, placeholder: '세부과목 입력' };
    });
    if (rows.length) return rows;
    const mapped = ['국어', '수학', '영어', '탐구', '기타'].map((subject) => {
      const plannedHour = (plannerMinutesBySubject[subject] || 0) / 60;
      const actualHour = (((todaySubjectRecord.subjects && todaySubjectRecord.subjects[subject]) || todayStudySeconds || 0) / 3600);
      const hint = subject === '국어' ? '세부과목 (예: 언매)' : subject === '수학' ? '세부과목 (예: 미적)' : subject === '영어' ? '세부과목 (예: 독해)' : subject === '탐구' ? '세부과목 (예: 생1)' : '세부과목 입력';
      return { id: `${subject}-base`, sourceId: `${subject}-base`, subject, detail: '', planned: plannedHour ? plannedHour.toFixed(1) : '', actual: actualHour ? actualHour.toFixed(1) : '', removable: subject === '기타', placeholder: hint };
    });
    return mapped;
  };
  const ensureCoachingSubjectRows = () => {
    if (coachingAutoFilledRef.current || coachingSubjectRows.length) return;
    coachingAutoFilledRef.current = true;
    setCoachingSubjectRows(buildDefaultCoachingSubjects());
  };
  const syncStep1FromDom = () => {
    const rows = coachingSubjectRows.map((row) => {
      const detail = document.querySelector(`[data-coach-detail="${row.id}"]`)?.value || row.detail;
      const planned = document.querySelector(`[data-coach-plan="${row.id}"]`)?.value || row.planned;
      const actual = document.querySelector(`[data-coach-actual="${row.id}"]`)?.value || row.actual;
      return { ...row, detail, planned, actual };
    });
    setCoachingSubjectRows(rows);
  };
  const myRank = Math.max(1, 160 - Math.floor(todayStudySeconds / 60));
  const percentile = Math.max(1, Math.min(100, 100 - Math.floor(todayStudySeconds / 120)));
  const rankingProgress = Math.max(5, 100 - percentile);
  const rankTier = percentile <= 5 ? 'diamond' : percentile <= 15 ? 'platinum' : percentile <= 30 ? 'gold' : percentile <= 60 ? 'silver' : 'bronze';
  const rankTierLabel = rankTier === 'diamond' ? 'DIAMOND' : rankTier === 'platinum' ? 'PLATINUM' : rankTier === 'gold' ? 'GOLD' : rankTier === 'silver' ? 'SILVER' : 'BRONZE';
  const lastStudyDate = studyRecords.length ? studyRecords[studyRecords.length - 1].date : '';
  const noStudyFor24h = !todayRecord && lastStudyDate !== todayKey;
  const retentionMessage = noStudyFor24h ? '오늘 공부 안 하면 합격컷에서 멀어집니다' : `오늘 목표까지 ${Math.max(0, Math.ceil((todayGoalSeconds - todayStudySeconds) / 3600))}시간 남았어요`;
  const streakDays = (() => {
    const set = new Set(studyRecords.filter((r) => r.studyTime > 0).map((r) => r.date));
    let count = 0;
    for (let i = 0; i < 30; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (set.has(key) || (i === 0 && todayStudySeconds > 0)) count += 1;
      else break;
    }
    return count;
  })();

  const homeView = () => `<div class="home-dashboard home-container">
    ${(() => { console.log('RENDER_HOME_RESULT_CARD_V3'); return ''; })()}
    <div class="home-content">
    <div class="home-header">
      <div class="home-top-icons">
        <button class="pro-top-btn" data-action="goto" data-target="proElite"><span>PRO LOUNGE 입장</span></button>
        <button class="top-icon-btn" data-action="openNotificationModal">${i('bell', false)}</button>
      </div>
      <div class="home-greeting-bubble">
        <img src="${CRACKY_SRC}" class="home-greeting-cracky" alt="크랙이" />
        <div class="home-greeting-speech">
          <p class="home-greeting">안녕하세요, 지민님 👋</p>
          <p class="home-sub">오늘도 크랙한 하루 되세요!</p>
        </div>
      </div>
    </div>
    <div class="section home-section">
      <div class="home-kpi-slider">
        <div class="home-kpi-track anchor-volatile ${homeSlideMotion}" style="--home-slide-card-width:100%;--home-slide-gap:12px;--home-slide-x:calc(-${homeSlideIndex} * (var(--home-slide-card-width) + var(--home-slide-gap)) + ${homeDragOffset}px);--home-slide-transition:${homeDragOffset!==0?'0s':'transform .72s cubic-bezier(.22,1,.36,1)'};">
        ${homeTargets.map((item) => `<button class="university-card-slide card home-kpi-card admission-card slider-card home-result-card-v3" data-action="selectUniversity" data-target-major="${item.major}">
          <span class="home-univ-remove" data-action="removeAnalysisTarget" data-target-major="${item.major}">✕</span>
          <div class="home-result-top"><div><p class="home-result-major">${item.major}</p><span class="home-result-state">${item.rank}</span></div><div class="home-result-score"><strong>${item.score}점</strong><small>AI 점수</small></div></div>
          <div class="home-result-gauge"><i class="${scoreTierClass(item.score)}" style="width:${Math.min((item.score / 250) * 100, 100)}%"></i><span class="cut pass" style="left:40%"></span><span class="cut safe" style="left:60%"></span></div>
          <div class="home-result-gauge-meta"><span>0</span><span>합격컷 100</span><span>안정컷 150</span><span>MAX 250</span></div>
          <div class="kpi-row score-row"><div class="kpi-item"><b>${item.score}점</b>현재 점수</div><div class="kpi-item"><b>${item.cut}점</b>합격 컷</div><div class="kpi-item danger"><b>${item.gap}점</b>부족 점수</div></div>
          <div class="home-planner-badges chip-row">${plannerBadges.map((badge) => `<span class="chip">${badge}</span>`).join('')}</div>
        </button>`).join('')}<button class="university-card-slide university-card card slider-card home-add-univ-card" data-action="openAnalysisSearchFromHome"><b>+ 대학 추가</b><p>추천/검색으로 추가</p></button></div>
      </div>
      <div class="home-kpi-indicator card-indicator">${[...homeTargets, { add: true }].map((_, idx) => `<i class="${idx===homeSlideIndex?'active':''}" data-action="setHomeSlide" data-slide-index="${idx}"></i>`).join('')}</div>
      ${universityModalOpen ? `<div class="home-modal-overlay" data-action="closeUniversityModal"><div class="home-modal" data-action="noopModal"><div class="analysis-search-head"><h4>희망 대학 선택</h4><button data-action="closeUniversityModal">✕</button></div><input class="planner-input" data-field="analysisSearchTerm" value="${analysisSearchTerm}" placeholder="대학명 또는 학과명을 검색하세요"/><div class="analysis-search-section recommend"><p>현재 성적 기준 추천</p><div class="analysis-search-rec-grid">${analysisRecommended.map((name) => `<button class="analysis-rec-card" data-action="addAnalysisTarget" data-target-major="${name}"><div><strong>${name}</strong><span class="badge">추천</span></div><em>${analysisTargetList.includes(name)?'추가됨':'선택'}</em></button>`).join('')}</div></div><div class="analysis-search-section"><p>검색 결과</p>${analysisSearchList.map((name) => `<button class="analysis-search-row" data-action="addAnalysisTarget" data-target-major="${name}">${name}<span>${analysisTargetList.includes(name)?'추가됨':'추가'}</span></button>`).join('')}</div></div></div>` : ''}
    </div>
    <div class="section home-section home-section-last">
      <div class="card home-study-summary study-summary-card home-insight-card premium-panel">
        <div class="home-card-head"><p class="analysis-title">오늘 누적 공부</p><span class="home-mini-badge">${studyTimerRunning ? '진행중' : '대기'}</span></div>
        <div class="study-timer-row"><b class="timer premium-clock" data-study-base-seconds="${todayRecord?.studyTime || 0}">${formatHms(todayStudySeconds)}</b><div class="timer-actions"><button class="btn btn-primary mini ${studyTimerRunning?'disabled':''}" data-action="openStudySubjectSheet" ${studyTimerRunning?'disabled':''}>공부 시작</button><button class="btn btn-secondary mini ${studyTimerRunning?'':'disabled'}" data-action="stopStudyTimer" ${studyTimerRunning?'':'disabled'}>정지</button></div></div>
        <button class="home-breakdown-toggle" data-action="toggleStudyBreakdown">${showStudyBreakdown ? '접기' : '펼쳐보기'}</button>
        ${showStudyBreakdown ? `<div class="home-breakdown-list">${breakdownSubjects.map((subject) => {
          const sec = todaySubjectsWithTimer[subject] || 0;
          const rows = breakdownDetailMap[subject] || [];
          const expanded = expandedBreakdownSubject === subject;
          return `<button class="home-breakdown-item" data-action="toggleBreakdownSubject" data-breakdown-subject="${subject}"><div><b>${subject}</b><small style="margin-left:6px;color:#1D4ED8;font-weight:800;">${rows.length}개 항목</small><span>${formatHms(sec)}</span></div></button>${expanded ? `<div class="home-breakdown-detail">${rows.length ? rows.map((row) => { const plannedSec = Math.round(row.plannedHour * 3600); const actualSec = Math.round(row.actualHour * 3600); const rate = plannedSec > 0 ? Math.min(100, Math.round((actualSec / plannedSec) * 100)) : 0; return `<div class="home-breakdown-detail-row"><small>${row.content}</small><em>계획 ${formatHms(plannedSec)} · 실제 ${formatHms(actualSec)}</em><span>${rate}%</span></div>`; }).join('') : '<p>오늘 등록된 학습 계획이 없습니다</p>'}</div>` : ''}`;
        }).join('')}</div>` : ''}
      </div>
      <button class="card study-goal-card home-goal-linked-card home-insight-card premium-panel" data-action="goto" data-target="planner">
        <p class="analysis-title">오늘 공부 목표</p>
        ${todayPlannerItems.length ? `<div class="goal-compact"><b>${todayPlannerProgress}%</b><span>달성</span><em>${formatMinutesLabel(todayPlannerTotalMinutes)}</em></div><div class="track"><i style="width:${todayPlannerProgress}%"></i></div><div class="goal-tags">${todayPlannerSubjectSummary.slice(0,3).map((v)=>`<span>${v}</span>`).join('')}</div>` : `<p class="sub">오늘 계획을 추가해보세요</p><span class="home-goal-empty-cta">플래너로 이동</span>`}
      </button>
      <div class="card home-bottom-summary ranking-card home-insight-card premium-panel rank-tier-${rankTier} ${['gold','platinum','diamond'].includes(rankTier) ? 'rank-shine' : ''}">
        <div class="home-ranking-head"><p class="analysis-title">내 공부 랭킹</p><span class="badge">오늘 기준</span></div>
        <p class="home-ranking-main">${Math.min(myRank, 124)}등</p>
        <p class="home-ranking-tier">${rankTierLabel}</p>
        <p class="home-ranking-sub">전체 124명 중</p>
        <div class="home-ranking-progress"><i style="width:${rankingProgress}%"></i></div>
        <p class="home-ranking-foot">상위 ${percentile}%</p>
        <p class="home-ranking-tip">오늘 공부를 시작하면 순위가 올라가요</p>
      </div>
    </div>
    ${studySubjectSheetOpen ? `<div class="planner-sheet-overlay" data-action="closeStudySubjectSheet"><div class="planner-sheet study-subject-sheet" data-action="noopModal"><h3>어떤 과목을 공부할까요?</h3>${studySubjectSheetOnlyPlanned ? '' : `<div class="study-subject-grid">${['국어', '수학', '영어', '탐구'].map((s) => `<button class="planner-pill" data-action="selectStudySubject" data-study-subject="${s}">${s}</button>`).join('')}<button class="planner-pill" data-action="selectStudySubjectCustom">기타 직접 입력</button></div>`}${plannedScheduleOptions.length ? `<p class="sub" style="margin:8px 0 6px">오늘 플래너 일정</p><div class="study-subject-grid">${plannedScheduleOptions.map((row) => `<button class="planner-pill" data-action="selectStudySubject" data-study-subject="${row.subject}" data-study-item-id="${row.id}">${row.label}</button>`).join('')}</div>` : '<p class="sub" style="margin-top:8px">오늘 플래너 일정이 없습니다.</p>'}</div></div>` : ''}
    ${notifModalOpen ? `<div class="home-modal-overlay" data-action="closeNotificationModal"><div class="home-modal pro-notif-modal" data-action="noopModal"><p class="home-modal-title">알림</p><div class="pro-notif-list"><div><b>주간 코칭 알림</b><p>이번 주 코칭 작성 마감이 오늘 20:00입니다.</p></div><div><b>PRO 리포트 알림</b><p>26년 4월 4주차 리포트가 도착했습니다.</p></div><div><b>플래너 알림</b><p>오늘 계획 3개 중 1개를 완료했어요.</p></div></div><button class="btn btn-primary" data-action="closeNotificationModal">확인</button></div></div>` : ''}
    ${drawerOpen ? `<div class="home-modal-overlay drawer-overlay" data-action="closeDrawer"><aside class="side-drawer" data-action="noopModal"><h3>메뉴</h3>${[['analysis','분석'],['strategy','학습 코칭'],['planner','플래너'],['weekly','주간 점검'],['report','프로 보고서']].map(([target,label]) => `<button class="my-row" data-action="drawerGoto" data-target="${target}">${label}<span>${i('chevron', false)}</span></button>`).join('')}</aside></div>` : ''}
  </div>
  </div>`;

  const planMeta = {
    Basic: {
      introPrice: '25,000원 / 4주',
      payPrice: '25,000원 / 4주',
      desc: '합격 가능성 분석 + 대학별 전략 확인',
      features: ['합격 가능성 분석', '대학별 전략 확인'],
      complete: '합격 가능성 분석과 대학별 전략을 확인할 수 있어요.'
    },
    Standard: {
      introPrice: '149,000원 / 4주',
      payPrice: '149,000원 / 4주',
      desc: '전략 + 플래너 + 주간 점검',
      features: ['전략 기능 이용', '플래너 피드백', '학습 방향 코칭', '주간 점검 제공'],
      complete: '플래너 피드백과 학습 방향 코칭을 받을 수 있어요.'
    },
    Pro: {
      introPrice: '299,000원 / 4주',
      payPrice: '299,000원 / 4주',
      desc: '모든 기능 무제한 + 프로 보고서 제공',
      features: ['모든 기능 무제한 이용', '프로 보고서 2주에 1번 제공', 'Sky튜터 1:1 피드백 무제한', '광고 제거'],
      complete: '프로 보고서는 2주 단위로 제공됩니다.'
    }
  };
  const currentPlan = planMeta[selectedPlan] || planMeta.Pro;
  const coachingMonthlyReports = {
    '26년 4월': [
      { title: '4월 1주차 피드백 리포트', date: '2026.04.07', pdfPath: 'assets/sample/weekly-feedback-4w1.pdf' },
      { title: '4월 2주차 피드백 리포트', date: '2026.04.14', pdfPath: 'assets/sample/weekly-feedback-4w2.pdf' }
    ],
    '26년 3월': []
  };
  const selectedCoachingReports = coachingMonthlyReports[coachingMonth] || [];
  const coachingStepBody = () => {
    if (coachingStep === 1) {
      return `<div class="coach-step-body"><h4>1. 과목별 학습 달성률 <span style="color:#ef4444">*</span></h4><p class="sub">과목별 구체적인 과목명과 시간을 입력하세요.</p>
        <div class="coach-subject-list">
          ${coachingSubjectRows.map((row) => {
            const planned = Number(row.planned) || 0;
            const actual = Number(row.actual) || 0;
            const rate = planned > 0 ? Math.min(999, Math.round((actual / planned) * 100)) : 0;
            return `<div class="coach-subject-card">
              <div class="coach-subject-head"><b>${row.subject}</b>${row.removable ? `<button class="coach-delete-btn" data-action="removeCoachingSubject" data-coach-row="${row.id}">삭제</button>` : ''}</div>
              <input class="planner-input" data-coach-detail="${row.id}" value="${row.detail || ''}" placeholder="${row.placeholder}" />
              <div class="coach-hours-row">
                <input class="planner-input" data-coach-plan="${row.id}" value="${row.planned || ''}" type="number" placeholder="계획(H)" />
                <input class="planner-input" data-coach-actual="${row.id}" value="${row.actual || ''}" type="number" placeholder="실제(H)" />
                <div class="coach-rate-box" data-coach-rate="${row.id}">달성률 ${rate}%</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn-secondary" data-action="addCoachingSubject">+ 새로운 과목 추가</button>
      </div>`;
    }
    if (coachingStep === 2) {
      return `<div class="coach-step-body"><h4>2. 플래너 인증 <span style="color:#ef4444">*</span></h4><p class="sub">이번 주 플래너 사진을 첨부해주세요. 최대 5장</p>
        <div class="coach-upload-box"><p>파일/사진 첨부 박스</p><input type="file" class="coach-hidden-file" data-field="coachPlannerFiles" accept="image/*" multiple /><button class="btn btn-secondary" data-action="openPlannerFilePicker">사진 추가하기</button></div>
        <div class="coach-thumb-list">${coachingPlannerFiles.length ? `<p class="sub">사진 ${coachingPlannerFiles.length}장 첨부됨</p>${coachingPlannerFiles.map((file, idx) => `<div class="coach-thumb"><span>${file.name}</span><button data-action="removePlannerPhoto" data-photo-index="${idx}">삭제</button></div>`).join('')}` : '<p class="sub">첨부된 사진이 없습니다.</p>'}</div>
      </div>`;
    }
    if (coachingStep === 3) {
      const examTypes = ['미응시', '교내', '평가원/교육청', '사설'];
      return `<div class="coach-step-body"><h4>3. 모의고사 응시 여부 <span style="color:#ef4444">*</span></h4><p class="sub">이번 주 사설 모의고사 또는 학력평가를 응시했나요?</p>
        <div class="coach-choice-row">${examTypes.map((type) => `<button class="planner-pill ${coachingExamType===type?'active':''}" data-action="setCoachingExamType" data-coach-exam="${type}">${type}</button>`).join('')}</div>
        ${coachingExamType && coachingExamType !== '미응시' ? `<div class="coach-exam-form">
          <input type="file" class="coach-hidden-file" data-field="coachExamFiles" accept="image/*" multiple /><button class="btn btn-secondary" data-action="openExamFilePicker">성적 인증 사진 첨부</button>
          <div class="coach-thumb-list">${coachingExamFiles.length ? `<p class="sub">사진 ${coachingExamFiles.length}장 첨부됨</p>${coachingExamFiles.map((file, idx) => `<div class="coach-thumb"><span>${file.name}</span><button data-action="removeExamPhoto" data-photo-index="${idx}">삭제</button></div>`).join('')}` : '<p class="sub">첨부된 사진이 없습니다.</p>'}</div>
          <div class="coach-exam-subject-list">
            <section class="coach-exam-subject-card"><h5>국어</h5><input class="planner-input" data-coach-field="koreanType" value="${coachingExamScores.koreanType || ''}" placeholder="선택과목" /><input class="planner-input" data-coach-field="koreanRaw" value="${coachingExamScores.koreanRaw || ''}" placeholder="원점수" /></section>
            <section class="coach-exam-subject-card"><h5>수학</h5><input class="planner-input" data-coach-field="mathType" value="${coachingExamScores.mathType || ''}" placeholder="선택과목" /><input class="planner-input" data-coach-field="mathRaw" value="${coachingExamScores.mathRaw || ''}" placeholder="원점수" /></section>
            <section class="coach-exam-subject-card"><h5>영어</h5><input class="planner-input" data-coach-field="englishGrade" value="${coachingExamScores.englishGrade || ''}" placeholder="등급" /></section>
            <section class="coach-exam-subject-card"><h5>탐구1</h5><input class="planner-input" data-coach-field="inq1Name" value="${coachingExamScores.inq1Name || ''}" placeholder="과목명" /><input class="planner-input" data-coach-field="inq1Raw" value="${coachingExamScores.inq1Raw || ''}" placeholder="원점수" /></section>
            <section class="coach-exam-subject-card"><h5>탐구2</h5><input class="planner-input" data-coach-field="inq2Name" value="${coachingExamScores.inq2Name || ''}" placeholder="과목명" /><input class="planner-input" data-coach-field="inq2Raw" value="${coachingExamScores.inq2Raw || ''}" placeholder="원점수" /></section>
          </div>
        </div>` : ''}
      </div>`;
    }
    if (coachingStep === 4) {
      const reasons = ['계획 과다', '실전 감각 저하', '컨디션/건강', '기타'];
      return `<div class="coach-step-body"><h4>4. 최근 2주 학업 추이 <span style="color:#ef4444">*</span></h4><p class="sub">최근 2주간 학습 흐름이 어땠나요?</p>
        <div class="coach-choice-row">${['상승', '유지', '하락'].map((v) => `<button class="planner-pill ${coachingTrend===v?'active':''}" data-action="setCoachingTrend" data-coach-trend="${v}">${v}</button>`).join('')}</div>
        ${coachingTrend === '하락' ? `<div class="coach-drop-box"><p class="sub">하락 원인 (중복 선택 가능)</p><div class="coach-choice-row">${reasons.map((reason) => `<button class="planner-pill ${coachingDropReasons.includes(reason)?'active':''}" data-action="toggleDropReason" data-drop-reason="${reason}">${reason}</button>`).join('')}</div><textarea class="planner-input coach-textarea" data-coach-answer="step4Reason" maxlength="200" placeholder="구체적인 이유를 간단히 적어주세요.">${coachingAnswers.step4Reason || ''}</textarea><p class="coach-count" data-coach-count="step4Reason">${(coachingAnswers.step4Reason || '').length}/200</p></div>` : ''}
      </div>`;
    }
    const stepMap = {
      5: ['5. 학습 계획 점검', '현재 세우고 있는 계획의 문제점이나 확신이 없는 부분을 적어주세요.', 'step5', '예: 하루 14시간 계획을 세우는데 자꾸 밀립니다. 현실적인 수정이 필요합니다.'],
      6: ['6. 학습 방향성 설정', '현재 공부하고 있는 방향이 맞는지, 입시 전략과 일치하는지 고민을 적어주세요.', 'step6', '예: 정시 파이터인데 내신 기간에 수능 공부 밸런스를 어떻게 잡아야 할까요?'],
      7: ['7. 튜터에게 묻고 싶은 질문', '이번 주 피드백에서 꼭 답변받고 싶은 질문을 적어주세요.', 'step7', '예: 수학은 기출을 반복하는 게 나을까요, N제를 늘리는 게 나을까요?'],
      8: ['8. 기타 멘탈 관리', '슬럼프, 불안감 등 학습 외적인 고민이 있다면 자유롭게 적어주세요.', 'step8', '자유롭게 작성해주세요.']
    };
    const [title, desc, key, placeholder] = stepMap[coachingStep];
    const value = coachingAnswers[key] || '';
    return `<div class="coach-step-body"><h4>${title}</h4><p class="sub">${desc}</p><textarea class="planner-input coach-textarea" data-coach-answer="${key}" maxlength="200" placeholder="${placeholder}">${value}</textarea><p class="coach-count" data-coach-count="${key}">${value.length}/200</p></div>`;
  };

  const designV2StyleTag = `<style>
    html,body{touch-action:manipulation;overscroll-behavior:none;}
    .app-shell,.app-frame,.app-screen{min-height:100dvh;}
    .onboarding-container .content{padding:0 16px 150px;box-sizing:border-box;}
    .onboarding-shot{height:100vh;max-width:390px;margin:0 auto;padding:0 24px;display:flex;flex-direction:column;position:relative;overflow:hidden;background:#fff;}
    .onboarding-shot-head{margin-top:72px;text-align:center;}
    .onboarding-shot-head h2{margin:0;font-size:24px;font-weight:800;line-height:1.45;letter-spacing:-0.04em;color:#111827;white-space:pre-line;}
    .onboarding-shot-head h2 .accent{color:#0B4EDB;}
    .onboarding-shot-head p{margin:20px 0 0;font-size:16px;font-weight:600;line-height:1.55;letter-spacing:-0.04em;color:#4B5563;white-space:pre-line;}
    .onboarding-center{margin-top:8px;position:relative;}
    .onboarding-card{background:#fff;border-radius:22px;box-shadow:0 8px 28px rgba(15,23,42,.08);border:1px solid rgba(226,232,240,.8);position:relative;}
    .onboarding-card.list{padding-top:10px;background:transparent;border:none;box-shadow:none;}
    .onboarding-list-item{height:78px;border-radius:18px;padding:0 20px;display:flex;align-items:center;gap:16px;margin-bottom:14px;background:#fff;box-shadow:0 8px 26px rgba(15,23,42,.07);border:1px solid #EEF2F7;font-size:19px;font-weight:800;color:#111827;letter-spacing:-0.04em;}
    .onboarding-icon-box{width:48px;height:48px;border-radius:14px;background:#F0F5FF;color:#0B6BFF;display:grid;place-items:center;flex:0 0 48px;}
    .onboarding-card.strategy{height:232px;margin-top:24px;padding:28px 28px 22px;}
    .onboarding-card.data{height:254px;margin-top:24px;padding:28px;overflow:hidden;}
    .onboarding-stat{font-size:24px;font-weight:800;line-height:1.65;color:#111827;letter-spacing:-0.04em;white-space:pre-line;}
    .onboarding-label{font-size:20px;font-weight:800;color:#111827;}
    .onboarding-score{margin-top:8px;font-size:58px;font-weight:900;line-height:1;color:#0f172a;}
    .onboarding-score em{font-style:normal;font-size:26px;font-weight:800;}
    .onboarding-graph{width:100%;display:block;}
    .onboarding-graph.strategy{height:96px;margin-top:10px;}
    .onboarding-graph.data{height:124px;margin-top:8px;}
    .onboarding-character{position:absolute;width:138px;height:auto;z-index:3;}
    .onboarding-character.on1{right:18px;bottom:170px;}
    .onboarding-character.on2{right:16px;bottom:168px;}
    .onboarding-character.on3{right:14px;bottom:112px;}
    .onboarding-shot-dots{position:absolute;bottom:132px;left:0;right:0;display:flex;justify-content:center;gap:12px;}
    .onboarding-shot-dots i{width:10px;height:10px;border-radius:999px;background:#E6EAF2;}
    .onboarding-shot-dots i.active{background:#0B6BFF;}
    .onboarding-next{position:absolute;left:24px;right:24px;bottom:36px;height:64px;border-radius:16px;background:#006BFF;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.04em;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(0,107,255,.25);border:none;}.onboarding-fixed-cta{padding-bottom:calc(16px + env(safe-area-inset-bottom));}
    .btn,button,.planner-input,select,textarea,input{transition:box-shadow .15s ease, border-color .15s ease;}
    .btn:active,button:active,.planner-input:active,select:active,textarea:active,input:active{transform:none;}
    .card:active{transform:none !important;filter:none !important;}
    input,select,textarea{font-size:16px !important;}

    .ob1-survey-card,.ob1-score-wrap,.analysis-v2-compare-card{background:#fff;border:1px solid #E2E8F0;border-radius:24px;padding:24px;box-sizing:border-box;}
    .ob1-survey-card h3,.ob1-score-wrap h3,.analysis-v2-compare-card h3{margin:0;font-size:24px;line-height:1.25;}
    .ob1-subtitle,.score-subtitle,.analysis-v2-compare-sub{margin:8px 0 0;color:#64748B;font-size:14px;line-height:1.5;}
    .ob1-field-stack{display:grid;gap:18px;margin-top:20px;}
    .ob1-field label,.ob1-score-wrap label{display:block;font-size:13px;font-weight:700;color:#334155;margin:0 0 8px;}
    .ob1-pill-row{display:flex;flex-wrap:wrap;gap:10px;}
    .ob1-pill{border:1px solid #CBD5E1;background:#F8FAFC;color:#334155;border-radius:999px;padding:10px 14px;font-size:14px;font-weight:600;}
    .ob1-pill.active{background:#DBEAFE;border-color:#2563EB;color:#1D4ED8;}
    .ob1-input,.ob1-select,.ob1-textarea,.ob1-score-input,.ob1-score-select{width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:16px;background:#fff;color:#0F172A;padding:0 14px;font-size:15px;height:52px;outline:none;}
    .ob1-textarea{height:96px;padding:14px;resize:vertical;}
    .ob1-input:focus,.ob1-select:focus,.ob1-textarea:focus,.ob1-score-input:focus,.ob1-score-select:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.12);}

    .ob1-score-wrap{margin-top:16px;}
    .ob1-score-exam{margin-top:18px;}
    .ob1-score-grid{display:grid;gap:14px;margin-top:14px;}
    .ob1-subject-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:20px;padding:16px;display:grid;gap:10px;box-sizing:border-box;}
    .ob1-subject-card h4{margin:0;font-size:18px;line-height:1.3;}
    .ob1-score-select,.ob1-score-input{height:48px;border-radius:14px;}
    .ob1-score-two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;}

    .analysis-v2-compare-card{box-shadow:0 10px 30px rgba(15,23,42,.06);overflow:visible;}
    .analysis-chart-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;}
    .analysis-chart-head h3{margin:0;font-size:20px;}
    .analysis-chart-badge{font-size:11px;font-weight:700;color:#475569;background:#F1F5F9;border-radius:999px;padding:5px 10px;}
    .analysis-v2-chart-area{position:relative;--bar-bottom:26px;--label-zone:48px;--bar-height:280px;min-height:460px;padding:36px 10px 18px;border-radius:20px;background:linear-gradient(180deg,#F8FAFC 0%,#FFFFFF 100%);margin-top:14px;overflow:visible;}
    .analysis-v2-guide-line{position:absolute;left:10px;right:10px;border-top:1px dashed #94A3B8;}
    .analysis-v2-guide-line.pass{bottom:calc(var(--bar-bottom) + var(--label-zone) + (var(--bar-height) * 0.4));}
    .analysis-v2-guide-line.safe{bottom:calc(var(--bar-bottom) + var(--label-zone) + (var(--bar-height) * 0.6));}
    .analysis-v2-guide-line .label{position:absolute;right:0;top:-18px;font-size:12px;font-weight:700;color:#64748B;text-align:right;background:rgba(255,255,255,.9);padding-left:8px;}
    .analysis-v2-bars{position:absolute;left:0;right:0;bottom:var(--bar-bottom);display:flex;justify-content:space-evenly;align-items:flex-end;gap:10px;height:370px;padding:0 8px;}
    .analysis-v2-bar-item{background:transparent;border:none;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:88px;padding:34px 4px 0;position:relative;}
    .analysis-v2-bar-item .score{font-size:22px;font-weight:800;color:#0F172A;line-height:1;position:absolute;top:0;left:50%;transform:translateX(-50%);}
    .analysis-v2-bar-wrap{height:var(--bar-height);display:flex;align-items:flex-end;position:relative;}
    .analysis-v2-bar{width:56px;min-height:8px;border-radius:18px 18px 12px 12px;position:relative;z-index:2;}
    .analysis-v2-bar-item p{margin:0;max-width:96px;min-height:48px;max-height:48px;font-size:12px;font-weight:600;line-height:1.3;color:#475569;text-align:center;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all;}
    .analysis-v2-bar-item.active p{color:#2563EB;font-weight:700;}
    .analysis-v2-bar-proj.pop{animation:barProjPop .36s ease;}
    .analysis-v2-bar-proj-line{position:absolute;left:50%;transform:translateX(-50%);border-left:2px dashed #FACC15;opacity:0;pointer-events:none;z-index:4;}
    .analysis-v2-bar-proj-line.show{opacity:1;}
    @keyframes barProjPop{0%{transform:translateX(-50%) translateY(8px);opacity:0;}100%{transform:translateX(-50%) translateY(0);opacity:1;}}
    .home-kpi-slider{overflow:visible;padding:2px 0 2px 0;touch-action:pan-y;}
    .home-kpi-track{display:flex;gap:var(--home-slide-gap,12px);transform:translateX(var(--home-slide-x));will-change:transform;transition:var(--home-slide-transition, transform .46s cubic-bezier(.22,.61,.36,1));}
    .anchor-volatile{overflow-anchor:none;}
    .home-kpi-track.motion-next{animation:none;}
    .home-kpi-track.motion-prev{animation:none;}
    @keyframes homeSlideNext{from{transform:translateX(calc(var(--home-slide-x) + 24%));opacity:.82;}to{transform:translateX(var(--home-slide-x));opacity:1;}}
    @keyframes homeSlidePrev{from{transform:translateX(calc(var(--home-slide-x) - 24%));opacity:.82;}to{transform:translateX(var(--home-slide-x));opacity:1;}}
    .home-kpi-slider .slider-card{flex:0 0 var(--home-slide-card-width,100%) !important;flex-basis:var(--home-slide-card-width,100%) !important;flex-shrink:0 !important;min-width:var(--home-slide-card-width,100%) !important;max-width:var(--home-slide-card-width,100%) !important;width:var(--home-slide-card-width,100%) !important;margin-right:0;min-height:0;box-sizing:border-box;overflow:hidden;}
    .home-kpi-slider .home-kpi-card.slider-card{flex:0 0 var(--home-slide-card-width,100%) !important;flex-basis:var(--home-slide-card-width,100%) !important;flex-shrink:0 !important;max-width:var(--home-slide-card-width,100%) !important;min-width:var(--home-slide-card-width,100%) !important;width:var(--home-slide-card-width,100%) !important;}
    .university-card-slide{width:100% !important;min-width:100% !important;max-width:100% !important;flex:0 0 100% !important;box-sizing:border-box;}
    .university-card{width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;}
    .university-card *{box-sizing:border-box;}
    .home-result-card-v3{width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;}
    .home-result-card-v3 *{box-sizing:border-box;}
    .home-result-top,.home-result-gauge-meta,.kpi-row.score-row,.home-planner-badges{min-width:0;max-width:100%;}
    .kpi-row.score-row .kpi-item{min-width:0;}
    .home-kpi-indicator i{cursor:pointer;}
    .home-add-univ-card{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;text-align:left;padding:24px;border:1px solid #BFDBFE;background:linear-gradient(135deg,#F8FBFF,#EAF2FF);color:#1D4ED8;border-radius:24px;box-shadow:0 12px 24px rgba(30,64,175,.10);min-height:0;}
    .home-add-univ-card b{font-size:28px;line-height:1.15;letter-spacing:-.02em;}
    .home-add-univ-card p{margin:8px 0 0;font-size:14px;color:#334155;font-weight:600;}
    .premium-panel{border:1px solid #D6E2F5;background:linear-gradient(160deg,#FFFFFF 0%,#F4F8FF 55%,#EEF4FF 100%);box-shadow:0 14px 28px rgba(15,23,42,.08);border-radius:24px;padding:18px;}
    .home-study-summary .timer{font-size:44px;letter-spacing:0.02em;font-weight:500;color:#0F172A;background:none;-webkit-background-clip:initial;text-shadow:none;}
    .premium-clock{font-family:'Pretendard',system-ui;display:inline-block;padding:6px 10px;border-radius:14px;background:#fff;}
    .study-timer-row{display:grid;grid-template-columns:1fr;justify-items:center;align-items:center;text-align:center;gap:12px;}
    .timer-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:0;width:100%;max-width:320px;}
    .timer-actions .mini{min-height:42px;border-radius:12px;width:100%;}
    .timer-actions .btn-secondary{background:#E5E7EB;color:#475569;border:none;}
    .home-breakdown-toggle{margin-top:10px;border:none;background:#EAF2FF;color:#1D4ED8;border-radius:14px;padding:11px 12px;font-weight:800;width:100%;text-align:center;display:block;}
    .home-breakdown-list{margin-top:10px;display:grid;gap:8px}
    .home-breakdown-list > div{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid #DBEAFE;background:#F8FBFF;border-radius:12px}
    .home-breakdown-detail-row{display:grid;gap:3px;padding:8px 10px;border:1px solid #E2E8F0;background:#fff;border-radius:10px;margin-top:6px;}
    .home-breakdown-detail-row small{font-size:12px;color:#334155;font-weight:700;}
    .home-breakdown-detail-row em{font-size:11px;color:#64748B;font-style:normal;}
    .home-breakdown-detail-row span{font-size:11px;font-weight:800;color:#1D4ED8;justify-self:end;background:#DBEAFE;padding:2px 8px;border-radius:999px;}
    .home-ranking-tier{margin:4px 0 0;font-size:13px;font-weight:800;color:#334155;}
    .rank-tier-bronze{border-color:#E7D8CC;background:linear-gradient(160deg,rgba(180,120,80,.10),rgba(255,255,255,.95));}
    .rank-tier-silver{border-color:#D5DCE5;background:linear-gradient(160deg,rgba(148,163,184,.12),rgba(255,255,255,.95));}
    .rank-tier-gold{border-color:#F4E2A1;background:linear-gradient(160deg,rgba(250,204,21,.14),rgba(255,255,255,.96));}
    .rank-tier-platinum{border-color:#D7D9FF;background:linear-gradient(160deg,rgba(129,140,248,.14),rgba(191,219,254,.16),rgba(255,255,255,.96));}
    .rank-tier-diamond{border-color:#BAE6FD;background:linear-gradient(160deg,rgba(34,211,238,.14),rgba(167,243,208,.14),rgba(255,255,255,.96));}
    .rank-shine{position:relative;overflow:hidden;}
    .rank-shine:after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 0%,rgba(255,255,255,.55) 42%,transparent 68%);transform:translateX(-130%);animation:rankShine 2.8s ease-in-out infinite;}
    @keyframes rankShine{0%{transform:translateX(-120%);}45%,100%{transform:translateX(120%);}}
    .home-goal-linked-card .analysis-title{margin-bottom:6px;}
    .goal-compact{display:flex;align-items:flex-end;gap:8px;margin-bottom:8px}
    .goal-compact b{font-size:26px;line-height:1;color:#1D4ED8}
    .goal-compact span{font-size:12px;color:#64748B;font-weight:700}
    .goal-compact em{margin-left:auto;font-style:normal;font-weight:700;color:#334155}
    .goal-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .goal-tags span{font-size:12px;padding:4px 8px;background:#EAF2FF;color:#1E3A8A;border-radius:999px}
    .home-goal-linked-card .track{height:14px;border-radius:999px;}
    .home-result-card-v3{display:grid;gap:12px;text-align:left;overflow:hidden;}
    .home-result-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
    .home-result-major{margin:0;font-size:16px;font-weight:800;color:#0F172A;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;}
    .home-result-state{display:inline-flex;margin-top:6px;padding:4px 10px;border-radius:999px;background:#DBEAFE;color:#1D4ED8;font-size:12px;font-weight:700;}
    .home-result-score{text-align:right;}
    .home-result-score strong{display:block;font-size:24px;line-height:1.1;color:#0F172A;}
    .home-result-score small{font-size:12px;color:#64748B;}
    .home-result-gauge{position:relative;height:10px;background:#E2E8F0;border-radius:999px;overflow:hidden;}
    .home-result-gauge i{display:block;height:100%;background:#2563EB;border-radius:inherit;}
    .home-result-gauge .cut{position:absolute;top:-2px;width:2px;height:14px;background:#fff;box-shadow:0 0 0 1px rgba(15,23,42,.18);}
    .home-result-gauge-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));font-size:11px;color:#64748B;gap:4px;}
    .home-result-gauge-meta span:nth-child(2),.home-result-gauge-meta span:nth-child(3){text-align:center;}
    .home-result-gauge-meta span:last-child{text-align:right;}
    .home-goal-linked-card{text-align:left;}
    .home-goal-empty-cta{margin-top:8px;display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;background:#DBEAFE;color:#1D4ED8;border-radius:10px;font-weight:700;font-size:13px;}
    .home-insight-card{border:1px solid #E2E8F0;border-radius:20px;box-shadow:0 8px 20px rgba(15,23,42,.05);padding:16px;}
    .home-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
    .home-mini-badge{font-size:11px;font-weight:700;color:#1D4ED8;background:#DBEAFE;border-radius:999px;padding:4px 8px;}
    .home-top-icons{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
    .pro-top-btn{
      width:190px;height:42px;border:none;border-radius:16px;position:relative;overflow:hidden;
      background:linear-gradient(135deg,#0F172A 0%,#1E293B 45%,#475569 100%);
      box-shadow:0 8px 20px rgba(15,23,42,.25), inset 0 1px 0 rgba(255,255,255,.22);
      color:#F8FAFC;font-weight:700;letter-spacing:0;font-size:15px;font-family:'Pretendard',system-ui;white-space:nowrap;
    }
    .pro-top-btn:before{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 0%,rgba(255,255,255,.35) 35%,transparent 60%);transform:translateX(-120%);animation:proShine 3.4s ease-in-out infinite;}
    @keyframes proShine{0%{transform:translateX(-120%);}45%,100%{transform:translateX(120%);}}
    .pro-notif-modal .pro-notif-list{display:grid;gap:10px;margin:10px 0 14px;}
    .pro-notif-modal .pro-notif-list > div{padding:10px;border:1px solid #E2E8F0;border-radius:12px;background:#F8FAFC;}
    .pro-notif-modal .pro-notif-list b{display:block;font-size:14px;color:#0F172A;margin-bottom:4px;}
    .pro-notif-modal .pro-notif-list p{margin:0;font-size:12px;color:#475569;line-height:1.45;}
    .pro-elite-page{display:grid;gap:14px;padding-bottom:8px;}
    .pro-elite-hero{
      padding:20px;border-radius:20px;border:1px solid #334155;
      background:radial-gradient(120% 120% at 0% 0%,#1E293B 0%,#0F172A 55%,#020617 100%);
      box-shadow:0 14px 30px rgba(2,6,23,.45);color:#E2E8F0;
    }
    .pro-elite-badge{display:inline-flex;padding:4px 10px;border-radius:999px;background:linear-gradient(90deg,#F59E0B,#FDE68A);color:#78350F;font-weight:900;font-size:11px;}
    .pro-elite-hero h3{margin:10px 0 8px;font-size:24px;line-height:1.28;color:#F8FAFC;}
    .pro-elite-hero p{margin:0;font-size:13px;color:#CBD5E1;}
    .pro-elite-list{display:grid;gap:10px;max-height:420px;overflow:auto;padding-right:2px;}
    .pro-elite-item{
      border:1px solid #1E293B;background:#fff;border-radius:16px;padding:14px;
      display:flex;justify-content:space-between;align-items:center;text-align:left;gap:10px;
      box-shadow:0 8px 18px rgba(15,23,42,.08);
    }
    .pro-elite-item b{display:block;font-size:14px;color:#0F172A;margin-bottom:4px;}
    .pro-elite-item p{margin:0;font-size:12px;color:#64748B;line-height:1.4;}
    .pro-elite-download{font-size:12px;font-weight:800;color:#1D4ED8;white-space:nowrap;}
    .pro-elite-request-bottom{padding:10px 4px 2px;}
    .pro-elite-filter{display:flex;justify-content:flex-end;}
    .pro-elite-month-select{border:1px solid #CBD5E1;background:#fff;border-radius:12px;padding:8px 12px;font-size:13px;font-weight:700;color:#334155;}
    .pro-request-btn{
      width:100%;height:58px;border:none;border-radius:18px;
      display:flex;align-items:center;justify-content:center;gap:8px;
      font-size:16px;font-weight:900;color:#fff;letter-spacing:.02em;
      background:linear-gradient(135deg,#0B1A47 0%,#1D4ED8 48%,#3B82F6 100%);
      box-shadow:0 16px 28px rgba(29,78,216,.26), inset 0 1px 0 rgba(255,255,255,.32);
      position:relative;overflow:hidden;
    }
    .pro-request-btn:before{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 0%,rgba(255,255,255,.3) 36%,transparent 40%);transform:translateX(-120%);animation:proRequestShine 3s ease-in-out infinite;}
    .pro-request-btn .spark{position:relative;z-index:1;font-size:17px;}
    .pro-request-btn span{position:relative;z-index:1;}
    @keyframes proRequestShine{0%{transform:translateX(-120%);}45%,100%{transform:translateX(120%);}}
    .pro-request-modal{width:calc(100% - 22px);max-width:430px;padding:0;overflow:hidden;border:1px solid #3B82F6;}
    .pro-request-head{background:linear-gradient(135deg,#1E40AF,#2563EB);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;}
    .pro-request-head h4{margin:0;font-size:18px;font-weight:800;}
    .pro-request-close{border:none;background:transparent;color:#BFDBFE;font-size:20px;font-weight:700;}
    .pro-request-body{padding:14px 16px 16px;background:#F8FAFC;}
    .pro-request-body p{margin:0 0 8px;color:#475569;line-height:1.45;}
    .pro-request-body label{display:block;margin:10px 0 8px;font-size:13px;font-weight:700;color:#64748B;}
    .pro-request-body textarea{width:100%;height:170px;border:2px solid #3B82F6;border-radius:14px;padding:12px;font-size:14px;resize:none;color:#334155;background:#fff;}
    .pro-request-count{text-align:right;font-size:13px;color:#94A3B8;margin-top:8px;}
    .pro-request-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;}
    .pro-request-actions .cancel{border:1px solid #CBD5E1;background:#fff;color:#64748B;border-radius:12px;height:48px;font-weight:700;}
    .pro-request-actions .submit{border:none;background:linear-gradient(135deg,#1D4ED8,#2563EB);color:#fff;border-radius:12px;height:48px;font-weight:800;}
    .home-chip-grid{display:flex;flex-wrap:wrap;gap:8px;}
    .study-goal-card .track{height:12px;border-radius:999px;background:#E2E8F0;overflow:hidden;}
    .study-goal-card .track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563EB,#38BDF8);}
    .score-journey-card{display:grid;gap:12px;}
    .score-journey-segment{display:inline-flex;gap:6px;background:#F1F5F9;border-radius:999px;padding:4px;width:max-content;position:relative;z-index:2;pointer-events:auto;}
    .score-journey-segment button{padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#64748B;border:none;background:transparent;pointer-events:auto;}
    .score-journey-segment button.active{background:#fff;color:#1E3A8A;box-shadow:0 1px 2px rgba(0,0,0,.06);}
    .score-journey-scroll{overflow:hidden;padding:4px 20px 4px 0;position:relative;z-index:1;touch-action:pan-y;}
    .score-journey-track{display:flex;width:200%;transform:translateX(var(--score-slide-x));will-change:transform;transition:var(--score-slide-transition, transform .56s cubic-bezier(.22,.61,.36,1));}
    .score-journey-track.motion-next{animation:scoreSlideNext .58s cubic-bezier(.22,.61,.36,1);}
    .score-journey-track.motion-prev{animation:scoreSlidePrev .58s cubic-bezier(.22,.61,.36,1);}
    @keyframes scoreSlideNext{from{transform:translateX(calc(var(--score-slide-x) + 18%));}to{transform:translateX(var(--score-slide-x));}}
    @keyframes scoreSlidePrev{from{transform:translateX(calc(var(--score-slide-x) - 18%));}to{transform:translateX(var(--score-slide-x));}}
    .score-journey-col{border:1px solid #E2E8F0;background:#F8FAFC;border-radius:18px;padding:12px;display:grid;gap:8px;min-width:0;}
    .score-journey-track .score-journey-col{width:50%;flex:0 0 50%;}
    .score-journey-col.target{border-color:#93C5FD;background:#EFF6FF;}
    .score-journey-col h4{margin:0;font-size:14px;color:#334155;}
    .score-row{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14px;color:#334155;white-space:nowrap;word-break:keep-all;min-width:0;}
    .score-row span,.score-row b,.score-row em{white-space:nowrap;word-break:keep-all;min-width:0;flex-shrink:0;font-style:normal;}
    .score-row b{min-width:56px;width:56px;text-align:center;}
    .score-row em{color:#1E293B;font-weight:600;min-width:92px;text-align:right;}
    .score-journey-col.target .score-row em{font-size:20px;font-weight:900;color:#1E40AF;letter-spacing:-0.01em;}
    .score-journey-col.target .score-row em .old{font-size:15px;font-weight:600;color:#111827;}
    .score-journey-col.target .score-row em .arrow{font-size:19px;font-weight:800;color:#1E40AF;padding:0 3px;}
    .score-journey-col.target .score-row em .new{font-size:20px;font-weight:900;color:#1E40AF;}
    .score-row .pill{border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
    .score-row .pill.up{background:#DBEAFE;color:#1D4ED8;}
    .score-row .pill.keep{background:#E2E8F0;color:#475569;}
    .score-journey-total{margin-top:2px;padding-top:10px;border-top:1px solid #CBD5E1;display:flex;justify-content:space-between;font-weight:800;white-space:nowrap;word-break:keep-all;}
    .score-journey-total b{font-weight:800;}
    .score-journey-arrow{align-self:center;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#E2E8F0;color:#334155;font-weight:900;}
    .analysis-v2-eta-card,.on-eta-card{margin-top:2px;padding:18px;border:1px solid #93C5FD;border-radius:22px;background:linear-gradient(135deg,#0B1A47 0%,#1D4ED8 52%,#60A5FA 100%);box-shadow:0 10px 24px rgba(29,78,216,.24);position:relative;overflow:hidden;}
    .analysis-v2-eta-card:before,.on-eta-card:before{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 8%,rgba(255,255,255,.35) 38%,transparent 62%);transform:translateX(-120%);animation:etaShine 3.3s ease-in-out infinite;}
    @keyframes etaShine{0%{transform:translateX(-120%);}45%,100%{transform:translateX(130%);}}
    .analysis-v2-eta-card .eyebrow,.on-eta-card .eyebrow{display:block;font-size:13px;font-weight:700;color:#DBEAFE;margin-bottom:4px;position:relative;z-index:1;}
    .analysis-v2-eta-card b,.on-eta-card b{display:block;font-size:22px;line-height:1.35;color:#fff;position:relative;z-index:1;}
    .analysis-v2-eta-card p,.on-eta-card p{margin:6px 0 0;font-size:13px;color:#DBEAFE;line-height:1.45;position:relative;z-index:1;}
    .analysis-v2-chart-area{overflow:visible;}
    .analysis-v2-bars{position:absolute;left:0;right:0;bottom:var(--bar-bottom);display:flex;justify-content:space-evenly;align-items:flex-end;gap:10px;height:370px;padding:0 8px;}
    .analysis-v2-chart-area .analysis-v2-guide-line{z-index:1;}
    .analysis-v2-bar-item{z-index:2;height:100%;justify-content:flex-end;min-height:280px;}
    .analysis-v2-bar-wrap{height:var(--bar-height);display:flex;align-items:flex-end;position:relative;}
    .analysis-v2-bar-item .score{font-size:14px;font-weight:700;}
    .analysis-v2-bar-item p{min-height:48px;max-height:48px;line-height:1.3;}
    .analysis-v2-bar-proj{position:absolute;left:50%;transform:translate(-50%, 100%);font-size:11px;font-weight:700;color:#1E3A8A;border:1px dashed #93C5FD;border-radius:999px;padding:2px 7px;background:#EFF6FF;white-space:nowrap;z-index:7;}
    .analysis-v2-bar-proj-box{position:absolute;left:50%;transform:translateX(-50%);width:62px;min-height:10px;border:3px dashed #F59E0B;border-bottom:none;border-radius:14px 14px 0 0;background:rgba(251,191,36,.18);pointer-events:none;z-index:6;}
    .analysis-v2-sim-item{min-height:112px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid #E2E8F0;border-radius:16px;padding:14px 15px;background:#fff;}
    .analysis-v2-sim-item .left{display:grid;gap:6px;}
    .analysis-v2-sim-item .left p{margin:0;display:flex;align-items:center;gap:8px;font-size:16px;}
    .analysis-v2-sim-item small{color:#64748B;line-height:1.4;}
    .analysis-v2-sim-item b{font-size:20px;margin-left:auto;white-space:nowrap;}
    .analysis-v2-sim-item.focus{background:#EFF6FF;border-color:#60A5FA;box-shadow:0 8px 24px rgba(37,99,235,.14);}
    .analysis-v2-sim-item .sim-detail{font-size:12px;color:#1D4ED8;font-weight:700;}
    .planner-item-main b,.planner-item-main p{transition:color .15s ease,text-decoration-color .15s ease;}
    .planner-item.done .planner-item-main b,.planner-item.done .planner-item-main p{color:#94A3B8;text-decoration:line-through;text-decoration-thickness:1px;text-decoration-color:#CBD5E1;}
    .planner-plan-list{padding-bottom:120px;}
    .planner-warning-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:999px;font-size:12px;color:#9A3412;font-weight:700;margin-top:8px;}
    .planner-section-title{display:flex;justify-content:space-between;align-items:center;gap:12px;}
    .planner-donut-wrap{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #E2E8F0;border-radius:14px;background:#fff;}
    .planner-donut{width:56px;height:56px;border-radius:999px;background:var(--donut);position:relative;flex-shrink:0;}
    .planner-donut:after{content:"";position:absolute;inset:11px;border-radius:999px;background:#fff;}
    .planner-donut-legend{display:grid;gap:4px;}
    .planner-donut-legend span{display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;font-weight:700;white-space:nowrap;}
    .planner-donut-legend i{width:8px;height:8px;border-radius:999px;display:inline-block;}
    .planner-add-cta{margin-top:10px;border:1px dashed #93C5FD;background:#EFF6FF;color:#1D4ED8;border-radius:16px;padding:14px;text-align:center;font-weight:800;}
    .planner-add-page{padding:0 0 120px;}
    .planner-add-form{margin-top:12px;display:grid;gap:12px;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:16px;}
    .planner-add-form h4{margin:0;font-size:18px;color:#0F172A;}
    .planner-add-form .sub{margin:0;color:#64748B;}
    .planner-days-carousel{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;padding:4px 16px 4px;}
    .planner-date-item{flex:0 0 auto;scroll-snap-align:center;display:grid;gap:2px;min-width:52px;padding:6px 8px;border-radius:12px;}
    .planner-date-item.active{background:transparent !important;border:none !important;box-shadow:none !important;}
    .planner-date-item small{font-size:11px;color:#64748B;}
    .planner-date-item strong{font-size:16px;line-height:1;}
    .planner-date-item.active small,.planner-date-item.active strong{color:#2563EB;font-weight:800;}
    .planner-input.is-hidden{display:none;}
    .score-info-detail-table{display:grid;gap:8px;margin:14px 0;}
    .score-info-detail-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;font-size:12px;color:#475569;padding:10px;border:1px solid #E2E8F0;border-radius:12px;background:#F8FAFC;}
    .coach-hidden-file{display:none;}
    @media (max-width:390px){.score-journey-col{padding:10px;}.score-row{font-size:13px;}.score-row .pill{font-size:11px;padding:2px 6px;}.score-journey-total{font-size:13px;}}
  </style>`;

  const scoreJourneyCard = (title = '최소 노력 대비 합격 도달 성적') => {
    const curr = {
      korean: Number(scores.korean || 0),
      math: Number(scores.math || 0),
      english: Number(scores.english || 0),
      inquiry1: Number(scores.inquiry1 || 0),
      inquiry2: Number(scores.inquiry2 || 0)
    };
    const currAvg = Math.round(analysisSelected?.score || ((curr.korean + curr.math + curr.english + curr.inquiry1 + curr.inquiry2) / 5));
    const target = {
      korean: Math.min(100, curr.korean + Math.max(1, Math.round((100 - curr.korean) * 0.12))),
      math: Math.min(100, curr.math + Math.max(2, Math.round((100 - curr.math) * 0.22))),
      english: Math.min(100, curr.english + Math.max(1, Math.round((100 - curr.english) * 0.08))),
      inquiry1: Math.min(100, curr.inquiry1 + Math.max(1, Math.round((100 - curr.inquiry1) * 0.14))),
      inquiry2: Math.min(100, curr.inquiry2 + Math.max(1, Math.round((100 - curr.inquiry2) * 0.1)))
    };
    const targetAvg = Math.round(analysisTargetScore || ((target.korean + target.math + target.english + target.inquiry1 + target.inquiry2) / 5));
    const toEngGrade = (v) => Math.min(9, Math.max(1, Math.round((100 - Number(v || 0)) / 12.5) + 1));
    const row = (label, c, t) => {
      const diff = t - c;
      const badge = diff > 0 ? `<span class="pill up">+${diff}</span>` : `<span class="pill keep">유지</span>`;
      const fromVal = label === '영어' ? `${toEngGrade(c)}등급` : `${c}`;
      const toVal = label === '영어' ? `${toEngGrade(t)}등급` : `${t}`;
      const detail = diff > 0 ? `<span class="old">${fromVal}</span><span class="arrow">→</span><span class="new">${toVal}</span>` : `${fromVal}`;
      return `<div class="score-row"><span>${label}</span><b>${badge}</b><em>${detail}</em></div>`;
    };
    return `
    <div class="score-journey-card">
      <p class="analysis-title">${title}</p>
      <div class="score-journey-segment">
        <button type="button" class="${activeScoreView==='current'?'active':''}" data-action="setScoreView" data-score-view="current">현재 성적</button>
        <button type="button" class="${activeScoreView==='target'?'active':''}" data-action="setScoreView" data-score-view="target">도달 성적</button>
      </div>
      <div class="score-journey-scroll">
        <div class="score-journey-track anchor-volatile ${scoreSlideMotion}" style="--score-slide-x:calc(${activeScoreView==='target' ? '-50%' : '0%'} + ${scoreDragOffset}px);--score-slide-transition:${scoreDragOffset!==0?'0s':'transform .56s cubic-bezier(.22,.61,.36,1)'};">
        <div class="score-journey-col current" data-score-view="current">
          <h4>현재 성적</h4>
          <div class="score-row"><span>국어</span><b>${curr.korean}</b></div>
          <div class="score-row"><span>수학</span><b>${curr.math}</b></div>
          <div class="score-row"><span>영어</span><b>${toEngGrade(curr.english)}등급</b></div>
          <div class="score-row"><span>탐구1</span><b>${curr.inquiry1}</b></div>
          <div class="score-row"><span>탐구2</span><b>${curr.inquiry2}</b></div>
          <div class="score-journey-total"><span>총점</span><b>${currAvg}점</b></div>
        </div>
        <div class="score-journey-col target" data-score-view="target">
          <div class="score-target-panel">
          <h4>도달 성적</h4>
          ${row('국어', curr.korean, target.korean)}
          ${row('수학', curr.math, target.math)}
          ${row('영어', curr.english, target.english)}
          ${row('탐구1', curr.inquiry1, target.inquiry1)}
          ${row('탐구2', curr.inquiry2, target.inquiry2)}
          <div class="score-journey-total"><span>예상 총점</span><b>${targetAvg}점</b></div>
          </div>
        </div>
        </div>
      </div>
    </div>
  `;
  };
  const screens = {
    ob1: layout(
      `<div class="onboarding-container"><div class="content">
       ${(() => { console.log('RENDER_OB1_DESIGN_V2'); return ''; })()}
       ${onboardingProgress(1)}
       ${appbar('학습성향 진단 1-1', true)}
       <p class="sub ob-subcopy">지금 성적과 공부 습관을 바탕으로<br/>나에게 맞는 합격 전략을 찾아볼게요.</p>
       <div class="card ob-bubble-card"><img src="${CRACKY_SRC}" class="ob-cracky" alt="크랙이"/><p>성적만 보는 게 아니라, 공부 방식까지 같이 봐야 정확해요!</p></div>
       <div class="ob1-survey-card">
         <h3>정성조사서</h3>
         <p class="ob1-subtitle">학습 상황과 고민을 알려주시면 더 정확한 전략을 만들 수 있어요.</p><p class="ob1-subtitle" style="color:#ef4444;font-weight:700;">* 표시는 필수 입력 항목입니다.</p>
         <div class="ob1-field-stack">
           <div class="ob1-field">
            <label>현재 학년 <span style="color:#ef4444">*</span></label>
             <div class="ob1-pill-row">
               ${['고1/2 재학','고3 재학','N수생','검정고시','기타'].map((grade) => `<button class="ob1-pill ${obGradeStatus===grade?'active':''}" data-action="setObGradeStatus" data-ob-grade="${grade}">${grade}</button>`).join('')}
             </div>
           </div>
           <div class="ob1-field">
            <label>출신 학교 <span style="color:#ef4444">*</span></label>
             <input class="ob1-input" data-field="obSchoolName" value="${obSchoolName}" placeholder="출신 학교 입력" />
           </div>
           <div class="ob1-field">
            <label>희망 계열 <span style="color:#ef4444">*</span></label>
             <select class="ob1-select" data-field="obTrack">
               <option ${obTrack==='예체능'?'selected':''}>예체능</option>
               <option ${obTrack==='인문'?'selected':''}>인문</option>
               <option ${obTrack==='자연'?'selected':''}>자연</option>
             </select>
           </div>
           <div class="ob1-field">
             <label>스터디크랙을 통해 얻고 싶은 점 <span style="color:#ef4444">*</span></label>
             <textarea class="ob1-textarea" data-field="obGoalText" placeholder="자유롭게 입력">${obGoalText}</textarea>
           </div>
           <div class="ob1-field">
             <label>입시 고민 및 질문</label>
             <textarea class="ob1-textarea" data-field="obQuestionText" placeholder="자유롭게 입력">${obQuestionText}</textarea>
           </div>
         </div>
       </div>
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="goto" data-target="ob2">1-2 성적 입력으로</button></div></div>`,
      false
    ),
    ob2: layout(
      `<div class="onboarding-container"><div class="content">
       ${onboardingProgress(2)}
       ${appbar('학습성향 진단 1-2', true)}
       <p class="sub ob-subcopy">과목별 성적을 입력하면 현재 위치를<br/>더 정확하게 계산할 수 있어요.</p>
       <div class="card ob-bubble-card"><img src="${CRACKY_SRC}" class="ob-cracky" alt="크랙이"/><p>점수는 세밀할수록 좋아요! 입력한 정보로 맞춤 분석을 진행할게요.</p></div>
       <div class="ob1-score-wrap">
         <h3>성적 입력 <span style="color:#ef4444">*</span></h3>
         <p class="score-subtitle">과목별 입력을 완료하면 현재 위치를 더 정확하게 계산해요.</p>
         <div class="ob1-score-exam">
           <label>시험 선택</label>
           <select class="ob1-score-select" data-field="obExamType">
             ${EXAM_OPTIONS.map((label) => `<option value="${label}" ${obExamType===label?'selected':''}>${label}</option>`).join('')}
           </select>
         </div>
         <div class="ob1-score-grid">
           <div class="ob1-subject-card">
             <h4>국어</h4>
             <select class="ob1-score-select" data-field="obKoreanType"><option value="">선택</option><option value="화법과작문">화법과작문</option><option value="언어와매체">언어와매체</option></select>
             <div class="ob1-score-two-col"><input class="ob1-score-input" data-score-key="korean_common" placeholder="공통 원점수" type="number"/><input class="ob1-score-input" data-score-key="korean_elective" placeholder="선택 원점수" type="number"/></div>
           </div>
           <div class="ob1-subject-card">
             <h4>수학</h4>
             <select class="ob1-score-select" data-field="obMathType"><option value="">선택</option><option value="확률과통계">확률과통계</option><option value="미적분">미적분</option><option value="기하">기하</option></select>
             <div class="ob1-score-two-col"><input class="ob1-score-input" data-score-key="math_common" placeholder="공통 원점수" type="number"/><input class="ob1-score-input" data-score-key="math_elective" placeholder="선택 원점수" type="number"/></div>
           </div>
          <div class="ob1-subject-card"><h4>영어</h4><select class="ob1-score-select" data-score-key="english_grade"><option value="">등급 선택</option>${[1,2,3,4,5,6,7,8,9].map((n)=>`<option value="${n}">${n}등급</option>`).join('')}</select></div>
           <div class="ob1-subject-card"><h4>한국사</h4><select class="ob1-score-select" data-field="obHistoryType"><option value="">등급 선택</option>${[1,2,3,4,5,6,7,8,9].map((n)=>`<option value="${n}">${n}등급</option>`).join('')}</select></div>
           <div class="ob1-subject-card">
             <h4>탐구1</h4>
             <select class="ob1-score-select" data-field="obInquiry1Subject"><option value="">과목 선택</option><optgroup label="사회탐구"><option value="생활과 윤리">생활과 윤리</option><option value="윤리와 사상">윤리와 사상</option><option value="한국지리">한국지리</option><option value="세계지리">세계지리</option><option value="동아시아사">동아시아사</option><option value="세계사">세계사</option><option value="경제">경제</option><option value="정치와 법">정치와 법</option><option value="사회·문화">사회·문화</option></optgroup><optgroup label="과학탐구"><option value="물리학Ⅰ">물리학Ⅰ</option><option value="화학Ⅰ">화학Ⅰ</option><option value="생명과학Ⅰ">생명과학Ⅰ</option><option value="지구과학Ⅰ">지구과학Ⅰ</option><option value="물리학Ⅱ">물리학Ⅱ</option><option value="화학Ⅱ">화학Ⅱ</option><option value="생명과학Ⅱ">생명과학Ⅱ</option><option value="지구과학Ⅱ">지구과학Ⅱ</option></optgroup></select>
            <input class="ob1-score-input" data-score-key="inquiry1_raw" placeholder="원점수" type="number"/>
           </div>
           <div class="ob1-subject-card">
             <h4>탐구2</h4>
             <select class="ob1-score-select" data-field="obInquiry2Subject"><option value="">과목 선택</option><optgroup label="사회탐구"><option value="생활과 윤리">생활과 윤리</option><option value="윤리와 사상">윤리와 사상</option><option value="한국지리">한국지리</option><option value="세계지리">세계지리</option><option value="동아시아사">동아시아사</option><option value="세계사">세계사</option><option value="경제">경제</option><option value="정치와 법">정치와 법</option><option value="사회·문화">사회·문화</option></optgroup><optgroup label="과학탐구"><option value="물리학Ⅰ">물리학Ⅰ</option><option value="화학Ⅰ">화학Ⅰ</option><option value="생명과학Ⅰ">생명과학Ⅰ</option><option value="지구과학Ⅰ">지구과학Ⅰ</option><option value="물리학Ⅱ">물리학Ⅱ</option><option value="화학Ⅱ">화학Ⅱ</option><option value="생명과학Ⅱ">생명과학Ⅱ</option><option value="지구과학Ⅱ">지구과학Ⅱ</option></optgroup></select>
            <input class="ob1-score-input" data-score-key="inquiry2_raw" placeholder="원점수" type="number"/>
           </div>
         </div>
       </div>
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="goto" data-target="ob3">1-3 학습 MBTI로</button><button type="button" class="auth-link-btn" data-action="skipOb2WithoutScore">시험 성적이 없어요</button></div></div>`,
      false
    ),
    ob3: layout(
      `<div class="onboarding-container"><div class="content">
       ${onboardingProgress(3)}
       ${appbar('학습성향 진단 1-3', true)}
       <p class="sub ob-subcopy">마지막 단계예요.<br/>학습 MBTI로 내 공부 성향을 진단해보세요.</p>
       <div class="card ob-bubble-card"><img src="${CRACKY_SRC}" class="ob-cracky" alt="크랙이"/><p>짧은 질문 4개로 학습 성향을 빠르게 확인할 수 있어요!</p></div>
       <div class="card ob-card">
         <p class="analysis-title">학습 MBTI 검사</p>
         <p class="sub">4문항으로 빠르게 진단해요.</p>
         <button class="btn btn-secondary" data-action="openMbtiModal">MBTI 시작하기</button>
         ${mbtiResult ? `<div class="card" style="margin-top:12px;border:2px solid #2563EB;background:#EFF6FF;"><p class="analysis-title">진단 결과 & MBTI 학습보고서</p><p style="margin:6px 0 2px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1D4ED8;text-shadow:0 6px 18px rgba(37,99,235,.18);">CSDR</p><p class="sub" style="margin:0 0 12px;font-size:12px;color:#1E40AF;">(컨셉형, 직관령, 분석형, 루틴)</p><button class="btn btn-primary" data-action="downloadMbtiReport">MBTI 학습 보고서 다운</button></div>` : ''}
       </div>
       ${mbtiModalOpen ? `<div class="home-modal-overlay" data-action="closeMbtiModal"><div class="home-modal ob-mbti-modal" data-action="noopModal">
         <p class="home-modal-title">학습 MBTI 검사</p>
         <div class="ob-mbti-q"><p>1) 계획을 세우고 공부하는 편인가요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q1" data-mbti-v="plan" class="${mbtiAnswers.q1==='plan'?'active':''}">네</button><button data-action="setMbti" data-mbti-q="q1" data-mbti-v="flex" class="${mbtiAnswers.q1==='flex'?'active':''}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>2) 혼자 공부할 때 집중이 잘 되나요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q2" data-mbti-v="solo" class="${mbtiAnswers.q2==='solo'?'active':''}">네</button><button data-action="setMbti" data-mbti-q="q2" data-mbti-v="group" class="${mbtiAnswers.q2==='group'?'active':''}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>3) 부족한 과목부터 먼저 하는 편인가요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q3" data-mbti-v="weak_first" class="${mbtiAnswers.q3==='weak_first'?'active':''}">네</button><button data-action="setMbti" data-mbti-q="q3" data-mbti-v="strong_first" class="${mbtiAnswers.q3==='strong_first'?'active':''}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>4) 피드백이 있으면 공부가 더 잘 되나요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q4" data-mbti-v="feedback" class="${mbtiAnswers.q4==='feedback'?'active':''}">네</button><button data-action="setMbti" data-mbti-q="q4" data-mbti-v="self" class="${mbtiAnswers.q4==='self'?'active':''}">아니오</button></div></div>
         <button class="btn btn-primary ${mbtiDone?'':'disabled'}" data-action="completeMbti" ${mbtiDone?'':'disabled'}>검사 완료</button>
       </div></div>` : ''}
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="goto" data-target="ob4">분석 결과 보기</button></div></div>`,
      false
    ),
    ob4: layout(
      `<div class="onboarding-container"><div class="content">
       ${onboardingProgress(2)}
       ${appbar('목표 설정 및 분석', true)}
       <p class="sub ob-subcopy">현재 성적 기준으로 도전 가능한 대학과<br/>합격 가능성을 분석해드릴게요.</p>
       <div class="card ob-bubble-card"><img src="${CRACKY_SRC}" class="ob-cracky" alt="크랙이"/><p>목표 대학마다 유리한 과목이 달라요. 그래서 대학별로 따로 봐야 해요!</p></div>
       <div class="card ob-card">
         <p class="analysis-title">현재 성적 기준 추천 대학</p>
         <div class="ob-uni-list">${['연세대학교 경영학과','고려대학교 경영학과','성균관대학교 글로벌경영학과'].map((u) => `<button class="ob-uni-item ${targetMajor===u?'active':''}" data-action="selectTarget" data-target-major="${u}">${u}</button>`).join('')}</div>
       </div>
       <div class="card ob-card analysis-top">
         <p class="analysis-title">합격 가능성 분석</p>
         <div class="analysis-v2-summary-top">
           <div><p class="analysis-v2-univ">${targetMajor}</p><p class="analysis-v2-label">AI 점수 · 합격컷 대비 위치</p></div>
           <div class="analysis-v2-score-wrap"><span class="analysis-v2-verdict ${scoreTierClass(analysisSelected.score)}" style="color:${analysisStatusColor};border-color:${analysisStatusColor}">${analysisStatus}</span><strong>${analysisSelected.score}점</strong><small>AI 점수</small></div>
         </div>
         <div class="analysis-v2-gauge"><i class="${scoreTierClass(analysisSelected.score)}" style="width:${analysisGaugeFill}%;background:${analysisGaugeColor}"></i><span class="cut pass" style="left:40%"></span><span class="cut safe" style="left:60%"></span></div>
         <div class="analysis-v2-gauge-meta"><span>0</span><span>합격컷 100점</span><span>안정컷 150점</span><span>MAX 250점</span></div>
         <div class="kpi-row score-row"><div class="kpi-item"><b>${liveCurrentScore}점</b>현재성적</div><div class="kpi-item"><b>100점</b>합격 컷</div><div class="kpi-item danger"><b>${analysisSelected.score-100>0?`+${analysisSelected.score-100}`:analysisSelected.score-100}점</b>격차</div></div>
       </div>
       <div class="card ob-card plus-one-card">
         <p class="analysis-title">+1점 상승 시뮬레이션</p>
         <div class="analysis-impact-item">수학<div class="track"><i style="width:90%"></i></div><span>+12점 → +18%</span></div>
         <div class="analysis-impact-item">탐구<div class="track"><i style="width:68%;background:#14b8a6"></i></div><span>+6점 → +9%</span></div>
         <div class="analysis-impact-item">영어<div class="track"><i style="width:48%;background:#f59e0b"></i></div><span>+3점 → +5%</span></div>
       </div>
       ${mbtiResult ? `<div class="card ob-card" style="border:2px solid #2563EB;background:#EFF6FF;"><p class="analysis-title">진단 결과 & MBTI 학습보고서</p><p style="margin:6px 0 2px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1D4ED8;text-shadow:0 6px 18px rgba(37,99,235,.18);">CSDR</p><p class="sub" style="margin:0 0 12px;font-size:12px;color:#1E40AF;">(컨셉형, 직관령, 분석형, 루틴)</p><button class="btn btn-primary" data-action="downloadMbtiReport">MBTI 학습 보고서 다운</button></div>` : ''}
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button type="button" class="cta-button" data-action="goto" data-target="ob5">내 맞춤 솔루션 보기</button></div></div>`,
      false
    ),
    ob5: layout(
      `<div class="onboarding-container ob5-screen"><div class="content">
       ${onboardingProgress(3)}
       ${appbar('공부 성향 맞춤 솔루션', true)}
       <p class="sub ob-subcopy">현재 성적에서 합격컷까지,<br/>가장 효율적인 점수 상승 루트를 보여드릴게요.</p>
       <div class="card ob-bubble-card"><img src="${CRACKY_SRC}" class="ob-cracky" alt="크랙이"/><p>무작정 전 과목을 올리는 게 아니라, 합격에 가장 크게 기여하는 과목부터 잡아야 해요!</p></div>
       <div class="card ob-card">${scoreJourneyCard('최소 노력 대비 합격 도달 성적')}</div>
       <div class="eta-card"><div class="card ob-card ob-period-card on-eta-card"><span class="eyebrow">현재 학습분석 기반</span><b>Standard 이용 시 평균 3개월 내 도달 예상</b><p>주간 플래너 피드백과 학습 방향 코칭 제공</p></div>${ob3IsAnalyzing ? `<div class="loading-overlay"><div class="loading-box"><div class="dots">● ● ●</div><div>분석중입니다</div><div>잠시만 기다려주세요</div></div></div>` : ''}</div>
       <div class="ob5-after-eta">
       <div class="card ob-card">
         <p class="analysis-title">합격 가능성 변화</p>
         <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${gaugeTarget}점</b></div></div>
         <div class="ob-gauge">
           <div class="ob-gauge-current ${scoreTierClass(gaugeCurrent)}" style="width:${gaugeCurrentPct}%"></div>
           <div class="ob-gauge-target ${scoreTierClass(gaugeTarget)}" style="width:${gaugeTargetPct}%"></div>
           <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
           <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
         </div>
         <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
         <p class="sub"><b>현재 → 합격권 진입 구간</b></p>
       </div>
       <div class="card ob-card">
         <p class="analysis-title">성적 변화 시 가능한 대학</p>
         <div class="possible-univ-slider" data-slider-group="possible"><div class="possible-univ-track">
         ${[['국민대 경영학부', gaugeCurrent + 6], ['숭실대 경제학과', gaugeCurrent + 10], ['세종대 미디어커뮤니케이션학과', gaugeCurrent + 14]].map(([name, target], idx) => `<div class="possible-univ-card"><button type="button" class="card ob-card" style="margin:10px 0 0; width:100%; text-align:left;" data-action="addPossibleUniversity" data-target-major="${name}">
           <p class="analysis-title">${name}</p>
           <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${target}점</b></div></div>
           <div class="ob-gauge">
             <div class="ob-gauge-current ${scoreTierClass(gaugeCurrent)}" style="width:${Math.min(100, (gaugeCurrent / 250) * 100)}%"></div>
             <div class="ob-gauge-target ${scoreTierClass(target)}" style="width:${Math.min(100, (target / 250) * 100)}%"></div>
             <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
             <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
           </div>
           <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
           <p class="sub"><b>현재 → 합격권 진입 구간</b></p>
         </button></div>`).join('')}</div></div><div class="possible-univ-nav"><button type="button" data-action="slidePrev">‹</button><div class="possible-univ-dots slider-indicator possible-univ-indicator possible-slider-indicator"><button data-action="slideTo" data-slide-index="0" class="active slider-dot possible-univ-dot possible-slider-dot"></button><button data-action="slideTo" data-slide-index="1" class="slider-dot possible-univ-dot possible-slider-dot"></button><button data-action="slideTo" data-slide-index="2" class="slider-dot possible-univ-dot possible-slider-dot"></button></div><button type="button" data-action="slideNext">›</button></div>
       </div></div>
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button type="button" class="cta-button" data-action="startStandard">Standard로 시작하기</button><button type="button" class="auth-link-btn" data-action="completeOnboarding">홈으로 이동</button></div></div>`,
      false
    ),
    authLogin: layout(`<div class="auth-screen">
      <div class="card auth-unified-card">
        <div class="auth-logo-wrap compact signup-logo">
          <img src="${STUDYCRACK_LOGO_SRC}" class="auth-logo" alt="StudyCrack Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <span class="auth-logo-fallback">StudyCrack</span>
        </div>
        <h1>StudyCrack</h1>
        <p class="auth-title">합격 전략을 시작해볼까요?</p>
        <p class="sub">내 성적에 맞는 대학별 합격 가능성과 전략을 확인하세요.</p>
        <label class="auth-label">이메일</label>
        <input class="planner-input" data-field="loginEmail" value="${loginEmail}" placeholder="you@example.com" />
        <label class="auth-label">비밀번호</label>
        <input class="planner-input" data-field="loginPassword" value="${loginPassword}" type="password" placeholder="비밀번호 입력" />
        <button class="btn btn-primary auth-submit" data-action="loginSuccess">로그인</button>
        <div class="auth-divider"><span>또는</span></div>
        <div class="auth-sso-row">
          <button class="auth-sso-btn kakao" data-action="ssoSuccess">카카오 계정으로 로그인</button>
          <button class="auth-sso-btn apple" data-action="ssoSuccess">Apple로 로그인</button>
        </div>
        <div class="auth-helper-row">
          <button class="auth-link-btn" data-action="goto" data-target="authFindId">아이디 찾기</button>
          <span>|</span>
          <button class="auth-link-btn" data-action="goto" data-target="authFindPw">비밀번호 찾기</button>
        </div>
        <button class="auth-link-btn" data-action="goto" data-target="authSignup">아직 계정이 없나요? 회원가입</button>
      </div>
    </div>`, false),
    authFindId: layout(appbar('아이디 찾기', true) + `<div class="auth-screen">
      <div class="card auth-form-card">
        <p class="sub">가입한 이름과 연락처를 입력하면 아이디(이메일)를 안내해드려요.</p>
        <label class="auth-label">이름</label>
        <input class="planner-input" placeholder="이름 입력" />
        <label class="auth-label">휴대폰 번호</label>
        <input class="planner-input" placeholder="01012345678" />
        <button class="btn btn-primary auth-submit" data-action="goto" data-target="authLogin">아이디 확인하기</button>
      </div>
    </div>`, false),
    authFindPw: layout(appbar('비밀번호 찾기', true) + `<div class="auth-screen">
      <div class="card auth-form-card">
        <p class="sub">가입한 아이디(이메일)로 비밀번호 재설정 링크를 보내드려요.</p>
        <label class="auth-label">아이디(이메일)</label>
        <input class="planner-input" placeholder="you@example.com" />
        <button class="btn btn-primary auth-submit" data-action="goto" data-target="authLogin">재설정 링크 받기</button>
      </div>
    </div>`, false),
    authSignup: layout(appbar('회원가입', true) + `<div class="signup-page"><div class="signup-form-card">
      <div class="auth-logo-wrap compact signup-logo"><img src="${STUDYCRACK_LOGO_SRC}" class="auth-logo" alt="StudyCrack Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="auth-logo-fallback">StudyCrack</span></div>
      <p class="signup-title">회원가입</p>
      <div class="signup-section"><p class="section-title">1 / 3 계정 정보</p><div class="section-divider"></div><label class="auth-label">이메일(아이디)</label><div class="input-row signup-input-row"><input class="input" data-field="signupEmail" defaultValue="${signupEmail}" placeholder="example@email.com" /><button type="button" class="input-btn" data-action="verifySignupEmail">${signupEmailSending ? '전송 중...' : (signupEmailCodeSent ? '재전송' : '인증번호 받기')}</button></div>${signupEmailCodeSent ? `<div class="verify-box"><p>이메일로 인증번호를 보냈습니다.</p><div class="verify-row"><input class="input" data-field="signupEmailCode" defaultValue="${signupEmailCode}" placeholder="인증코드 6자리" /><b>${formatSignupTimer(signupEmailTimerSeconds)}</b><button type="button" class="input-btn verify-confirm-btn" data-action="confirmSignupEmailCode">확인</button></div>${signupEmailTimerSeconds===0?'<small>인증 시간이 만료되었습니다. 재전송해주세요.</small>':''}<small>이메일이 오지 않는다면 스팸 메일함을 먼저 확인해주세요.</small><small>그래도 도착하지 않는다면 contact@studycrack.co.kr로 문의 부탁드립니다.</small></div>` : ''}<label class="auth-label">비밀번호</label><input class="input" data-field="signupPassword" defaultValue="${signupPassword}" type="password" placeholder="영문 대/소문자, 숫자, 특수문자 포함 8자 이상" /><small class="signup-pw-guide">영문 대문자, 영문 소문자, 숫자, 특수문자를 모두 포함해 8자 이상 입력해주세요.</small><label class="auth-label">비밀번호 확인</label><input class="input" data-field="signupPasswordConfirm" defaultValue="${signupPasswordConfirm}" type="password" placeholder="비밀번호 재입력" /><p class="pw-match" data-signup-pw-match style="display:none"></p></div>
      <div class="signup-section"><p class="section-title">2 / 3 개인 정보</p><div class="section-divider"></div><label class="auth-label">이름(실명)</label><input class="input" data-field="signupName" defaultValue="${signupName}" placeholder="이름 입력" /><div class="grid-2 signup-personal-grid"><div><label class="auth-label">성별</label><div class="radio-group gender-row"><label class="radio-item"><input type="radio" name="signupGender" data-action="setSignupGender" data-gender="female" ${signupGender==='female'?'checked':''}/>여성</label><label class="radio-item"><input type="radio" name="signupGender" data-action="setSignupGender" data-gender="male" ${signupGender==='male'?'checked':''}/>남성</label></div></div><div class="signup-date-field"><label class="auth-label">생년월일</label><input class="input" type="date" data-field="signupBirth" defaultValue="${signupBirth}" placeholder="생년월일 선택" /></div></div><label class="auth-label">전화번호</label><div class="input-row signup-input-row"><input class="input" data-field="signupPhone" defaultValue="${signupPhone}" placeholder="- 없이 입력해주세요" /><button type="button" class="input-btn" data-action="verifySignupPhone">${signupPhoneSending ? '전송 중...' : (signupPhoneCodeSent ? '재전송' : '인증번호 전송')}</button></div>${signupPhoneCodeSent ? `<div class="verify-box"><p>문자로 인증번호를 보냈습니다.</p><div class="verify-row"><input class="input" data-field="signupPhoneCode" defaultValue="${signupPhoneCode}" placeholder="인증코드 6자리" /><b>${formatSignupTimer(signupPhoneTimerSeconds)}</b><button type="button" class="input-btn verify-confirm-btn" data-action="confirmSignupPhoneCode">확인</button></div>${signupPhoneTimerSeconds===0?'<small>인증 시간이 만료되었습니다. 재전송해주세요.</small>':''}</div>` : ''}</div>
      <div class="signup-section"><p class="section-title">3 / 3 세부 정보</p><div class="section-divider"></div><label class="auth-label">희망 계열</label><div class="radio-group signup-radio-grid"><label class="radio-item signup-radio-item"><input type="radio" name="track"/>의치한약계열</label><label class="radio-item signup-radio-item"><input type="radio" name="track"/>자연/공학계열</label><label class="radio-item signup-radio-item"><input type="radio" name="track"/>상경계열</label><label class="radio-item signup-radio-item"><input type="radio" name="track"/>어문/사회계열</label><label class="radio-item signup-radio-item"><input type="radio" name="track"/>예체능</label><label class="radio-item signup-radio-item"><input type="radio" name="track"/>기타</label></div><label class="auth-label">유입 경로</label><div class="radio-group signup-radio-grid"><label class="radio-item signup-radio-item"><input type="radio" name="source"/>인스타그램</label><label class="radio-item signup-radio-item"><input type="radio" name="source"/>스레드</label><label class="radio-item signup-radio-item"><input type="radio" name="source"/>오르비</label><label class="radio-item signup-radio-item"><input type="radio" name="source"/>기타</label></div><label class="auth-label">프로모션 코드(선택)</label><input class="input" placeholder="프로모션 코드 입력" /></div>
      <div class="terms-card"><div class="terms-header"><input type="checkbox" data-action="toggleSignupTermsAll" ${signupTermsAll?'checked':''}/><span>약관 전체 동의</span></div><div class="terms-item"><label><input type="checkbox" data-action="toggleSignupTermsRequired" ${signupTermsRequired?'checked':''}/> (필수) 표준이용약관 동의</label><button class="terms-link" data-action="openTermsModal" data-terms-type="standard">전문보기</button></div><div class="terms-item"><label><input type="checkbox" data-action="toggleSignupTermsRequired" ${signupTermsRequired?'checked':''}/> (필수) 서비스 이용약관 조항 동의</label><button class="terms-link" data-action="openTermsModal" data-terms-type="service">전문보기</button></div><div class="terms-item"><label><input type="checkbox" data-action="toggleSignupTermsRequired" ${signupTermsRequired?'checked':''}/> (필수) 개인정보 처리방침 동의</label><button class="terms-link" data-action="openTermsModal" data-terms-type="privacy">전문보기</button></div><div class="terms-item"><label><input type="checkbox" data-action="toggleSignupTermsRequired" ${signupTermsRequired?'checked':''}/> (필수) 환불 규정 동의</label><button class="terms-link" data-action="openTermsModal" data-terms-type="refund">전문보기</button></div><div class="terms-item"><label><input type="checkbox"/> (선택) 마케팅 정보 수신 동의</label><button class="terms-link" data-action="openTermsModal" data-terms-type="marketing">전문보기</button></div></div>${openTermsType ? `<div class="terms-modal-backdrop" data-action="closeTermsModal"><div class="terms-modal" data-action="noopModal"><button class="terms-modal-close" data-action="closeTermsModal">×</button><p class="terms-modal-title">${termsContentMap[openTermsType]?.title || ''}</p><div class="terms-modal-body">${termsContentMap[openTermsType]?.body || ''}</div></div></div>` : ''}
      <button class="signup-submit signup-submit-btn ${signupSubmitEnabled ? 'active' : 'disabled'}" data-action="signupSuccess" ${signupSubmitEnabled ? '' : 'disabled'}>${signupSubmitEnabled ? '회원가입 완료' : '이메일/전화번호 인증을 완료해주세요'}</button>
      <p class="signup-login-link">이미 계정이 있으신가요? <button class="auth-link-btn" data-action="goto" data-target="authLogin">로그인</button></p>
    </div>
    </div>`, false),
    splash: `<div class="app-shell"><div class="app-frame"><div class="splash"><div class="logo-bolt">${i('bolt',true)}</div><img class="brand-logo" src="${(window.__studycrackAssetSrc && window.__studycrackAssetSrc.onboardingLogoSrc) || './assets/images/studycrack_logo_wo_bg.png'}" alt="logo"/><h1 style="margin:0;font-size:30px">스터디크랙</h1><p>합격까지 가장 빠른 전략</p></div></div></div>`,
    on1: `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="onboarding-shot"><div class="onboarding-shot-head"><h2><span class="accent">데이터 기반으로</span>
내 합격 가능성을 분석해요</h2><p>흔들리지 않는 방향을
제시해드립니다.</p></div><div class="onboarding-center"><div class="onboarding-card data"><div class="onboarding-label">합격 가능성</div><div class="onboarding-score">72<em>%</em></div><svg class="onboarding-graph data" viewBox="0 0 320 124"><defs><linearGradient id="obDataFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#BFD8FF" stop-opacity="0.65"/><stop offset="100%" stop-color="#BFD8FF" stop-opacity="0"/></linearGradient></defs><path d="M16 106 L42 84 L66 92 L94 60 L122 76 L146 92 L172 74 L196 36 L224 76 L248 62 L272 24 L292 56 L310 10 L310 124 L16 124 Z" fill="url(#obDataFill)"/><path d="M16 106 L42 84 L66 92 L94 60 L122 76 L146 92 L172 74 L196 36 L224 76 L248 62 L272 24 L292 56 L310 10" stroke="#0B6BFF" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="310" cy="10" r="5" fill="#0B6BFF"/></svg></div></div><img src="./assets/images/3A1D897F-252E-4096-AEF2-C4FA7CA6689D.png" class="onboarding-character on1" alt="크랙이"/><div class="onboarding-shot-dots"><i class="active"></i><i></i><i></i></div><button class="onboarding-next" data-action="goto" data-target="on2">다음</button></div></div></div></div>`,
    on2: `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="onboarding-shot"><div class="onboarding-shot-head"><h2>나에게 최적화된
점수 상승 전략을 제공해요</h2><p>과목별 효율과 목표 도달 시간을
정확하게 예측해 드려요.</p></div><div class="onboarding-center"><div class="onboarding-card strategy"><div class="onboarding-stat">수학 +12점
합격 가능성 +18%</div><svg class="onboarding-graph strategy" viewBox="0 0 320 96"><rect x="72" y="58" width="16" height="38" rx="3" fill="#0B6BFF" fill-opacity="0.85"/><rect x="142" y="40" width="16" height="56" rx="3" fill="#0B6BFF" fill-opacity="0.85"/><rect x="212" y="22" width="16" height="74" rx="3" fill="#0B6BFF" fill-opacity="0.85"/><rect x="282" y="-2" width="16" height="98" rx="3" fill="#0B6BFF" fill-opacity="0.85"/><path d="M18 88 L56 84 L92 70 L126 62 L162 48 L196 42 L232 30 L266 20 L302 12" stroke="#4A8DFF" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="88" r="3" fill="#4A8DFF"/><circle cx="302" cy="12" r="3" fill="#4A8DFF"/></svg></div></div><img src="./assets/images/3A1D897F-252E-4096-AEF2-C4FA7CA6689D.png" class="onboarding-character on2" alt="크랙이"/><div class="onboarding-shot-dots"><i></i><i class="active"></i><i></i></div><button class="onboarding-next" data-action="goto" data-target="on3">다음</button></div></div></div></div>`,
    on3: `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="onboarding-shot"><div class="onboarding-shot-head"><h2>실행부터 관리까지
끝까지 함께해요</h2><p>플래너, 주간 점검, Sky튜터 피드백,
프로 보고서로 완성됩니다.</p></div><div class="onboarding-center"><div class="onboarding-card list"><div class="onboarding-list-item"><span class="onboarding-icon-box"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg></span><span>플래너 & 주간 점검</span></div><div class="onboarding-list-item"><span class="onboarding-icon-box"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6"/></svg></span><span>Sky튜터 1:1 피드백</span></div><div class="onboarding-list-item long-report"><span class="onboarding-icon-box"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v6h6"/></svg></span><span>중장기 합격 전략 리포트</span></div></div></div><img src="./assets/images/3A1D897F-252E-4096-AEF2-C4FA7CA6689D.png" class="onboarding-character on3" alt="크랙이"/><div class="onboarding-shot-dots"><i></i><i></i><i class="active"></i></div><button class="onboarding-next" data-action="goto" data-target="authLogin">시작하기</button></div></div></div></div>`,
    home: layout(homeView(), true),
    addUniversity: layout(
      appbar('대학 추가', true) + `<div class="add-univ-page">
        <div class="card add-univ-hero">
          <p class="analysis-title">희망 대학을 추가해보세요</p>
          <p class="sub">현재 성적과 목표를 기준으로 대학을 추천하거나 직접 검색할 수 있어요.</p>
        </div>
        <div class="card add-univ-section">
          <div class="add-univ-head"><h4>추천 대학</h4><span class="badge">추천</span></div>
          <div class="add-univ-grid">
            ${analysisRecommended.map((name) => `<div class="add-univ-card">
              <div class="add-univ-card-top"><div class="add-univ-item-text"><b>${name}</b><p>현재 성적 기준 우선 검토 대학</p><span class="add-univ-item-badge">검토</span></div><span class="badge">추천</span></div>
              <button class="btn ${analysisTargetList.includes(name)?'btn-secondary':'btn-primary'}" data-action="addAnalysisTarget" data-target-major="${name}" ${analysisTargetList.includes(name)?'disabled':''}>${analysisTargetList.includes(name)?'추가됨':'추가'}</button>
            </div>`).join('')}
          </div>
        </div>
        <div class="card add-univ-section">
          <div class="add-univ-head"><h4>대학 검색</h4></div>
          <input class="planner-input add-univ-search" data-field="analysisSearchTerm" value="${analysisSearchTerm}" placeholder="대학명 또는 학과명을 검색하세요"/>
          <div class="add-univ-results">
            ${analysisSearchList.map((name) => `<div class="add-univ-row"><div class="add-univ-item-text"><span>${name}</span><span class="add-univ-item-badge">검색</span></div><button class="btn ${analysisTargetList.includes(name)?'btn-secondary':'btn-primary'} mini" data-action="addAnalysisTarget" data-target-major="${name}" ${analysisTargetList.includes(name)?'disabled':''}>${analysisTargetList.includes(name)?'추가됨':'추가'}</button></div>`).join('') || '<p class="sub">검색 결과가 없습니다.</p>'}
          </div>
        </div>
      </div>`,
      true
    ),
    analysis: layout(
      `<section class="analysis-v2 ${isAnalyzing ? 'loading' : ''}">
        <div class="card analysis-v2-head">
          <div class="top-card-head">
            <div><h3>분석</h3><p>결과를 보고, 전략을 이해하고, 바로 실행으로 연결하세요.</p></div>
            <span class="top-infographic top-infographic-analysis" aria-hidden="true"><i></i><i></i><i></i></span>
          </div>
        </div>

        <div class="analysis-v2-tabs">
          <button class="analysis-v2-tab ${analysisMode==='summary'?'active':''}" data-action="setAnalysisMode" data-analysis-mode="summary">전략 요약</button>
          <button class="analysis-v2-tab ${analysisMode==='simulation'?'active':''}" data-action="setAnalysisMode" data-analysis-mode="simulation">점수 상승 시뮬레이션</button>
        </div>

        ${analysisMode === 'summary' ? `
          <div class="card analysis-v2-targets">
            <p class="analysis-title">희망 대학 선택</p>
            <select class="analysis-dropdown" data-field="analysisTargetMajor" value="${normalizedTargetMajor}">
              ${analysisMajorOptions.map((name) => `<option value="${name}" ${normalizedTargetMajor===name?'selected':''}>${name}</option>`).join('')}
              <option value="__add_university__">+ 대학 추가하기</option>
            </select>
            <button class="analysis-add-link-btn" data-action="openAnalysisSearchFromHome">+ 대학 추가하기</button>
          </div>

          <div class="card analysis-v2-summary">
            <p class="analysis-title">핵심 결과 카드</p>
            <div class="analysis-v2-summary-top">
              <div>
                <p class="analysis-v2-univ">${targetMajor}</p>
                <p class="analysis-v2-label">합격 가능성 진단</p>
              </div>
              <div class="analysis-v2-score-wrap">
                <span class="analysis-v2-verdict ${scoreTierClass(analysisSelected.score)}" style="color:${analysisStatusColor};border-color:${analysisStatusColor}">${analysisStatus}</span>
                <strong>${analysisSelected.score}점</strong><small>AI 점수</small>
              </div>
            </div>
            <div class="analysis-v2-infographic"><span class="icon">📍</span><div><b>${analysisSelected.score >= 150 ? '현재 위치: 합격 안정권 진입' : (analysisSelected.score >= 100 ? '현재 위치: 합격권 진입 전' : '현재 위치: 합격권까지 거리 있음')}</b><p>목표까지 ${Math.max(0, 150 - Number(analysisSelected.score || 0)) > 0 ? `-${Math.max(0, 150 - Number(analysisSelected.score || 0))}점` : '달성 완료'}</p></div></div>
            <div class="analysis-v2-gauge"><i class="${scoreTierClass(analysisSelected.score)}" style="width:${analysisGaugeFill}%;background:${analysisGaugeColor}"></i></div>
            <div class="analysis-v2-gauge-meta"><span>0</span><span>합격컷 100점</span><span>안정컷 150점</span><span>MAX 250점</span></div>
          </div>

          <div class="card analysis-v2-before-after">
            ${scoreJourneyCard('최소 노력 대비 합격 도달 성적')}
            <div class="analysis-v2-eta ${analysisEtaStage < 3 ? 'loading' : ''}">
              ${analysisEtaStage === 1 ? `<div class="analysis-eta-loading"><span class="skeleton"></span><p>도달 성적 계산 중입니다...</p></div>` : analysisEtaStage === 2 ? `<div class="analysis-eta-loading"><span class="skeleton thin"></span><p>도달 시간을 예상 중입니다...</p></div>` : `<button class="analysis-v2-eta-card" data-action="startStandard"><span class="eyebrow">현재 학습분석 기반</span><b>Standard 이용 시 평균 2개월 내 도달 예상</b><p>매주 플래너 피드백과 학습 방향 관리를 기준으로 계산했어요</p></button>`}
            </div>
          </div>
          <div class="card analysis-v2-gauge-change">
            <p class="analysis-title">합격 가능성 변화</p>
            <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${gaugeTarget}점</b></div></div>
            <div class="ob-gauge">
              <div class="ob-gauge-current ${scoreTierClass(gaugeCurrent)}" style="width:${gaugeCurrentPct}%"></div>
              <div class="ob-gauge-target ${scoreTierClass(gaugeTarget)}" style="width:${gaugeTargetPct}%"></div>
              <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
              <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
            </div>
            <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
            <p class="analysis-sub"><b>현재 → 합격권 진입 구간</b></p><p class="analysis-conv-line">이 속도라면 목표까지 약 2~3개월이 필요합니다</p><p class="analysis-conv-line">방향이 틀리면 점수 상승 효율이 크게 떨어질 수 있습니다</p>
          </div>
          <div class="card ob-card">
            <p class="analysis-title">성적 변화 시 가능한 대학</p>
            <div class="possible-univ-slider" data-slider-group="possible"><div class="possible-univ-track">
            ${[['국민대 경영학부', gaugeCurrent + 6], ['숭실대 경제학과', gaugeCurrent + 10], ['세종대 미디어커뮤니케이션학과', gaugeCurrent + 14]].map(([name, target], idx) => `<div class="possible-univ-card"><button type="button" class="card ob-card" style="margin:10px 0 0; width:100%; text-align:left;" data-action="addPossibleUniversity" data-target-major="${name}">
              <p class="analysis-title">${name}</p>
              <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${target}점</b></div></div>
              <div class="ob-gauge">
                <div class="ob-gauge-current ${scoreTierClass(gaugeCurrent)}" style="width:${Math.min(100, (gaugeCurrent / 250) * 100)}%"></div>
                <div class="ob-gauge-target ${scoreTierClass(target)}" style="width:${Math.min(100, (target / 250) * 100)}%"></div>
                <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
                <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
              </div>
              <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
              <p class="sub"><b>현재 → 합격권 진입 구간</b></p>
            </button></div>`).join('')}</div></div><div class="possible-univ-nav"><button type="button" data-action="slidePrev">‹</button><div class="possible-univ-dots slider-indicator possible-univ-indicator possible-slider-indicator"><button data-action="slideTo" data-slide-index="0" class="active slider-dot possible-univ-dot possible-slider-dot"></button><button data-action="slideTo" data-slide-index="1" class="slider-dot possible-univ-dot possible-slider-dot"></button><button data-action="slideTo" data-slide-index="2" class="slider-dot possible-univ-dot possible-slider-dot"></button></div><button type="button" data-action="slideNext">›</button></div>
          </div>

          <div class="card analysis-v2-cta sticky"><p class="analysis-cta-lead">지금 시작하면 평균 2개월 단축됩니다</p><button class="btn analysis-convert-btn" data-action="startStandard">합격까지 필요한 전략 보기</button><p class="analysis-cta-sub">MBTI 다운로드만 유지</p></div>
        ` : `
          <div class="analysis-v2-compare-card">
            ${(() => { console.log('RENDER_ANALYSIS_BAR_CHART_FIXED_V3'); return ''; })()}
            <div class="analysis-chart-head"><h3>합격 가능성 위치 (0~250점)</h3><span class="analysis-chart-badge">3월 학력평가 기준</span></div>
            <div class="analysis-v2-chart-area">
              <div class="analysis-v2-guide-line pass"><span class="label">합격선 100</span></div>
              <div class="analysis-v2-guide-line safe"><span class="label">안정선 150</span></div>
              <div class="analysis-v2-bars">
                ${[['가천대 관광경영학과', 250, '가천대학교 관광경영학과'], ['강서대 G2빅데이터경영학과', 238, '강서대학교 G2빅데이터경영학과'], ['고려대 경영대학', 71, '고려대학교 경영대학']].map(([label, score, full]) => {
                  const heightPercent = Math.max(0, Math.min(100, (score / 250) * 100));
                  const color = score <= 100 ? '#fa8072' : score <= 150 ? '#2563eb' : '#8b5cf6';
                  const shouldProject = analysisBarProjectionTarget === full;
                  const projectionGain = shouldProject ? Math.max(0, Math.min(analysisSimMax, 250 - score)) : null;
                  const projectionScore = projectionGain !== null ? Math.min(250, score + projectionGain) : null;
                  const projectedPercent = projectionScore ? Math.max(0, Math.min(100, (projectionScore / 250) * 100)) : heightPercent;
                  const projectionHeight = projectionScore ? Math.max(0, projectedPercent - heightPercent) : 0;
                  const gainLabel = projectionGain === null ? '' : Number(projectionGain.toFixed(1)).toString();
                  const projection = projectionScore ? `<span class="analysis-v2-bar-proj ${shouldProject ? 'pop' : ''}" style="bottom:${Math.max(0, (100 - projectionScore / 250 * 100))}%">${Number(projectionScore.toFixed(1)).toString()} (+${gainLabel})</span>` : '';
                  const projectionBox = projectionScore && projectionHeight > 0 ? `<span class="analysis-v2-bar-proj-box" style="bottom:${heightPercent}%;height:${projectionHeight}%"></span>` : '';
                  const tier = scoreTierClass(score);
                  return `<button class="analysis-v2-bar-item ${targetMajor===full?'active':''}" data-action="simulateBarGain" data-target-major="${full}" data-base-score="${score}"><b class="score ${tier}">${score}</b><div class="analysis-v2-bar-wrap"><i class="analysis-v2-bar ${tier}" style="height:${heightPercent}%;background:${color}"></i>${projectionBox}${projection}</div><p>${label}</p></button>`;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="card analysis-v2-sim">
            ${(() => { console.log('RENDER_SCORE_GAIN_CARD_V3'); return ''; })()}
            <p class="analysis-title">+1점 상승 시 기대 효율</p>
            ${analysisSimRows.map(({ subject, gain, desc, gainNum }, index) => {
              const ratio = Math.max((gainNum / Math.max(analysisSimMax, 1)) * 100, 8);
              const recommended = index === analysisSimRecommendedIndex;
              const selected = analysisHighlightedSubject===subject;
              return `<button class="analysis-v2-sim-item ${recommended?'recommended':''} ${selected?'focus':''}" data-action="highlightSimSubject" data-sim-subject="${subject}"><div class="left"><p><strong>${subject} (+1점)</strong>${recommended?'<span class="badge">추천</span>':''}</p><small>${desc}</small><span class="mini-track"><i style="width:${ratio}%"></i></span>${selected?`<span class="sim-detail">+1점 상승 시 AI 점수 ${gain} / 합격 가능성 상승 기대</span>`:''}</div><b>${gain}</b></button>`;
            }).join('')}
            <p class="analysis-v2-sim-foot">탭해서 과목별 상승 효율을 빠르게 비교해보세요.</p>
          </div>
        `}

        ${analysisSearchOpen ? `<div class="analysis-search-overlay" data-action="closeAnalysisSearch"><div class="analysis-search-modal" data-action="noopModal"><div class="analysis-search-head"><h4>희망 대학 선택</h4><button data-action="closeAnalysisSearch">✕</button></div><div class="analysis-search-sticky"><input class="planner-input" data-field="analysisSearchTerm" value="${analysisSearchTerm}" placeholder="대학명 또는 학과명을 검색하세요"/></div><div class="analysis-search-section recommend"><p>현재 성적 기준 추천</p><div class="analysis-search-rec-grid">${analysisRecommended.map((name) => `<button class="analysis-rec-card" data-action="addAnalysisTarget" data-target-major="${name}"><div><strong>${name}</strong><span class="badge">추천</span></div><em>${analysisTargetList.includes(name)?'추가됨':'선택'}</em></button>`).join('')}</div></div><div class="analysis-search-section"><p>검색 결과</p>${analysisSearchList.map((name) => `<button class="analysis-search-row" data-action="addAnalysisTarget" data-target-major="${name}">${name}<span>${analysisTargetList.includes(name)?'추가됨':'추가'}</span></button>`).join('')}</div></div></div>` : ''}
      </section>`,
      true
    ),
    strategy: layout(
      `<div class="coach-page">
        <div class="card coach-title-card"><div class="top-card-head"><div><h3>학습 코칭</h3><p>주간 학습 계획을 점검하고, 튜터의 피드백을 받아보세요.</p></div><span class="top-infographic top-infographic-coach" aria-hidden="true"><i></i><i></i><i></i></span></div></div>
        <div class="card coach-status-card">
          <div class="coach-row"><h4>이번 주 학습 점검 & 코칭 요청</h4><span class="badge ${coachingSubmitted ? 'coach-submitted' : ''}">${coachingSubmitted ? '제출 완료' : '미제출'}</span></div>
          <p>이번 주 학습 달성률과 고민을 작성하면 튜터가 피드백을 제공해요.</p>
          <small>매주 일요일 20:00 마감</small>
          <button class="btn btn-primary" data-action="openCoachingSheet">${coachingSubmitted ? '다시 작성하기' : '코칭 요청하기'}</button>
        </div>
        <div class="card coach-feedback-card">
          <div class="coach-row"><h4>주간학습 피드백</h4><select class="coach-month-select" data-field="coachingMonth"><option value="26년 4월" ${coachingMonth==='26년 4월'?'selected':''}>26년 4월</option><option value="26년 3월" ${coachingMonth==='26년 3월'?'selected':''}>26년 3월</option></select></div>
          <p>월별 피드백 리포트를 PDF로 다운로드할 수 있어요.</p>
          ${selectedCoachingReports.length ? `<div class="coach-report-list">${selectedCoachingReports.map((report) => `<button class="coach-report-card" data-action="downloadCoachingPdf" data-pdf-path="${report.pdfPath}"><div><b>${report.title}</b><p>${report.date}</p></div><div class="coach-report-side"><span class="badge coach-pdf-badge">PDF</span><span class="coach-report-arrow">›</span></div></button>`).join('')}</div>` : `<div class="coach-empty">아직 도착한 피드백 리포트가 없습니다.</div>`}
        </div>
        ${coachingSheetOpen ? `<div class="coach-sheet-overlay" data-action="closeCoachingSheet">
          <section class="coach-sheet" data-action="noopModal">
            <div class="coach-sheet-head"><div><h3>26년 4월 4주차 학습점검</h3><p>${coachingStep} / 8 단계</p></div><button class="coach-close" data-action="closeCoachingSheet">✕</button></div>
            <div class="coach-sheet-body">${coachingStepBody()}</div>
            <div class="coach-sheet-footer"><button class="btn btn-secondary" data-action="coachingPrev" ${coachingStep===1?'disabled':''}>이전</button><button class="btn btn-primary" data-action="coachingNext">${coachingStep===8?'작성 완료 및 제출':'다음 단계'}</button></div>
          </section>
        </div>` : ''}
      </div>`,
      true
    ),
    planner: layout(
	      `<div class="planner-screen">${(() => { console.log('RENDER_PLANNER_NO_TIME_RANGE_V3'); return ''; })()}<div class="planner-head"><h3>2024년 5월 ${selectedPlannerDate}일 (화)</h3><button class="planner-cal-btn" data-action="openPlannerCalendar">${i('calendar', false)}</button></div>
       <div class="planner-days planner-days-carousel planner-date-strip">${plannerWeekDates.map(({ day, weekday }) => `<button class="planner-date-item ${selectedPlannerDate===day?'active':''}" data-action="selectPlannerDate" data-planner-date="${day}"><small>${weekday}</small><strong>${day}</strong></button>`).join('')}</div>
       <div class="planner-section-title planner-fade"><div><h4>${selectedPlannerDate}일 계획</h4><p>총 ${plannerViewHour}시간 ${plannerViewMinute}분</p>${plannerFeedback.tone==='warn' ? `<span class="planner-warning-pill">⚠ 수학 비중 높음 · 과목 균형 필요</span>` : ''}</div>${plannerViewSubjectStats.length ? `<div class="planner-donut-wrap"><div class="planner-donut" style="--donut:${plannerViewDonutGradient}"></div><div class="planner-donut-legend">${plannerViewSubjectStats.map((item)=>`<span><i style="background:${item.color}"></i>${item.subject} ${item.percent}%</span>`).join('')}</div></div>` : ''}</div>
       <div class="planner-plan-list">
         ${plannerViewItems.map((item) => `<div class="planner-item ${item.done ? 'done' : ''}" data-action="openPlannerEdit" data-planner-id="${item.id}"><i class="dot ${item.dot}"></i><div class="planner-item-main"><b>${item.subject}</b><p>${item.content}</p></div><div class="planner-item-right"><strong>${item.minutes}분</strong><div class="planner-item-controls"><button class="planner-item-done" data-action="togglePlannerDone" data-planner-id="${item.id}">✓ ${item.done ? '완료!' : '완료'}</button><button class="planner-item-remove" data-action="removePlannerItem" data-planner-id="${item.id}">✕</button></div></div></div>`).join('') || '<div class="planner-empty-day">선택한 날짜의 플래너가 없습니다.</div>'}
	         <button class="planner-add-cta" data-action="openPlannerAddPage">+ ${selectedPlannerDate}일 계획 추가하기</button>
       </div>
       
       <div class="planner-bottom-space"></div>
       ${plannerCalendarOpen ? `<div class="planner-sheet-overlay" data-action="closePlannerCalendar"><div class="planner-sheet planner-calendar-sheet" data-action="noopModal"><button class="planner-sheet-close" data-action="closePlannerCalendar">✕</button><h3>2024년 5월</h3><div class="planner-calendar-grid">${Array.from({ length: 31 }, (_, i) => i + 1).map((day) => `<button class="planner-cal-day ${selectedPlannerDate===String(day)?'active':''}" data-action="selectPlannerDate" data-planner-date="${day}">${day}</button>`).join('')}</div></div></div>` : ''}
	       ${plannerEditIndex !== null ? `<div class="planner-sheet-overlay" data-action="closePlannerEdit"><div class="planner-sheet" data-action="noopModal"><button class="planner-sheet-close" data-action="closePlannerEdit">✕</button><h3>플래너 항목 수정</h3><div class="planner-sheet-block"><label>과목</label><input class="planner-input" data-field="plannerEditSubject" value="${plannerEditItem?.subject || ''}" /></div><div class="planner-sheet-block"><label>세부 내용</label><input class="planner-input" data-field="plannerEditContent" value="${plannerEditItem?.content || ''}" /></div><div class="planner-sheet-block"><label>소요 시간(분)</label><input class="planner-input" data-field="plannerEditMinutes" type="number" value="${plannerEditItem?.minutes || ''}" /></div><button class="btn btn-primary" data-action="savePlannerEdit">수정 저장</button></div></div>` : ''}
	       </div>`,
	      true
	    ),
    plannerAdd: layout(
      `<div class="planner-screen">
        ${appbar(`${selectedPlannerDate}일 플래너 항목 추가`, true)}
        <div class="planner-add-page">
          <div class="planner-add-form">
            <h4>${selectedPlannerDate}일 학습 계획</h4>
            <p class="sub">선택한 날짜에 실행할 학습 계획을 입력해 주세요.</p>
            <div class="planner-sheet-block"><label>과목 선택</label><div class="planner-pill-row"><button class="planner-pill ${plannerDraft.subject==='수학'?'active':''}" data-action="setPlannerSubject" data-planner-subject="수학">수학</button><button class="planner-pill ${plannerDraft.subject==='국어'?'active':''}" data-action="setPlannerSubject" data-planner-subject="국어">국어</button><button class="planner-pill ${plannerDraft.subject==='영어'?'active':''}" data-action="setPlannerSubject" data-planner-subject="영어">영어</button><button class="planner-pill ${plannerDraft.subject==='탐구'?'active':''}" data-action="setPlannerSubject" data-planner-subject="탐구">탐구</button><button class="planner-pill ${plannerDraft.subject==='기타'?'active':''}" data-action="setPlannerSubject" data-planner-subject="기타">기타</button></div></div>
            <div class="planner-sheet-block"><label>학습 내용</label><input class="planner-input" data-field="plannerContent" value="${plannerContentRef.current}" placeholder="예: 개념 학습, 독해 문제 풀이" /></div>
            <div class="planner-sheet-block"><label>시간 선택</label><div class="planner-pill-row"><button class="planner-pill ${plannerDraft.durationChoice==='30'?'active':''}" data-action="setPlannerDuration" data-planner-duration="30">30분</button><button class="planner-pill ${plannerDraft.durationChoice==='60'?'active':''}" data-action="setPlannerDuration" data-planner-duration="60">60분</button><button class="planner-pill ${plannerDraft.durationChoice==='90'?'active':''}" data-action="setPlannerDuration" data-planner-duration="90">90분</button><button class="planner-pill ${plannerDraft.durationChoice==='120'?'active':''}" data-action="setPlannerDuration" data-planner-duration="120">120분</button><button class="planner-pill ${plannerDraft.durationChoice==='custom'?'active':''}" data-action="setPlannerDuration" data-planner-duration="custom">직접 입력</button></div><input class="planner-input ${plannerDraft.durationChoice==='custom'?'':'is-hidden'}" data-field="plannerCustomMinutes" value="${plannerCustomMinutesRef.current}" type="number" placeholder="분 단위 입력" /></div>
            <button class="btn btn-primary planner-sheet-submit ${canSubmitPlanner?'':'disabled'}" data-action="addPlannerFromSheet" ${canSubmitPlanner?'':'disabled'}>플래너에 추가하기</button>
          </div>
        </div>
      </div>`,
      true
    ),
    my: layout(appbar('마이페이지', false) + `<div class="my-stack">
      <div class="card my-profile-card"><div class="my-profile-left"><div class="my-avatar">${i('user', false)}</div><div><p class="my-name">김지민</p><p class="sub">목표 대학: 연세대학교 경영학과</p></div></div><div class="my-profile-right"><span class="top-infographic top-infographic-my" aria-hidden="true"><i></i><i></i><i></i></span><span class="badge">Pro 이용 중</span></div></div>
      ${mbtiResult ? `<div class="card" style="border:2px solid #2563EB;background:#EFF6FF;"><p class="analysis-title">진단 결과 & MBTI 학습보고서</p><p style="margin:6px 0 2px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1D4ED8;text-shadow:0 6px 18px rgba(37,99,235,.18);">CSDR</p><p class="sub" style="margin:0 0 12px;font-size:12px;color:#1E40AF;">(컨셉형, 직관령, 분석형, 루틴)</p><button class="btn btn-primary" data-action="downloadMbtiReport">MBTI 학습 보고서 다운</button></div>` : ''}
      <div class="card my-subscription-card"><div class="my-sub-icon">${i('report', false)}</div><div><p class="my-sub-title">Pro 플랜 이용 중</p><p class="my-sub-date">다음 결제일 2024.06.14</p></div></div>
      <div class="card my-menu-card">
        <button class="my-row" data-action="goto" data-target="qualInfo">정성조사서 <span>${i('chevron', false)}</span></button><button class="my-row" data-action="goto" data-target="scoreInfo">성적 정보 <span>${i('chevron', false)}</span></button>
        
        <button class="my-row" data-action="goto" data-target="proIntro">구독 관리 <span>${i('chevron', false)}</span></button>
      </div>
      <div class="card my-menu-card my-service-card">
        <p class="my-section-title">서비스</p>
        <button class="my-row" data-action="goto" data-target="notificationSettings">알림 설정 <span>${i('chevron', false)}</span></button>
        <button class="my-row" data-action="goto" data-target="customerSupport">고객센터 <span>${i('chevron', false)}</span></button>
        <button class="my-row" data-action="goto" data-target="settingsMain">설정 <span>${i('chevron', false)}</span></button>
      </div>
    </div>`, true),
    weekly: layout(
      `<div class="weekly-head"><button class="weekly-back" data-action="back">←</button><h3>주간 점검</h3><span></span></div>
       <p class="weekly-range">이번 주 점검 (5.6 ~ 5.12)</p>
       <div class="card weekly-rate"><div><p class="sub">플래너 수행률</p><h2>82%</h2></div><span class="badge">목표 90%</span></div>
       <div class="card weekly-feedback">
         <p class="sub" style="margin:0 0 10px;">주간 요약 피드백</p>
         <div class="feedback-item">${i('check', true)}수학 공부 시간이 부족해요. 개념 학습 시간을 늘려보세요.</div>
         <div class="feedback-item">${i('check', true)}탐구 문제 풀이 시간이 좋아요! 유지하면 더 좋은 결과가 기대돼요.</div>
         <div class="feedback-item">${i('check', true)}영어는 꾸준히 잘하고 있어요. 계속 유지해요!</div>
         <img src="${CRACKY_SRC}" class="weekly-char crackie" alt="크랙이"/>
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary weekly-next cta-btn" data-action="goto" data-target="planner">다음 주 계획 세우기</button></div>`,
      true
    ),
    report: layout(
      `<span class="badge">프로 플랜 전용</span>
       <p class="report-desc">2주에 한 번, 내 맞춤 분석 리포트 제공</p>
       <div class="card report-main"><p class="sub">다음 보고서 이용 가능일</p><p class="report-date">5월 25일 (토)</p><h2>D-11</h2></div>
       <div class="card report-list"><p class="sub">이전 보고서</p>
         <button class="report-row" data-action="goto" data-target="reportDetail"><div><b>5월 11일 (토)</b><p>종합 분석 리포트</p></div><span>${i('chevron', false)}</span></button>
         <button class="report-row"><div><b>4월 27일 (토)</b><p>중간 분석 리포트</p></div><span>${i('chevron', false)}</span></button>
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary report-sample cta-btn">프로 보고서 샘플 보기</button></div>`,
      true
    ),
    reportDetail: layout(appbar('종합 분석 리포트', true) + `<div class="report-tabs"><span class="active">종합 분석</span><span>과목 분석</span><span>학습 전략</span><span>현재 위치</span></div><div class="report-detail-stack"><div class="card report-detail-card"><p class="sub">핵심 요약</p><p class="report-detail-text">수학에서 점수 상승 여지가 가장 큽니다. 개념 학습 시간을 늘리고, 문제 풀이 비중을 높이면 단기간 점수 개선이 가능합니다.</p></div><div class="card report-detail-card"><p class="sub">과목별 성과</p><div class="subject-result"><span>수학</span><div class="track"><i style="width:82%"></i></div><em><span class="score">68점</span><span class="delta">▲12</span></em></div><div class="subject-result"><span>국어</span><div class="track"><i style="width:74%"></i></div><em><span class="score">82점</span><span class="delta">▲3</span></em></div><div class="subject-result"><span>영어</span><div class="track"><i style="width:70%"></i></div><em><span class="score">77점</span><span class="delta">-</span></em></div><div class="subject-result"><span>탐구</span><div class="track"><i style="width:62%"></i></div><em><span class="score">66점</span><span class="delta">▲5</span></em></div></div></div><div class="cta-wrapper report-detail-cta"><button class="btn btn-primary cta-btn">PDF 다운로드</button></div>`, false),
    proElite: layout(appbar('PRO EXCLUSIVE', true) + `<div class="pro-elite-page"><div class="pro-elite-hero"><span class="pro-elite-badge">TOP 1%</span><h3>상위 1%를 위한<br/>중장기 집중 맞춤 솔루션</h3><p>주차별 프리미엄 전략 리포트를 다운로드하세요.</p></div><div class="pro-elite-filter"><select class="pro-elite-month-select" data-field="proEliteMonth">${proEliteMonths.map((month)=>`<option value="${month}" ${proEliteMonth===month?'selected':''}>${month}</option>`).join('')}</select></div><div class="pro-elite-list">${proEliteFilteredReports.map((report)=>`<button class="pro-elite-item" data-action="downloadProReport" data-pdf-path="${PRO_ELITE_REPORT_PDF_PATH}" data-pdf-name="${report.fileName}"><div><b>${report.week} PRO 리포트</b><p>${report.desc}</p></div><span class="pro-elite-download">PDF 다운로드</span></button>`).join('') || '<div class="coach-empty">해당 월 리포트가 없습니다.</div>'}</div><div class="pro-elite-request-bottom"><button class="pro-request-btn" data-action="openProRequestModal"><i class="spark">✦</i><span>전략 리포트 요청하기</span></button></div>${proRequestModalOpen ? `<div class="home-modal-overlay" data-action="closeProRequestModal"><div class="home-modal pro-request-modal" data-action="noopModal"><div class="pro-request-head"><h4>✈ 전략 보고서 요청</h4><button class="pro-request-close" data-action="closeProRequestModal">✕</button></div><div class="pro-request-body"><p>현재 학습 상황이나 고민, 특별히 분석받고 싶은 내용을 적어주세요.</p><p>담당 컨설턴트가 이를 반영하여 <b>최적의 전략</b>을 수립합니다.</p><label>요청 사항 (500자 이내)</label><textarea data-field="proRequestText" maxlength="500" placeholder="예: 6월 모평 대비 수학 기하 과목 집중 전략이 필요합니다. 최근 실전 문제 풀이에서 시간이 부족해 고민입니다.">${proRequestText}</textarea><div class="pro-request-count">${proRequestText.length}/500</div><div class="pro-request-actions"><button class="cancel" data-action="closeProRequestModal">취소</button><button class="submit" data-action="submitProRequest">요청서 제출하기</button></div></div></div></div>` : ''}</div>`, false),
    tutor: layout(appbar('SKY튜터 1:1 피드백', true) + `<div class="card"><p class="sub">텍스트 기반 질의응답</p><ul class="list"><li>Q. 수학 개념 이해가 잘 안돼요</li><li>A. 유형별 복습 루틴을 추가하세요</li></ul></div><button class="btn btn-primary">새 질문 작성</button>`, false),
    proIntro: layout(appbar('StudyCrack 요금제', true) + `<p class="sub pricing-sub">합격 전략, 단계별로 선택하세요</p>
      <div class="plan-stack">
        <button class="plan-card basic ${selectedPlan==='Basic'?'active':''}" data-action="selectPlan" data-plan="Basic"><div class="plan-head"><h4>Basic</h4></div><p class="plan-price">${planMeta.Basic.introPrice}</p><ul><li>합격 가능성 분석</li><li>대학별 전략 확인</li></ul></button>
        <button class="plan-card standard ${selectedPlan==='Standard'?'active':''}" data-action="selectPlan" data-plan="Standard"><div class="plan-head"><h4>Standard</h4><span class="badge">추천</span></div><p class="plan-price">${planMeta.Standard.introPrice}</p><ul><li>플래너 피드백</li><li>학습 방향 코칭</li></ul></button>
        <button class="plan-card pro ${selectedPlan==='Pro'?'active':''}" data-action="selectPlan" data-plan="Pro"><div class="plan-head"><h4>Pro</h4><span class="badge">최고 효율</span></div><p class="plan-price">${planMeta.Pro.introPrice}</p><ul><li>모든 기능 무제한 이용</li><li>프로 보고서 2주 1회</li><li>Sky튜터 1:1 피드백</li></ul></button>
      </div>
      <div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="payment">결제하기</button></div>`, false),
    payment: layout(appbar('플랜 선택', true) + `<div class="payment-tabs full">
      <button class="${selectedPlan==='Basic'?'active':''}" data-action="selectPlan" data-plan="Basic">Basic</button>
      <button class="${selectedPlan==='Standard'?'active':''}" data-action="selectPlan" data-plan="Standard">Standard</button>
      <button class="${selectedPlan==='Pro'?'active':''}" data-action="selectPlan" data-plan="Pro">Pro</button>
    </div>
      <div class="card payment-focus-card"><div class="payment-focus-head"><div><h3>${selectedPlan}</h3><p>${currentPlan.payPrice}</p></div></div><p class="payment-desc">${currentPlan.desc}</p><ul class="payment-check-list">${currentPlan.features.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      <div class="duration-row payment-duration-row">
        <button class="${duration==='4주'?'active':''}" data-action="selectDuration" data-duration="4주">4주</button>
        <button class="${duration==='8주'?'active':''}" data-action="selectDuration" data-duration="8주">8주</button>
        <button class="${duration==='12주'?'active':''}" data-action="selectDuration" data-duration="12주">12주</button>
      </div>
      <div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="paymentComplete">결제하기</button></div>`, false),
    paymentComplete: layout(`<div class="payment-done-screen"><div class="payment-complete-wrap"><div class="payment-check">${i('check', true)}</div><p class="title payment-complete-title">결제가 완료되었습니다!</p><p class="sub payment-complete-sub">${selectedPlan.toUpperCase()} 플랜이 활성화되었습니다.</p><div class="card payment-complete-note"><b>프로 보고서 이용 안내</b><p>2주에 한 번 새로운 리포트를 제공해 드려요.<br/>다음 리포트는 5월 25일에 이용 가능해요.</p></div></div><div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="home">홈으로 이동</button></div></div>`, false),

    qualInfo: layout(appbar('정성조사서', true) + `<div class="card"><p class="sub" style="color:#ef4444;font-weight:700;margin:0 0 10px;">* 표시는 필수 입력 항목입니다.</p><p class="analysis-title">현재 학년 <span style="color:#ef4444">*</span></p><div class="ob1-pill-row">${['고1/2 재학','고3 재학','N수생','검정고시','기타'].map((grade) => `<button class="ob1-pill ${obGradeStatus===grade?'active':''}" data-action="setObGradeStatus" data-ob-grade="${grade}">${grade}</button>`).join('')}</div></div><div class="card"><p class="analysis-title">출신 학교 <span style="color:#ef4444">*</span></p><input class="planner-input" data-field="obSchoolName" value="${obSchoolName}" placeholder="출신 학교 입력"/></div><div class="card"><p class="analysis-title">희망 계열 <span style="color:#ef4444">*</span></p><select class="planner-input" data-field="obTrack"><option value="예체능" ${obTrack==='예체능'?'selected':''}>예체능</option><option value="인문사회" ${obTrack==='인문사회'?'selected':''}>인문사회</option><option value="상경계열" ${obTrack==='상경계열'?'selected':''}>상경계열</option><option value="자연/공학" ${obTrack==='자연/공학'?'selected':''}>자연/공학</option><option value="의치한약수" ${obTrack==='의치한약수'?'selected':''}>의치한약수</option><option value="간호" ${obTrack==='간호'?'selected':''}>간호</option><option value="사범/교대" ${obTrack==='사범/교대'?'selected':''}>사범/교대</option><option value="기타" ${obTrack==='기타'?'selected':''}>기타</option></select></div><div class="card"><p class="analysis-title">스터디크랙을 통해서 얻고 싶은 점 <span style="color:#ef4444">*</span></p><textarea class="planner-input" data-field="obGoalText" rows="3">${obGoalText}</textarea></div><div class="card"><p class="analysis-title">입시 고민 및 질문 (있으면 작성해주세요.)</p><textarea class="planner-input" data-field="obQuestionText" rows="4">${obQuestionText}</textarea><button class="btn btn-primary" data-action="saveQualInfo">정성조사서 저장</button></div>`, false),
    scoreInfo: layout(appbar('성적 정보', true) + `<div class="card score-info-card"><label style="font-weight:700;">시험 선택</label><select class="planner-input" data-field="scoreExamType" style="margin-top:8px;">${EXAM_OPTIONS.map((label) => `<option value="${label}" ${scoreExamType===label?'selected':''}>${label}</option>`).join('')}</select><div class="score-info-detail-table"><div class="score-info-detail-row"><b>과목</b><b>원점수</b><b>표준점수</b><b>백분위</b><b>등급</b></div>${scoreInfoDetailList}</div><button class="btn btn-primary score-edit-btn" data-action="openScoreEdit">성적 수정하기</button><button class="btn btn-secondary score-edit-btn" data-action="applyScoreExam" style="margin-top:10px;">적용</button></div><div class="card"><p class="analysis-title">최근 성적 업데이트</p><p class="sub" style="margin:0">선택한 시험 기준으로 결과가 연동됩니다.</p></div>${scoreEditOpen ? ScoreEditModal() : ''}`, false),
    notificationSettings: layout(appbar('알림 설정', true) + `<div class="card notify-card">${[
      ['planner', '플래너 알림', '오늘 계획을 잊지 않도록 알려드려요'],
      ['weekly', '주간 점검 알림', '매주 점검 시점을 알려드려요'],
      ['report', '프로 보고서 알림', '새 리포트 이용 가능일을 알려드려요'],
      ['billing', '결제/구독 알림', '다음 결제일을 미리 알려드려요']
    ].map(([key, title, desc]) => `<button class="notify-row" data-action="toggleNotification" data-notify-key="${key}"><div><b>${title}</b><p>${desc}</p></div><span class="notify-switch ${notifications[key]?'on':''}"><i></i></span></button>`).join('')}</div>`, false),
    customerSupport: layout(appbar('고객센터', true) + `<div class="card"><p class="analysis-title">궁금한 점이 있으면 언제든 문의해주세요.</p><p class="sub" style="margin:0">운영 시간: 평일 10:00 - 18:00</p><div class="support-btns"><button class="btn btn-secondary" data-action="openKakaoSupport">카카오톡 문의하기</button><button class="btn btn-secondary" data-action="openEmailSupport">이메일 문의하기</button></div></div><div class="card faq-card">${[
      ['faq1', '분석 결과는 얼마나 정확한가요?', '스터디크랙의 분석 엔진은 최근 3개년의 합격자 표본과 대학별 환산식을 기반으로 계산됩니다. 단순 등급이 아닌 대학별 실질 환산 점수를 사용하여 높은 정확도를 제공합니다.'],
      ['faq2', '목표 대학을 중간에 변경할 수 있나요?', '네, 가능합니다. 목표 대학을 수정하면 즉시 새로운 분석 결과가 반영됩니다.'],
      ['faq3', '환불 규정이 궁금합니다.', '결제 후 목표 대학 설정 전까지는 전액 환불이 가능합니다. 목표 대학 설정 이후에는 콘텐츠 이용으로 간주되어 환불이 제한될 수 있습니다.'],
      ['faq4', '다른 서비스랑 뭐가 다른가요?', '스터디크랙은 실제 합격 데이터를 기반으로 개인 전략을 설계해주는 서비스입니다. 막연한 가능성이 아니라 어디를, 왜, 어떻게 써야 하는지까지 제시합니다.'],
      ['faq5', '지금 시작해도 늦지 않았나요?', '오히려 지금이 가장 중요합니다. 입시는 얼마나 많이가 아니라 얼마나 정확하게 하느냐가 결과를 좌우합니다.'],
      ['faq6', '성적이 애매한데 효과가 있을까요?', '성적이 애매할수록 전략이 더 중요합니다. 상위권은 유지가 핵심이지만, 중위권은 전략에 따라 결과가 크게 갈립니다.'],
      ['faq7', '혼자 해도 되는 거 아닌가요?', '가능합니다. 하지만 잘못된 방향으로 공부하면 시간은 쓰고 결과는 안 나옵니다. 스터디크랙은 시행착오를 줄여줍니다.'],
      ['faq8', '어떤 플랜을 선택해야 할지 모르겠어요.', '빠르게 방향만 잡고 싶다면 Basic, 루틴 관리까지 원하면 Standard, 확실한 결과를 원하면 Pro를 추천합니다.']
    ].map(([id, q, a]) => `<button class="faq-row" data-action="toggleFaq" data-faq-id="${id}"><div><b>${q}</b>${openFaq===id?`<p>${a}</p>`:''}</div><span>${i('chevron', false)}</span></button>`).join('')}</div>`, false),
    settingsMain: layout(appbar('설정', true) + `<div class="card settings-list"><button data-action="goto" data-target="accountInfo">계정 정보 <span>${i('chevron', false)}</span></button><button data-action="goto" data-target="privacyPolicy">개인정보 처리방침 <span>${i('chevron', false)}</span></button><button data-action="goto" data-target="termsScreen">서비스 이용약관 <span>${i('chevron', false)}</span></button><button data-action="openLogoutModal">로그아웃 <span>${i('chevron', false)}</span></button></div>${logoutModalOpen ? `<div class="home-modal-overlay" data-action="closeLogoutModal"><div class="home-modal" data-action="noopModal"><p class="home-modal-title">로그아웃하시겠어요?</p><div class="support-btns"><button class="btn btn-secondary" data-action="closeLogoutModal">취소</button><button class="btn btn-primary" data-action="confirmLogout">로그아웃</button></div></div></div>` : ''}`, false),
    accountInfo: layout(appbar('계정 정보', true) + `<div class="card"><div class="score-info-row"><span>이름</span><strong>${user?.name || DEFAULT_USER.name}</strong></div><div class="score-info-row"><span>목표 대학</span><strong>${targetMajor || DEFAULT_USER.targetUniversity}</strong></div><div class="score-info-row"><span>현재 플랜</span><strong>${selectedPlan || DEFAULT_USER.plan}</strong></div><button class="btn btn-secondary" style="margin-top:14px" data-action="openWithdrawModal">회원탈퇴</button></div>${withdrawModalOpen ? `<div class="home-modal-overlay" data-action="closeWithdrawModal"><div class="home-modal" data-action="noopModal"><p class="home-modal-title">회원탈퇴</p><p class="sub" style="margin:8px 0 12px;">현재 비밀번호를 입력하면 탈퇴할 수 있습니다.</p><input class="planner-input" type="password" data-field="withdrawPassword" value="${withdrawPassword}" placeholder="현재 비밀번호"/><div class="support-btns" style="margin-top:12px"><button class="btn btn-secondary" data-action="closeWithdrawModal">취소</button><button class="btn btn-primary" data-action="confirmWithdraw">탈퇴하기</button></div></div></div>` : ''}`, false),
    privacyPolicy: layout(appbar('개인정보 처리방침', true) + `<div class="card"><p class="sub" style="margin:0">스터디크랙은 서비스 제공을 위해 필요한 최소한의 개인정보를 처리합니다.</p></div>`, false),
    termsScreen: layout(appbar('서비스 이용약관', true) + `<div class="card"><p class="sub" style="margin:0">본 약관은 스터디크랙 서비스 이용과 관련한 기본 사항을 안내합니다.</p></div>`, false)
  };

  const current = screens[screen] || screens.home;
  const currentScreen = screen;
  console.log('APP_LOADING_STATE', loading);
  console.log('APP_CURRENT_SCREEN', currentScreen);
  const armScrollGuard = () => {
    // no-op: 강제 scrollTo 제거
  };
  const getHomeSliderState = () => {
    const slider = document.querySelector('.home-kpi-slider');
    const track = slider?.querySelector('.home-kpi-track');
    const indicators = document.querySelectorAll('.home-kpi-indicator i');
    const total = indicators.length;
    const activeIndex = Array.from(indicators).findIndex((el) => el.classList.contains('active'));
    return { slider, track, indicators, total, activeIndex: activeIndex >= 0 ? activeIndex : 0 };
  };
  const setHomeSlideDom = (index, motion = '') => {
    const { track, indicators, total } = getHomeSliderState();
    if (!track || !total) return;
    const max = total - 1;
    const next = Math.max(0, Math.min(index, max));
    indicators.forEach((el, idx) => {
      el.classList.toggle('active', idx === next);
    });
    if (motion) {
      track.classList.remove('motion-next', 'motion-prev');
      track.classList.add(motion);
    }
    track.style.setProperty('--home-slide-x', `calc(-${next} * (var(--home-slide-card-width) + var(--home-slide-gap)) + 0px)`);
    track.style.setProperty('--home-slide-transition', 'transform .72s cubic-bezier(.22,1,.36,1)');
    track.dataset.homeSlideIndex = String(next);
  };
  const getScoreCardState = (baseEl) => {
    const card = baseEl?.closest?.('.score-journey-card') || document.querySelector('.score-journey-card');
    const track = card?.querySelector('.score-journey-track');
    const buttons = card?.querySelectorAll('.score-journey-segment button') || [];
    const activeView = card?.querySelector('.score-journey-segment button.active')?.getAttribute('data-score-view') || 'target';
    return { card, track, buttons, activeView };
  };
  const setScoreCardDom = (baseEl, nextView, transition = 'transform .56s cubic-bezier(.22,.61,.36,1)') => {
    const { card, track, buttons } = getScoreCardState(baseEl);
    if (!card || !track || !buttons.length) return;
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-score-view') === nextView);
    });
    track.classList.remove('motion-next', 'motion-prev');
    track.style.setProperty('--score-slide-x', nextView === 'target' ? '-50%' : '0%');
    track.style.setProperty('--score-slide-transition', transition);
    card.dataset.scoreView = nextView;
  };
  const ensureHomeSliderDomReady = () => {
    const { track, activeIndex } = getHomeSliderState();
    if (!track) return;
    track.dataset.homeSlideIndex = String(activeIndex || 0);
    track.style.setProperty('--home-slide-transition', 'transform .72s cubic-bezier(.22,1,.36,1)');
  };
  const ensureScoreJourneyDomReady = (card) => {
    if (!card) return;
    const active = card.querySelector('.score-journey-segment button.active')?.getAttribute('data-score-view') || 'target';
    card.dataset.scoreView = active;
    const track = card.querySelector('.score-journey-track');
    if (track) {
      track.style.setProperty('--score-slide-x', active === 'target' ? '-50%' : '0%');
      track.style.setProperty('--score-slide-transition', 'transform .56s cubic-bezier(.22,.61,.36,1)');
    }
  };

  let possibleUnivTouchStartX = 0;
  let possibleUnivDragging = false;
  const updatePossibleUnivSlider = (slider, nextIndex) => {
    if (!slider) return;
    const track = slider.querySelector('.possible-univ-track');
    const cards = slider.querySelectorAll('.possible-univ-card');
    const total = cards.length;
    if (!track || !total) return;
    const idx = Math.max(0, Math.min(nextIndex, total - 1));
    slider.dataset.slideIndex = String(idx);
    const cardList = Array.from(cards);
    const target = cardList[idx];
    const x = target ? target.offsetLeft : 0;
    track.style.transition = 'transform .35s cubic-bezier(.22,1,.36,1)';
    track.style.transform = `translate3d(-${x}px,0,0)`;
    slider.parentElement?.querySelectorAll('.slider-indicator [data-action="slideTo"]').forEach((dot, i) => {
      dot.classList.toggle('active', i === idx);
    });
  };

  const initPossibleUnivSliders = () => {
    document.querySelectorAll('.possible-univ-slider').forEach((slider) => {
      if (!slider.dataset.slideIndex) slider.dataset.slideIndex = '0';
      updatePossibleUnivSlider(slider, Number(slider.dataset.slideIndex || 0));
      if (slider.dataset.bound === '1') return;
      slider.dataset.bound = '1';
      slider.addEventListener('touchstart', (e) => {
        possibleUnivTouchStartX = e.touches?.[0]?.clientX || 0;
        possibleUnivDragging = false;
      }, { passive: true });
      slider.addEventListener('touchmove', (e) => {
        const moveX = e.touches?.[0]?.clientX || 0;
        if (Math.abs(moveX - possibleUnivTouchStartX) > 8) {
          possibleUnivDragging = true;
          const track = slider.querySelector('.possible-univ-track');
          if (track) track.style.transition = 'none';
        }
      }, { passive: true });
      slider.addEventListener('touchend', (e) => {
        const endX = e.changedTouches?.[0]?.clientX || 0;
        const delta = endX - possibleUnivTouchStartX;
        const current = Number(slider.dataset.slideIndex || 0);
        const next = Math.abs(delta) < 40 ? current : (delta < 0 ? current + 1 : current - 1);
        updatePossibleUnivSlider(slider, next);
        if (possibleUnivDragging) suppressClickUntilRef.current = Date.now() + 220;
        possibleUnivDragging = false;
      }, { passive: true });
    });
  };
  const addMajorToTargets = (major) => {
    if (!major) return;
    setAnalysisTargetList((prev) => (prev.includes(major) ? prev : [...prev, major]));
    setHomeTargetList((prev) => {
      const next = prev.includes(major) ? prev : [...prev, major];
      setHomeSlideIndex(Math.max(0, next.length - 1));
      return next;
    });
    setTargetMajor(major);
  };
  const syncHomeSliderDomFromCurrentMarkup = () => ensureHomeSliderDomReady();
  const syncScoreJourneyDomFromCurrentMarkup = () => {
    document.querySelectorAll('.score-journey-card').forEach((card) => ensureScoreJourneyDomReady(card));
    initPossibleUnivSliders();
  };
  const waitAndSyncHomeSliderDom = (attempt = 0) => {
    if (!isIOSSafari()) return;
    if (screen !== 'home') return;
    const slider = document.querySelector('.home-kpi-slider');
    const track = document.querySelector('.home-kpi-track');
    const indicators = document.querySelectorAll('.home-kpi-indicator i');
    if (!slider || !track || !indicators.length) {
      if (attempt < 10) requestAnimationFrame(() => waitAndSyncHomeSliderDom(attempt + 1));
      return;
    }
    const activeIndex = Array.from(indicators).findIndex((el) => el.classList.contains('active'));
    const index = activeIndex >= 0 ? activeIndex : 0;
    track.dataset.homeSlideIndex = String(index);
    track.style.setProperty('--home-slide-x', `calc(-${index} * (var(--home-slide-card-width) + var(--home-slide-gap)) + 0px)`);
    track.style.setProperty('--home-slide-transition', 'transform .72s cubic-bezier(.22,1,.36,1)');
    slider.dataset.homeSliderReady = '1';
  };
  const toggleHomeUiDom = (selector, open) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    el.style.display = open ? '' : 'none';
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
    return true;
  };

  const onClick = (e) => {
    lastStableScrollYRef.current = window.scrollY || window.pageYOffset || 0;
    if (Date.now() < suppressClickUntilRef.current) return;
    if (isAnalyzing && screen === 'analysis') return;
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    const isOverlaySelfClick = e.target === actionEl;
    const shouldKeepScroll = ['toggleFaq', 'toggleStudyBreakdown', 'openUniversityModal', 'closeUniversityModal', 'openDrawer', 'closeDrawer', 'openScoreEdit', 'closeScoreEdit'].includes(action);
    if (shouldKeepScroll) keepScrollPosition();
    if (action === 'goto') {
      const target = actionEl.getAttribute('data-target');
      if (screen === 'ob1' && target === 'ob2') {
        const ob1Values = (isIOSSafari() && isObSurveyScreen()) ? readOb1FormValuesFromDom() : {
          obSchoolName,
          obGradeStatus,
          obTrack,
          obGoalText,
          obQuestionText
        };
        if (!String(ob1Values.obGradeStatus || '').trim() || !String(ob1Values.obSchoolName || '').trim() || !String(ob1Values.obTrack || '').trim() || !String(ob1Values.obGoalText || '').trim()) {
          alert('필수 입력 사항을 모두 입력해주세요');
          return;
        }
        if (isIOSSafari() && isObSurveyScreen()) {
          setObSchoolName(ob1Values.obSchoolName);
          setObGradeStatus(ob1Values.obGradeStatus);
          setObTrack(ob1Values.obTrack);
          setObGoalText(ob1Values.obGoalText);
          setObQuestionText(ob1Values.obQuestionText);
        }
      }
      if (screen === 'on1' && target === 'ob1') {
        setOnboardingLoading(true);
        setOnboardingLoadingText('성적 분석중...');
        setTimeout(() => setOnboardingLoadingText('유리한 대학 전형 파악중...'), 2000);
        setTimeout(() => {
          armScrollGuard(1400);
          markStableScrollPosition();
          setOnboardingLoading(false);
          goto('ob1');
          restoreIfUnexpectedTopJump();
        }, 4000);
        return;
      }
      if (screen === 'ob2' && target === 'ob3') {
        if (isInvalidRequiredSelectValue(obExamType)) {
          alert('필수 항목을 모두 선택해주세요');
          return;
        }
        const englishGradeValue = String(document.querySelector('[data-score-key="english_grade"]')?.value || '').trim();
        if (isInvalidRequiredSelectValue(englishGradeValue)) {
          alert('필수 항목을 모두 선택해주세요');
          return;
        }
        const historySelect = document.querySelector('[data-score-key="history_grade"], [data-field="obHistoryType"]');
        const koreanTypeSelect = document.querySelector('[data-field="obKoreanType"]');
        const mathTypeSelect = document.querySelector('[data-field="obMathType"]');
        const inq1SubjectSelect = document.querySelector('[data-field="obInquiry1Subject"], [data-score-key="inquiry1_subject"]');
        const inq2SubjectSelect = document.querySelector('[data-field="obInquiry2Subject"], [data-score-key="inquiry2_subject"]');
        if ((koreanTypeSelect && isInvalidRequiredSelectValue(koreanTypeSelect.value))
          || (mathTypeSelect && isInvalidRequiredSelectValue(mathTypeSelect.value))
          || (historySelect && isInvalidRequiredSelectValue(historySelect.value))
          || (inq1SubjectSelect && isInvalidRequiredSelectValue(inq1SubjectSelect.value))
          || (inq2SubjectSelect && isInvalidRequiredSelectValue(inq2SubjectSelect.value))) {
          alert('필수 항목을 모두 선택해주세요');
          return;
        }
        const getScoreInput = (key) => Number(document.querySelector(`[data-score-key="${key}"]`)?.value || 0);
        const hasAllScores = ['korean_common','korean_elective','math_common','math_elective','english_grade','inquiry1_raw','inquiry2_raw']
          .every((k) => String(document.querySelector(`[data-score-key="${k}"]`)?.value || '').trim() !== '');
        if (!hasAllScores) { alert('필수 입력 사항을 모두 입력해주세요'); return; }
        const ko = getScoreInput('korean_common') + getScoreInput('korean_elective');
        const ma = getScoreInput('math_common') + getScoreInput('math_elective');
        const enGrade = getScoreInput('english_grade');
        const enScore = enGrade ? Math.max(0, Math.round(100 - (enGrade - 1) * 12.5)) : 0;
        const iq1 = getScoreInput('inquiry1_raw');
        const iq2 = getScoreInput('inquiry2_raw');
        if (ko || ma || enScore || iq1 || iq2) setScores((prev)=>({ ...prev, korean: ko || prev.korean, math: ma || prev.math, english: enScore || prev.english, inquiry1: iq1 || prev.inquiry1, inquiry2: iq2 || prev.inquiry2 }));
        const map = getExamScoresMap();
        map[obExamType] = { korean: ko, math: ma, englishGrade: enGrade, english: enScore, inquiry1: iq1, inquiry2: iq2 };
        saveExamScoresMap(map);
        setOb2SkippedNoScore(false);
        goto('ob3');
        return;
      }
      if (screen === 'ob3' && target === 'ob4') {
        if (!Object.values(mbtiAnswers).every(Boolean)) {
          alert('MBTI 검사를 완료해주세요');
          return;
        }
        if (ob2SkippedNoScore) {
          goto('home');
          return;
        }
      }
      if (screen === 'ob4' && target === 'ob5') {
        setOnboardingLoading(true);
        setOnboardingLoadingText('학습 성향 분석중...');
        setTimeout(() => setOnboardingLoadingText('효율적인 공부법 찾는중...'), 1500);
        setTimeout(() => {
          const y = window.scrollY;
          armScrollGuard(1400);
          markStableScrollPosition();
          setOnboardingLoading(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              goto('ob5');
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (y > 0 && window.scrollY === 0) {
                    safeScrollTo({ top: y, left: 0, behavior: 'auto' });
                  }
                  restoreIfUnexpectedTopJump();
                });
              });
            });
          });
        }, 3000);
        return;
      }
      goto(target);
    }
    if (action === 'back') back();
    if (action === 'tab') goto(actionEl.getAttribute('data-tab'));
    if (action === 'selectPlan') {
      const plan = actionEl.getAttribute('data-plan');
      if (isIOSSafari()) {
        if (!plan) return;
        document.body.dataset.selectedPlan = plan;
        document.querySelectorAll('.plan-card, .payment-plan-tabs button').forEach((card) => {
          const key = card.getAttribute('data-plan');
          if (!key) return;
          card.classList.toggle('active', key === plan);
        });
        return;
      }
      setSelectedPlan(plan);
    }
    if (action === 'selectDuration') {
      const durationValue = actionEl.getAttribute('data-duration');
      if (isIOSSafari()) {
        if (!durationValue) return;
        document.body.dataset.selectedDuration = durationValue;
        document.querySelectorAll('.duration-row button').forEach((btn) => {
          btn.classList.toggle('active', btn.getAttribute('data-duration') === durationValue);
        });
        return;
      }
      setDuration(durationValue);
    }
    if (action === 'toggleTarget') preserveY(() => setTargetOpen((v) => !v));
    if (action === 'selectTarget') {
      const major = actionEl.getAttribute('data-target-major');
      preserveScrollAfterStateChange(() => {
        setTargetMajor(major);
        afterSafariViewportStable(() => setTargetOpen(false));
      });
    }
    if (action === 'setAnalysisMode') {
      const mode = actionEl.getAttribute('data-analysis-mode') || 'summary';
      if (isIOSSafari() && screen === 'analysis') {
        const tabs = document.querySelectorAll('.analysis-v2-tab');
        tabs.forEach((tabEl) => {
          tabEl.classList.toggle('active', tabEl.getAttribute('data-analysis-mode') === mode);
        });
        document.body.dataset.analysisMode = mode;
        const summarySection = document.querySelector('.analysis-v2-summary');
        const simulationSection = document.querySelector('.analysis-v2-compare-card');
        if (summarySection && simulationSection) {
          const showSummary = mode === 'summary';
          summarySection.style.display = showSummary ? '' : 'none';
          summarySection.hidden = !showSummary;
          simulationSection.style.display = showSummary ? 'none' : '';
          simulationSection.hidden = showSummary;
          return;
        }
      }
      setAnalysisMode(mode);
    }
    if (action === 'setScoreView') {
      const nextView = actionEl.getAttribute('data-score-view') || 'current';
      if (isIOSSafari()) {
        setScoreCardDom(actionEl, nextView);
        return;
      }
      if (screen === 'ob5') {
        const card = actionEl.closest('.score-journey-card');
        if (!card) return;
        card.querySelectorAll('.score-journey-segment button').forEach((btn) => {
          btn.classList.toggle('active', btn.getAttribute('data-score-view') === nextView);
        });
        const track = card.querySelector('.score-journey-track');
        if (track) {
          track.style.setProperty('--score-slide-x', nextView === 'target' ? '-50%' : '0%');
          track.style.setProperty('--score-slide-transition', 'transform .56s cubic-bezier(.22,.61,.36,1)');
        }
        return;
      }
      keepScrollPosition(700);
      e.stopPropagation();
      setScoreDragOffset(0);
      markStableScrollPosition();
      setActiveScoreView((prev) => {
        if (prev === nextView) return prev;
        setScoreSlideMotion(nextView === 'target' ? 'motion-next' : 'motion-prev');
        return nextView;
      });
    }
    if (action === 'setHomeSlide') {
      const idx = Number(actionEl.getAttribute('data-slide-index'));
      if (Number.isNaN(idx)) return;
      if (screen === 'home' && isIOSSafari()) {
        const slider = document.querySelector('.home-kpi-slider');
        if (slider && slider.dataset.homeSliderReady !== '1') waitAndSyncHomeSliderDom();
      }
      if (screen === 'home') {
        const { activeIndex } = getHomeSliderState();
        const motion = idx > activeIndex ? 'motion-next' : 'motion-prev';
        setHomeSlideDom(idx, motion);
        return;
      }
      setHomeDragOffset(0);
      markStableScrollPosition();
      setHomeSlideIndex((prev) => {
        const next = Math.max(0, Math.min(idx, homeTargets.length));
        if (next === prev) return prev;
        setHomeSlideMotion(next > prev ? 'motion-next' : 'motion-prev');
        return next;
      });
      restoreIfUnexpectedTopJump();
    }
    if (action === 'slidePrev' || action === 'slideNext' || action === 'slideTo') {
      const slider = actionEl.closest('.card')?.querySelector('.possible-univ-slider') || actionEl.closest('.possible-univ-nav')?.previousElementSibling;
      if (!slider) return;
      const current = Number(slider.dataset.slideIndex || 0);
      const next = action === 'slidePrev' ? current - 1 : action === 'slideNext' ? current + 1 : Number(actionEl.getAttribute('data-slide-index') || current);
      updatePossibleUnivSlider(slider, next);
      return;
    }
    if (action === 'openPossibleUnivAnalysis') {
      const major = actionEl.getAttribute('data-target-major');
      if (!major) return;
      if (confirm(`${major} 분석을 보시겠어요?`)) {
        setTargetMajor(major);
        goto('analysis');
        setAnalysisMode('summary');
      }
      return;
    }
    if (action === 'openAnalysisSearch') {
      goto('addUniversity');
      return;
    }
    if (action === 'closeAnalysisSearch') {
      afterSafariViewportStable(() => setAnalysisSearchOpen(false));
      setAnalysisSearchTerm('');
    }
    if (action === 'highlightSimSubject') {
      const subject = actionEl.getAttribute('data-sim-subject');
      if (!subject) return;
      setAnalysisHighlightedSubject(subject);
      setTimeout(() => setAnalysisHighlightedSubject(''), 550);
    }
    if (action === 'simulateBarGain') {
      const major = actionEl.getAttribute('data-target-major');
      if (!major) return;
      setTargetMajor(major);
      setAnalysisBarProjectionTarget(major);
    }
    if (action === 'addAnalysisTarget') {
      const major = actionEl.getAttribute('data-target-major');
      if (!major) return;
      afterSafariViewportStable(() => setUniversityModalOpen(false));
      afterSafariViewportStable(() => setAnalysisSearchOpen(false));
      setAnalysisSearchTerm('');
      setAddingUniversity(true);
      setTimeout(() => {
        addMajorToTargets(major);
        setAddingUniversity(false);
      }, 500);
    }
    if (action === 'addPossibleUniversity') {
      const major = actionEl.getAttribute('data-target-major');
      if (!major) return;
      addMajorToTargets(major);
      return;
    }
    if (action === 'verifySignupEmail') {
      e.preventDefault();
      const form = syncSignupFromDom();
      if (!form.email) { alert('이메일을 입력해주세요.'); return; }
      setSignupEmailSending(true);
      setTimeout(() => {
        setSignupEmailSending(false);
        setSignupEmailCodeSent(true);
        setSignupEmailTimerSeconds(300);
        alert('이메일로 인증번호가 발송되었습니다.');
      }, 600);
      return;
    }
    if (action === 'verifySignupPhone') {
      e.preventDefault();
      const form = syncSignupFromDom();
      if (!form.phone) { alert('전화번호를 입력해주세요.'); return; }
      setSignupPhoneSending(true);
      setTimeout(() => {
        setSignupPhoneSending(false);
        setSignupPhoneCodeSent(true);
        setSignupPhoneTimerSeconds(300);
        alert('인증번호가 발송되었습니다. 5분 이내에 입력해주세요.');
      }, 600);
      return;
    }
    if (action === 'confirmSignupEmailCode') {
      e.preventDefault();
      syncSignupFromDom();
      const code = document.querySelector('[data-field="signupEmailCode"]')?.value ?? '';
      if (code.length >= 4) setSignupEmailVerified(true);
      return;
    }
    if (action === 'confirmSignupPhoneCode') {
      e.preventDefault();
      syncSignupFromDom();
      const code = document.querySelector('[data-field="signupPhoneCode"]')?.value ?? '';
      if (code.length >= 4) setSignupPhoneVerified(true);
      return;
    }
    if (action === 'setSignupGender') {
      setSignupGender(actionEl.getAttribute('data-gender') || 'female');
      return;
    }
    if (action === 'toggleSignupTermsAll') {
      setSignupTermsAll((prev) => {
        const next = !prev;
        setSignupTermsRequired(next);
        return next;
      });
      return;
    }
    if (action === 'openTermsModal') {
      setOpenTermsType(actionEl.getAttribute('data-terms-type') || '');
      return;
    }
    if (action === 'closeTermsModal') {
      setOpenTermsType('');
      return;
    }
    if (action === 'toggleSignupTermsRequired') {
      setSignupTermsRequired((prev) => {
        const next = !prev;
        if (!next) setSignupTermsAll(false);
        return next;
      });
      return;
    }
    if (action === 'removeAnalysisTarget') {
      const major = actionEl.getAttribute('data-target-major');
      if (!major) return;
      if ((homeTargetList || []).length <= 1) { alert('최소 1개 대학은 유지해야 합니다.'); return; }
      const nextAnalysis = (analysisTargetList || []).filter((v) => v !== major);
      const nextHome = (homeTargetList || []).filter((v) => v !== major);
      setAnalysisTargetList(nextAnalysis);
      setHomeTargetList(() => {
        setHomeSlideIndex((idx) => Math.max(0, Math.min(idx, Math.max(0, nextHome.length - 1))));
        return nextHome;
      });
      if (targetMajor === major) {
        const fallback = nextAnalysis[0] || nextHome[0] || analysisRecommended[0] || '';
        setTargetMajor(fallback);
      }
      return;
    }
    if (action === 'openUniversityModal') {
      goto('addUniversity');
      return;
    }
    if (action === 'openAnalysisSearchFromHome') {
      goto('addUniversity');
      return;
    }
    if (action === 'closeUniversityModal') {
      if (!isOverlaySelfClick && actionEl.classList.contains('home-modal-overlay')) return;
      preserveScrollAfterStateChange(() => {
        setUniversityModalOpen(false);
        setAnalysisSearchOpen(false);
      });
      return;
    }
    if (action === 'openPlannerAddPage') goto('plannerAdd');
    if (action === 'openPlannerCalendar') {
      const strip = document.querySelector('.planner-date-strip');
      const left = strip?.scrollLeft || 0;
      preserveY(() => setPlannerCalendarOpen(true));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const nextStrip = document.querySelector('.planner-date-strip');
          if (nextStrip && Math.abs((nextStrip.scrollLeft || 0) - left) > 2) nextStrip.scrollLeft = left;
        });
      });
    }
    if (action === 'closePlannerCalendar') {
      const strip = document.querySelector('.planner-date-strip');
      const left = strip?.scrollLeft || 0;
      afterSafariViewportStable(() => setPlannerCalendarOpen(false));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const nextStrip = document.querySelector('.planner-date-strip');
          if (nextStrip && Math.abs((nextStrip.scrollLeft || 0) - left) > 2) nextStrip.scrollLeft = left;
        });
      });
    }
    if (action === 'selectPlannerDate') {
      const date = actionEl.getAttribute('data-planner-date');
      if (!date) return;
      setSelectedDate(String(date));
      afterSafariViewportStable(() => setPlannerCalendarOpen(false));
      requestAnimationFrame(() => {
        const currentStrip = document.querySelector('.planner-date-strip');
        const selectedBtn = currentStrip?.querySelector(`[data-planner-date="${date}"]`);
        if (currentStrip && selectedBtn) {
          const containerRect = currentStrip.getBoundingClientRect();
          const btnRect = selectedBtn.getBoundingClientRect();
          const currentLeft = currentStrip.scrollLeft || 0;
          const targetLeft = currentLeft + (btnRect.left - containerRect.left) - (currentStrip.clientWidth / 2) + (selectedBtn.clientWidth / 2);
          currentStrip.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
        }
      });
      restoreIfUnexpectedTopJump();
    }
    if (action === 'openPlannerEdit') setPlannerEditIndex(actionEl.getAttribute('data-planner-id'));
    if (action === 'closePlannerEdit') setPlannerEditIndex(null);
    if (action === 'openScoreEdit') { setScoreEditOpen(true); setScoreEditStep(1); }
    if (action === 'saveQualInfo') {
      const ob1Values = (isIOSSafari() && isObSurveyScreen()) ? readOb1FormValuesFromDom() : {
        obSchoolName,
        obGradeStatus,
        obTrack,
        obGoalText,
        obQuestionText
      };
      if (!String(ob1Values.obGradeStatus || '').trim() || !String(ob1Values.obSchoolName || '').trim() || !String(ob1Values.obTrack || '').trim() || !String(ob1Values.obGoalText || '').trim()) {
        alert('필수 입력 사항을 모두 입력해주세요');
        return;
      }
      if (isIOSSafari() && isObSurveyScreen()) {
        setObSchoolName(ob1Values.obSchoolName);
        setObGradeStatus(ob1Values.obGradeStatus);
        setObTrack(ob1Values.obTrack);
        setObGoalText(ob1Values.obGoalText);
        setObQuestionText(ob1Values.obQuestionText);
      }
      const nextQual = { status: ob1Values.obGradeStatus || '', school: ob1Values.obSchoolName || '', stream: ob1Values.obTrack || '', benefits: ob1Values.obGoalText || '', questions: ob1Values.obQuestionText || '' };
      setUser(prev => ({ ...prev, qualitative: nextQual }));
      localStorage.setItem('user', JSON.stringify({ ...(user || {}), qualitative: nextQual }));
      alert('정성조사서가 저장되었습니다.');
    }
    if (action === 'closeScoreEdit') { setScoreEditOpen(false); setScoreEditStep(1); }
    if (action === 'skipOb2WithoutScore') {
      const ok = window.confirm('정확한 분석이 어려울 수 있어요. 그래도 진행할까요?');
      if (!ok) return;
      setOb2SkippedNoScore(true);
      goto('ob3');
      return;
    }
    if (action === 'downloadMbtiReport') {
      const reportText = `StudyCrack MBTI 학습 보고서\n\n진단 결과: ${mbtiResult || '미완료'}\n\n추천 학습 전략:\n- 주간 계획을 먼저 세우고 과목별 우선순위를 정하세요.\n- 취약 과목 1개를 매일 고정 시간에 학습하세요.\n- 주 1회 성취도 점검으로 다음 주 계획을 보정하세요.`;
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mbti-study-report.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    if (action === 'scoreStepPrev') setScoreEditStep((v) => Math.max(1, v - 1));
    if (action === 'scoreStepNext') {
      const read = (name) => (document.querySelector(`[data-field="${name}"]`)?.value ?? '');
      if (scoreEditStep === 1) {
        const common = read('v2e-korean-common');
        const elective = read('v2e-korean-elective');
        setScoreEditState((prev) => ({ ...prev, korean: { ...prev.korean, common, elective } }));
      }
      if (scoreEditStep === 2) {
        const common = read('v2e-math-common');
        const elective = read('v2e-math-elective');
        setScoreEditState((prev) => ({ ...prev, math: { ...prev.math, common, elective } }));
      }
      if (scoreEditStep === 3) {
        const english = read('v2e-english');
        setScoreEditState((prev) => ({ ...prev, english }));
      }
      if (scoreEditStep === 5) {
        const score = read('v2e-inq1-score');
        setScoreEditState((prev) => ({ ...prev, inquiry1: { ...prev.inquiry1, score } }));
      }
      if (scoreEditStep === 6) {
        const score = read('v2e-inq2-score');
        setScoreEditState((prev) => ({ ...prev, inquiry2: { ...prev.inquiry2, score } }));
      }
      const over =
        (scoreEditStep === 1 && (Number(scoreEditState.korean.common || 0) > 76 || Number(scoreEditState.korean.elective || 0) > 24)) ||
        (scoreEditStep === 2 && (Number(scoreEditState.math.common || 0) > 74 || Number(scoreEditState.math.elective || 0) > 26)) ||
        (scoreEditStep === 5 && Number(scoreEditState.inquiry1.score || 0) > 50) ||
        (scoreEditStep === 6 && Number(scoreEditState.inquiry2.score || 0) > 50);
      if (over) { alert('성적을 정확히 입력해주세요'); return; }
      setScoreEditStep((v) => Math.min(6, v + 1));
    }
    if (action === 'saveScoreEdit') {
      if (!scoreExamType || scoreExamType === '선택' || scoreExamType === '선택하세요') {
        alert('필수 항목을 모두 선택해주세요');
        return;
      }
      const read = (name, fallback = '') => (document.querySelector(`[data-field="${name}"]`)?.value ?? fallback);
      const nextCommonKor = read('v2e-korean-common', scoreEditState.korean.common || '');
      const nextElecKor = read('v2e-korean-elective', scoreEditState.korean.elective || '');
      const nextCommonMath = read('v2e-math-common', scoreEditState.math.common || '');
      const nextElecMath = read('v2e-math-elective', scoreEditState.math.elective || '');
      const nextEnglish = read('v2e-english', scoreEditState.english || '');
      const nextHistory = read('v2e-history', scoreEditState.history || '');
      const nextInq1Subject = read('v2e-inq1-subject', scoreEditState.inquiry1.subject || '');
      const nextInq2Subject = read('v2e-inq2-subject', scoreEditState.inquiry2.subject || '');
      const nextInq1 = read('v2e-inq1-score', scoreEditState.inquiry1.score || '');
      const nextInq2 = read('v2e-inq2-score', scoreEditState.inquiry2.score || '');
      setScoreEditState((prev) => ({
        ...prev,
        korean: { ...prev.korean, common: nextCommonKor, elective: nextElecKor },
        math: { ...prev.math, common: nextCommonMath, elective: nextElecMath },
        english: nextEnglish,
        history: nextHistory,
        inquiry1: { ...prev.inquiry1, subject: nextInq1Subject, score: nextInq1 },
        inquiry2: { ...prev.inquiry2, subject: nextInq2Subject, score: nextInq2 }
      }));
      const requiredMissing = !String(nextCommonKor).trim()
        || !String(nextElecKor).trim()
        || !String(nextCommonMath).trim()
        || !String(nextElecMath).trim()
        || isInvalidRequiredSelectValue(nextEnglish)
        || isInvalidRequiredSelectValue(nextHistory)
        || isInvalidRequiredSelectValue(nextInq1Subject)
        || isInvalidRequiredSelectValue(nextInq2Subject)
        || !String(nextInq1).trim()
        || !String(nextInq2).trim();
      if (requiredMissing) {
        alert('필수 입력 사항을 모두 입력해주세요');
        return;
      }
      const nextKo = Number(nextCommonKor || 0) + Number(nextElecKor || 0);
      const nextMa = Number(nextCommonMath || 0) + Number(nextElecMath || 0);
      const nextEnGrade = Number(nextEnglish || 0);
      const nextEnScore = nextEnGrade ? Math.max(0, Math.round(100 - (nextEnGrade - 1) * 12.5)) : 0;
      const nextIq1 = Number(nextInq1 || 0);
      const nextIq2 = Number(nextInq2 || 0);
      setScores((prev) => ({
        ...prev,
        korean: nextKo || prev.korean,
        math: nextMa || prev.math,
        english: nextEnScore || prev.english,
        inquiry1: nextIq1 || prev.inquiry1,
        inquiry2: nextIq2 || prev.inquiry2
      }));
      const map = getExamScoresMap();
      map[scoreExamType] = { korean: nextKo, math: nextMa, englishGrade: nextEnGrade, english: nextEnScore, inquiry1: nextIq1, inquiry2: nextIq2 };
      saveExamScoresMap(map);
      setUser((prevUser)=>({ ...prevUser, quantitative: { ...(prevUser.quantitative||{}), active: { kor: { raw: Number(scoreEditState.korean.common || 0) + Number(scoreEditState.korean.elective || 0) }, math: { raw: Number(scoreEditState.math.common || 0) + Number(scoreEditState.math.elective || 0) }, eng: { grd: Number(scoreEditState.english || 0) }, inq1: { raw: Number(scoreEditState.inquiry1.score || 0) }, inq2: { raw: Number(scoreEditState.inquiry2.score || 0) } } } }));
      setScoreEditOpen(false);
      setScoreEditStep(1);
    }
    if (action === 'applyScoreExam') {
      const vEnglish = document.querySelector('[data-field="v2e-english"]')?.value ?? scoreEditState.english;
      const vHistory = document.querySelector('[data-field="v2e-history"]')?.value ?? scoreEditState.history;
      const vInq1Subject = document.querySelector('[data-field="v2e-inq1-subject"]')?.value ?? scoreEditState.inquiry1.subject;
      const vInq2Subject = document.querySelector('[data-field="v2e-inq2-subject"]')?.value ?? scoreEditState.inquiry2.subject;
      if (isInvalidRequiredSelectValue(vEnglish) || isInvalidRequiredSelectValue(vHistory) || isInvalidRequiredSelectValue(vInq1Subject) || isInvalidRequiredSelectValue(vInq2Subject)) {
        alert('필수 항목을 모두 선택해주세요');
        return;
      }
      if (!scoreExamType || scoreExamType === '선택' || scoreExamType === '선택하세요') {
        alert('필수 항목을 모두 선택해주세요');
        return;
      }
      const map = getExamScoresMap();
      const picked = map[scoreExamType];
      if (!picked) { alert('선택한 시험의 저장된 성적이 없습니다.'); return; }
      setScores((prev) => ({ ...prev, korean: Number(picked.korean||prev.korean), math: Number(picked.math||prev.math), english: Number(picked.english||prev.english), inquiry1: Number(picked.inquiry1||prev.inquiry1), inquiry2: Number(picked.inquiry2||prev.inquiry2) }));
      alert('선택한 시험 성적이 적용되었습니다.');
    }
    if (action === 'toggleNotification') {
      const key = actionEl.getAttribute('data-notify-key');
      setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    }
    if (action === 'toggleFaq') {
      if (isIOSSafari()) {
        const answerEl = actionEl.querySelector('p');
        if (answerEl) {
          const nextOpen = actionEl.classList.contains('active') ? false : true;
          actionEl.classList.toggle('active', nextOpen);
          actionEl.classList.toggle('open', nextOpen);
          actionEl.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
          answerEl.hidden = !nextOpen;
          answerEl.style.display = nextOpen ? '' : 'none';
          return;
        }
      }
      const id = actionEl.getAttribute('data-faq-id');
      setOpenFaq((prev) => (prev === id ? '' : id));
    }
    if (action === 'openLogoutModal') setLogoutModalOpen(true);
    if (action === 'closeLogoutModal') setLogoutModalOpen(false);
    if (action === 'openWithdrawModal') setWithdrawModalOpen(true);
    if (action === 'closeWithdrawModal') {
      setWithdrawModalOpen(false);
      setWithdrawPassword('');
    }
    if (action === 'openMbtiModal') setMbtiModalOpen(true);
    if (action === 'closeMbtiModal') setMbtiModalOpen(false);
    if (action === 'setMbti') {
      const q = actionEl.getAttribute('data-mbti-q');
      const v = actionEl.getAttribute('data-mbti-v');
      setMbtiAnswers((prev) => ({ ...prev, [q]: v }));
    }
    if (action === 'completeMbti') {
      const yesCount = Object.values(mbtiAnswers).filter((v) => ['plan', 'solo', 'weak_first', 'feedback'].includes(v)).length;
      setMbtiResult(yesCount >= 3 ? '전략형 집중러' : '균형형 실행러');
      setMbtiModalOpen(false);
    }
    if (action === 'confirmLogout') {
      setLogoutModalOpen(false);
      setLoggedIn(false);
      setHistory([]);
      goto('authLogin', false);
      window.alert('로그아웃되었습니다');
    }
    if (action === 'confirmWithdraw') {
      if (!withdrawPassword.trim()) {
        window.alert('현재 비밀번호를 입력해주세요.');
        return;
      }
      setWithdrawModalOpen(false);
      setWithdrawPassword('');
      setLoggedIn(false);
      setHistory([]);
      goto('authLogin', false);
      window.alert('회원탈퇴가 완료되었습니다.');
    }
    if (action === 'setObGradeStatus') {
      const nextGrade = actionEl.getAttribute('data-ob-grade') || '고1/2 재학';
      if (isIOSSafari() && isObSurveyScreen()) {
        const schoolEl = document.querySelector('[data-field="obSchoolName"]');
        const goalEl = document.querySelector('[data-field="obGoalText"]');
        const questionEl = document.querySelector('[data-field="obQuestionText"]');
        if (schoolEl) schoolEl.dataset.pendingValue = schoolEl.value;
        if (goalEl) goalEl.dataset.pendingValue = goalEl.value;
        if (questionEl) questionEl.dataset.pendingValue = questionEl.value;
        const gradeEl = document.querySelector('[data-field="obGradeStatus"]');
        if (gradeEl) gradeEl.dataset.pendingValue = nextGrade;
      }
      setObGradeStatus(nextGrade);
    }
    if (action === 'toggleObGed') setObGed((v) => !v);
    if (action === 'openKakaoSupport') window.open('http://pf.kakao.com/_wxjxcgn', '_blank');
    if (action === 'openEmailSupport') window.location.href = 'mailto:contact@studycrack.co.kr';
    if (action === 'openDrawer') {
      preserveScrollAfterStateChange(() => {
        setNotifModalOpen(false);
        setDrawerOpen(true);
      });
      return;
    }
    if (action === 'closeDrawer') {
      if (!isOverlaySelfClick && actionEl.classList.contains('drawer-overlay')) return;
      preserveScrollAfterStateChange(() => {
        setDrawerOpen(false);
      });
      return;
    }
    if (action === 'openNotificationModal') {
      preserveScrollAfterStateChange(() => setNotifModalOpen(true));
      return;
    }
    if (action === 'closeNotificationModal') {
      if (!isOverlaySelfClick && actionEl.classList.contains('home-modal-overlay')) return;
      preserveScrollAfterStateChange(() => setNotifModalOpen(false));
      return;
    }
    if (action === 'openProRequestModal') setProRequestModalOpen(true);
    if (action === 'closeProRequestModal') setProRequestModalOpen(false);
    if (action === 'submitProRequest') {
      if (!proRequestText.trim()) {
        window.alert('요청 사항을 입력해주세요.');
        return;
      }
      window.alert('요청서가 제출되었습니다.');
      setProRequestModalOpen(false);
      setProRequestText('');
    }
    if (action === 'downloadProReport') {
      const pdfPath = actionEl.getAttribute('data-pdf-path') || PRO_ELITE_REPORT_PDF_PATH;
      const fileName = actionEl.getAttribute('data-pdf-name') || 'studycrack-pro-report.pdf';
      const anchor = document.createElement('a');
      anchor.href = pdfPath;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
    if (action === 'drawerGoto') {
      setDrawerOpen(false);
      goto(actionEl.getAttribute('data-target'));
    }
    if (action === 'toggleCoachingMonth') {
      setCoachingMonth((prev) => (prev === '26년 4월' ? '26년 3월' : '26년 4월'));
    }
    if (action === 'downloadCoachingPdf') {
      const pdfPath = actionEl.getAttribute('data-pdf-path');
      if (!pdfPath) {
        window.alert('PDF 다운로드 준비 중입니다.');
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = pdfPath;
      anchor.download = pdfPath.split('/').pop() || 'weekly-feedback.pdf';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
    if (action === 'openCoachingSheet') {
      ensureCoachingSubjectRows();
      setCoachingStep(1);
      setCoachingSheetOpen(true);
    }
    if (action === 'closeCoachingSheet') setCoachingSheetOpen(false);
    if (action === 'addCoachingSubject') {
      const customName = window.prompt('과목명을 입력하세요', '사회문화');
      if (!customName) return;
      const id = `custom-${Date.now()}`;
      setCoachingSubjectRows((prev) => [...prev, { id, subject: customName, detail: '', planned: '', actual: '', removable: true, placeholder: '세부과목 입력' }]);
    }
    if (action === 'removeCoachingSubject') {
      const rowId = actionEl.getAttribute('data-coach-row');
      setCoachingSubjectRows((prev) => prev.filter((row) => row.id !== rowId));
    }
    if (action === 'openPlannerFilePicker') document.querySelector('[data-field="coachPlannerFiles"]')?.click();
    if (action === 'removePlannerPhoto') {
      const idx = Number(actionEl.getAttribute('data-photo-index'));
      setCoachingPlannerFiles((prev) => prev.filter((_, i) => i !== idx));
    }
    if (action === 'setCoachingExamType') setCoachingExamType(actionEl.getAttribute('data-coach-exam'));
    if (action === 'openExamFilePicker') document.querySelector('[data-field="coachExamFiles"]')?.click();
    if (action === 'removeExamPhoto') {
      const idx = Number(actionEl.getAttribute('data-photo-index'));
      setCoachingExamFiles((prev) => prev.filter((_, i) => i !== idx));
    }
    if (action === 'setCoachingTrend') setCoachingTrend(actionEl.getAttribute('data-coach-trend'));
    if (action === 'toggleDropReason') {
      const reason = actionEl.getAttribute('data-drop-reason');
      setCoachingDropReasons((prev) => (prev.includes(reason) ? prev.filter((item) => item !== reason) : [...prev, reason]));
    }
    if (action === 'coachingPrev') {
      if (coachingStep <= 1) return;
      setCoachingStep((prev) => Math.max(1, prev - 1));
    }
    if (action === 'coachingNext') {
      if (coachingStep === 1) syncStep1FromDom();
      if (isIOSSafari() && screen === 'strategy' && coachingStep === 3) {
        const nextScores = {};
        document.querySelectorAll('[data-coach-field]').forEach((input) => {
          const key = input.getAttribute('data-coach-field');
          if (key) nextScores[key] = input.value;
        });
        setCoachingExamScores((prev) => ({ ...prev, ...nextScores }));
      }
      if (coachingStep === 1) {
        const invalid = coachingSubjectRows.some((r) => !String(r.detail || '').trim() || !String(r.planned || '').trim() || !String(r.actual || '').trim());
        if (invalid) { alert('필수 입력 사항을 모두 입력해주세요'); return; }
      }
      if (coachingStep === 2 && coachingPlannerFiles.length === 0) { alert('필수 입력 사항을 모두 입력해주세요'); return; }
      if (coachingStep === 3) {
        const examScoresForValidation = isIOSSafari() && screen === 'strategy'
          ? (() => {
            const values = {};
            document.querySelectorAll('[data-coach-field]').forEach((input) => {
              const key = input.getAttribute('data-coach-field');
              if (key) values[key] = input.value || '';
            });
            return values;
          })()
          : coachingExamScores;
        if (!coachingExamType) { alert('필수 입력 사항을 모두 입력해주세요'); return; }
        if (coachingExamType !== '미응시' && (!String(examScoresForValidation.koreanRaw || '').trim() || !String(examScoresForValidation.mathRaw || '').trim() || !String(examScoresForValidation.englishGrade || '').trim() || !String(examScoresForValidation.inq1Raw || '').trim() || !String(examScoresForValidation.inq2Raw || '').trim())) { alert('필수 입력 사항을 모두 입력해주세요'); return; }
        if (isIOSSafari() && screen === 'strategy') {
          setCoachingExamScores((prev) => ({ ...prev, ...examScoresForValidation }));
        }
      }
      if (coachingStep === 4 && !coachingTrend) { alert('필수 입력 사항을 모두 입력해주세요'); return; }
      if (coachingStep >= 8) {
        setCoachingSheetOpen(false);
        setCoachingSubmitted(true);
        window.alert('코칭 요청이 제출되었습니다.\n튜터 피드백이 도착하면 학습 코칭 페이지에서 확인할 수 있어요.');
        return;
      }
      setCoachingStep((prev) => Math.min(8, prev + 1));
    }
    if (action === 'openStudySubjectSheet') {
      preserveScrollAfterStateChange(() => {
        setNotifModalOpen(false);
        setStudySubjectSheetOnlyPlanned(true);
        setStudySubjectSheetOpen(true);
      });
      return;
    }
    if (action === 'toggleStudyBreakdown') {
      if (isIOSSafari() && screen === 'home') {
        const list = document.querySelector('.home-breakdown-list');
        const toggleBtn = document.querySelector('.home-breakdown-toggle');
        if (list && toggleBtn) {
          const hiddenNow = list.hidden || list.style.display === 'none';
          const nextOpen = hiddenNow;
          list.hidden = !nextOpen;
          list.style.display = nextOpen ? '' : 'none';
          toggleBtn.textContent = nextOpen ? '접기' : '펼쳐보기';
          toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
          return;
        }
      }
      setShowStudyBreakdown((v) => !v);
    }
    if (action === 'toggleBreakdownSubject') {
      const subject = actionEl.getAttribute('data-breakdown-subject') || '';
      setExpandedBreakdownSubject((prev) => (prev === subject ? '' : subject));
    }
    if (action === 'closeStudySubjectSheet') {
      if (!isOverlaySelfClick && actionEl.classList.contains('planner-sheet-overlay')) return;
      preserveScrollAfterStateChange(() => {
        setStudySubjectSheetOnlyPlanned(false);
        setStudySubjectSheetOpen(false);
      });
      return;
    }
    if (action === 'selectStudySubjectCustom') {
      const custom = window.prompt('과목명을 입력하세요', '기타');
      if (!custom) return;
      setActiveStudySubject(custom);
      setActivePlannerItemId('');
      setStudySubjectSheetOpen(false);
      setStudySubjectSheetOnlyPlanned(false);
      setStudyTimerRunning(true);
      studyTimerSecondsRef.current = 0;
      startLiveStudyTimer();
      syncLiveStudyTimerUi(0);
    }
    if (action === 'selectStudySubject') {
      const subject = actionEl.getAttribute('data-study-subject');
      const plannerItemId = actionEl.getAttribute('data-study-item-id') || '';
      if (!subject) return;
      setActiveStudySubject(subject);
      setActivePlannerItemId(plannerItemId);
      setStudySubjectSheetOpen(false);
      setStudySubjectSheetOnlyPlanned(false);
      setStudyTimerRunning(true);
      studyTimerSecondsRef.current = 0;
      startLiveStudyTimer();
      syncLiveStudyTimerUi(0);
    }
    if (action === 'stopStudyTimer') {
      setStudyTimerRunning(false);
      stopLiveStudyTimer();
      const elapsed = studyTimerSecondsRef.current;
      const today = FIXED_TODAY_DATE;
      setStudyRecords((prev) => {
        const idx = prev.findIndex((r) => r.date === today);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = { ...clone[idx], studyTime: clone[idx].studyTime + elapsed };
          return clone;
        }
        return [...prev, { date: today, studyTime: elapsed }];
      });
      if (activeStudySubject) {
        setStudySubjectRecords((prev) => {
          const idx = prev.findIndex((r) => r.date === today);
          if (idx >= 0) {
            const clone = [...prev];
            const oldSubjects = clone[idx].subjects || {};
            clone[idx] = { ...clone[idx], subjects: { ...oldSubjects, [activeStudySubject]: (oldSubjects[activeStudySubject] || 0) + elapsed } };
            return clone;
          }
          return [...prev, { date: today, subjects: { [activeStudySubject]: elapsed } }];
        });
        if (activePlannerItemId) {
          setPlannerItems((prev) => prev.map((item) => (item.id === activePlannerItemId ? { ...item, doneMinutes: (item.doneMinutes || 0) + Math.round(elapsed / 60) } : item)));
        }
      }
      studyTimerSecondsRef.current = 0;
      syncLiveStudyTimerUi(0);
      setActiveStudySubject('');
      setActivePlannerItemId('');
    }
    if (action === 'signupSuccess') syncSignupFromDom();
    if (action === 'loginSuccess' || action === 'signupSuccess' || action === 'ssoSuccess') {
      setLoggedIn(true);
      setHistory([]);
      const completed = localStorage.getItem('studycrack_onboarding_completed') === 'true';
      goto(completed ? 'home' : 'ob1', true);
    }
    if (action === 'completeOnboarding') {
      preserveOB5Scroll(() => {
        localStorage.setItem('studycrack_onboarding_completed', 'true');
        goto('home', false);
      });
    }
    if (action === 'startStandard') {
      preserveOB5Scroll(() => {
        localStorage.setItem('studycrack_onboarding_completed', 'true');
        setSelectedPlan('Standard');
        goto('proIntro');
      });
    }
    if (action === 'retryInit') initializeApp();
    if (action === 'noopModal') return;
    if (action === 'setPlannerSubject') {
      setPlannerDraft((prev) => ({ ...prev, subject: actionEl.getAttribute('data-planner-subject') || '' }));
    }
    if (action === 'setPlannerDuration') setPlannerDraft((prev) => ({ ...prev, durationChoice: actionEl.getAttribute('data-planner-duration') || '' }));
    if (action === 'removePlannerItem') {
      const plannerId = actionEl.getAttribute('data-planner-id');
      if (isIOSSafari() && screen === 'planner') {
        const item = actionEl.closest('.planner-item');
        if (item) {
          item.style.display = 'none';
          document.body.dataset.pendingPlannerDelete = `${document.body.dataset.pendingPlannerDelete || ''},${plannerId}`;
          return;
        }
      }
      setPlannerItems((prev) => prev.filter((item) => item.id !== plannerId));
    }
    if (action === 'togglePlannerDone') {
      const plannerId = actionEl.getAttribute('data-planner-id');
      if (isIOSSafari() && screen === 'planner') {
        const item = actionEl.closest('.planner-item');
        if (item) {
          const nextDone = item.classList.contains('done') ? '0' : '1';
          item.classList.toggle('done', nextDone === '1');
          actionEl.dataset.completed = nextDone;
          actionEl.textContent = nextDone === '1' ? '✓ 완료!' : '✓ 완료';
          return;
        }
      }
      setPlannerItems((prev) => prev.map((item) => (item.id === plannerId ? { ...item, done: !item.done } : item)));
    }
    if (action === 'selectUniversity') {
      setTargetMajor(actionEl.getAttribute('data-target-major'));
      setTargetOpen(false);
      goto('analysis');
    }
    if (action === 'addPlannerFromSheet') {
      const content = plannerContentRef.current.trim();
      const customMinutes = plannerCustomMinutesRef.current.trim();
      const minutes = plannerDraft.durationChoice === 'custom' ? Number(customMinutes) : Number(plannerDraft.durationChoice);
      if (!plannerDraft.subject || !content || !minutes || Number.isNaN(minutes)) return;
      const dot = plannerDraft.subject === '수학' ? 'math' : plannerDraft.subject === '영어' ? 'eng' : plannerDraft.subject === '국어' ? 'kor' : plannerDraft.subject === '기타' ? 'etc' : 'sci';
      setPlannerItems((prev) => [...prev, { id: buildPlannerId(), date: selectedPlannerDate, subject: plannerDraft.subject, content, start: '--:--', end: '--:--', minutes, dot }]);
      plannerContentRef.current = '';
      plannerCustomMinutesRef.current = '';
      setPlannerDraft({ subject: '', content: '', durationChoice: '', customMinutes: '' });
      goto('planner', false);
    }
    if (action === 'savePlannerEdit') {
      if (plannerEditIndex === null) return;
      const subject = document.querySelector('[data-field="plannerEditSubject"]')?.value?.trim();
      const content = document.querySelector('[data-field="plannerEditContent"]')?.value?.trim();
      const minutes = Number(document.querySelector('[data-field="plannerEditMinutes"]')?.value || 0);
      if (!subject || !content || !minutes || !plannerEditItem) return;
      const lowered = subject.toLowerCase();
      const dot = lowered.includes('수') ? 'math' : lowered.includes('영') ? 'eng' : lowered.includes('국') ? 'kor' : lowered.includes('기타') ? 'etc' : 'sci';
      setPlannerItems((prev) => prev.map((item) => (item.id === plannerEditIndex ? { ...item, subject, content, minutes, dot } : item)));
      setPlannerEditIndex(null);
    }
  };

  const onInput = (e) => {
    const scoreKey = e.target.getAttribute('data-score-key');
    if (scoreKey) {
      const raw = String(e.target.value || '');
      if (raw && !/^\d+$/.test(raw)) {
        alert('성적을 정확히 입력해주세요');
        e.target.value = '';
        return;
      }
      const n = Number(raw || 0);
      const maxMap = { korean_common: 76, korean_elective: 24, math_common: 74, math_elective: 26, inquiry1_raw: 50, inquiry2_raw: 50, english_grade: 9 };
      const max = maxMap[scoreKey];
      if (max && n > max) {
        alert('성적을 정확히 입력해주세요');
        e.target.value = String(max);
      }
      return;
    }
    const field = e.target.getAttribute('data-field');
    if (field === 'coachPlannerFiles') {
      const files = Array.from(e.target.files || []);
      if (files.length) setCoachingPlannerFiles((prev) => [...prev, ...files].slice(0, 5));
      e.target.value = '';
      return;
    }
    if (field === 'coachExamFiles') {
      const files = Array.from(e.target.files || []);
      if (files.length) setCoachingExamFiles((prev) => [...prev, ...files]);
      e.target.value = '';
      return;
    }
    if (field === 'coachingMonth') setCoachingMonth(e.target.value);
    if (field === 'proEliteMonth') setProEliteMonth(e.target.value);
    if (field === 'obTrack') {
      if (isIOSSafari() && isObSurveyScreen()) {
        e.target.dataset.pendingValue = e.target.value;
      } else {
        setObTrack(e.target.value);
      }
    }
    if (field === 'scoreExamType') applyScoreExamSelection(e.target.value);
    if (field === 'obExamType') applyObExamSelection(e.target.value);
    restoreIfUnexpectedTopJump();
    const coachAnswer = e.target.getAttribute('data-coach-answer');
    const coachPlan = e.target.getAttribute('data-coach-plan');
    const coachActual = e.target.getAttribute('data-coach-actual');
    if (coachAnswer) {
      const countEl = document.querySelector(`[data-coach-count="${coachAnswer}"]`);
      if (countEl) countEl.textContent = `${e.target.value.length}/200`;
    }
    if (coachPlan || coachActual) {
      const rowId = coachPlan || coachActual;
      const plan = Number(document.querySelector(`[data-coach-plan="${rowId}"]`)?.value || 0);
      const actual = Number(document.querySelector(`[data-coach-actual="${rowId}"]`)?.value || 0);
      const rate = plan > 0 ? Math.round((actual / plan) * 100) : 0;
      const rateEl = document.querySelector(`[data-coach-rate="${rowId}"]`);
      if (rateEl) rateEl.textContent = `달성률 ${Number.isFinite(rate) ? rate : 0}%`;
    }
    if (!field) return;
    if (field === 'plannerContent') {
      plannerContentRef.current = e.target.value;
      return;
    }
    if (field === 'plannerCustomMinutes') {
      plannerCustomMinutesRef.current = e.target.value;
      return;
    }
    if (field === 'signupPassword' || field === 'signupPasswordConfirm') {
      updateSignupPasswordMatchUi();
      return;
    }
  };

  useEffect(() => {
    if (!isIOSSafari()) return;
    if (screen !== 'home') return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        waitAndSyncHomeSliderDom();
      });
    });
  }, [screen]);

  useEffect(() => {
    const startGesture = (target, clientX) => {
      if (typeof clientX !== 'number') return;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) {
        touchTargetRef.current = '';
        touchStartXRef.current = null;
        return;
      }
      if (target?.closest?.('.home-kpi-slider')) {
        if (screen === 'home' && isIOSSafari()) {
          const slider = document.querySelector('.home-kpi-slider');
          if (slider && slider.dataset.homeSliderReady !== '1') waitAndSyncHomeSliderDom();
        }
        touchTargetRef.current = 'home';
        touchStartXRef.current = clientX;
        return;
      }
      if (target?.closest?.('.score-journey-scroll')) {
        touchTargetRef.current = 'score';
        touchStartXRef.current = clientX;
        touchCardRef.current = target.closest('.score-journey-card');
        if (screen === 'ob5' && touchCardRef.current) {
          touchCardRef.current.dataset.dragStartX = String(clientX);
          touchCardRef.current.dataset.dragging = '1';
          const track = touchCardRef.current.querySelector('.score-journey-track');
          if (track) track.style.setProperty('--score-slide-transition', '0s');
        }
        return;
      }
      touchTargetRef.current = '';
      touchStartXRef.current = null;
    };

    const moveGesture = (clientX) => {
      const startX = touchStartXRef.current;
      if (typeof startX !== 'number' || typeof clientX !== 'number') return;
      touchLastXRef.current = clientX;
      const delta = clientX - startX;
      if (touchTargetRef.current === 'home') {
        if (screen === 'home') {
          const { slider, track, activeIndex, total } = getHomeSliderState();
          if (!slider || !track || !total) return;
          const max = total - 1;
          const atFirst = activeIndex === 0;
          const atLast = activeIndex === max;
          const overscrolling = (atFirst && delta > 0) || (atLast && delta < 0);
          const resistance = overscrolling ? 0.35 : 0.92;
          const clamped = Math.max(-118, Math.min(118, delta * resistance));
          track.style.setProperty('--home-slide-x', `calc(-${activeIndex} * (var(--home-slide-card-width) + var(--home-slide-gap)) + ${clamped}px)`);
          track.style.setProperty('--home-slide-transition', '0s');
          return;
        }
        const atFirst = homeSlideIndex === 0;
        const atLast = homeSlideIndex === homeTargets.length;
        const overscrolling = (atFirst && delta > 0) || (atLast && delta < 0);
        const resistance = overscrolling ? 0.35 : 0.92;
        const clamped = Math.max(-118, Math.min(118, delta * resistance));
        setHomeDragOffset(clamped);
      } else if (touchTargetRef.current === 'score') {
        if (screen === 'ob5' || isIOSSafari()) {
          const card = touchCardRef.current;
          if (!card || card.dataset.dragging !== '1') return;
          ensureScoreJourneyDomReady(card);
          const currentView = card.querySelector('.score-journey-segment button.active')?.getAttribute('data-score-view') || 'target';
          const base = currentView === 'target' ? -50 : 0;
          const offsetPct = Math.max(-50, Math.min(50, (delta / Math.max(card.clientWidth || 1, 1)) * 100));
          const track = card.querySelector('.score-journey-track');
          if (track) {
            track.style.setProperty('--score-slide-x', `calc(${base}% + ${offsetPct}%)`);
            track.style.setProperty('--score-slide-transition', '0s');
          }
        } else {
          const clamped = Math.max(-96, Math.min(96, delta));
          setScoreDragOffset(clamped);
        }
      }
    };

    const endGesture = (clientX) => {
      const startX = touchStartXRef.current;
      if (typeof startX !== 'number' || typeof clientX !== 'number') return;
      const delta = clientX - startX;
      touchStartXRef.current = null;
      touchLastXRef.current = null;
      if (!(touchTargetRef.current === 'home' && screen === 'home')) setHomeDragOffset(0);
      if (!(touchTargetRef.current === 'score' && isIOSSafari())) {
        if (screen !== 'ob5') setScoreDragOffset(0);
      }
      const absDelta = Math.abs(delta);
      const swipeThreshold = touchTargetRef.current === 'home' ? 22 : 26;
      if (absDelta < swipeThreshold) {
        touchTargetRef.current = '';
        return;
      }
      armScrollGuard(1000);
      suppressClickUntilRef.current = Date.now() + 260;
      markStableScrollPosition();
      if (touchTargetRef.current === 'home') {
        if (screen === 'home') {
          const { activeIndex, total } = getHomeSliderState();
          const max = total - 1;
          const next = delta < 0 ? Math.min(activeIndex + 1, max) : Math.max(activeIndex - 1, 0);
          const motion = next > activeIndex ? 'motion-next' : 'motion-prev';
          setHomeSlideDom(next, motion);
          touchTargetRef.current = '';
          touchCardRef.current = null;
          restoreIfUnexpectedTopJump();
          return;
        }
        setHomeSlideIndex((prev) => {
          const next = delta < 0 ? Math.min(prev + 1, homeTargets.length) : Math.max(prev - 1, 0);
          if (next === prev) return prev;
          setHomeSlideMotion(next > prev ? 'motion-next' : 'motion-prev');
          return next;
        });
      } else if (touchTargetRef.current === 'score') {
        if (screen === 'ob5' || isIOSSafari()) {
          const card = touchCardRef.current;
          if (card) {
            const threshold = Math.max(40, (card.clientWidth || 0) * 0.15);
            ensureScoreJourneyDomReady(card);
            const currentView = card.querySelector('.score-journey-segment button.active')?.getAttribute('data-score-view') || 'target';
            let nextView = currentView;
            if (delta < -threshold) nextView = 'target';
            if (delta > threshold) nextView = 'current';
            setScoreCardDom(card, nextView);
            delete card.dataset.dragStartX;
            delete card.dataset.dragging;
          }
        } else {
          setActiveScoreView((prev) => {
            const next = delta < 0 ? 'target' : 'current';
            if (next === prev) return prev;
            setScoreSlideMotion(next === 'target' ? 'motion-next' : 'motion-prev');
            return next;
          });
        }
      }
      touchTargetRef.current = '';
      touchCardRef.current = null;
      restoreIfUnexpectedTopJump();
    };

    const onNativeTouchStart = (e) => startGesture(e.target, e.touches?.[0]?.clientX);
    const onNativeTouchMove = (e) => moveGesture(e.touches?.[0]?.clientX);
    const onNativeTouchEnd = (e) => endGesture(e.changedTouches?.[0]?.clientX);
    const onNativeTouchCancel = () => {
      touchStartXRef.current = null;
      touchLastXRef.current = null;
      touchTargetRef.current = '';
      if (screen !== 'home') setHomeDragOffset(0);
      if (!(touchTargetRef.current === 'score' && isIOSSafari())) {
        if (screen !== 'ob5') setScoreDragOffset(0);
      }
      if (touchCardRef.current) {
        delete touchCardRef.current.dataset.dragStartX;
        delete touchCardRef.current.dataset.dragging;
      }
      touchCardRef.current = null;
    };
    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startGesture(e.target, e.clientX);
    };
    const onPointerUp = (e) => endGesture(e.clientX);
    const onPointerMove = (e) => moveGesture(e.clientX);
    const onPointerCancel = () => {
      touchStartXRef.current = null;
      touchLastXRef.current = null;
      touchTargetRef.current = '';
      if (screen !== 'home') setHomeDragOffset(0);
      if (!(touchTargetRef.current === 'score' && isIOSSafari())) {
        if (screen !== 'ob5') setScoreDragOffset(0);
      }
      if (touchCardRef.current) {
        delete touchCardRef.current.dataset.dragStartX;
        delete touchCardRef.current.dataset.dragging;
      }
      touchCardRef.current = null;
    };

    document.addEventListener('touchstart', onNativeTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onNativeTouchMove, { passive: true, capture: true });
    document.addEventListener('touchend', onNativeTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', onNativeTouchCancel, { passive: true, capture: true });
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    return () => {
      document.removeEventListener('touchstart', onNativeTouchStart, true);
      document.removeEventListener('touchmove', onNativeTouchMove, true);
      document.removeEventListener('touchend', onNativeTouchEnd, true);
      document.removeEventListener('touchcancel', onNativeTouchCancel, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
    };
  }, [homeTargets.length, homeSlideIndex, activeScoreView]);

  const onChange = (e) => {
    markStableScrollPosition();
    const field = e.target.getAttribute('data-field');
    const isOb2ScoreField = field === 'obExamType'
      || field === 'obKoreanType'
      || field === 'obMathType'
      || field === 'obHistoryType'
      || field === 'obInquiry1Subject'
      || field === 'obInquiry2Subject'
      || e.target.getAttribute('data-score-key') === 'english_grade';
    if (isIOSSafari() && screen === 'ob2' && isOb2ScoreField) {
      if (ob2SelectSyncTimerRef.current) clearTimeout(ob2SelectSyncTimerRef.current);
      ob2SelectSyncTimerRef.current = setTimeout(() => {
        const examType = String(document.querySelector('[data-field="obExamType"]')?.value || '').trim();
        if (examType) applyObExamSelection(examType);
      }, 300);
      return;
    }
    const isV2eSelectField = field === 'v2e-english' || field === 'v2e-history' || field === 'v2e-inq1-subject' || field === 'v2e-inq2-subject';
    if (isIOSSafari() && scoreEditOpen && isV2eSelectField) {
      if (v2eSelectSyncTimerRef.current) clearTimeout(v2eSelectSyncTimerRef.current);
      v2eSelectSyncTimerRef.current = setTimeout(() => {
        const english = document.querySelector('[data-field="v2e-english"]')?.value;
        const history = document.querySelector('[data-field="v2e-history"]')?.value;
        const inq1 = document.querySelector('[data-field="v2e-inq1-subject"]')?.value;
        const inq2 = document.querySelector('[data-field="v2e-inq2-subject"]')?.value;
        setScoreEditState((prev) => ({
          ...prev,
          english: english ?? prev.english,
          history: history ?? prev.history,
          inquiry1: { ...prev.inquiry1, subject: inq1 ?? prev.inquiry1.subject },
          inquiry2: { ...prev.inquiry2, subject: inq2 ?? prev.inquiry2.subject }
        }));
      }, 300);
      return;
    }
    if (field === 'coachPlannerFiles') {
      const files = Array.from(e.target.files || []);
      if (files.length) setCoachingPlannerFiles((prev) => [...prev, ...files].slice(0, 5));
      e.target.value = '';
      return;
    }
    if (field === 'coachExamFiles') {
      const files = Array.from(e.target.files || []);
      if (files.length) setCoachingExamFiles((prev) => [...prev, ...files]);
      e.target.value = '';
      return;
    }
    if (field === 'scoreExamType') preserveY(() => applyScoreExamSelection(e.target.value));
    if (field === 'obTrack') {
      if (isIOSSafari() && isObSurveyScreen()) {
        e.target.dataset.pendingValue = e.target.value;
      } else {
        preserveY(() => setObTrack(e.target.value));
      }
    }
    if (field === 'obExamType') preserveY(() => applyObExamSelection(e.target.value));
    if (field === 'analysisTargetMajor' || field === 'targetMajor') {
      const value = e.target.value;
      if (value === '__add_university__') {
        goto('addUniversity');
        return;
      }
      preserveScrollAfterStateChange(() => {
        if (value) setTargetMajor(value);
      });
      return;
    }
    if (isV2eSelectField) {
      const value = e.target.value;
      preserveScrollAfterStateChange(() => {
        if (field === 'v2e-english') setScoreEditState((prev) => ({ ...prev, english: value }));
        if (field === 'v2e-history') setScoreEditState((prev) => ({ ...prev, history: value }));
        if (field === 'v2e-inq1-subject') setScoreEditState((prev) => ({ ...prev, inquiry1: { ...prev.inquiry1, subject: value } }));
        if (field === 'v2e-inq2-subject') setScoreEditState((prev) => ({ ...prev, inquiry2: { ...prev.inquiry2, subject: value } }));
      });
      return;
    }
    restoreIfUnexpectedTopJump();
  };
  const onBlur = (e) => {
    markStableScrollPosition();
    const field = e.target.getAttribute('data-field');
    const coachAnswer = e.target.getAttribute('data-coach-answer');
    if (coachAnswer) {
      const value = e.target.value.slice(0, 200);
      setCoachingAnswers((prev) => ({ ...prev, [coachAnswer]: value }));
    }
    const coachDetail = e.target.getAttribute('data-coach-detail');
    const coachPlan = e.target.getAttribute('data-coach-plan');
    const coachActual = e.target.getAttribute('data-coach-actual');
    if (coachDetail || coachPlan || coachActual) {
      const dirtyId = coachDetail || coachPlan || coachActual;
      if (dirtyId) coachingDirtyRowsRef.current[dirtyId] = true;
    }
    const coachField = e.target.getAttribute('data-coach-field');
    if (coachField) {
      if (isIOSSafari() && screen === 'strategy') {
        e.target.dataset.pendingValue = e.target.value;
      } else {
        setCoachingExamScores((prev) => ({ ...prev, [coachField]: e.target.value }));
      }
    }
    if (coachDetail || coachPlan || coachActual) {
      const rowId = coachDetail || coachPlan || coachActual;
      setCoachingSubjectRows((prev) => prev.map((row) => row.id === rowId
        ? { ...row, detail: document.querySelector(`[data-coach-detail="${rowId}"]`)?.value || row.detail, planned: document.querySelector(`[data-coach-plan="${rowId}"]`)?.value || row.planned, actual: document.querySelector(`[data-coach-actual="${rowId}"]`)?.value || row.actual }
        : row));
    }
    if (!field) return;
    const value = e.target.value;
    if (field.startsWith('score-')) {
      const subject = field.replace('score-', '');
      setScores((prev) => ({ ...prev, [subject]: Number(value) || 0 }));
    }
    if (field === 'strongSubject') setStrongSubject(value);
    if (field === 'weakSubject') setWeakSubject(value);
    if (field === 'studyHours') setStudyHours(value);
    if (field === 'studyDifficulty') setStudyDifficulty(value);
    if (field === 'proRequestText') setProRequestText(value);
    if (field === 'loginEmail') setLoginEmail(value);
    if (field === 'loginPassword') setLoginPassword(value);
    if (field === 'withdrawPassword') setWithdrawPassword(value);
    if (field === 'signupName') setSignupName(value);
    if (field === 'signupEmail') setSignupEmail(value);
    if (field === 'signupPhone') setSignupPhone(value);
    if (field === 'signupBirth') setSignupBirth(value);
    if (field === 'signupEmailCode') setSignupEmailCode(value);
    if (field === 'signupPhoneCode') setSignupPhoneCode(value);
    if (field === 'signupPassword') setSignupPassword(value);
    if (field === 'signupPasswordConfirm') setSignupPasswordConfirm(value);
    if (field === 'analysisSearchTerm') setAnalysisSearchTerm(value);
    if (field === 'analysisTargetMajor') {
      if (value === '__add_university__') { goto('addUniversity'); return; }
      if (value) setTargetMajor(value);
    }
    if (field === 'obSchoolName') {
      if (isIOSSafari() && isObSurveyScreen()) e.target.dataset.pendingValue = value;
      else setObSchoolName(value);
    }
    if (field === 'obGradeStatus') {
      if (isIOSSafari() && isObSurveyScreen()) e.target.dataset.pendingValue = value;
      else setObGradeStatus(value);
    }
    if (field === 'obTrack') {
      if (isIOSSafari() && isObSurveyScreen()) e.target.dataset.pendingValue = value;
      else setObTrack(value);
    }
    if (field === 'obGoalText') {
      if (isIOSSafari() && isObSurveyScreen()) e.target.dataset.pendingValue = value;
      else setObGoalText(value);
    }
    if (field === 'obQuestionText') {
      if (isIOSSafari() && isObSurveyScreen()) e.target.dataset.pendingValue = value;
      else setObQuestionText(value);
    }
    if (field === 'v2e-english' || field === 'v2e-history' || field === 'v2e-inq1-subject' || field === 'v2e-inq2-subject') {
      preserveScrollAfterStateChange(() => {
        if (field === 'v2e-english') setScoreEditState((prev) => ({ ...prev, english: value }));
        if (field === 'v2e-history') setScoreEditState((prev) => ({ ...prev, history: value }));
        if (field === 'v2e-inq1-subject') setScoreEditState((prev) => ({ ...prev, inquiry1: { ...prev.inquiry1, subject: value } }));
        if (field === 'v2e-inq2-subject') setScoreEditState((prev) => ({ ...prev, inquiry2: { ...prev.inquiry2, subject: value } }));
      });
      return;
    }
    if (e.target && e.target.tagName === 'SELECT') return;
    if (field && field.startsWith('v2-')) {
      const [, subject, key] = field.split('-');
      let normalizedValue = value;
      const valueNum = Number(value);
      const maxMap = { 'korean-common': 76, 'korean-elective': 24, 'math-common': 74, 'math-elective': 26, 'inq1-score': 50, 'inq2-score': 50 };
      const mk = `${subject}-${key}`;
      if (maxMap[mk] && valueNum > maxMap[mk]) { alert('성적을 정확히 입력해주세요'); normalizedValue = String(maxMap[mk]); e.target.value = normalizedValue; }
      if (subject === 'english' || subject === 'history') setScoreState((prev) => ({ ...prev, [subject]: normalizedValue }));
      if (subject === 'korean' || subject === 'math') setScoreState((prev) => ({ ...prev, [subject]: { ...prev[subject], [key === 'type' ? 'type' : key === 'common' ? 'common' : 'elective']: normalizedValue } }));
      if (subject === 'inq1' || subject === 'inq2') setScoreState((prev) => ({ ...prev, [subject === 'inq1' ? 'inquiry1' : 'inquiry2']: { ...prev[subject === 'inq1' ? 'inquiry1' : 'inquiry2'], [key === 'subject' ? 'subject' : 'score']: normalizedValue } }));
    }
    if (field && field.startsWith('v2e-')) {
      const [, subject, key] = field.split('-');
      let normalizedValue = value;
      const valueNum = Number(value);
      const maxMap = { 'korean-common': 76, 'korean-elective': 24, 'math-common': 74, 'math-elective': 26, 'inq1-score': 50, 'inq2-score': 50 };
      const mk = `${subject}-${key}`;
      if (maxMap[mk] && valueNum > maxMap[mk]) { alert('성적을 정확히 입력해주세요'); normalizedValue = String(maxMap[mk]); e.target.value = normalizedValue; }
      if (subject === 'english' || subject === 'history') setScoreEditState((prev) => ({ ...prev, [subject]: normalizedValue }));
      if (subject === 'korean' || subject === 'math') setScoreEditState((prev) => ({ ...prev, [subject]: { ...prev[subject], [key === 'type' ? 'type' : key === 'common' ? 'common' : 'elective']: normalizedValue } }));
      if (subject === 'inq1' || subject === 'inq2') setScoreEditState((prev) => ({ ...prev, [subject === 'inq1' ? 'inquiry1' : 'inquiry2']: { ...prev[subject === 'inq1' ? 'inquiry1' : 'inquiry2'], [key === 'subject' ? 'subject' : 'score']: normalizedValue } }));
    }
    restoreIfUnexpectedTopJump();
  };

  const loadingOverlayUi = `<div class="loading-overlay"><div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><section class="app-loading-hero app-loading-poster anchor-volatile ${loadingFadeOut ? 'is-fade-out' : ''}"><img class="app-loading-poster-img" src="./assets/images/IMG_3020.png" alt="스터디크랙 로딩 이미지"/><div class="app-loading-progress"><div class="app-loading-bar"><i></i></div><p class="app-loading-label">LOADING...</p></div></section></div></div></div></div>`;
  const fallbackUi = `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="center init-loading"><h3>데이터를 불러오지 못했습니다.</h3><p class="sub">다시 시도해주세요.</p><button class="btn btn-primary" data-action="retryInit">다시 시도</button></div></div></div></div>`;
  const preAuthAllowedScreens = ['splash', 'authLogin', 'authSignup', 'authFindId', 'authFindPw', 'on1', 'on2', 'on3'];
  const renderedBase = error ? fallbackUi : !loggedIn && !preAuthAllowedScreens.includes(screen) ? screens.on1 : current;
  const analysisOverlay = isAnalyzing && screen === 'analysis'
    ? `<div class="global-loading-overlay"><div class="global-loading-card"><div class="loading-dots"><i></i><i></i><i></i></div><b>분석중입니다</b><p>잠시만 기다려주세요</p></div></div>`
    : '';
  const onboardingOverlay = onboardingLoading
    ? `<div class="global-loading-overlay"><div class="global-loading-card"><img src="${CRACKY_SRC}" alt="크랙이" class="global-loading-char"/><div class="loading-dots"><i></i><i></i><i></i></div><b>${onboardingLoadingText}</b><p>잠시만 기다려주세요</p></div></div>`
    : '';
  const addingUniversityOverlay = addingUniversity
    ? `<div class="global-loading-overlay"><div class="global-loading-card"><div class="loading-dots"><i></i><i></i><i></i></div><b>추가중입니다.</b><p>잠시만 기다려주세요</p></div></div>`
    : '';
  const rendered = `${designV2StyleTag}${renderedBase}${analysisOverlay}${onboardingOverlay}${addingUniversityOverlay}${loading ? loadingOverlayUi : ''}`;


  return <div className="ios-scroll-root" onClick={onClick} onInput={onInput} onChange={onChange} onBlur={onBlur} dangerouslySetInnerHTML={{ __html: rendered }} />;

}

const rootElement = document.getElementById('root');
initialScrollY = window.scrollY || window.pageYOffset || 0;
if (!rootElement) {
  console.error('[APP_INIT_ERROR]', new Error('root element #root not found'));
} else if (!window.ReactDOM || typeof window.ReactDOM.createRoot !== 'function') {
  console.error('[APP_INIT_ERROR]', new Error('ReactDOM.createRoot is unavailable'));
  rootElement.innerHTML = HOME_FALLBACK_HTML;
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<AppErrorBoundary><App /></AppErrorBoundary>);
  } catch (e) {
    console.error('[APP_INIT_ERROR]', e);
    rootElement.innerHTML = `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="center init-loading"><h3>앱을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.</h3></div></div></div></div>`;
  }
}
