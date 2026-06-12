import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PLANNER_ITEMS,
  DEFAULT_SCORES,
  DEFAULT_USER
} from '../constants/mock-data.js';

// 메인 탭과 매핑되는 screen id (goto 시 탭 동기화 대상). 원본 App().goto와 동일.
export const MAIN_TAB_SCREENS = ['home', 'analysis', 'strategy', 'planner', 'my'];

const DEFAULT_TARGET_LIST = ['연세대학교 경영학과', '고려대학교 경영대학', '강서대학교 G2빅데이터경영학과'];

const DEFAULT_SCORE_STATE = {
  korean: { type: '', common: '', elective: '' },
  math: { type: '', common: '', elective: '' },
  english: '',
  history: '',
  inquiry1: { subject: '', score: '' },
  inquiry2: { subject: '', score: '' }
};

const DEFAULT_SCORE_EDIT_STATE = {
  korean: { type: '화법과작문', common: '', elective: '' },
  math: { type: '확률과통계', common: '', elective: '' },
  english: '',
  history: '',
  inquiry1: { subject: '', score: '' },
  inquiry2: { subject: '', score: '' }
};

// 모놀리식 App()의 useState 초기값을 단일 객체로 모은 런타임 상태 컨테이너 초기값.
// 인벤토리: docs/exec-plans/active/260613_phase7_app_state_inventory.md
// studyRecords/studySubjectRecords 등 localStorage 하이드레이션은 후속 effect 단계에서 채운다.
export function createInitialAppState() {
  return {
    // 앱/내비
    screen: 'splash',
    tab: 'home',
    rankingPeriod: 'daily',
    history: [],
    loading: true,
    loadingFadeOut: false,
    error: false,
    loggedIn: false,
    drawerOpen: false,
    // user/plan
    user: DEFAULT_USER,
    selectedPlan: DEFAULT_USER.plan,
    duration: '4주',
    targetMajor: DEFAULT_USER.targetUniversity,
    targetOpen: false,
    selectedUniversityIndex: 0,
    // analysis/대학
    analysisTargetList: [...DEFAULT_TARGET_LIST],
    homeTargetList: [...DEFAULT_TARGET_LIST],
    analysisSearchOpen: false,
    analysisSearchTerm: '',
    analysisMode: 'summary',
    analysisEtaStage: 1,
    analysisHighlightedSubject: '',
    analysisBarProjectionTarget: '',
    activeScoreView: 'target',
    universityModalOpen: false,
    addingUniversity: false,
    // 홈 슬라이더/드래그
    homeSlideIndex: 0,
    homeSlideMotion: '',
    scoreSlideMotion: '',
    homeDragOffset: 0,
    scoreDragOffset: 0,
    // planner
    selectedDate: '14',
    plannerCalendarOpen: false,
    plannerDraft: { subject: '', content: '', durationChoice: '', customMinutes: '' },
    plannerItems: DEFAULT_PLANNER_ITEMS,
    plannerEditIndex: null,
    // 공부 타이머/기록 (records는 후속 하이드레이션)
    studyRecords: [],
    studySubjectRecords: [],
    studyTimerRunning: false,
    activeStudySubject: '',
    activePlannerItemId: '',
    studySubjectSheetOpen: false,
    studySubjectSheetOnlyPlanned: false,
    showStudyBreakdown: false,
    expandedBreakdownSubject: '',
    // auth/login
    loginEmail: '',
    loginPassword: '',
    findEmailModalOpen: false,
    foundEmailMasked: '',
    resetPasswordModalOpen: false,
    resetPasswordStep: 'request',
    resetPasswordEmail: '',
    resetPasswordSending: false,
    // signup
    signupName: '',
    signupEmail: '',
    signupPassword: '',
    signupPasswordConfirm: '',
    signupPhone: '',
    signupBirth: '',
    signupGender: 'female',
    signupEmailVerified: false,
    signupPhoneVerified: false,
    signupTermsAll: false,
    signupTermsRequired: false,
    signupTermsMarketing: false,
    signupTrack: '',
    signupSource: '',
    signupPromoCode: '',
    signupEmailSending: false,
    signupPhoneSending: false,
    signupEmailCodeSent: false,
    signupPhoneCodeSent: false,
    signupEmailCode: '',
    signupPhoneCode: '',
    signupEmailTimerSeconds: 0,
    signupPhoneTimerSeconds: 0,
    openTermsType: '',
    // 온보딩/MBTI
    mbtiModalOpen: false,
    mbtiAnswers: { q1: '', q2: '', q3: '', q4: '' },
    mbtiResult: '',
    ob2SkippedNoScore: false,
    strongSubject: '',
    weakSubject: '',
    studyHours: '',
    studyDifficulty: '',
    ob3IsAnalyzing: true,
    onboardingLoading: false,
    onboardingLoadingText: '',
    obGradeStatus: '고1/2 재학',
    obSchoolName: '',
    obGed: false,
    obTrack: '예체능',
    obGoalText: '',
    obQuestionText: '',
    obExamType: '3월 모의고사',
    obScoreInputs: {},
    isAnalyzing: false,
    // 성적
    scores: DEFAULT_SCORES,
    scoreState: DEFAULT_SCORE_STATE,
    scoreEditState: DEFAULT_SCORE_EDIT_STATE,
    scoreEditOpen: false,
    scoreEditStep: 1,
    scoreExamType: '3월 모의고사',
    // 알림/FAQ
    notifications: DEFAULT_NOTIFICATIONS,
    openFaq: '',
    notifModalOpen: false,
    // mypage/계정
    logoutModalOpen: false,
    withdrawModalOpen: false,
    myProfileEditOpen: false,
    myProfileNameDraft: '',
    myProfileTargetDraft: '',
    withdrawPassword: '',
    // service/PRO/coaching
    proRequestModalOpen: false,
    proRequestText: '',
    proEliteMonth: '26년 4월',
    coachingSubmitted: false,
    coachingSheetOpen: false,
    coachingStep: 1,
    coachingMonth: '26년 4월',
    coachingSubjectRows: [],
    coachingPlannerFiles: [],
    coachingExamType: '',
    coachingExamFiles: [],
    coachingExamScores: {},
    coachingTrend: '',
    coachingDropReasons: [],
    coachingAnswers: { step4Reason: '', step5: '', step6: '', step7: '', step8: '' }
  };
}

// 내비게이션 백본 (순수). React 셸이 getState/setState를 주입한다.
// onScreenChange: 화면 전환 시 부수효과(스크롤 저장 등) 훅. 브라우저 의존은 셸이 주입.
export function createNavigationOps({ getState, setState, onScreenChange } = {}) {
  function goto(next, addHistory = true) {
    const state = getState();
    if (!next || next === state.screen) return false;
    onScreenChange?.(state.screen, next);
    const patch = { screen: next };
    if (addHistory && state.screen !== next) patch.history = [...state.history, state.screen];
    if (MAIN_TAB_SCREENS.includes(next)) patch.tab = next;
    setState(patch);
    return true;
  }

  function back() {
    const state = getState();
    onScreenChange?.(state.screen, null);
    if (!state.history.length) return goto('home', false);
    const clone = [...state.history];
    const prev = clone.pop();
    setState({ history: clone, screen: prev, ...(MAIN_TAB_SCREENS.includes(prev) ? { tab: prev } : {}) });
    return true;
  }

  return { goto, back };
}
