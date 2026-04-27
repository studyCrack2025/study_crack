const { useState, useEffect, useRef } = React;

const CRACKY_SRC = './assets/images/3A1D897F-252E-4096-AEF2-C4FA7CA6689D.png';
const ONBOARDING_LOGO_SRC = './assets/images/og-image.jpg';
const STUDYCRACK_LOGO_SRC = './assets/images/studycrack_logo_wo_bg.png';
const HOME_FALLBACK_HTML = `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="center init-loading"><h3>스터디크랙 홈</h3><p class="sub">앱을 불러왔어요. 계속 이용해 주세요.</p></div></div></div></div>`;
const DEFAULT_USER = { name: '김지민', targetUniversity: '연세대학교 경영학과', plan: 'Pro' };
const DEFAULT_SCORES = { korean: 82, math: 68, english: 77, inquiry1: 70, inquiry2: 66 };
const DEFAULT_NOTIFICATIONS = { planner: true, weekly: true, report: true, billing: true };
const DEFAULT_PLANNER_ITEMS = [
  { subject: '수학', content: '개념 학습', start: '10:00', end: '12:00', minutes: 120, dot: 'math' },
  { subject: '영어', content: '독해 문제 풀이', start: '13:00', end: '14:30', minutes: 90, dot: 'eng' },
  { subject: '탐구', content: '실전문제', start: '15:00', end: '17:00', minutes: 120, dot: 'sci' },
  { subject: '수학', content: '오답 풀이', start: '19:00', end: '22:00', minutes: 180, dot: 'math' }
];
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

const resolveAssetPath = async (path, fallback) => {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok ? path : fallback;
  } catch (_) {
    return fallback;
  }
};
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
  const [error, setError] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedUniversityIndex, setSelectedUniversityIndex] = useState(0);
  const [user, setUser] = useState(DEFAULT_USER);
  const [selectedPlan, setSelectedPlan] = useState(DEFAULT_USER.plan);
  const [duration, setDuration] = useState('4주');
  const [targetMajor, setTargetMajor] = useState(DEFAULT_USER.targetUniversity);
  const [targetOpen, setTargetOpen] = useState(false);
  const [analysisTargetList, setAnalysisTargetList] = useState(['연세대학교 경영학과', '고려대학교 경영대학', '강서대학교 G2빅데이터경영학과']);
  const [analysisSearchOpen, setAnalysisSearchOpen] = useState(false);
  const [analysisSearchTerm, setAnalysisSearchTerm] = useState('');
  const [analysisMode, setAnalysisMode] = useState('summary');
  const [analysisEtaStage, setAnalysisEtaStage] = useState(1);
  const [analysisHighlightedSubject, setAnalysisHighlightedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState('14');
  const [plannerCalendarOpen, setPlannerCalendarOpen] = useState(false);
  const [universityModalOpen, setUniversityModalOpen] = useState(false);
  const [plannerAddModalOpen, setPlannerAddModalOpen] = useState(false);
  const [plannerSubject, setPlannerSubject] = useState('');
  const [plannerContent, setPlannerContent] = useState('');
  const [plannerDurationChoice, setPlannerDurationChoice] = useState('');
  const [plannerCustomMinutes, setPlannerCustomMinutes] = useState('');
  const [plannerStart, setPlannerStart] = useState('');
  const [plannerEnd, setPlannerEnd] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [mbtiModalOpen, setMbtiModalOpen] = useState(false);
  const [mbtiAnswers, setMbtiAnswers] = useState({ q1: '', q2: '', q3: '', q4: '' });
  const [mbtiResult, setMbtiResult] = useState('');
  const [strongSubject, setStrongSubject] = useState('');
  const [weakSubject, setWeakSubject] = useState('');
  const [studyHours, setStudyHours] = useState('');
  const [studyDifficulty, setStudyDifficulty] = useState('');
  const [showDurationCard, setShowDurationCard] = useState(false);
  const [scoreEditOpen, setScoreEditOpen] = useState(false);
  const [scoreEditStep, setScoreEditStep] = useState(1);
  const [scores, setScores] = useState(DEFAULT_SCORES);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [openFaq, setOpenFaq] = useState('');
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [plannerItems, setPlannerItems] = useState(DEFAULT_PLANNER_ITEMS);
  const [plannerEditIndex, setPlannerEditIndex] = useState(null);
  const [studyRecords, setStudyRecords] = useState(() => safeParse('studyRecords', []));
  const [studySubjectRecords, setStudySubjectRecords] = useState(() => safeParse('studySubjectRecords', []));
  const [studyTimerRunning, setStudyTimerRunning] = useState(false);
  const studyTimerSecondsRef = useRef(0);
  const studyTimerIntervalRef = useRef(null);
  const [activeStudySubject, setActiveStudySubject] = useState('');
  const [studySubjectSheetOpen, setStudySubjectSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [coachingSubmitted, setCoachingSubmitted] = useState(false);
  const [coachingSheetOpen, setCoachingSheetOpen] = useState(false);
  const [coachingStep, setCoachingStep] = useState(1);
  const [coachingMonth, setCoachingMonth] = useState('26년 4월');
  const [coachingSubjectRows, setCoachingSubjectRows] = useState([]);
  const [coachingPlannerPhotos, setCoachingPlannerPhotos] = useState([]);
  const [coachingExamType, setCoachingExamType] = useState('');
  const [coachingExamPhotos, setCoachingExamPhotos] = useState([]);
  const [coachingExamScores, setCoachingExamScores] = useState({});
  const [coachingTrend, setCoachingTrend] = useState('');
  const [coachingDropReasons, setCoachingDropReasons] = useState([]);
  const [coachingAnswers, setCoachingAnswers] = useState({ step4Reason: '', step5: '', step6: '', step7: '', step8: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
  const [obExamType, setObExamType] = useState('3월 학평');
  const [obScoreInputs, setObScoreInputs] = useState({});

  const goto = (next, addHistory = true) => {
    if (addHistory && screen !== next) setHistory((h) => [...h, screen]);
    setScreen(next);
    if (['home', 'analysis', 'strategy', 'planner', 'my'].includes(next)) setTab(next);
  };

  const back = () => {
    if (!history.length) return goto('home', false);
    const clone = [...history];
    const prev = clone.pop();
    setHistory(clone);
    setScreen(prev);
  };

  useEffect(() => {
    if (screen === 'splash') {
      const t = setTimeout(() => goto('on1'), 900);
      return () => clearTimeout(t);
    }
  }, [screen]);

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
    const t = setTimeout(() => setIsAnalyzing(false), 2000);
    return () => clearTimeout(t);
  }, [screen, targetMajor]);

  const initializeApp = async () => {
    let fallbackTimer;
    try {
      console.log('[APP_INIT_START]');
      setLoading(true);
      setError(false);
      fallbackTimer = setTimeout(() => {
        setLoading(false);
        setScreen('authLogin');
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
      setPlannerItems(Array.isArray(savedItems) ? savedItems : DEFAULT_PLANNER_ITEMS);
      setScores({ ...DEFAULT_SCORES, ...(savedScore || {}) });
      setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(savedNotifications || {}) });

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('init-timeout')), 2500));
      const crackySrc = await resolveAssetPath(CRACKY_SRC, './assets/images/studycrack_logo_wo_bg.png');
      const onboardingLogoSrc = await resolveAssetPath(ONBOARDING_LOGO_SRC, './assets/images/studycrack_logo_wo_bg.png');
      window.__studycrackAssetSrc = { crackySrc, onboardingLogoSrc };
      await Promise.race([fetch(onboardingLogoSrc), timeoutPromise]).catch(() => null);
      await resolveAssetPath('./assets/76220C96-DE85-4148-A6AC-7BD5881821A0.png', null);
      await resolveAssetPath('./assets/IMG_2648.jpeg', null);

      setScreen('authLogin');
      console.log('[APP_INIT_SUCCESS]');
    } catch (e) {
      console.error('[APP_INIT_ERROR]', e);
      setError(true);
      setScreen('authLogin');
    } finally {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

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

  useEffect(() => {
    if (screen !== 'ob3') return undefined;
    setShowDurationCard(false);
    const t = setTimeout(() => setShowDurationCard(true), 1500);
    return () => clearTimeout(t);
  }, [screen]);

  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector('.app-shell .app-content');
      if (el) el.scrollTop = 0;
    }, 0);
    return () => clearTimeout(t);
  }, [screen]);

  const appbar = (title, showBack) => `<div class="appbar">${showBack ? '<button class="back-btn" data-action="back">←</button>' : '<div style="width:36px"></div>'}<div class="title">${title}</div></div>`;
  const tabBtn = (k, label, iconName) => `<button class="${tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}">${i(iconName, tab===k)}<span>${label}</span></button>`;
  const tabbarDimmed = Boolean(
    coachingSheetOpen
    || studySubjectSheetOpen
    || plannerAddModalOpen
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
      score: 250, verdict: '초안정', verdictColor: '#22C55E', aiGrade: '초안정',
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
  const analysisSelected = analysisProfiles[targetMajor] || analysisProfiles['연세대학교 경영학과'];
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
  const analysisSimMax = Math.max(...analysisSelected.sim.map(([, gain]) => Number(String(gain).replace(/[^0-9.]/g, '')) || 0), 1);
  const onboardingProgress = (step) => `<div class="ob-progress"><span>${step}/3</span><div class="ob-dots"><i class="${step>=1?'active':''}"></i><i class="${step>=2?'active':''}"></i><i class="${step>=3?'active':''}"></i></div></div>`;
  const mbtiDone = Object.values(mbtiAnswers).every(Boolean);
  const gaugeTotal = 250;
  const gaugeCurrent = 86;
  const gaugeTarget = 120;
  const gaugePass = 100;
  const gaugeSafe = 150;
  const gaugeCurrentPct = Math.min((gaugeCurrent / gaugeTotal) * 100, 100);
  const gaugeTargetPct = Math.min((gaugeTarget / gaugeTotal) * 100, 100);
  const gaugePassPct = (gaugePass / gaugeTotal) * 100;
  const gaugeSafePct = (gaugeSafe / gaugeTotal) * 100;
  const totalMinutes = plannerItems.reduce((acc, item) => acc + item.minutes, 0);
  const totalHour = Math.floor(totalMinutes / 60);
  const totalMinute = totalMinutes % 60;
  const plannerWeekDates = ['12', '13', '14', '15', '16', '17', '18'];
  const plannerItemsByDate = {
    '12': plannerItems.slice(0, 2),
    '13': plannerItems.slice(1, 3),
    '14': plannerItems,
    '15': plannerItems.slice(0, Math.max(plannerItems.length - 1, 1)),
    '16': plannerItems.slice(0, 1),
    '17': plannerItems.slice(1, 2),
    '18': []
  };
  const plannerViewItems = plannerItemsByDate[selectedDate] || [];
  const plannerViewMinutes = plannerViewItems.reduce((acc, item) => acc + (item.minutes || 0), 0);
  const plannerViewHour = Math.floor(plannerViewMinutes / 60);
  const plannerViewMinute = plannerViewMinutes % 60;
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
  const canSubmitPlanner = Boolean(plannerSubject && plannerDurationChoice);
  const inquiryOptions = `<optgroup label="사회탐구"><option value="">과목 선택</option><option>생활과 윤리</option><option>윤리와 사상</option><option>한국지리</option><option>세계지리</option><option>동아시아사</option><option>세계사</option><option>경제</option><option>정치와 법</option><option>사회·문화</option></optgroup><optgroup label="과학탐구"><option>물리학</option><option>화학</option><option>생명과학</option><option>지구과학</option></optgroup>`;
  const ScoreLine = (title, left, mid, right = '') => `<div class="v2-score-line"><span>${title}</span>${left}${mid}${right}</div>`;
  const OnboardingStep1Full = () => `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="onboarding-screen on-form-screen">
    <img src="${ONBOARDING_LOGO_SRC}" class="onboarding-logo logo" alt="StudyCrack 로고"/>
    <div class="onboarding-copy"><h2>학생 현황 및 진로 설계</h2><p>정성/정량 정보를 모두 입력해 주세요.</p></div>
    <div class="card on-form-card"><h4>성적 입력</h4>
      <div class="v2-score-scroll">
        ${ScoreLine('국어', `<select class="planner-input" data-field="v2-korean-type"><option value="">선택과목</option><option value="화법과작문" ${scoreState.korean.type==='화법과작문'?'selected':''}>화법과작문</option><option value="언어와매체" ${scoreState.korean.type==='언어와매체'?'selected':''}>언어와매체</option></select>`, `<input class="planner-input" data-field="v2-korean-common" value="${scoreState.korean.common}" placeholder="공통 점수" type="number"/>`, `<input class="planner-input" data-field="v2-korean-elective" value="${scoreState.korean.elective}" placeholder="선택 점수" type="number"/>`)}
        ${ScoreLine('수학', `<select class="planner-input" data-field="v2-math-type"><option value="">선택과목</option><option value="확률과통계" ${scoreState.math.type==='확률과통계'?'selected':''}>확률과통계</option><option value="미적분" ${scoreState.math.type==='미적분'?'selected':''}>미적분</option><option value="기하" ${scoreState.math.type==='기하'?'selected':''}>기하</option></select>`, `<input class="planner-input" data-field="v2-math-common" value="${scoreState.math.common}" placeholder="공통 점수" type="number"/>`, `<input class="planner-input" data-field="v2-math-elective" value="${scoreState.math.elective}" placeholder="선택 점수" type="number"/>`)}
        ${ScoreLine('영어', `<select class="planner-input" data-field="v2-english"><option value="">등급 선택</option>${[1,2,3,4,5,6,7,8,9].map((n)=>`<option value="${n}" ${String(scoreState.english)===String(n)?'selected':''}>${n}등급</option>`).join('')}</select>`, `<span class="v2-fill"></span>`)}
        ${ScoreLine('한국사', `<select class="planner-input" data-field="v2-history"><option value="">등급 선택</option>${[1,2,3,4,5,6,7,8,9].map((n)=>`<option value="${n}" ${String(scoreState.history)===String(n)?'selected':''}>${n}등급</option>`).join('')}</select>`, `<span class="v2-fill"></span>`)}
        ${ScoreLine('탐구1', `<select class="planner-input" data-field="v2-inq1-subject">${inquiryOptions}</select>`, `<input class="planner-input" data-field="v2-inq1-score" value="${scoreState.inquiry1.score}" placeholder="원점수" type="number"/>`)}
        ${ScoreLine('탐구2', `<select class="planner-input" data-field="v2-inq2-subject">${inquiryOptions}</select>`, `<input class="planner-input" data-field="v2-inq2-score" value="${scoreState.inquiry2.score}" placeholder="원점수" type="number"/>`)}
      </div>
    </div><div class="onboarding-footer"><div class="page-indicator"><i class="active"></i><i></i><i></i></div><button class="onboarding-next" data-action="goto" data-target="on2">다음</button></div>
  </div></div></div>`;
  const ScoreEditModalV2 = () => {
    const step = scoreEditStep;
    const preview = `<div class="on-dummy-result"><b>표준점수 ${100 + step * 4}</b><b>백분위 ${82 + step * 2}</b><b>등급 ${Math.max(1, 4 - Math.floor(step/2))}</b></div>`;
    const body = step === 1
      ? `<h4>국어</h4><select class="planner-input" data-field="v2e-korean-type"><option value="화법과작문" ${scoreEditState.korean.type==='화법과작문'?'selected':''}>화법과작문</option><option value="언어와매체" ${scoreEditState.korean.type==='언어와매체'?'selected':''}>언어와매체</option></select><input class="planner-input" data-field="v2e-korean-common" value="${scoreEditState.korean.common}" type="number" placeholder="공통 원점수"/><input class="planner-input" data-field="v2e-korean-elective" value="${scoreEditState.korean.elective}" type="number" placeholder="선택 원점수"/>${preview}`
      : step === 2
        ? `<h4>수학</h4><select class="planner-input" data-field="v2e-math-type"><option value="확률과통계" ${scoreEditState.math.type==='확률과통계'?'selected':''}>확률과통계</option><option value="미적분" ${scoreEditState.math.type==='미적분'?'selected':''}>미적분</option><option value="기하" ${scoreEditState.math.type==='기하'?'selected':''}>기하</option></select><input class="planner-input" data-field="v2e-math-common" value="${scoreEditState.math.common}" type="number" placeholder="공통 원점수"/><input class="planner-input" data-field="v2e-math-elective" value="${scoreEditState.math.elective}" type="number" placeholder="선택 원점수"/>${preview}`
        : step === 3
          ? `<h4>영어</h4><select class="planner-input" data-field="v2e-english"><option value="">등급 선택</option>${[1,2,3,4,5,6,7,8,9].map((n)=>`<option value="${n}" ${String(scoreEditState.english)===String(n)?'selected':''}>${n}등급</option>`).join('')}</select>${preview}`
          : step === 4
            ? `<h4>한국사</h4><select class="planner-input" data-field="v2e-history"><option value="">등급 선택</option>${[1,2,3,4,5,6,7,8,9].map((n)=>`<option value="${n}" ${String(scoreEditState.history)===String(n)?'selected':''}>${n}등급</option>`).join('')}</select>${preview}`
            : step === 5
              ? `<h4>탐구1</h4><select class="planner-input" data-field="v2e-inq1-subject">${inquiryOptions}</select><input class="planner-input" data-field="v2e-inq1-score" value="${scoreEditState.inquiry1.score}" type="number" placeholder="원점수"/>${preview}`
              : `<h4>탐구2</h4><select class="planner-input" data-field="v2e-inq2-subject">${inquiryOptions}</select><input class="planner-input" data-field="v2e-inq2-score" value="${scoreEditState.inquiry2.score}" type="number" placeholder="원점수"/>${preview}`;
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

  const homeTargets = targetOptions.slice(0, 3).map((major) => ({ major, ...universityProfiles[major] }));
  const scoreList = Object.entries(SCORE_LABELS)
    .map(([key, label]) => `<div class="score-info-row"><span>${label}</span><strong>${Number(scores?.[key] ?? DEFAULT_SCORES[key])}점</strong></div>`)
    .join('');
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRecord = studyRecords.find((item) => item.date === todayKey);
  const liveStudySeconds = studyTimerSecondsRef.current;
  const todayStudySeconds = (todayRecord?.studyTime || 0) + liveStudySeconds;
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
  const plannedSubjectOptions = Array.from(new Set(plannerItems.map((item) => `${item.subject}${item.content ? ` - ${item.content}` : ''}`)));
  const buildDefaultCoachingSubjects = () => {
    const mapped = ['국어', '수학', '영어', '탐구'].map((subject) => {
      const plannedHour = Math.round((plannerMinutesBySubject[subject] || 0) / 60);
      const actualHour = Math.round(((todaySubjectRecord.subjects && todaySubjectRecord.subjects[subject]) || 0) / 3600);
      const hint = subject === '국어' ? '세부과목 (예: 언매)' : subject === '수학' ? '세부과목 (예: 미적)' : subject === '영어' ? '세부과목 (예: 독해)' : '세부과목 (예: 생1)';
      return { id: `${subject}-base`, subject, detail: '', planned: plannedHour ? String(plannedHour) : '', actual: actualHour ? String(actualHour) : '', removable: false, placeholder: hint };
    });
    return mapped;
  };
  const ensureCoachingSubjectRows = () => {
    if (coachingSubjectRows.length) return;
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
    <div class="home-content">
    <div class="home-header">
      <div class="home-top-icons">
        <button class="top-icon-btn" data-action="openDrawer">${i('menu', false)}</button>
        <button class="top-icon-btn">${i('bell', false)}</button>
      </div>
      <p class="home-greeting">안녕하세요, 지민님 👋</p>
      <p class="home-sub">오늘도 크랙한 하루 되세요!</p>
    </div>
    <div class="section home-section">
      <div class="home-kpi-slider">
        ${homeTargets.map((item) => `<button class="card home-kpi-card admission-card slider-card" data-action="selectUniversity" data-target-major="${item.major}">
          <span class="home-major-pill">${item.major}</span>
          <p class="sub">내 합격 가능성</p>
          <div class="home-kpi-head"><div><p class="metric percent">${item.rate}%</p><p class="sub">${item.rank}</p></div><div class="ring donut" style="background:conic-gradient(var(--primary) 0 ${item.rate}%, #dfe8f8 ${item.rate}% 100%)"></div></div>
          <div class="kpi-row score-row"><div class="kpi-item"><b>${item.score}점</b>현재 점수</div><div class="kpi-item"><b>${item.cut}점</b>합격 컷</div><div class="kpi-item danger"><b>${item.gap}점</b>부족 점수</div></div>
          <div class="home-planner-badges chip-row">${plannerBadges.map((badge) => `<span class="chip">${badge}</span>`).join('')}</div>
        </button>`).join('')}
        <button class="card home-kpi-add-card slider-card" data-action="openUniversityModal"><span class="plus">+</span><p>+ 목표 대학 추가</p></button>
      </div>
      <div class="home-kpi-indicator card-indicator">${homeTargets.map((_, idx) => `<i class="${idx===0?'active':''}"></i>`).join('')}<b>+</b></div>
      ${universityModalOpen ? `<div class="home-modal-overlay" data-action="closeUniversityModal"><div class="home-modal" data-action="noopModal"><p class="home-modal-title">목표 대학 추가</p><p class="sub" style="margin-top:8px">대학 선택 모달은 다음 단계에서 연결됩니다.</p><button class="btn btn-primary" data-action="closeUniversityModal">닫기</button></div></div>` : ''}
    </div>
    <div class="section home-section home-section-last">
      <div class="card home-study-summary study-summary-card">
        <p class="analysis-title">오늘 공부 요약</p>
        <div class="study-timer-row"><b class="timer" data-study-base-seconds="${todayRecord?.studyTime || 0}">${formatHms(todayStudySeconds)}</b>${studyTimerRunning ? `<button class="btn btn-secondary start-button" data-action="stopStudyTimer">공부 종료</button>` : `<button class="btn btn-primary start-button" data-action="openStudySubjectSheet">공부 시작하기</button>`}</div>
        <div class="home-subject-pill-row subject-chip-row">${visibleSubjectChips.map(([subject, sec]) => `<span class="home-subject-pill subject-time-chip">${subject} ${formatHms(sec || 0)}</span>`).join('')}${hiddenSubjectCount ? `<span class="home-subject-pill subject-time-chip more">+${hiddenSubjectCount}</span>` : ''}</div>
      </div>
      <div class="card study-goal-card">
        <p class="analysis-title">오늘 공부 목표</p>
        <p class="sub">수학: 2시간 · 탐구: 1시간</p>
        <div class="track"><i style="width:${todayGoalPercent}%"></i></div>
        <p class="sub" style="margin:8px 0 0">오늘 목표 달성률 ${todayGoalPercent}%</p>
      </div>
      <div class="card home-bottom-summary ranking-card">
        <div class="home-ranking-head"><p class="analysis-title">내 공부 랭킹</p><span class="badge">오늘 기준</span></div>
        <p class="home-ranking-main">${Math.min(myRank, 124)}등</p>
        <p class="home-ranking-sub">전체 124명 중</p>
        <div class="home-ranking-progress"><i style="width:${rankingProgress}%"></i></div>
        <p class="home-ranking-foot">상위 ${percentile}%</p>
        <p class="home-ranking-tip">오늘 공부를 시작하면 순위가 올라가요</p>
      </div>
    </div>
    ${studySubjectSheetOpen ? `<div class="planner-sheet-overlay" data-action="closeStudySubjectSheet"><div class="planner-sheet study-subject-sheet" data-action="noopModal"><h3>어떤 과목을 공부할까요?</h3><div class="study-subject-grid">${['국어', '수학', '영어', '탐구'].map((s) => `<button class="planner-pill" data-action="selectStudySubject" data-study-subject="${s}">${s}</button>`).join('')}<button class="planner-pill" data-action="selectStudySubjectCustom">기타 직접 입력</button></div>${plannedSubjectOptions.length ? `<p class="sub" style="margin:8px 0 6px">오늘 플래너 일정</p><div class="study-subject-grid">${plannedSubjectOptions.map((s) => `<button class="planner-pill" data-action="selectStudySubject" data-study-subject="${s.split(' - ')[0]}">${s}</button>`).join('')}</div>` : ''}</div></div>` : ''}
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
      return `<div class="coach-step-body"><h4>1. 과목별 학습 달성률</h4><p class="sub">과목별 구체적인 과목명과 시간을 입력하세요.</p>
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
      return `<div class="coach-step-body"><h4>2. 플래너 인증</h4><p class="sub">이번 주 플래너 사진을 첨부해주세요. 최대 5장</p>
        <div class="coach-upload-box"><p>파일/사진 첨부 박스</p><button class="btn btn-secondary" data-action="addPlannerPhoto">사진 추가하기</button></div>
        <div class="coach-thumb-list">${coachingPlannerPhotos.length ? coachingPlannerPhotos.map((name, idx) => `<div class="coach-thumb"><span>${name}</span><button data-action="removePlannerPhoto" data-photo-index="${idx}">삭제</button></div>`).join('') : '<p class="sub">첨부된 사진이 없습니다.</p>'}</div>
      </div>`;
    }
    if (coachingStep === 3) {
      const examTypes = ['미응시', '교내', '평가원/교육청', '사설'];
      return `<div class="coach-step-body"><h4>3. 모의고사 응시 여부</h4><p class="sub">이번 주 사설 모의고사 또는 학력평가를 응시했나요?</p>
        <div class="coach-choice-row">${examTypes.map((type) => `<button class="planner-pill ${coachingExamType===type?'active':''}" data-action="setCoachingExamType" data-coach-exam="${type}">${type}</button>`).join('')}</div>
        ${coachingExamType && coachingExamType !== '미응시' ? `<div class="coach-exam-form">
          <button class="btn btn-secondary" data-action="addExamPhoto">성적 인증 사진 첨부</button>
          <div class="coach-thumb-list">${coachingExamPhotos.map((name, idx) => `<div class="coach-thumb"><span>${name}</span><button data-action="removeExamPhoto" data-photo-index="${idx}">삭제</button></div>`).join('')}</div>
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
      return `<div class="coach-step-body"><h4>4. 최근 2주 학업 추이</h4><p class="sub">최근 2주간 학습 흐름이 어땠나요?</p>
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

  const screens = {
    ob1: layout(
      `<div class="onboarding-container"><div class="content">
       ${onboardingProgress(1)}
       ${appbar('학습성향 진단', true)}
       <p class="sub ob-subcopy">지금 성적과 공부 습관을 바탕으로<br/>나에게 맞는 합격 전략을 찾아볼게요.</p>
       <div class="card ob-bubble-card"><img src="${CRACKY_SRC}" class="ob-cracky" alt="크랙이"/><p>성적만 보는 게 아니라, 공부 방식까지 같이 봐야 정확해요!</p></div>
       <div class="card ob-card">
         <p class="analysis-title">성적 입력</p>
         <div class="score-edit-grid">
           <label>국어<input data-field="score-korean" value="${scores.korean}" type="number"/></label>
           <label>수학<input data-field="score-math" value="${scores.math}" type="number"/></label>
           <label>영어<input data-field="score-english" value="${scores.english}" type="number"/></label>
           <label>탐구1<input data-field="score-inquiry1" value="${scores.inquiry1}" type="number"/></label>
           <label>탐구2<input data-field="score-inquiry2" value="${scores.inquiry2}" type="number"/></label>
         </div>
       </div>
       <div class="card ob-card">
         <p class="analysis-title">정성 조사서</p>
         <label class="auth-label">가장 자신 있는 과목</label><input class="planner-input" data-field="strongSubject" value="${strongSubject}" placeholder="예: 국어" />
         <label class="auth-label">가장 불안한 과목</label><input class="planner-input" data-field="weakSubject" value="${weakSubject}" placeholder="예: 수학" />
         <label class="auth-label">하루 평균 공부 시간</label><input class="planner-input" data-field="studyHours" value="${studyHours}" placeholder="예: 5시간" />
         <label class="auth-label">공부할 때 가장 어려운 점</label><input class="planner-input" data-field="studyDifficulty" value="${studyDifficulty}" placeholder="예: 집중력 유지" />
       </div>
       <div class="card ob-card">
         <p class="analysis-title">학습 MBTI 검사</p>
         <p class="sub">4문항으로 빠르게 진단해요.</p>
         <button class="btn btn-secondary" data-action="openMbtiModal">MBTI 시작하기</button>
         ${mbtiResult ? `<p class="sub mbti-result">진단 결과: <b>${mbtiResult}</b></p>` : ''}
       </div>
       ${mbtiModalOpen ? `<div class="home-modal-overlay" data-action="closeMbtiModal"><div class="home-modal ob-mbti-modal" data-action="noopModal">
         <p class="home-modal-title">학습 MBTI 검사</p>
         <div class="ob-mbti-q"><p>1) 계획을 세우고 공부하는 편인가요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q1" data-mbti-v="plan" class="${mbtiAnswers.q1==='plan'?'active':''}">네</button><button data-action="setMbti" data-mbti-q="q1" data-mbti-v="flex" class="${mbtiAnswers.q1==='flex'?'active':''}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>2) 혼자 공부할 때 집중이 잘 되나요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q2" data-mbti-v="solo" class="${mbtiAnswers.q2==='solo'?'active':''}">네</button><button data-action="setMbti" data-mbti-q="q2" data-mbti-v="group" class="${mbtiAnswers.q2==='group'?'active':''}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>3) 부족한 과목부터 먼저 하는 편인가요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q3" data-mbti-v="weak_first" class="${mbtiAnswers.q3==='weak_first'?'active':''}">네</button><button data-action="setMbti" data-mbti-q="q3" data-mbti-v="strong_first" class="${mbtiAnswers.q3==='strong_first'?'active':''}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>4) 피드백이 있으면 공부가 더 잘 되나요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q4" data-mbti-v="feedback" class="${mbtiAnswers.q4==='feedback'?'active':''}">네</button><button data-action="setMbti" data-mbti-q="q4" data-mbti-v="self" class="${mbtiAnswers.q4==='self'?'active':''}">아니오</button></div></div>
         <button class="btn btn-primary ${mbtiDone?'':'disabled'}" data-action="completeMbti" ${mbtiDone?'':'disabled'}>검사 완료</button>
       </div></div>` : ''}
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="goto" data-target="ob2">진단 완료하고 다음으로</button></div></div>`,
      false
    ),
    ob2: layout(
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
         <span class="badge analysis-badge">${targetMajor}</span>
         <div class="analysis-kpi-row"><div><p class="ob-rate">${selectedUniversity.rate}%</p><p class="analysis-sub">합격 가능성</p></div><div class="ring" style="background:conic-gradient(var(--primary) 0 ${selectedUniversity.rate}%, #dfe8f8 ${selectedUniversity.rate}% 100%)"></div></div>
         <div class="ob-score-summary-row">
           <div class="ob-score-summary-card"><b>${selectedUniversity.score}점</b><span>현재 점수</span></div>
           <div class="ob-score-summary-card"><b>${selectedUniversity.cut}점</b><span>합격 컷</span></div>
           <div class="ob-score-summary-card danger"><b>${selectedUniversity.gap}점</b><span>부족 점수</span></div>
         </div>
         <p class="analysis-title">+1점 상승 시뮬레이션</p>
         <div class="analysis-impact-item">수학<div class="track"><i style="width:90%"></i></div><span>+12점 → +18%</span></div>
         <div class="analysis-impact-item">탐구<div class="track"><i style="width:68%;background:#14b8a6"></i></div><span>+6점 → +9%</span></div>
         <div class="analysis-impact-item">영어<div class="track"><i style="width:48%;background:#f59e0b"></i></div><span>+3점 → +5%</span></div>
       </div>
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="goto" data-target="ob3">내 맞춤 솔루션 보기</button></div></div>`,
      false
    ),
    ob3: layout(
      `<div class="onboarding-container"><div class="content">
       ${onboardingProgress(3)}
       ${appbar('공부 성향 맞춤 솔루션', true)}
       <p class="sub ob-subcopy">현재 성적에서 합격컷까지,<br/>가장 효율적인 점수 상승 루트를 보여드릴게요.</p>
       <div class="card ob-bubble-card"><img src="${CRACKY_SRC}" class="ob-cracky" alt="크랙이"/><p>무작정 전 과목을 올리는 게 아니라, 합격에 가장 크게 기여하는 과목부터 잡아야 해요!</p></div>
       <div class="card ob-card">
         <p class="analysis-title">성적 Before & After</p>
         <div class="ob-before-after">
           <div class="ob-score-card"><b>현재 성적</b><p>국어 82</p><p>수학 68</p><p>영어 77</p><p>탐구1 70</p><p>탐구2 66</p><strong>총점 86</strong></div>
           <div class="ob-score-card"><b>목표 성적</b><p>국어 82</p><p>수학 80 <span class="plus">(+12)</span></p><p>영어 77</p><p>탐구1 76 <span class="plus">(+6)</span></p><p>탐구2 66</p><strong>총점 120</strong></div>
         </div>
       </div>
       ${showDurationCard ? `<div class="card ob-card ob-period-card"><p class="analysis-title">Standard 이용 시 예상 도달 기간</p><h2>평균 3개월 예상</h2><p class="sub">주간 플래너 피드백과 학습 방향 코칭 제공</p></div>` : `<div class="card ob-card ob-loading-card"><div class="ob-spinner"></div><p class="sub">최적 도달 기간 계산 중...</p></div>`}
       <div class="card ob-card">
         <p class="analysis-title">합격확률 게이지</p>
         <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${gaugeTarget}점</b></div></div>
         <div class="ob-gauge">
           <div class="ob-gauge-current" style="width:${gaugeCurrentPct}%"></div>
           <div class="ob-gauge-target" style="width:${gaugeTargetPct}%"></div>
           <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
           <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
         </div>
         <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
         <p class="sub"><b>현재 → 합격권 진입 구간</b></p>
       </div>
       <div class="card ob-card">
         <p class="analysis-title">핵심 전략</p>
         <ol class="ob-strategy"><li><b>수학 68점 → 80점</b><p>합격 가능성 상승 기여도 가장 큼</p></li><li><b>탐구1 70점 → 76점</b><p>단기간 상승 효율 높음</p></li><li><b>영어 77점 유지</b><p>현재 수준 유지 전략</p></li></ol>
       </div>
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="startStandard">Standard로 시작하기</button><button class="auth-link-btn" data-action="completeOnboarding">홈으로 이동</button></div></div>`,
      false
    ),
    authLogin: layout(`<div class="auth-screen">
      <div class="card auth-unified-card">
        <div class="auth-logo-wrap compact">
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
          <button class="auth-sso-btn" data-action="ssoSuccess">K</button>
          <button class="auth-sso-btn" data-action="ssoSuccess">G</button>
          <button class="auth-sso-btn" data-action="ssoSuccess">N</button>
        </div>
        <button class="auth-link-btn" data-action="goto" data-target="authSignup">아직 계정이 없나요? 회원가입</button>
      </div>
    </div>`, false),
    authSignup: layout(appbar('회원가입', true) + `<div class="auth-screen">
      <div class="auth-brand card">
        <div class="auth-logo-wrap">
          <img
            src="${STUDYCRACK_LOGO_SRC}"
            class="auth-logo"
            alt="StudyCrack Logo"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          />
          <span class="auth-logo-fallback">StudyCrack</span>
        </div>
      </div>
      <div class="card auth-form-card">
        <label class="auth-label">이름</label>
        <input class="planner-input" data-field="signupName" value="${signupName}" placeholder="이름 입력" />
        <label class="auth-label">이메일</label>
        <input class="planner-input" data-field="signupEmail" value="${signupEmail}" placeholder="you@example.com" />
        <label class="auth-label">비밀번호</label>
        <input class="planner-input" data-field="signupPassword" value="${signupPassword}" type="password" placeholder="비밀번호 입력" />
        <label class="auth-label">비밀번호 확인</label>
        <input class="planner-input" data-field="signupPasswordConfirm" value="${signupPasswordConfirm}" type="password" placeholder="비밀번호 다시 입력" />
        <button class="btn btn-primary auth-submit" data-action="signupSuccess">회원가입 완료</button>
      </div>
      <div class="card auth-signup-card">
        <p>이미 계정이 있나요?</p>
        <button class="btn btn-secondary" data-action="goto" data-target="authLogin">로그인</button>
      </div>
    </div>`, false),
    splash: `<div class="app-shell"><div class="app-frame"><div class="splash"><div class="logo-bolt">${i('bolt',true)}</div><img class="brand-logo" src="${(window.__studycrackAssetSrc && window.__studycrackAssetSrc.onboardingLogoSrc) || './assets/images/studycrack_logo_wo_bg.png'}" alt="logo"/><h1 style="margin:0;font-size:30px">스터디크랙</h1><p>합격까지 가장 빠른 전략</p></div></div></div>`,
    on1: OnboardingStep1Full(),
    on2: onboarding(
      2,
      '나에게 최적화된\n점수 상승 전략을 제공해요',
      '과목별 효율과 목표 도달 시간을\n정확하게 예측해 드려요.',
      `<div class="onboarding-card"><p class="onboarding-sub" style="margin-top:0">수학 +12점</p><p class="onboarding-sub" style="margin-top:4px">합격 가능성 +18%</p><div class="on-graph-bars"><i></i><i></i><i></i><i></i></div><div class="on-chart-line"><svg viewBox="0 0 300 90" fill="none"><path d="M18 72C54 70 88 66 122 60C156 54 190 45 222 34C246 26 266 20 286 14" stroke="#2F6BFF" stroke-width="4" stroke-linecap="round"/></svg></div></div>`,
      '가장 효율적인 점수 상승 루트를 찾아드릴게요.',
      'on3'
    ),
    on3: onboarding(
      3,
      '실행부터 관리까지\n끝까지 함께해요',
      '플래너, 주간 점검, Sky튜터 피드백,\n프로 보고서로 관리합니다.',
      `<div class="on-feature-list"><div class="on-feature-item"><div class="on-feature-icon">${i('calendar', true)}</div><span>플래너 & 주간 점검</span></div><div class="on-feature-item"><div class="on-feature-icon">${i('chat', true)}</div><span>Sky튜터 1:1 피드백</span></div><div class="on-feature-item"><div class="on-feature-icon">${i('report', true)}</div><span>프로 보고서 (2주에 1번)</span></div></div>`,
      '계획부터 점검까지 끝까지 같이 갈게요.',
      'home',
      '시작하기'
    ),
    home: layout(homeView(), true),
    analysis: layout(
      `<section class="analysis-v2 ${isAnalyzing ? 'loading' : ''}">
        <div class="card analysis-v2-head">
          <h3>분석</h3>
          <p>결과를 보고, 전략을 이해하고, 바로 실행으로 연결하세요.</p>
        </div>

        <div class="analysis-v2-tabs">
          <button class="analysis-v2-tab ${analysisMode==='summary'?'active':''}" data-action="setAnalysisMode" data-analysis-mode="summary">전략 요약</button>
          <button class="analysis-v2-tab ${analysisMode==='simulation'?'active':''}" data-action="setAnalysisMode" data-analysis-mode="simulation">점수 상승 시뮬레이션</button>
        </div>

        ${analysisMode === 'summary' ? `
          <div class="card analysis-v2-targets">
            <p class="analysis-title">희망 대학 선택</p>
            <button class="analysis-dropdown" data-action="openAnalysisSearch"><span>${targetMajor}</span><em>⌄</em></button>
          </div>

          <div class="card analysis-v2-summary">
            <p class="analysis-title">핵심 결과 카드</p>
            <div class="analysis-v2-summary-top">
              <div>
                <p class="analysis-v2-univ">${targetMajor}</p>
                <p class="analysis-v2-label">AI 점수 · 합격컷 대비 위치</p>
              </div>
              <div class="analysis-v2-score-wrap">
                <span class="analysis-v2-verdict" style="color:${analysisStatusColor};border-color:${analysisStatusColor}">${analysisStatus}</span>
                <strong>${analysisSelected.score}점</strong>
              </div>
            </div>
            <div class="analysis-v2-gauge"><i style="width:${analysisGaugeFill}%;background:${analysisGaugeColor}"></i><span class="cut pass" style="left:40%"></span><span class="cut safe" style="left:60%"></span></div>
            <div class="analysis-v2-gauge-meta"><span>0</span><span>합격컷 100점</span><span>안정컷 150점</span><span>MAX 250점</span></div>
          </div>

          <div class="card analysis-v2-before-after">
            <p class="analysis-title">최소 노력 대비 합격 도달 성적</p>
            <div class="analysis-v2-ba-grid">
              <div class="analysis-v2-ba-col"><h4>현재 성적</h4><p>국어 82</p><p>수학 68</p><p>영어 77</p><p>탐구1 70</p><p>탐구2 66</p><p><b>총점 86</b></p></div>
              <div class="analysis-v2-arrow">→</div>
              <div class="analysis-v2-ba-col"><h4>도달 성적</h4><p>국어 82</p><p>수학 80 <em>+12</em></p><p>영어 77</p><p>탐구1 76 <em>+6</em></p><p>탐구2 66</p><p><b>예상 총점 120</b></p></div>
            </div>
            <div class="analysis-v2-eta ${analysisEtaStage < 3 ? 'loading' : ''}">
              ${analysisEtaStage === 1 ? `<div class="analysis-eta-loading"><span class="skeleton"></span><p>도달 성적 계산 중입니다...</p></div>` : analysisEtaStage === 2 ? `<div class="analysis-eta-loading"><span class="skeleton thin"></span><p>도달 시간을 예상 중입니다...</p></div>` : `<p class="analysis-v2-eta-text">⚡ <b>현재 학습분석 기반 Standard 이용 시 평균 2개월 내 도달 예상</b></p>`}
            </div>
          </div>

          <div class="card analysis-v2-gauge-change">
            <p class="analysis-title">합격 가능성 변화</p>
            <p class="analysis-v2-gauge-line">현재 <b class="current">${analysisSelected.score}점</b> → 목표 <b class="target">${analysisTargetScore}점</b></p>
            <div class="analysis-v2-progress">
              <span class="line pass" style="left:40%"></span>
              <span class="line safe" style="left:60%"></span>
              <span class="dot current" style="left:${analysisCurrentPct}%"></span>
              <span class="dot target" style="left:${analysisTargetPct}%"></span>
            </div>
            <div class="analysis-v2-progress-label"><span>위험</span><span>합격</span><span>안정</span></div>
            <p class="analysis-sub">현재: 합격컷 미달 → 목표 달성 시 합격권 진입</p>
          </div>

          <div class="card analysis-v2-cta sticky"><p class="analysis-title">지금 방향이 틀리면 시간만 낭비될 수 있습니다</p><p class="sub">Standard는 매주 학습 방향과 실행을 관리합니다.</p><button class="btn analysis-convert-btn" data-action="startStandard">2개월 내 합격권 진입 시작하기</button></div>
        ` : `
          <div class="card analysis-v2-compare">
            <p class="analysis-title">목표대학 점수 비교</p>
            <div class="analysis-v2-vert-chart">
              <span class="guide pass" style="bottom:40%">합격선 100</span>
              <span class="guide safe" style="bottom:60%">안정선 150</span>
              ${[['가천대 관광경영학과', 250, '가천대학교 관광경영학과'], ['강서대 G2빅데이터경영학과', 250, '강서대학교 G2빅데이터경영학과'], ['고려대 경영대학', 71, '고려대학교 경영대학']].map(([label, score, full]) => `<button class="analysis-v2-vert-item ${targetMajor===full?'active':''}" data-action="selectTarget" data-target-major="${full}"><b>${score}</b><i style="height:${Math.max((score/250)*100, 8)}%;background:${score>=150?'#22C55E':score>=100?'#2563EB':'#F97316'}"></i><p>${label}</p></button>`).join('')}
            </div>
          </div>

          <div class="card analysis-v2-sim">
            <p class="analysis-title">+1점 상승 시 기대 효율</p>
            ${analysisSelected.sim.map(([subject, gain, desc, recommended]) => `<button class="analysis-v2-sim-item ${recommended?'recommended':''} ${analysisHighlightedSubject===subject?'focus':''}" data-action="highlightSimSubject" data-sim-subject="${subject}"><div class="left"><p><strong>${subject} (+1점)</strong>${recommended?'<span class="badge">추천</span>':''}</p><small>${desc}</small><span class="mini-track"><i style="width:${Math.max(((Number(String(gain).replace(/[^0-9.]/g, '')) || 0) / analysisSimMax) * 100, 8)}%"></i></span></div><b>${gain}</b></button>`).join('')}
            <p class="analysis-v2-sim-foot">탭해서 과목별 상승 효율을 빠르게 비교해보세요.</p>
          </div>
        `}

        ${analysisSearchOpen ? `<div class="analysis-search-overlay" data-action="closeAnalysisSearch"><div class="analysis-search-modal" data-action="noopModal"><div class="analysis-search-head"><h4>희망 대학 선택</h4><button data-action="closeAnalysisSearch">✕</button></div><div class="analysis-search-sticky"><input class="planner-input" data-field="analysisSearchTerm" value="${analysisSearchTerm}" placeholder="대학명 또는 학과명을 검색하세요"/></div><div class="analysis-search-section recommend"><p>현재 성적 기준 추천</p><div class="analysis-search-rec-grid">${analysisRecommended.map((name) => `<button class="analysis-rec-card" data-action="addAnalysisTarget" data-target-major="${name}"><div><strong>${name}</strong><span class="badge">추천</span></div><em>${analysisTargetList.includes(name)?'추가됨':'선택'}</em></button>`).join('')}</div></div><div class="analysis-search-section"><p>검색 결과</p>${analysisSearchList.map((name) => `<button class="analysis-search-row" data-action="addAnalysisTarget" data-target-major="${name}">${name}<span>${analysisTargetList.includes(name)?'추가됨':'추가'}</span></button>`).join('')}</div></div></div>` : ''}
      </section>`,
      true
    ),
    strategy: layout(
      `<div class="coach-page">
        <div class="card coach-title-card"><h3>학습 코칭</h3><p>주간 학습 계획을 점검하고, 튜터의 피드백을 받아보세요.</p></div>
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
      `<div class="planner-screen"><div class="planner-head"><h3>2024년 5월 ${selectedDate}일 (화)</h3><button class="planner-cal-btn" data-action="openPlannerCalendar">${i('calendar', false)}</button></div>
       <div class="planner-weekday"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
       <div class="planner-days">${plannerWeekDates.map((d) => `<button class="${selectedDate===d?'active':''}" data-action="selectPlannerDate" data-planner-date="${d}">${d}</button>`).join('')}</div>
       <div class="planner-section-title planner-fade"><div><h4>${selectedDate}일 계획</h4><p>총 ${plannerViewHour}시간 ${plannerViewMinute}분</p></div></div>
       <div class="planner-plan-list">
         ${plannerViewItems.map((item, idx) => `<div class="planner-item ${item.done ? 'done' : ''}" data-action="openPlannerEdit" data-planner-index="${idx}"><i class="dot ${item.dot}"></i><div><b>${item.subject}</b><p>${item.content}</p><small>${item.start} - ${item.end}</small></div><div class="planner-item-right"><strong>${item.minutes}분</strong><div class="planner-item-controls"><button class="planner-item-done" data-action="togglePlannerDone" data-planner-index="${idx}">✓ ${item.done ? '완료!' : '완료'}</button><button class="planner-item-remove" data-action="removePlannerItem" data-planner-index="${idx}">✕</button></div></div></div>`).join('') || '<div class="planner-empty-day">선택한 날짜의 플래너가 없습니다.</div>'}
       </div>
       <div class="planner-feedback-card ${plannerFeedback.tone}"><span>${plannerFeedback.icon}</span><p>${plannerFeedback.text}</p></div>
       <div class="planner-bottom-space"></div>
       ${!plannerAddModalOpen ? `<button class="planner-fab" data-action="openPlannerAddModal"><span>+</span></button>` : ''}
       ${plannerCalendarOpen ? `<div class="planner-sheet-overlay" data-action="closePlannerCalendar"><div class="planner-sheet planner-calendar-sheet" data-action="noopModal"><button class="planner-sheet-close" data-action="closePlannerCalendar">✕</button><h3>2024년 5월</h3><div class="planner-calendar-grid">${Array.from({ length: 31 }, (_, i) => i + 1).map((day) => `<button class="planner-cal-day ${selectedDate===String(day)?'active':''}" data-action="selectPlannerDate" data-planner-date="${day}">${day}</button>`).join('')}</div></div></div>` : ''}
       ${plannerAddModalOpen ? `<div class="planner-sheet-overlay" data-action="closePlannerAddModal"><div class="planner-sheet" data-action="noopModal"><button class="planner-sheet-close" data-action="closePlannerAddModal">✕</button><h3>플래너 항목 추가</h3><p>오늘 실행할 학습 계획을 입력해 주세요.</p><div class="planner-sheet-block"><label>과목 선택</label><div class="planner-pill-row"><button class="planner-pill ${plannerSubject==='수학'?'active':''}" data-action="setPlannerSubject" data-planner-subject="수학">수학</button><button class="planner-pill ${plannerSubject==='국어'?'active':''}" data-action="setPlannerSubject" data-planner-subject="국어">국어</button><button class="planner-pill ${plannerSubject==='영어'?'active':''}" data-action="setPlannerSubject" data-planner-subject="영어">영어</button><button class="planner-pill ${plannerSubject==='탐구'?'active':''}" data-action="setPlannerSubject" data-planner-subject="탐구">탐구</button></div></div><div class="planner-sheet-block"><label>학습 내용</label><input class="planner-input" data-field="plannerContent" value="${plannerContent}" placeholder="예: 개념 학습, 독해 문제 풀이" /></div><div class="planner-sheet-block"><label>시간 선택</label><div class="planner-pill-row"><button class="planner-pill ${plannerDurationChoice==='30'?'active':''}" data-action="setPlannerDuration" data-planner-duration="30">30분</button><button class="planner-pill ${plannerDurationChoice==='60'?'active':''}" data-action="setPlannerDuration" data-planner-duration="60">60분</button><button class="planner-pill ${plannerDurationChoice==='90'?'active':''}" data-action="setPlannerDuration" data-planner-duration="90">90분</button><button class="planner-pill ${plannerDurationChoice==='120'?'active':''}" data-action="setPlannerDuration" data-planner-duration="120">120분</button><button class="planner-pill ${plannerDurationChoice==='custom'?'active':''}" data-action="setPlannerDuration" data-planner-duration="custom">직접 입력</button></div>${plannerDurationChoice==='custom' ? `<input class="planner-input" data-field="plannerCustomMinutes" value="${plannerCustomMinutes}" type="number" placeholder="분 단위 입력" />` : ''}</div><button class="btn btn-primary planner-sheet-submit ${canSubmitPlanner?'':'disabled'}" data-action="addPlannerFromSheet" ${canSubmitPlanner?'':'disabled'}>플래너에 추가하기</button></div></div>` : ''}
       ${plannerEditIndex !== null ? `<div class="planner-sheet-overlay" data-action="closePlannerEdit"><div class="planner-sheet" data-action="noopModal"><button class="planner-sheet-close" data-action="closePlannerEdit">✕</button><h3>플래너 항목 수정</h3><div class="planner-sheet-block"><label>과목</label><input class="planner-input" data-field="plannerEditSubject" value="${plannerItems[plannerEditIndex]?.subject || ''}" /></div><div class="planner-sheet-block"><label>세부 내용</label><input class="planner-input" data-field="plannerEditContent" value="${plannerItems[plannerEditIndex]?.content || ''}" /></div><div class="planner-sheet-block"><label>시간대</label><div class="planner-time-row"><input class="planner-input" data-field="plannerEditStart" type="time" value="${plannerItems[plannerEditIndex]?.start || ''}" /><input class="planner-input" data-field="plannerEditEnd" type="time" value="${plannerItems[plannerEditIndex]?.end || ''}" /></div></div><div class="planner-sheet-block"><label>소요 시간(분)</label><input class="planner-input" data-field="plannerEditMinutes" type="number" value="${plannerItems[plannerEditIndex]?.minutes || ''}" /></div><button class="btn btn-primary" data-action="savePlannerEdit">수정 저장</button></div></div>` : ''}
       </div>`,
      true
    ),
    my: layout(appbar('마이페이지', false) + `<div class="my-stack">
      <div class="card my-profile-card"><div class="my-profile-left"><div class="my-avatar">${i('user', false)}</div><div><p class="my-name">김지민</p><p class="sub">목표 대학: 연세대학교 경영학과</p></div></div><span class="badge">Pro 이용 중</span></div>
      <div class="card my-subscription-card"><div class="my-sub-icon">${i('report', false)}</div><div><p class="my-sub-title">Pro 플랜 이용 중</p><p class="my-sub-date">다음 결제일 2024.06.14</p></div></div>
      <div class="card my-menu-card">
        <button class="my-row" data-action="goto" data-target="scoreInfo">성적 정보 <span>${i('chevron', false)}</span></button>
        <button class="my-row" data-action="goto" data-target="studyReports">학습 리포트 <span>${i('chevron', false)}</span></button>
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
    scoreInfo: layout(appbar('성적 정보', true) + `<div class="card score-info-card">${scoreList}<button class="btn btn-primary score-edit-btn" data-action="openScoreEdit">성적 수정하기</button></div><div class="card"><p class="analysis-title">최근 성적 업데이트</p><p class="sub" style="margin:0">2024.05.14 기준</p><p class="sub" style="margin:6px 0 0">다음 업데이트 권장: 2주 후</p></div>${scoreEditOpen ? ScoreEditModalV2() : ''}`, false),
    studyReports: layout(appbar('학습 리포트', true) + `<div class="card report-list-card"><button class="report-row" data-action="goto" data-target="reportDetail"><div><b>5월 11일 종합 분석 리포트</b><p>수학 점수 상승 여지 큼</p></div><span>${i('chevron', false)}</span></button><button class="report-row" data-action="goto" data-target="reportDetail"><div><b>4월 27일 중간 분석 리포트</b><p>탐구 집중 강화 필요</p></div><span>${i('chevron', false)}</span></button></div><div class="cta-wrapper"><button class="btn btn-primary cta-btn" data-action="goto" data-target="reportDetail">프로 보고서 샘플 보기</button></div>`, false),
    notificationSettings: layout(appbar('알림 설정', true) + `<div class="card notify-card">${[
      ['planner', '플래너 알림', '오늘 계획을 잊지 않도록 알려드려요'],
      ['weekly', '주간 점검 알림', '매주 점검 시점을 알려드려요'],
      ['report', '프로 보고서 알림', '새 리포트 이용 가능일을 알려드려요'],
      ['billing', '결제/구독 알림', '다음 결제일을 미리 알려드려요']
    ].map(([key, title, desc]) => `<button class="notify-row" data-action="toggleNotification" data-notify-key="${key}"><div><b>${title}</b><p>${desc}</p></div><span class="notify-switch ${notifications[key]?'on':''}"><i></i></span></button>`).join('')}</div>`, false),
    customerSupport: layout(appbar('고객센터', true) + `<div class="card"><p class="analysis-title">궁금한 점이 있으면 언제든 문의해주세요.</p><p class="sub" style="margin:0">운영 시간: 평일 10:00 - 18:00</p><div class="support-btns"><button class="btn btn-secondary">카카오톡 문의하기</button><button class="btn btn-secondary">이메일 문의하기</button></div></div><div class="card faq-card">${[
      ['faq1', '합격 가능성은 어떻게 계산되나요?', '목표 대학의 반영 방식과 현재 성적을 기준으로 계산됩니다.'],
      ['faq2', '플래너 피드백은 언제 받을 수 있나요?', '제출된 플래너를 기준으로 정해진 일정에 맞춰 피드백을 제공합니다.'],
      ['faq3', '프로 보고서는 얼마나 자주 받을 수 있나요?', 'Pro 플랜은 2주에 한 번 리포트를 받을 수 있습니다.'],
      ['faq4', '결제 후 플랜 변경이 가능한가요?', '플랜 변경 기능은 준비 중입니다.']
    ].map(([id, q, a]) => `<button class="faq-row" data-action="toggleFaq" data-faq-id="${id}"><div><b>${q}</b>${openFaq===id?`<p>${a}</p>`:''}</div><span>${i('chevron', false)}</span></button>`).join('')}</div>`, false),
    settingsMain: layout(appbar('설정', true) + `<div class="card settings-list"><button data-action="goto" data-target="accountInfo">계정 정보 <span>${i('chevron', false)}</span></button><button data-action="goto" data-target="privacyPolicy">개인정보 처리방침 <span>${i('chevron', false)}</span></button><button data-action="goto" data-target="termsScreen">서비스 이용약관 <span>${i('chevron', false)}</span></button><button data-action="openLogoutModal">로그아웃 <span>${i('chevron', false)}</span></button></div>${logoutModalOpen ? `<div class="home-modal-overlay" data-action="closeLogoutModal"><div class="home-modal" data-action="noopModal"><p class="home-modal-title">로그아웃하시겠어요?</p><div class="support-btns"><button class="btn btn-secondary" data-action="closeLogoutModal">취소</button><button class="btn btn-primary" data-action="confirmLogout">로그아웃</button></div></div></div>` : ''}`, false),
    accountInfo: layout(appbar('계정 정보', true) + `<div class="card"><div class="score-info-row"><span>이름</span><strong>${user?.name || DEFAULT_USER.name}</strong></div><div class="score-info-row"><span>목표 대학</span><strong>${targetMajor || DEFAULT_USER.targetUniversity}</strong></div><div class="score-info-row"><span>현재 플랜</span><strong>${selectedPlan || DEFAULT_USER.plan}</strong></div></div>`, false),
    privacyPolicy: layout(appbar('개인정보 처리방침', true) + `<div class="card"><p class="sub" style="margin:0">스터디크랙은 서비스 제공을 위해 필요한 최소한의 개인정보를 처리합니다.</p></div>`, false),
    termsScreen: layout(appbar('서비스 이용약관', true) + `<div class="card"><p class="sub" style="margin:0">본 약관은 스터디크랙 서비스 이용과 관련한 기본 사항을 안내합니다.</p></div>`, false)
  };

  const current = screens[screen] || screens.home;
  const currentScreen = screen;
  console.log('APP_LOADING_STATE', loading);
  console.log('APP_CURRENT_SCREEN', currentScreen);

  const onClick = (e) => {
    if (isAnalyzing && screen === 'analysis') return;
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    if (action === 'goto') {
      const target = actionEl.getAttribute('data-target');
      if (screen === 'on1' && target === 'on2') {
        setOnboardingLoading(true);
        setOnboardingLoadingText('성적 분석중...');
        setTimeout(() => setOnboardingLoadingText('유리한 대학 전형 파악중...'), 2000);
        setTimeout(() => { setOnboardingLoading(false); goto('on2'); }, 4000);
        return;
      }
      if (screen === 'on2' && target === 'on3') {
        setOnboardingLoading(true);
        setOnboardingLoadingText('학습 성향 분석중...');
        setTimeout(() => setOnboardingLoadingText('효율적인 공부법 찾는 중...'), 1500);
        setTimeout(() => { setOnboardingLoading(false); goto('on3'); }, 3000);
        return;
      }
      goto(target);
    }
    if (action === 'back') back();
    if (action === 'tab') goto(actionEl.getAttribute('data-tab'));
    if (action === 'selectPlan') setSelectedPlan(actionEl.getAttribute('data-plan'));
    if (action === 'selectDuration') setDuration(actionEl.getAttribute('data-duration'));
    if (action === 'toggleTarget') setTargetOpen((v) => !v);
    if (action === 'selectTarget') {
      setTargetMajor(actionEl.getAttribute('data-target-major'));
      setTargetOpen(false);
    }
    if (action === 'setAnalysisMode') setAnalysisMode(actionEl.getAttribute('data-analysis-mode') || 'summary');
    if (action === 'openAnalysisSearch') setAnalysisSearchOpen(true);
    if (action === 'closeAnalysisSearch') {
      setAnalysisSearchOpen(false);
      setAnalysisSearchTerm('');
    }
    if (action === 'highlightSimSubject') {
      const subject = actionEl.getAttribute('data-sim-subject');
      if (!subject) return;
      setAnalysisHighlightedSubject(subject);
      setTimeout(() => setAnalysisHighlightedSubject(''), 550);
    }
    if (action === 'addAnalysisTarget') {
      const major = actionEl.getAttribute('data-target-major');
      if (!major) return;
      setAnalysisTargetList((prev) => (prev.includes(major) ? prev : [...prev, major]));
      setTargetMajor(major);
      setAnalysisSearchOpen(false);
      setAnalysisSearchTerm('');
    }
    if (action === 'openUniversityModal') setUniversityModalOpen(true);
    if (action === 'closeUniversityModal') setUniversityModalOpen(false);
    if (action === 'openPlannerAddModal') setPlannerAddModalOpen(true);
    if (action === 'closePlannerAddModal') setPlannerAddModalOpen(false);
    if (action === 'openPlannerCalendar') setPlannerCalendarOpen(true);
    if (action === 'closePlannerCalendar') setPlannerCalendarOpen(false);
    if (action === 'selectPlannerDate') {
      const date = actionEl.getAttribute('data-planner-date');
      if (!date) return;
      setSelectedDate(String(date));
      setPlannerCalendarOpen(false);
    }
    if (action === 'openPlannerEdit') setPlannerEditIndex(Number(actionEl.getAttribute('data-planner-index')));
    if (action === 'closePlannerEdit') setPlannerEditIndex(null);
    if (action === 'openScoreEdit') { setScoreEditOpen(true); setScoreEditStep(1); }
    if (action === 'closeScoreEdit') { setScoreEditOpen(false); setScoreEditStep(1); }
    if (action === 'scoreStepPrev') setScoreEditStep((v) => Math.max(1, v - 1));
    if (action === 'scoreStepNext') setScoreEditStep((v) => Math.min(6, v + 1));
    if (action === 'saveScoreEdit') {
      setScores((prev) => ({
        ...prev,
        korean: Number(scoreEditState.korean.common || prev.korean),
        math: Number(scoreEditState.math.common || prev.math),
        english: Number(scoreEditState.english || prev.english),
        inquiry1: Number(scoreEditState.inquiry1.score || prev.inquiry1),
        inquiry2: Number(scoreEditState.inquiry2.score || prev.inquiry2)
      }));
      setScoreEditOpen(false);
      setScoreEditStep(1);
    }
    if (action === 'toggleNotification') {
      const key = actionEl.getAttribute('data-notify-key');
      setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    }
    if (action === 'toggleFaq') {
      const id = actionEl.getAttribute('data-faq-id');
      setOpenFaq((prev) => (prev === id ? '' : id));
    }
    if (action === 'openLogoutModal') setLogoutModalOpen(true);
    if (action === 'closeLogoutModal') setLogoutModalOpen(false);
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
      window.alert('로그아웃되었습니다');
    }
    if (action === 'setObGradeStatus') setObGradeStatus(actionEl.getAttribute('data-ob-grade') || '고1/2 재학');
    if (action === 'toggleObGed') setObGed((v) => !v);
    if (action === 'openDrawer') setDrawerOpen(true);
    if (action === 'closeDrawer') setDrawerOpen(false);
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
    if (action === 'addPlannerPhoto') {
      if (coachingPlannerPhotos.length >= 5) return;
      const name = window.prompt('사진 이름을 입력하세요', `planner_${coachingPlannerPhotos.length + 1}.jpg`);
      if (!name) return;
      setCoachingPlannerPhotos((prev) => [...prev, name]);
    }
    if (action === 'removePlannerPhoto') {
      const idx = Number(actionEl.getAttribute('data-photo-index'));
      setCoachingPlannerPhotos((prev) => prev.filter((_, i) => i !== idx));
    }
    if (action === 'setCoachingExamType') setCoachingExamType(actionEl.getAttribute('data-coach-exam'));
    if (action === 'addExamPhoto') {
      const name = window.prompt('성적 인증 사진 이름', `exam_${coachingExamPhotos.length + 1}.jpg`);
      if (!name) return;
      setCoachingExamPhotos((prev) => [...prev, name]);
    }
    if (action === 'removeExamPhoto') {
      const idx = Number(actionEl.getAttribute('data-photo-index'));
      setCoachingExamPhotos((prev) => prev.filter((_, i) => i !== idx));
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
      if (coachingStep >= 8) {
        setCoachingSheetOpen(false);
        setCoachingSubmitted(true);
        window.alert('코칭 요청이 제출되었습니다.\n튜터 피드백이 도착하면 학습 코칭 페이지에서 확인할 수 있어요.');
        return;
      }
      setCoachingStep((prev) => Math.min(8, prev + 1));
    }
    if (action === 'openStudySubjectSheet') setStudySubjectSheetOpen(true);
    if (action === 'closeStudySubjectSheet') setStudySubjectSheetOpen(false);
    if (action === 'selectStudySubjectCustom') {
      const custom = window.prompt('과목명을 입력하세요', '기타');
      if (!custom) return;
      setActiveStudySubject(custom);
      setStudySubjectSheetOpen(false);
      setStudyTimerRunning(true);
      studyTimerSecondsRef.current = 0;
      startLiveStudyTimer();
      syncLiveStudyTimerUi(0);
    }
    if (action === 'selectStudySubject') {
      const subject = actionEl.getAttribute('data-study-subject');
      if (!subject) return;
      setActiveStudySubject(subject);
      setStudySubjectSheetOpen(false);
      setStudyTimerRunning(true);
      studyTimerSecondsRef.current = 0;
      startLiveStudyTimer();
      syncLiveStudyTimerUi(0);
    }
    if (action === 'stopStudyTimer') {
      setStudyTimerRunning(false);
      stopLiveStudyTimer();
      const elapsed = studyTimerSecondsRef.current;
      const today = new Date().toISOString().slice(0, 10);
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
        setPlannerItems((prev) => prev.map((item) => item.subject === activeStudySubject ? { ...item, doneMinutes: (item.doneMinutes || 0) + Math.round(elapsed / 60) } : item));
      }
      studyTimerSecondsRef.current = 0;
      syncLiveStudyTimerUi(0);
      setActiveStudySubject('');
    }
    if (action === 'loginSuccess' || action === 'signupSuccess' || action === 'ssoSuccess') {
      setLoggedIn(true);
      setHistory([]);
      const completed = localStorage.getItem('studycrack_onboarding_completed') === 'true';
      goto(completed ? 'home' : 'ob1', true);
    }
    if (action === 'completeOnboarding') {
      localStorage.setItem('studycrack_onboarding_completed', 'true');
      goto('home', false);
    }
    if (action === 'startStandard') {
      localStorage.setItem('studycrack_onboarding_completed', 'true');
      setSelectedPlan('Standard');
      goto('proIntro');
    }
    if (action === 'retryInit') initializeApp();
    if (action === 'noopModal') return;
    if (action === 'setPlannerSubject') setPlannerSubject(actionEl.getAttribute('data-planner-subject'));
    if (action === 'setPlannerDuration') setPlannerDurationChoice(actionEl.getAttribute('data-planner-duration'));
    if (action === 'removePlannerItem') {
      const idx = Number(actionEl.getAttribute('data-planner-index'));
      setPlannerItems((prev) => prev.filter((_, i) => i !== idx));
    }
    if (action === 'togglePlannerDone') {
      const idx = Number(actionEl.getAttribute('data-planner-index'));
      setPlannerItems((prev) => prev.map((item, i) => (i === idx ? { ...item, done: !item.done } : item)));
    }
    if (action === 'selectUniversity') {
      setTargetMajor(actionEl.getAttribute('data-target-major'));
      setTargetOpen(false);
      goto('analysis');
    }
    if (action === 'addPlannerItem' || action === 'addPlannerItemFromModal') {
      setPlannerAddModalOpen(false);
      const subject = window.prompt('과목을 입력하세요', '수학');
      if (!subject) return;
      const content = window.prompt('학습 내용을 입력하세요', '개념 복습');
      if (!content) return;
      const start = window.prompt('시작 시간을 입력하세요 (예: 18:00)', '18:00');
      if (!start) return;
      const end = window.prompt('종료 시간을 입력하세요 (예: 19:30)', '19:30');
      if (!end) return;
      const durationValue = window.prompt('예상 학습 시간을 분 단위로 입력하세요', '90');
      const minutes = Number(durationValue);
      if (!minutes || Number.isNaN(minutes)) return;
      const lowered = subject.toLowerCase();
      const dot = lowered.includes('수') ? 'math' : lowered.includes('영') ? 'eng' : 'sci';
      setPlannerItems((prev) => [...prev, { subject, content, start, end, minutes, dot }]);
    }
    if (action === 'addPlannerFromSheet') {
      const readFieldValue = (name) => {
        const input = document.querySelector(`[data-field="${name}"]`);
        return input ? input.value.trim() : '';
      };
      const content = readFieldValue('plannerContent');
      const customMinutes = readFieldValue('plannerCustomMinutes');
      const minutes = plannerDurationChoice === 'custom' ? Number(customMinutes) : Number(plannerDurationChoice);
      if (!plannerSubject || !content || !minutes || Number.isNaN(minutes)) return;
      const dot = plannerSubject === '수학' ? 'math' : plannerSubject === '영어' ? 'eng' : plannerSubject === '국어' ? 'kor' : 'sci';
      setPlannerItems((prev) => [...prev, { subject: plannerSubject, content, start: '--:--', end: '--:--', minutes, dot }]);
      setPlannerAddModalOpen(false);
      setPlannerSubject('');
      setPlannerContent('');
      setPlannerDurationChoice('');
      setPlannerCustomMinutes('');
      setPlannerStart('');
      setPlannerEnd('');
      ['plannerContent', 'plannerCustomMinutes'].forEach((name) => {
        const input = document.querySelector(`[data-field="${name}"]`);
        if (input) input.value = '';
      });
    }
    if (action === 'savePlannerEdit') {
      if (plannerEditIndex === null) return;
      const subject = document.querySelector('[data-field="plannerEditSubject"]')?.value?.trim();
      const content = document.querySelector('[data-field="plannerEditContent"]')?.value?.trim();
      const start = document.querySelector('[data-field="plannerEditStart"]')?.value;
      const end = document.querySelector('[data-field="plannerEditEnd"]')?.value;
      const minutes = Number(document.querySelector('[data-field="plannerEditMinutes"]')?.value || 0);
      if (!subject || !content || !start || !end || !minutes) return;
      const lowered = subject.toLowerCase();
      const dot = lowered.includes('수') ? 'math' : lowered.includes('영') ? 'eng' : lowered.includes('국') ? 'kor' : 'sci';
      setPlannerItems((prev) => prev.map((item, idx) => (idx === plannerEditIndex ? { ...item, subject, content, start, end, minutes, dot } : item)));
      setPlannerEditIndex(null);
    }
  };

  const onInput = (e) => {
    const field = e.target.getAttribute('data-field');
    if (field === 'coachingMonth') setCoachingMonth(e.target.value);
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
  };
  const onBlur = (e) => {
    const field = e.target.getAttribute('data-field');
    const coachAnswer = e.target.getAttribute('data-coach-answer');
    if (coachAnswer) {
      const value = e.target.value.slice(0, 200);
      setCoachingAnswers((prev) => ({ ...prev, [coachAnswer]: value }));
    }
    const coachDetail = e.target.getAttribute('data-coach-detail');
    const coachPlan = e.target.getAttribute('data-coach-plan');
    const coachActual = e.target.getAttribute('data-coach-actual');
    const coachField = e.target.getAttribute('data-coach-field');
    if (coachField) setCoachingExamScores((prev) => ({ ...prev, [coachField]: e.target.value }));
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
    if (field === 'loginEmail') setLoginEmail(value);
    if (field === 'loginPassword') setLoginPassword(value);
    if (field === 'signupName') setSignupName(value);
    if (field === 'signupEmail') setSignupEmail(value);
    if (field === 'signupPassword') setSignupPassword(value);
    if (field === 'signupPasswordConfirm') setSignupPasswordConfirm(value);
    if (field === 'analysisSearchTerm') setAnalysisSearchTerm(value);
    if (field === 'obSchoolName') setObSchoolName(value);
    if (field === 'obTrack') setObTrack(value);
    if (field === 'obGoalText') setObGoalText(value);
    if (field === 'obQuestionText') setObQuestionText(value);
    if (field === 'obExamType') setObExamType(value);
    if (field && field.startsWith('ob-')) {
      const key = field.replace('ob-', '');
      setObScoreInputs((prev) => ({ ...prev, [key]: value }));
    }
    if (field && field.startsWith('v2-')) {
      const [, subject, key] = field.split('-');
      if (subject === 'english' || subject === 'history') setScoreState((prev) => ({ ...prev, [subject]: value }));
      if (subject === 'korean' || subject === 'math') setScoreState((prev) => ({ ...prev, [subject]: { ...prev[subject], [key === 'type' ? 'type' : key === 'common' ? 'common' : 'elective']: value } }));
      if (subject === 'inq1' || subject === 'inq2') setScoreState((prev) => ({ ...prev, [subject === 'inq1' ? 'inquiry1' : 'inquiry2']: { ...prev[subject === 'inq1' ? 'inquiry1' : 'inquiry2'], [key === 'subject' ? 'subject' : 'score']: value } }));
    }
    if (field && field.startsWith('v2e-')) {
      const [, subject, key] = field.split('-');
      if (subject === 'english' || subject === 'history') setScoreEditState((prev) => ({ ...prev, [subject]: value }));
      if (subject === 'korean' || subject === 'math') setScoreEditState((prev) => ({ ...prev, [subject]: { ...prev[subject], [key === 'type' ? 'type' : key === 'common' ? 'common' : 'elective']: value } }));
      if (subject === 'inq1' || subject === 'inq2') setScoreEditState((prev) => ({ ...prev, [subject === 'inq1' ? 'inquiry1' : 'inquiry2']: { ...prev[subject === 'inq1' ? 'inquiry1' : 'inquiry2'], [key === 'subject' ? 'subject' : 'score']: value } }));
    }
  };

  const loadingUi = `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="center init-loading"><h3>StudyCrack 앱을 불러오는 중입니다...</h3><p class="sub">잠시만 기다려 주세요.</p></div></div></div></div>`;
  const fallbackUi = `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="center init-loading"><h3>데이터를 불러오지 못했습니다.</h3><p class="sub">다시 시도해주세요.</p><button class="btn btn-primary" data-action="retryInit">다시 시도</button></div></div></div></div>`;
  const renderedBase = loading ? loadingUi : error ? fallbackUi : !loggedIn && !['authLogin', 'authSignup'].includes(screen) ? screens.authLogin : current;
  const analysisOverlay = isAnalyzing && screen === 'analysis'
    ? `<div class="global-loading-overlay"><div class="global-loading-card"><div class="loading-dots"><i></i><i></i><i></i></div><b>분석중입니다</b><p>잠시만 기다려주세요</p></div></div>`
    : '';
  const onboardingOverlay = onboardingLoading
    ? `<div class="global-loading-overlay"><div class="global-loading-card"><img src="${CRACKY_SRC}" alt="크랙이" class="global-loading-char"/><div class="loading-dots"><i></i><i></i><i></i></div><b>${onboardingLoadingText}</b><p>잠시만 기다려주세요</p></div></div>`
    : '';
  const rendered = `${renderedBase}${analysisOverlay}${onboardingOverlay}`;

  return <div onClick={onClick} onInput={onInput} onBlur={onBlur} dangerouslySetInnerHTML={{ __html: rendered }} />;
}

const rootElement = document.getElementById('root');
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
