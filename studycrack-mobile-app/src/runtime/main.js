import React from 'react';
import { createRoot } from 'react-dom/client';
// V2 재디자인 스타일. foundation -> screen styles -> final layout overrides 순서를 유지한다.
import '../styles/foundation/tokens.css';
import '../styles/foundation/base.css';
import '../styles/foundation/shell.css';
import '../styles/components/primitives.css';
import '../styles/components/secondary.css';
import '../styles/components/mbti-survey.css';
import '../styles/components/insights.css';
import '../styles/foundation/motion.css';
import '../styles/components/modals.css';
import '../styles/components/navigation.css';
import '../styles/components/sheets.css';
import '../styles/components/drawers.css';
import '../styles/screens/auth-signup.css';
import '../styles/screens/auth-recovery.css';
import '../styles/screens/auth.css';
import '../styles/screens/onboarding.css';
import '../styles/screens/locked-splash.css';
import '../styles/screens/home-overlays.css';
import '../styles/screens/home-base.css';
import '../styles/screens/home.css';
import '../styles/screens/analysis-base.css';
import '../styles/screens/analysis-unified.css';
import '../styles/screens/analysis.css';
import '../styles/screens/planner-calendar.css';
import '../styles/screens/planner.css';
import '../styles/screens/planner-add.css';
import '../styles/screens/coaching.css';
import '../styles/screens/reports.css';
import '../styles/screens/service.css';
import '../styles/screens/mypage-support.css';
import '../styles/screens/mypage-data.css';
import '../styles/screens/mypage.css';
import '../styles/screens/ranking.css';
import '../styles/screens/score-input.css';
import '../styles/layout/mobile-layout-system.css';
import { renderAppBar } from '../components/app-bar.js';
import { renderAppShell } from '../components/app-shell.js';
import { renderIcon } from '../components/icon.js';
import { renderScoreJourneyCard, scoreTierClass } from '../components/score-journey.js';
import { renderTabBar, TAB_ITEMS } from '../components/tab-bar.js';
import { CRACKY_SRC, ONBOARDING_LOGO_SRC } from '../constants/assets.js';
import { createMobileEventHandlers } from '../handlers/mobile-handlers.js';
import { getScreenComponent, renderMobileScreen } from '../app/screen-registry.js';
import { renderScoreEditModal } from '../screens/profile/renderers.js';
import { MAIN_TAB_SCREENS, createInitialAppState, createNavigationOps, createStateSetters, hydrateAppState } from './app-state.js';
import { STORAGE_KEYS, readExamScoresMap, safeStringifySet, writeExamScoresMap } from '../state/storage.js';
import { buildDerivedContext } from './derived.js';
import { createBlankScoreState, fetchMobileAdmissionCalendar, fetchMobileBacktrace, fetchMobileNotifications, fetchMobileProReports, fetchMobileQnaHistory, fetchMobileScoreSimulation, fetchMobileTargetAnalysis, fetchMobileWeeklyReports, fetchStudyRanking, fetchUniversityCatalog, fetchUniversityRecommendations, mapExamDataToScorePatch, requestMobileProReport, saveMobileQna, saveMobileWeeklyCheck, saveNotificationPreferences, saveQualitative, saveQuantitative, saveStudySession, saveTargetUnivs, scoreExamTypeToKey, targetSlotsToList, uploadMobileFile, uploadMobileWeeklyFiles, upsertTargetSlot } from './persistence.js';
import { createUserDataResetPatch, fetchCurrentUser, mapUserToStatePatch } from './session.js';
import { buildAnalysisScoreView, buildScoreSignature, buildSimulationTargets, buildUniversityCards, canRetryInitialScore, canRetryInitialScorePayload, mergeScoreCache, normalizeServerResults } from './score-store.js';
import { createScrollOps } from './scroll-ops.js';
import { createTimerOps } from './timer-ops.js';
import { clearMobileAuthArtifacts } from './auth-service.js';
import { attachVisualViewportMetrics } from './visual-viewport.js';

const { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } = React;

// 스크롤 비-setter 연산(원본 window 스크롤 헬퍼). iOS 가드 상태를 유지해야 하므로
// 컴포넌트 밖 단일 인스턴스로 둔다(렌더마다 재생성 금지).
const scrollOps = createScrollOps();

// 라이브 공부 타이머 연산. 인터벌/누적 ref를 유지해야 하므로 컴포넌트 밖 단일 인스턴스.
const timerOps = createTimerOps();

// 제스처(드래그) 트랜지언트 상태 ref. 리스너 재부착·재렌더에도 진행 중 제스처가 유지되도록 모듈 레벨.
const touchStartXRef = { current: null };
const touchStartYRef = { current: null };
const touchLastXRef = { current: null };
const touchLastYRef = { current: null };
const touchTargetRef = { current: '' };
const touchCardRef = { current: null };
const suppressClickUntilRef = { current: 0 };

function markAppBooted() {
  if (typeof window === 'undefined') return;
  window.__studycrackAppBooted = true;
  window.__studycrackAssetSrc = {
    ...(window.__studycrackAssetSrc || {}),
    crackySrc: CRACKY_SRC,
    onboardingLogoSrc: ONBOARDING_LOGO_SRC
  };
}

markAppBooted();

// 홈 KPI 슬라이더 DOM 상태(원본 getHomeSliderState, 순수 DOM 조회 — 스테일 클로저 회피).
function getHomeSliderState(doc = globalThis.document) {
  const slider = doc?.querySelector?.('.home-kpi-slider');
  const track = slider?.querySelector?.('.home-kpi-track');
  const indicators = doc?.querySelectorAll?.('.home-kpi-indicator i') || [];
  const total = indicators.length;
  const activeIndex = Array.from(indicators).findIndex((el) => el.classList.contains('active'));
  return { slider, track, indicators, total, activeIndex: activeIndex >= 0 ? activeIndex : 0 };
}

function updatePossibleUnivSlider(slider, nextIndex) {
  if (!slider) return;
  const track = slider.querySelector?.('.possible-univ-track');
  const cards = slider.querySelectorAll?.('.possible-univ-card') || [];
  const total = cards.length;
  if (!track || !total) return;
  const idx = Math.max(0, Math.min(Number(nextIndex) || 0, total - 1));
  slider.dataset.slideIndex = String(idx);
  const target = Array.from(cards)[idx];
  const x = target ? target.offsetLeft : 0;
  track.style.transition = 'transform .35s cubic-bezier(.22,1,.36,1)';
  track.style.transform = `translate3d(-${x}px,0,0)`;
  slider.parentElement?.querySelectorAll?.('.slider-indicator [data-action="slideTo"]')?.forEach((dot, i) => {
    dot.classList?.toggle?.('active', i === idx);
  });
}

function uniqueTargetList(list = []) {
  return Array.from(new Set((list || []).map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 6);
}

function notifySaveFailure(result, message) {
  if (!result || result.ok !== false) return;
  globalThis.alert?.(result.error || message);
}

function buildDefaultCoachingSubjects(derived = {}) {
  const {
    todayPlannerItems = [],
    todayStudySeconds = 0,
    todaySubjectsWithTimer = {}
  } = derived;
  const rows = todayPlannerItems.map((item, idx) => {
    const subject = item.subject || '기타';
    const plannedHour = (Number(item.minutes || 0) / 60);
    const actualHour = (Number(todaySubjectsWithTimer[subject] || 0) / 3600);
    return {
      id: `plan-${idx}-${subject}`,
      sourceId: item.id || `plan-${idx}`,
      subject,
      detail: item.content || '',
      planned: plannedHour ? plannedHour.toFixed(1) : '',
      actual: actualHour ? actualHour.toFixed(1) : '',
      removable: true,
      placeholder: '세부과목 입력'
    };
  });
  if (rows.length) return rows;
  return ['국어', '수학', '영어', '탐구', '기타'].map((subject) => {
    const actualHour = (Number(todaySubjectsWithTimer[subject] || 0) || Number(todayStudySeconds || 0)) / 3600;
    const placeholder = subject === '국어'
      ? '세부과목 (예: 언매)'
      : subject === '수학'
        ? '세부과목 (예: 미적)'
        : subject === '영어'
          ? '세부과목 (예: 독해)'
          : subject === '탐구'
            ? '세부과목 (예: 생1)'
            : '세부과목 입력';
    return {
      id: `${subject}-base`,
      sourceId: `${subject}-base`,
      subject,
      detail: '',
      planned: '',
      actual: actualHour ? actualHour.toFixed(1) : '',
      removable: subject === '기타',
      placeholder
    };
  });
}

const PLAN_RANK = { free: 0, trial: 0, basic: 1, starter: 1, standard: 2, pro: 3 };
const SCREEN_REQUIREMENTS = {
  strategy: 'standard',
  planner: 'basic',
  plannerAdd: 'basic',
  weekly: 'standard',
  report: 'pro',
  reportDetail: 'pro',
  proElite: 'pro',
  tutor: 'pro'
};
const LOCKED_SCREEN_LABELS = {
  strategy: '학습 코칭',
  planner: '플래너',
  plannerAdd: '플래너 작성',
  weekly: '주간 피드백',
  report: 'PRO 리포트',
  reportDetail: '리포트 상세',
  proElite: 'PRO 전용 리포트',
  tutor: 'SKY튜터 1:1 피드백'
};

function getEffectiveTier(state = {}) {
  const raw = state.userTier || state.selectedPlan || '';
  return String(raw).toLowerCase();
}

function normalizeAccessTier(value) {
  const tier = String(value || '').toLowerCase();
  return tier === 'test' ? 'basic' : tier;
}

function parseAccessDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickActiveAccessSubscription(user = {}) {
  const now = Date.now();
  const pick = (sub) => {
    if (!sub || sub.status !== 'active') return null;
    const tier = normalizeAccessTier(sub.tier);
    const start = parseAccessDate(sub.startDate);
    if (start && now < start.getTime()) return null;
    if (tier === 'basic' || tier === 'starter') return sub;
    const end = parseAccessDate(sub.endDate) || (start ? new Date(start.getTime() + 28 * 24 * 60 * 60 * 1000) : null);
    if (end && now > end.getTime()) return null;
    return sub;
  };
  return pick(user.currentSubscription) || pick(user.pendingSubscription);
}

function canAccessTier(state, requiredTier) {
  if (!requiredTier) return true;
  return (PLAN_RANK[getEffectiveTier(state)] || 0) >= (PLAN_RANK[requiredTier] || 0);
}

function canUseScoreSimulation(state) {
  const user = state?.user || {};
  const activeSub = pickActiveAccessSubscription(user);
  if (!activeSub) return false;
  const tier = normalizeAccessTier(activeSub.tier);
  return ['basic', 'starter', 'standard', 'pro'].includes(tier);
}

function canUseReverseProjection(state) {
  return canAccessTier(state, 'standard');
}

function getRoleLoginPath(role) {
  if (role === 'admin') return '/admin/login';
  if (role === 'tutor') return '/tutor/login';
  return '/login';
}

async function blockNonStudentMobileSession(role) {
  if (typeof window === 'undefined') return;
  try {
    await window.apiFetch?.(window.CONFIG?.api?.auth, {
      method: 'POST',
      body: JSON.stringify({ type: 'logout' })
    });
  } catch (_error) {}
  try {
    clearMobileAuthArtifacts(window);
  } catch (_error) {}
  try {
    window.alert?.(role === 'tutor'
      ? '튜터 계정은 튜터 전용 페이지를 이용해주세요.'
      : '관리자 계정은 관리자 페이지를 이용해주세요.');
  } catch (_error) {}
  window.location.replace(getRoleLoginPath(role));
}

// 인증 만료 시 모바일 로그인 화면으로 보내는 경로. 현재 pathname 기준이되 비정상 경로는 정적 경로로 폴백.
function getMobileExpiredLoginPath() {
  const path = (typeof window !== 'undefined' && window.location && window.location.pathname) || '/studycrack-mobile.html';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/studycrack-mobile.html?screen=authLogin';
  return `${path}?screen=authLogin`;
}

// 인증 만료 단일 종료 가드: alert 없이 모바일 세션을 정리하고 로그인 화면으로 1회만 이동한다.
// 동시 다발 401/403이 발생해도 replace는 한 번만 수행된다.
let mobileSessionExpiring = false;
function expireMobileSessionSilently() {
  if (typeof window === 'undefined' || mobileSessionExpiring) return;
  mobileSessionExpiring = true;
  try {
    clearMobileAuthArtifacts(window);
  } catch (_error) {}
  window.location.replace(getMobileExpiredLoginPath());
}

function filterTabItemsForTier() {
  return TAB_ITEMS;
}

function buildScoreSelectionPatch(scoreExamType, current) {
  const scoreExamKey = scoreExamTypeToKey(scoreExamType);
  const mapped = mapExamDataToScorePatch(current.user?.quantitative?.[scoreExamKey], current);
  if (mapped) {
    // 분석 결과를 즉시 비우지 않고 갱신 대기로 둔다(stale-while-revalidate).
    // 동기적으로 []로 덮으면 재요청 응답 전까지 홈 카드가 라이브/0점으로 추락해 플리커가 발생한다.
    return {
      scoreExamType,
      scoreExamKey,
      ...mapped,
      analysisApiStatus: 'loading',
      analysisApiError: ''
    };
  }
  // 선택한 시험에 입력 성적이 없으면 이전 시험의 분석 결과를 비우고 빈 상태로 둔다(잘못된 stale 점수 방지).
  const blankScoreState = createBlankScoreState();
  return {
    scoreExamType,
    scoreExamKey,
    scores: {},
    scoreState: blankScoreState,
    scoreEditState: blankScoreState,
    analysisResults: [],
    analysisSimulations: [],
    analysisApiStatus: 'empty',
    analysisApiError: '선택한 시험에 입력된 성적이 없습니다.'
  };
}

function resolveAnalysisExamMode(state = {}) {
  const explicitKey = state.scoreExamKey || scoreExamTypeToKey(state.scoreExamType);
  if (explicitKey && explicitKey !== 'active') return explicitKey;
  const quantitative = state.user?.quantitative || {};
  return ['jun', 'may', 'mar', 'apr', 'jul', 'sep', 'oct', 'csat']
    .find((examKey) => {
      const item = quantitative[examKey];
      return item && typeof item === 'object' && (item.kor || item.math || item.eng || item.inq1 || item.inq2);
    }) || explicitKey || 'mar';
}

function buildRenderScoreCache(state = {}, examKey = '') {
  const baseCache = state.scoreCache || {};
  const snapshot = state.lastAnalysisSnapshot;
  const snapshotMatches = snapshot && snapshot.examMode === examKey;
  const liveResultsMatch = state.analysisResultExamMode === examKey
    && state.analysisResultSignature
    && state.analysisResultSignature === state.scoreFetchSignature;
  const analysisResults = liveResultsMatch
    ? state.analysisResults || []
    : snapshotMatches
      ? snapshot.analysisResults || []
      : [];
  const analysisSimulations = liveResultsMatch
    ? state.analysisSimulations || []
    : snapshotMatches
      ? snapshot.analysisSimulations || []
      : [];
  const merged = normalizeServerResults(analysisResults, analysisSimulations, state.scoreFetchSignature || '');
  return Object.keys(merged).length ? mergeScoreCache(baseCache, examKey, merged) : baseCache;
}

// 탭바 dimmed 조건. 원본 App()의 tabbarDimmed와 동일.
function isTabbarDimmed(state) {
  return Boolean(
    state.coachingSheetOpen ||
      state.studySubjectSheetOpen ||
      state.plannerEditIndex !== null ||
      state.drawerOpen ||
      state.universityModalOpen ||
      state.scoreEditOpen ||
      state.logoutModalOpen
  );
}

function reducer(state, patch) {
  return { ...state, ...patch };
}

const PUBLIC_MOBILE_SCREENS = new Set([
  'splash',
  'on1',
  'on2',
  'on3',
  'authLogin',
  'authSignup',
  'authFindId',
  'authFindPw',
  'privacyPolicy',
  'termsScreen'
]);

function isLocalMobilePreview() {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = window.location.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

function replaceMobileScreenParam(screen) {
  if (typeof window === 'undefined' || !window.location || !window.history) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('screen', screen);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (_error) {}
}

// 모바일 런타임 셸.
// URL ?screen=<id>는 로컬/디자인 점검 시 초기 화면 지정에만 사용한다.
// 초기 상태는 localStorage 하이드레이션을 적용(저장 effect와 짝 → 새로고침 간 상태 유지).
function createInitialAppStateWithScreenParam() {
  const base = hydrateAppState(createInitialAppState());
  if (typeof window === 'undefined' || !window.location) return base;
  const param = new URLSearchParams(window.location.search).get('screen');
  const hasSession = typeof window.hasClientSession === 'function' && window.hasClientSession();
  const sessionSafeBase = hasSession
    ? { ...base, personalEvents: [], calendarSyncStatus: 'loading' }
    : base;
  if (hasSession && (param === 'authLogin' || param === 'authSignup')) return { ...sessionSafeBase, screen: 'home', tab: 'home' };
  if (!hasSession && param && !isLocalMobilePreview() && !PUBLIC_MOBILE_SCREENS.has(param)) {
    replaceMobileScreenParam('authLogin');
    return { ...base, screen: 'authLogin', tab: 'home' };
  }
  return param
    ? { ...sessionSafeBase, screen: param, ...(MAIN_TAB_SCREENS.includes(param) ? { tab: param } : {}) }
    : sessionSafeBase;
}

function MobileApp() {
  const [state, setState] = useReducer(reducer, undefined, createInitialAppStateWithScreenParam);
  const stateRef = useRef(state);
  const plannerContentRef = useRef('');
  const plannerCustomMinutesRef = useRef('');
  const userFetchRetryRef = useRef(0);
  const scoreFetchRetryRef = useRef(0);
  const scoreFetchSignatureRef = useRef('');
  const scoreRequestIdRef = useRef(0);
  const scoreResultRetryRef = useRef({ signature: '', attempts: 0 });
  const simulationFetchSignatureRef = useRef('');
  const backtraceFetchSignatureRef = useRef('');

  const retryUserLoad = useCallback(() => {
    userFetchRetryRef.current = 0;
    setState({
      ...createUserDataResetPatch(),
      userLoadStatus: 'idle',
      userLoadError: '',
      userFetchRetryTick: (stateRef.current.userFetchRetryTick || 0) + 1
    });
  }, []);
  const qnaDraftRef = useRef({ title: '', content: '' });
  stateRef.current = state;

  useEffect(() => attachVisualViewportMetrics(), []);

  // 상태 키별 setX setter 자동 생성(핸들러 ctx 계약 충족). 키는 고정이라 1회 생성.
  const setters = useMemo(
    () => createStateSetters(Object.keys(stateRef.current), { setState, getState: () => stateRef.current }),
    []
  );

  const nav = useMemo(
    () =>
      createNavigationOps({
        getState: () => stateRef.current,
        setState,
        onScreenChange: (from) => {
          // 스크롤 저장은 후속 단계. 현재는 위치만 보존 가드.
          if (typeof window !== 'undefined' && from) {
            stateRef.current.__lastScrollY = window.scrollY || window.pageYOffset || 0;
          }
        }
      }),
    []
  );

  const getUserApiBinding = useCallback(
    () => ({
      apiFetch: (typeof window !== 'undefined' && window.apiFetch) || null,
      userApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.user) || ''
    }),
    []
  );

  const getAnalysisApiBinding = useCallback(
    () => ({
      apiFetch: (typeof window !== 'undefined' && window.apiFetch) || null,
      analysisApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.analysis) || ''
    }),
    []
  );

  const getReportApiBinding = useCallback(
    () => ({
      apiFetch: (typeof window !== 'undefined' && window.apiFetch) || null,
      reportApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.report) || ''
    }),
    []
  );

  const getQnaApiBinding = useCallback(
    () => ({
      apiFetch: (typeof window !== 'undefined' && window.apiFetch) || null,
      qnaApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.qna) || ''
    }),
    []
  );

  const getNotiApiBinding = useCallback(
    () => ({
      apiFetch: (typeof window !== 'undefined' && window.apiFetch) || null,
      notiApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.noti) || ''
    }),
    []
  );

  const getFileApiBinding = useCallback(
    () => ({
      apiFetch: (typeof window !== 'undefined' && window.apiFetch) || null,
      fetchImpl: (typeof window !== 'undefined' && window.fetch?.bind(window)) || globalThis.fetch,
      fileApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.file) || ''
    }),
    []
  );

  const persistTargetUnivs = useCallback(
    (targetList, targetSlots) => saveTargetUnivs({ ...getUserApiBinding(), targetList, targetSlots }),
    [getUserApiBinding]
  );

  const persistQuantitative = useCallback(
    (quantitative) => saveQuantitative({ ...getUserApiBinding(), quantitative }),
    [getUserApiBinding]
  );

  const persistQualitative = useCallback(
    (qualitative) => saveQualitative({ ...getUserApiBinding(), qualitative }),
    [getUserApiBinding]
  );

  const persistStudySession = useCallback(
    (session) => saveStudySession({ ...getUserApiBinding(), session }),
    [getUserApiBinding]
  );

  const persistNotificationPreferences = useCallback(
    (preferences) => saveNotificationPreferences({ ...getUserApiBinding(), preferences }),
    [getUserApiBinding]
  );

  const persistMobileQna = useCallback(
    ({ title, content } = {}) => saveMobileQna({ ...getQnaApiBinding(), title, content }),
    [getQnaApiBinding]
  );

  const persistProReportRequest = useCallback(
    (requestText) => requestMobileProReport({ ...getReportApiBinding(), requestText }),
    [getReportApiBinding]
  );

  const persistWeeklyCheck = useCallback(
    (payload) => saveMobileWeeklyCheck({ ...getReportApiBinding(), payload }),
    [getReportApiBinding]
  );

  const uploadWeeklyCheckFiles = useCallback(
    ({ examFiles, plannerFiles } = {}) => uploadMobileWeeklyFiles({ ...getFileApiBinding(), examFiles, plannerFiles }),
    [getFileApiBinding]
  );

  const uploadProfileImage = useCallback(
    (file) => uploadMobileFile({ ...getFileApiBinding(), file, folder: 'profile' }),
    [getFileApiBinding]
  );

  // 플래너 진입/날짜 변경 시 날짜 스트립을 선택 날짜로 가로 센터링.
  // planner가 JSX(React 트리)라 스트립 노드가 재렌더 간 유지되므로 센터링이 정착한다.
  // useLayoutEffect에서 동기 실행: commit 직후 layout이 준비되고 paint 전이라 깜빡임이 없으며,
  // requestAnimationFrame에 의존하지 않아 모든 환경(헤드리스 포함)에서 동작한다.
  // 미연결 화면에선 .planner-date-strip 부재로 no-op.
  const plannerCenteredRef = useRef(false);
  useLayoutEffect(() => {
    if (state.screen !== 'planner') return;
    const behavior = plannerCenteredRef.current ? 'smooth' : 'auto';
    scrollOps.centerPlannerDate(state.selectedDate, behavior);
    plannerCenteredRef.current = true;
  }, [state.screen, state.selectedDate]);

  useEffect(() => {
    if (state.screen === 'home' || state.homeDragOffset === 0) return;
    setState({ homeDragOffset: 0 });
  }, [state.screen, state.homeDragOffset]);

  const dimmed = isTabbarDimmed(state);
  const visibleTabItems = filterTabItemsForTier();

  const beforeGoto = useCallback(({ target } = {}) => {
    const required = SCREEN_REQUIREMENTS[target];
    if (!required || canAccessTier(stateRef.current, required)) return true;
    const label = LOCKED_SCREEN_LABELS[target] || '선택한 기능';
    setState({
      upgradePromptTier: required,
      upgradePromptTarget: label,
      lockedFeatureTarget: target,
      lockedFeatureTier: required,
      lockedFeatureLabel: label,
      ...(MAIN_TAB_SCREENS.includes(target) ? { tab: target } : {})
    });
    nav.goto('lockedFeature');
    return false;
  }, [nav]);

  const derivedCtx = buildDerivedContext(state, timerOps.studyTimerSecondsRef.current);
  const renderExamKey = resolveAnalysisExamMode(state);
  const renderScoreCache = buildRenderScoreCache(state, renderExamKey);
  const baseCtx = {
    ...state,
    isAnalyzing: state.analysisApiStatus === 'loading'
      && !(state.analysisResults || []).length
      && !(state.lastAnalysisSnapshot?.analysisResults || []).length,
    // 상태 키별 setX setter 전체(핸들러 ctx 계약)
    ...setters,
    // 화면 renderer가 기대하는 derived view-model(원시 state에서 파생).
    // 라이브 타이머 ref 현재값을 더해 재렌더 시 표시/랭킹/진행률이 base+live로 일관되게 한다.
    ...derivedCtx,
    initializeApp: retryUserLoad,
    // [환산점수 단일 출처] 홈 대학 카드는 homeTargetList(고정 순서) + scoreCache(서버 점수)에서만 만든다.
    // targetMajor로 재정렬하던 computeHomeTargets 경로를 대체 → 1~3지망 순서 섞임/라이브·0 폴백 제거.
    homeTargets: buildUniversityCards(
      uniqueTargetList(state.homeTargetList || []),
      renderScoreCache,
      renderExamKey,
      state.scoreFetchStatus
    ),
    // [환산점수 단일 출처] 분석 화면의 점수/게이지/시뮬레이션 타겟도 scoreCache(서버)에서만 만든다.
    // 분석 선택 대학(targetMajor)은 분석 전용 — homeTargets(homeTargetList)와 분리되어 홈 순서에 영향 없음.
    ...(() => {
      const examKey = renderExamKey;
      const targets = uniqueTargetList([...(state.analysisTargetList || []), ...(state.homeTargetList || [])]);
      const selectedMajor = targets.includes(state.targetMajor)
        ? state.targetMajor
        : targets[0] || state.targetMajor || '';
      const view = buildAnalysisScoreView(selectedMajor, renderScoreCache, examKey, state.scoreFetchStatus);
      return {
        analysisSelected: { ...(derivedCtx.analysisSelected || {}), score: view.score },
        analysisScoreView: view,
        analysisStatus: view.status,
        analysisStatusColor: view.color,
        analysisGaugeColor: view.color,
        analysisGaugeFill: view.pct,
        gaugeCurrent: view.score,
        gaugeCurrentPct: view.pct,
        gaugeTarget: view.score,
        gaugeTargetPct: view.pct,
        gaugePassPct: 40,
        gaugeSafePct: 60,
        analysisSimulationTargets: buildSimulationTargets(targets, renderScoreCache, examKey),
        analysisMajorOptions: targets,
        normalizedTargetMajor: selectedMajor
      };
    })(),
    // 렌더 helper (실제 컴포넌트 주입)
    icon: renderIcon,
    appbar: (title, showBack) => renderAppBar({ title, showBack }),
    // 셸 조각을 분리 반환한다(MobileApp이 배경/오버레이/탭바를 각각 dangerouslySetInnerHTML div로 렌더).
    // 모달 상태만 바뀌면 inner(__html)가 그대로라 React가 배경 DOM을 건드리지 않아 배경 깜빡임이 없다.
    layout: (inner, withTab, overlays = '') => ({
      __mobileShell: true,
      inner: String(inner || ''),
      withTab: Boolean(withTab),
      overlays: String(overlays || '')
    }),
    // JSX 화면이 셸을 직접 조립할 때 쓰는 raw 값(문자열 leaf로 임베드).
    dimmed,
    tabBarHtml: renderTabBar({ tab: state.tab, dimmed, icon: renderIcon, items: visibleTabItems }),
    // 내비게이션 백본
    goto: nav.goto,
    back: nav.back,
    beforeGoto,
    // window.CONFIG에서 API URL을 주입한다. 미설정 시 핸들러는 graceful no-op.
    authApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.auth) || '',
    analysisApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.analysis) || '',
    apiBase: (typeof window !== 'undefined' && window.CONFIG?.api) || null,
    canAccessStandard: canAccessTier(state, 'standard'),
    canAccessPro: canAccessTier(state, 'pro'),
    // 공용 API/session helper를 재사용한다. 미로드 시 graceful no-op.
    apiFetch: (typeof window !== 'undefined' && window.apiFetch) || null,
    userApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.user) || '',
    notiApiUrl: (typeof window !== 'undefined' && window.CONFIG?.api?.noti) || '',
    hasClientSession: (typeof window !== 'undefined' && window.hasClientSession) || (() => false),
    redirectToLogin: (typeof window !== 'undefined' && window.redirectToLogin) || (() => {}),
    expireMobileSessionSilently,
    canAccessBasic: canAccessTier(state, 'basic'),
    canUseScoreSimulation: canUseScoreSimulation(state),
    canUseReverseProjection: canUseReverseProjection(state),
    // 비-setter 스크롤 연산(원본 1:1). preserveScroll은 추가 payload 인자를 무시한다.
    preserveScroll: (task) => scrollOps.preserveScrollAfterStateChange(task),
    preserveScrollAfterStateChange: scrollOps.preserveScrollAfterStateChange,
    preserveY: scrollOps.preserveY,
    afterSafariViewportStable: scrollOps.afterSafariViewportStable,
    restoreIfUnexpectedTopJump: scrollOps.restoreIfUnexpectedTopJump,
    markStableScrollPosition: scrollOps.markStableScrollPosition,
    centerPlannerDate: scrollOps.centerPlannerDate,
    // 라이브 공부 타이머(원본 1:1). interval이 [data-study-base-seconds] DOM을 직접 갱신.
    studyTimerSecondsRef: timerOps.studyTimerSecondsRef,
    startLiveStudyTimer: timerOps.startLiveStudyTimer,
    stopLiveStudyTimer: timerOps.stopLiveStudyTimer,
    syncLiveStudyTimerUi: timerOps.syncLiveStudyTimerUi,
    // 홈 슬라이더 드래그 제스처(원본 1:1). touch ref는 모듈 레벨, slider 상태는 DOM 조회.
    touchStartXRef,
    touchStartYRef,
    touchLastXRef,
    touchLastYRef,
    touchTargetRef,
    touchCardRef,
    suppressClickUntilRef,
    plannerContentRef,
    plannerCustomMinutesRef,
    qnaDraftRef,
    qnaDraftTitle: qnaDraftRef.current.title,
    qnaDraftContent: qnaDraftRef.current.content,
    isIOSSafari: scrollOps.isIOSSafari,
    getHomeSliderState: () => getHomeSliderState(),
    updatePossibleUnivSlider,
    scoreTierClass,
    ScoreEditModal: () => renderScoreEditModal(stateRef.current),
    // 슬라이드 확정은 state로 반영(JSX 트랙이 유지된 채 transform transition 적용). 원본은 DOM-direct였으나
    // 이 런타임은 재렌더가 state→DOM이라 state 경유가 필요하다.
    setHomeSlideDom: (index, motion = '') => {
      const { total } = getHomeSliderState();
      const max = Math.max(0, total - 1);
      const next = Math.max(0, Math.min(Number(index) || 0, max));
      setState({ homeSlideIndex: next, homeSlideMotion: motion || '' });
    },
    // 자주 쓰는 최소 연산 (나머지 도메인 연산은 후속 단계에서 연결)
    setField: (key, value) => setState({ [key]: value }),
    closeDrawer: () => setState({ drawerOpen: false }),
    selectPlan: (plan) => setState({ checkoutPlan: plan }),
    markOnboardingComplete: () => setState({ loggedIn: true }),
    getExamScoresMap: () => readExamScoresMap(),
    saveExamScoresMap: (map) => writeExamScoresMap(map),
    applyScoreExamSelection: (scoreExamType) => setState(buildScoreSelectionPatch(scoreExamType, stateRef.current)),
    persistTargetUnivs,
    persistQuantitative,
    persistQualitative,
    persistStudySession,
    persistNotificationPreferences,
    persistMobileQna,
    persistProReportRequest,
    persistWeeklyCheck,
    uploadProfileImage,
    uploadWeeklyCheckFiles,
    ensureCoachingSubjectRows: () => {
      const current = stateRef.current;
      if ((current.coachingSubjectRows || []).length) return;
      setState({ coachingSubjectRows: buildDefaultCoachingSubjects(derivedCtx) });
    },
    addMajorToTargets: (major) => {
      if (!major) return false;
      const current = stateRef.current;
      const nextSlots = upsertTargetSlot(current.targetUnivSlots, major);
      const nextHome = targetSlotsToList(nextSlots);
      const nextAnalysis = uniqueTargetList(nextHome);
      setState({
        targetUnivSlots: nextSlots,
        analysisTargetList: nextAnalysis,
        homeTargetList: nextHome,
        targetMajor: current.targetMajor || major
      });
      persistTargetUnivs(nextHome, nextSlots).then((result) => notifySaveFailure(result, '목표 대학 저장에 실패했습니다.'));
      return true;
    }
  };
  const ctx = {
    ...baseCtx,
    scoreJourneyCard: (title) => renderScoreJourneyCard(baseCtx, title)
  };

  const events = useMemo(() => createMobileEventHandlers(ctx), [ctx]);

  // HTML fallback timer가 정상 부팅을 인식하도록 플래그를 세운다.
  useEffect(() => {
    markAppBooted();
  }, []);

  // 초기 진입 흐름: splash를 잠깐 노출한 뒤 이동.
  // 이미 로그인된 사용자는 바로 홈으로, 미로그인은 소개 화면으로 이동한다.
  useEffect(() => {
    if (state.screen !== 'splash') return undefined;
    const loggedIn =
      typeof window !== 'undefined' && typeof window.hasClientSession === 'function' && window.hasClientSession();
    const dest = loggedIn ? 'home' : 'on1';
    const timer = globalThis.setTimeout?.(() => nav.goto(dest, false), 900);
    return () => {
      if (timer) globalThis.clearTimeout?.(timer);
    };
  }, [state.screen, nav]);

  // 원본 motion/easing state 정리. class가 남으면 다음 전환 애니메이션이 재발화하지 않는다.
  useEffect(() => {
    if (!state.homeSlideMotion) return undefined;
    const timer = globalThis.setTimeout?.(() => setState({ homeSlideMotion: '' }), 420);
    return () => {
      if (timer) globalThis.clearTimeout?.(timer);
    };
  }, [state.homeSlideMotion]);

  useEffect(() => {
    if (!state.scoreSlideMotion) return undefined;
    const timer = globalThis.setTimeout?.(() => setState({ scoreSlideMotion: '' }), 380);
    return () => {
      if (timer) globalThis.clearTimeout?.(timer);
    };
  }, [state.scoreSlideMotion]);

  useEffect(() => {
    const session = state.activeStudySession;
    if (!session || session.status !== 'running') {
      timerOps.stopLiveStudyTimer();
      return undefined;
    }
    timerOps.startLiveStudyTimer(session.startedAt, (seconds) => setState({ studyTimerTick: seconds }));
    return () => timerOps.stopLiveStudyTimer();
  }, [state.activeStudySession?.sessionId]);

  useEffect(() => {
    if (!['home', 'ranking'].includes(state.screen) || state.userLoadStatus !== 'ready') return undefined;
    let cancelled = false;
    setState({ rankingStatus: 'loading', rankingError: '' });
    const period = state.screen === 'ranking' ? state.rankingPeriod : 'daily';
    fetchStudyRanking({ ...getUserApiBinding(), period }).then((result) => {
      if (cancelled) return;
      setState({
        rankingRows: result.rows || [],
        rankingMe: result.me || null,
        rankingStatus: result.ok ? ((result.rows || []).length ? 'ready' : 'empty') : 'error',
        rankingError: result.error || ''
      });
    });
    return () => {
      cancelled = true;
    };
  }, [getUserApiBinding, state.screen, state.rankingPeriod, state.userLoadStatus]);

  useEffect(() => {
    if (state.screen === 'accountInfo') return;
    if (!state.phoneChangeModalOpen && !state.myProfileEditOpen) return;
    setState({
      phoneChangeModalOpen: false,
      phoneChangeStep: 'input',
      phoneChangeSending: false,
      myProfileEditOpen: false,
      myProfileNameDraft: '',
      myProfilePhoneDraft: '',
      myProfilePhoneCodeDraft: ''
    });
  }, [state.screen, state.phoneChangeModalOpen, state.myProfileEditOpen]);

  // 원본 ob3 분석 로딩은 1.5초 후 해제된다. ob5 직접 진입 시에도 영구 오버레이를 방지한다.
  useEffect(() => {
    if (state.screen === 'ob5') {
      if (state.ob3IsAnalyzing) setState({ ob3IsAnalyzing: false });
      return undefined;
    }
    if (state.screen !== 'ob3') return undefined;
    setState({ ob3IsAnalyzing: true });
    const timer = globalThis.setTimeout?.(() => setState({ ob3IsAnalyzing: false }), 1500);
    return () => {
      if (timer) globalThis.clearTimeout?.(timer);
      setState({ ob3IsAnalyzing: false });
    };
  }, [state.screen]);

  // 제스처(드래그) 리스너를 document에 부착(원본 attachGestureListeners). events가 매 렌더 새 ctx로
  // 재생성되므로 [events]로 재부착 → 핸들러가 항상 현재 state를 본다(스테일 방지). 홈 드래그 move는
  // DOM-direct라 드래그 중 setState가 없어 재부착 thrash가 없다. cleanup이 이전 리스너를 제거.
  useEffect(() => events.gesture?.attachGestureListeners?.(), [events]);

  // localStorage 영속(원본 per-key useEffect 1:1). 변경 시 저장 → hydrateAppState와 짝으로 새로고침 유지.
  useEffect(() => { safeStringifySet(STORAGE_KEYS.scores, state.scores); }, [state.scores]);
  useEffect(() => { safeStringifySet(STORAGE_KEYS.plannerItems, state.plannerItems); }, [state.plannerItems]);
  useEffect(() => { safeStringifySet(STORAGE_KEYS.notifications, state.notifications); }, [state.notifications]);
  useEffect(() => { safeStringifySet(STORAGE_KEYS.studyRecords, state.studyRecords); }, [state.studyRecords]);
  useEffect(() => { safeStringifySet(STORAGE_KEYS.studySubjectRecords, state.studySubjectRecords); }, [state.studySubjectRecords]);
  useEffect(() => { safeStringifySet(STORAGE_KEYS.activeStudySession, state.activeStudySession); }, [state.activeStudySession]);
  useEffect(() => { safeStringifySet(STORAGE_KEYS.admissionCalendar, state.personalEvents); }, [state.personalEvents]);
  useEffect(() => {
    // 문자열 키는 원본과 동일하게 raw 저장(readString과 짝).
    const ls = globalThis.localStorage;
    if (!ls?.setItem) return;
    try {
      ls.setItem(STORAGE_KEYS.selectedPlan, String(state.selectedPlan ?? ''));
      ls.setItem(STORAGE_KEYS.selectedUniversity, String(state.targetMajor ?? ''));
      ls.setItem(STORAGE_KEYS.activeTab, String(state.tab ?? ''));
    } catch (_error) {
      /* 저장 실패는 무시(quota/사파리 프라이빗) */
    }
  }, [state.selectedPlan, state.targetMajor, state.tab]);

  // 세션이 있으면 사용자 데이터를 불러온다. 사용자별 값은 서버 응답만 신뢰한다.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) return undefined;
    const userApiBinding = getUserApiBinding();
    if (typeof userApiBinding.apiFetch !== 'function' || !userApiBinding.userApiUrl) {
      const retryDelay = Math.min(1200, 250 + userFetchRetryRef.current * 100);
      setState({ ...createUserDataResetPatch(), userLoadStatus: 'loading', userLoadError: '' });
      const timer = globalThis.setTimeout?.(() => {
        userFetchRetryRef.current += 1;
        if (userFetchRetryRef.current >= 40) {
          setState({ userLoadStatus: 'error', userLoadError: '사용자 정보 연결을 준비하지 못했습니다. 다시 시도해주세요.' });
          return;
        }
        setState({ userFetchRetryTick: (stateRef.current.userFetchRetryTick || 0) + 1 });
      }, retryDelay);
      return () => {
        if (timer) globalThis.clearTimeout?.(timer);
      };
    }
    userFetchRetryRef.current = 0;
    let cancelled = false;
    setState({ ...createUserDataResetPatch(), userLoadStatus: 'loading', userLoadError: '' });
    fetchCurrentUser(userApiBinding).then((userData) => {
      if (cancelled) return;
      if (!userData) {
        setState({ userLoadStatus: 'error', userLoadError: '사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
        return;
      }
      const role = String(userData.role || 'student').toLowerCase();
      if (role && role !== 'student') {
        blockNonStudentMobileSession(role);
        return;
      }
      if (userData.role) {
        try { localStorage.setItem('userRole', userData.role); } catch (_error) {}
      }
      const patch = mapUserToStatePatch(userData, stateRef.current);
      setState({ ...patch, userLoadStatus: 'ready', userLoadError: '' });
    }).catch((error) => {
      if (cancelled) return;
      // 인증 만료: alert 없이 세션 정리 후 모바일 로그인 화면으로 1회만 이동.
      if (error && error.code === 'AUTH_EXPIRED') {
        expireMobileSessionSilently();
        return;
      }
      setState({ userLoadStatus: 'error', userLoadError: '사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
    });
    return () => {
      cancelled = true;
    };
  }, [getUserApiBinding, state.userFetchRetryTick]);

  useEffect(() => {
    if (typeof window === 'undefined' || state.userLoadStatus !== 'ready') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) {
      setState({ calendarSyncStatus: 'local' });
      return undefined;
    }
    let cancelled = false;
    setState({ calendarSyncStatus: 'loading' });
    fetchMobileAdmissionCalendar(getUserApiBinding()).then((events) => {
      if (cancelled) return;
      if (!events) {
        setState({ calendarSyncStatus: 'error' });
        return;
      }
      setState({ personalEvents: events, calendarSyncStatus: 'ready' });
    }).catch((error) => {
      if (cancelled) return;
      if (error?.code === 'AUTH_EXPIRED') {
        expireMobileSessionSilently();
        return;
      }
      setState({ calendarSyncStatus: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [getUserApiBinding, state.userLoadStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) return undefined;
    let cancelled = false;
    fetchUniversityCatalog(getAnalysisApiBinding()).then((catalog) => {
      if (cancelled || !catalog.length) return;
      setState({ universityCatalog: catalog });
    });
    return () => {
      cancelled = true;
    };
  }, [getAnalysisApiBinding]);

  useEffect(() => {
    if (state.screen !== 'addUniversity' || state.userLoadStatus !== 'ready') return undefined;
    const examMode = resolveAnalysisExamMode(state);
    const examData = state.user?.quantitative?.[examMode];
    let cancelled = false;
    setState({ universityRecommendationStatus: 'loading', universityRecommendationError: '' });
    fetchUniversityRecommendations({
      ...getAnalysisApiBinding(),
      examData,
      examMode,
      savedStream: state.user?.qualitative?.stream || state.obTrack,
      excludeTargets: state.analysisTargetList
    }).then((result) => {
      if (cancelled) return;
      setState({
        universityRecommendations: result.recommendations || [],
        universityRecommendationStatus: result.ok && result.recommendations?.length ? 'ready' : 'empty',
        universityRecommendationError: result.error || ''
      });
    });
    return () => {
      cancelled = true;
    };
  }, [getAnalysisApiBinding, state.screen, state.userLoadStatus, state.universityRecommendationRetryTick]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) return undefined;
    let cancelled = false;
    setState({ proReportsStatus: 'loading' });
    fetchMobileProReports(getReportApiBinding()).then((reports) => {
      if (cancelled || !reports) return;
      setState({ proReports: reports, proReportsStatus: reports.length ? 'ready' : 'empty' });
    }).catch(() => {
      if (!cancelled) setState({ proReports: [], proReportsStatus: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [getReportApiBinding]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) return undefined;
    let cancelled = false;
    setState({ qnaStatus: 'loading' });
    fetchMobileQnaHistory(getQnaApiBinding()).then((items) => {
      if (cancelled || !items) return;
      setState({ qnaHistory: items, qnaStatus: items.length ? 'ready' : 'empty' });
    }).catch(() => {
      if (!cancelled) setState({ qnaHistory: [], qnaStatus: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [getQnaApiBinding]);

  // 세션이 있으면 알림을 로드한다.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) return undefined;
    let cancelled = false;
    setState({ notiStatus: 'loading' });
    fetchMobileNotifications(getNotiApiBinding()).then((items) => {
      if (cancelled || !items) return;
      setState({ notiList: items, notiStatus: items.length ? 'ready' : 'empty' });
    }).catch(() => {
      if (!cancelled) setState({ notiList: [], notiStatus: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [getNotiApiBinding]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) return undefined;
    let cancelled = false;
    setState({ weeklyReportsStatus: 'loading' });
    fetchMobileWeeklyReports(getReportApiBinding()).then((reports) => {
      if (cancelled || !reports) return;
      setState({ weeklyReports: reports, weeklyReportsStatus: reports.length ? 'ready' : 'empty' });
    }).catch(() => {
      if (!cancelled) setState({ weeklyReports: [], weeklyReportsStatus: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [getReportApiBinding]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) return undefined;
    const examMode = resolveAnalysisExamMode(state);
    const userScores = state.user?.quantitative?.[examMode] || state.user?.quantitative?.active;
    const targetList = uniqueTargetList([
      state.targetMajor,
      ...(state.analysisTargetList || []),
      ...(state.homeTargetList || [])
    ]);
    if (state.userLoadStatus === 'error') {
      scoreRequestIdRef.current += 1;
      if (state.analysisApiStatus !== 'error' || state.scoreFetchStatus !== 'error') {
        setState({
          analysisApiStatus: 'error',
          analysisApiError: state.userLoadError || '사용자 정보를 불러오지 못했습니다.',
          scoreFetchStatus: 'error',
          scoreFetchSignature: ''
        });
      }
      return undefined;
    }
    if (state.userLoadStatus !== 'ready') {
      scoreRequestIdRef.current += 1;
      if (state.scoreFetchStatus !== 'loading') {
        setState({ analysisApiStatus: 'loading', analysisApiError: '', scoreFetchStatus: 'loading' });
      }
      return undefined;
    }
    if (!userScores || !targetList.length) {
      scoreRequestIdRef.current += 1;
      scoreFetchRetryRef.current = 0;
      scoreFetchSignatureRef.current = '';
      const hasPrevious = (state.analysisResults || []).length || state.lastAnalysisSnapshot?.analysisResults?.length;
      const scorePatch = stateRef.current.scoreFetchStatus === 'loading'
        ? { scoreFetchStatus: 'empty', scoreFetchSignature: '' }
        : { scoreFetchSignature: '' };
      if (!hasPrevious && state.analysisApiStatus !== 'empty') {
        setState({ analysisApiStatus: 'empty', analysisApiError: !userScores ? '선택한 시험에 입력된 성적이 없습니다.' : '', ...scorePatch });
      } else if (hasPrevious && state.analysisApiStatus !== 'stale') {
        setState({ analysisApiStatus: 'stale', analysisApiError: !userScores ? '선택한 시험에 입력된 성적이 없어 이전 결과를 보여드리고 있습니다.' : '', ...scorePatch });
      }
      return undefined;
    }

    const scoreSignature = buildScoreSignature(examMode, targetList, userScores);
    if (scoreResultRetryRef.current.signature !== scoreSignature) {
      scoreResultRetryRef.current = { signature: scoreSignature, attempts: 0 };
    }
    const apiBinding = getAnalysisApiBinding();
    if (typeof apiBinding.apiFetch !== 'function' || !apiBinding.analysisApiUrl) {
      scoreRequestIdRef.current += 1;
      const retryDelay = Math.min(1200, 250 + scoreFetchRetryRef.current * 100);
      const timer = globalThis.setTimeout?.(() => {
        scoreFetchRetryRef.current += 1;
        if (scoreFetchRetryRef.current >= 40) {
          setState({ analysisApiStatus: 'error', analysisApiError: '분석 설정을 불러오지 못했습니다.', scoreFetchStatus: 'error' });
          return;
        }
        setState({ scoreFetchRetryTick: stateRef.current.scoreFetchRetryTick + 1 });
      }, retryDelay);
      return () => {
        if (timer) globalThis.clearTimeout?.(timer);
      };
    }
    if (
      scoreFetchSignatureRef.current === scoreSignature
      && state.scoreFetchSignature === scoreSignature
      && (state.scoreFetchStatus === 'loading' || state.scoreFetchStatus === 'ready')
    ) return undefined;
    scoreFetchRetryRef.current = 0;
    const requestId = scoreRequestIdRef.current + 1;
    scoreRequestIdRef.current = requestId;
    scoreFetchSignatureRef.current = scoreSignature;
    simulationFetchSignatureRef.current = '';
    setState({ analysisApiStatus: 'loading', analysisApiError: '', scoreFetchStatus: 'loading', scoreFetchSignature: scoreSignature });
    // cancelled 플래그를 쓰지 않는다(in-flight 응답 유실 버그 방지). staleness는 응답 토큰 가드로만 판정.
    fetchMobileTargetAnalysis({ ...apiBinding, targetList, userScores, examMode }).then((payload) => {
      if (scoreRequestIdRef.current !== requestId || scoreFetchSignatureRef.current !== scoreSignature) return;
      if (!payload) {
        const timer = globalThis.setTimeout?.(() => {
          setState({ scoreFetchStatus: 'idle', scoreFetchRetryTick: stateRef.current.scoreFetchRetryTick + 1 });
        }, 250);
        if (!timer) setState({ scoreFetchStatus: 'idle', scoreFetchRetryTick: stateRef.current.scoreFetchRetryTick + 1 });
        return;
      }
      const analysisResults = payload.analysisResults || [];
      const analysisSimulations = [];
      const hasPrevious = (stateRef.current.analysisResults || []).length || stateRef.current.lastAnalysisSnapshot?.analysisResults?.length;
      const analysisError = payload.analysisError || null;
      if (canRetryInitialScorePayload({ error: analysisError, resultCount: analysisResults.length }, scoreResultRetryRef.current.attempts)) {
        scoreResultRetryRef.current.attempts += 1;
        const retryDelay = 300 * scoreResultRetryRef.current.attempts;
        globalThis.setTimeout?.(() => {
          if (scoreRequestIdRef.current !== requestId || scoreFetchSignatureRef.current !== scoreSignature) return;
          setState({
            analysisApiStatus: 'loading',
            analysisApiError: '',
            scoreFetchStatus: 'idle',
            scoreFetchRetryTick: stateRef.current.scoreFetchRetryTick + 1
          });
        }, retryDelay);
        return;
      }
      if (analysisResults.length) scoreResultRetryRef.current.attempts = 0;
      const nextStatus = analysisResults.length
        ? 'ready'
        : analysisError
          ? (hasPrevious ? 'stale' : 'error')
          : 'empty';
      // 홈/분석 단일 출처: 같은 fetch 결과를 scoreCache에도 머지한다. 홈 카드는 이 캐시만 읽으므로
      // "분석탭 갔다와야 점수가 뜨던" 문제가 사라진다(분석에서 점수가 뜨면 홈에서도 즉시 뜸).
      const merged = normalizeServerResults(analysisResults, [], scoreSignature);
      const hasEntries = Object.keys(merged).length > 0;
      const hasScores = Object.values(merged).some((entry) => entry.available !== false && Number.isFinite(Number(entry.score)));
      setState({
        analysisResults,
        analysisSimulations,
        analysisResultExamMode: examMode,
        analysisResultSignature: scoreSignature,
        lastAnalysisSnapshot: analysisResults.length
          ? { examMode, targetList, analysisResults, analysisSimulations, updatedAt: Date.now() }
          : stateRef.current.lastAnalysisSnapshot,
        analysisApiStatus: nextStatus,
        analysisApiError: analysisError?.message || (analysisResults.length ? '' : ''),
        scoreCache: hasEntries ? mergeScoreCache(stateRef.current.scoreCache, examMode, merged) : stateRef.current.scoreCache,
        scoreFetchStatus: hasScores ? 'ready' : analysisError ? 'error' : 'empty'
      });
    }).catch((error) => {
      if (scoreRequestIdRef.current !== requestId || scoreFetchSignatureRef.current !== scoreSignature) return;
      if (canRetryInitialScore(error, scoreResultRetryRef.current.attempts)) {
        scoreResultRetryRef.current.attempts += 1;
        const retryDelay = 300 * scoreResultRetryRef.current.attempts;
        globalThis.setTimeout?.(() => {
          if (scoreRequestIdRef.current !== requestId || scoreFetchSignatureRef.current !== scoreSignature) return;
          setState({
            analysisApiStatus: 'loading',
            analysisApiError: '',
            scoreFetchStatus: 'idle',
            scoreFetchRetryTick: stateRef.current.scoreFetchRetryTick + 1
          });
        }, retryDelay);
        return;
      }
      const hasPrevious = (stateRef.current.analysisResults || []).length || stateRef.current.lastAnalysisSnapshot?.analysisResults?.length;
      setState({
        analysisApiStatus: hasPrevious ? 'stale' : 'error',
        analysisApiError: error?.message || '분석 결과를 불러오지 못했습니다.',
        scoreFetchStatus: stateRef.current.scoreFetchSignature === scoreSignature ? 'error' : stateRef.current.scoreFetchStatus
      });
    });
    return undefined;
  }, [
    getAnalysisApiBinding,
    state.analysisTargetList,
    state.homeTargetList,
    state.scoreFetchRetryTick,
    state.scoreExamKey,
    state.scoreExamType,
    state.targetMajor,
    state.userLoadError,
    state.userLoadStatus,
    state.user?.quantitative
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || state.screen !== 'analysis' || !canUseReverseProjection(state)) {
      backtraceFetchSignatureRef.current = '';
      if (state.analysisBacktraceStatus !== 'idle' || state.analysisBacktracePlan || state.analysisBacktraceError) {
        setState({ analysisBacktraceStatus: 'idle', analysisBacktracePlan: null, analysisBacktraceError: '', analysisBacktraceSignature: '' });
      }
      return undefined;
    }
    if (state.userLoadStatus !== 'ready' || state.analysisApiStatus !== 'ready' || !(state.analysisSimulations || []).length) return undefined;
    const examMode = resolveAnalysisExamMode(state);
    const userScores = state.user?.quantitative?.[examMode] || state.user?.quantitative?.active;
    const targetMajor = String(state.targetMajor || '').trim();
    if (!userScores || !targetMajor) return undefined;
    const signature = `backtrace::${buildScoreSignature(examMode, [targetMajor], userScores)}`;
    if (backtraceFetchSignatureRef.current === signature && state.analysisBacktraceSignature === signature) return undefined;
    const apiBinding = getAnalysisApiBinding();
    if (typeof apiBinding.apiFetch !== 'function' || !apiBinding.analysisApiUrl) return undefined;
    backtraceFetchSignatureRef.current = signature;
    setState({ analysisBacktraceStatus: 'loading', analysisBacktracePlan: null, analysisBacktraceError: '', analysisBacktraceSignature: signature });
    fetchMobileBacktrace({ ...apiBinding, targetMajor, userScores, examMode }).then((result) => {
      if (backtraceFetchSignatureRef.current !== signature) return;
      setState({
        analysisBacktraceStatus: result.ok ? (result.plan ? 'ready' : 'empty') : 'error',
        analysisBacktracePlan: result.plan || null,
        analysisBacktraceError: result.error || '',
        analysisBacktraceSignature: signature
      });
    });
    return undefined;
  }, [
    getAnalysisApiBinding,
    state.screen,
    state.targetMajor,
    state.scoreExamKey,
    state.scoreExamType,
    state.analysisApiStatus,
    state.analysisSimulations,
    state.userLoadStatus,
    state.userTier,
    state.selectedPlan,
    state.user?.currentSubscription,
    state.user?.pendingSubscription,
    state.user?.quantitative
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.hasClientSession === 'function' && !window.hasClientSession()) return undefined;
    if (!canUseScoreSimulation(state)) {
      simulationFetchSignatureRef.current = '';
      return undefined;
    }
    if (state.userLoadStatus !== 'ready' || state.analysisApiStatus !== 'ready') return undefined;

    const examMode = resolveAnalysisExamMode(state);
    const userScores = state.user?.quantitative?.[examMode] || state.user?.quantitative?.active;
    const targetList = uniqueTargetList([
      state.targetMajor,
      ...(state.analysisTargetList || []),
      ...(state.homeTargetList || [])
    ]);
    if (!userScores || !targetList.length || !(state.analysisResults || []).length) return undefined;

    const scoreSignature = buildScoreSignature(examMode, targetList, userScores);
    const simulationSignature = `sim::${scoreSignature}`;
    if (simulationFetchSignatureRef.current === simulationSignature) return undefined;

    const apiBinding = getAnalysisApiBinding();
    if (typeof apiBinding.apiFetch !== 'function' || !apiBinding.analysisApiUrl) return undefined;

    simulationFetchSignatureRef.current = simulationSignature;
    fetchMobileScoreSimulation({ ...apiBinding, targetList, userScores, examMode }).then((payload) => {
      if (simulationFetchSignatureRef.current !== simulationSignature) return;
      const simulationResults = payload?.simulationResults || [];
      const currentAnalysisResults = stateRef.current.analysisResults || [];
      const merged = normalizeServerResults(currentAnalysisResults, simulationResults, scoreSignature);
      const hasScores = Object.keys(merged).length > 0;
      setState({
        analysisSimulations: simulationResults,
        lastAnalysisSnapshot: currentAnalysisResults.length
          ? {
              examMode,
              targetList,
              analysisResults: currentAnalysisResults,
              analysisSimulations: simulationResults,
              updatedAt: Date.now()
            }
          : stateRef.current.lastAnalysisSnapshot,
        scoreCache: hasScores ? mergeScoreCache(stateRef.current.scoreCache, examMode, merged) : stateRef.current.scoreCache
      });
    });
    return undefined;
  }, [
    getAnalysisApiBinding,
    state.analysisApiStatus,
    state.analysisResults,
    state.analysisTargetList,
    state.homeTargetList,
    state.scoreExamKey,
    state.scoreExamType,
    state.targetMajor,
    state.userLoadStatus,
    state.userTier,
    state.selectedPlan,
    state.user?.currentSubscription,
    state.user?.pendingSubscription,
    state.user?.gracePeriodUntil,
    state.user?.univChangeRemaining,
    state.user?.quantitative
  ]);

  // scoreCache는 기본 분석 fetch가 채우고, Basic 이상 시뮬레이션 fetch가 같은 캐시에 보강한다.

  const onClick = useCallback(
    (event) => {
      // 스와이프 제스처 직후의 ghost click 무시. gesture-handlers가 인식된 스와이프 끝에
      // suppressClickUntilRef를 세팅하지만 onClick이 이를 읽지 않아, 홈 대학 카드 좌/우 스와이프가
      // selectUniversity 클릭으로 새어 분석 화면으로 이동하던 문제를 막는다.
      if (Date.now() < suppressClickUntilRef.current) {
        event.preventDefault?.();
        event.stopPropagation?.();
        return;
      }
      events.dispatchAction(event);
    },
    [events]
  );
  const onInput = useCallback((event) => events.handleInput?.(event), [events]);
  const onChange = useCallback((event) => events.handleChange?.(event), [events]);
  const onBlur = useCallback((event) => events.handleBlur?.(event), [events]);

  // display:contents로 래퍼 박스를 없애 원본 DOM(#root > .app-shell) 레이아웃 체인을 보존한다.
  // 이벤트(onClick/onInput/...)는 양쪽 경로 공통으로 래퍼에 위임된다.
  const wrapperProps = {
    className: 'studycrack-mobile-root',
    style: { display: 'contents' },
    onClick,
    onInput,
    onChange,
    onBlur
  };

  // JSX 등록 화면은 React 트리만 사용한다. 미등록 보조 화면만 문자열 renderer 경로를 사용한다.
  const ScreenComponent = getScreenComponent(state.screen);
  if (ScreenComponent) {
    return React.createElement('div', wrapperProps, React.createElement(ScreenComponent, ctx));
  }

  const rendered = renderMobileScreen(state.screen, ctx);
  // 셸 조각이 분리된 경우(문자열 화면): app-shell/app-frame을 React 노드로 두고 배경/오버레이/탭바를
  // 각각 독립 dangerouslySetInnerHTML div로 렌더한다. React는 __html 문자열이 바뀐 div만 갱신하므로,
  // 모달 상태만 변할 때 배경(inner) DOM은 그대로 유지된다 → 어떤 모달도 배경을 새로고침하지 않는다.
  if (rendered && rendered.__mobileShell) {
    const tabBarHtml = rendered.withTab
      ? renderTabBar({ tab: state.tab, dimmed, icon: renderIcon, items: visibleTabItems })
      : '';
    return React.createElement(
      'div',
      wrapperProps,
      React.createElement(
        'div',
        { className: 'app-shell' },
        React.createElement(
          'div',
          { className: 'app-frame' },
          React.createElement('div', {
            key: 'screen',
            className: `screen app-screen app-content ${dimmed ? 'modal-lock' : ''}`,
            'data-screen': state.screen,
            dangerouslySetInnerHTML: { __html: rendered.inner }
          }),
          React.createElement('div', {
            key: 'overlays',
            className: 'app-screen-overlays',
            style: { display: 'contents' },
            dangerouslySetInnerHTML: { __html: rendered.overlays }
          }),
          React.createElement('div', {
            key: 'tabbar',
            style: { display: 'contents' },
            dangerouslySetInnerHTML: { __html: tabBarHtml }
          })
        )
      )
    );
  }
  return React.createElement('div', { ...wrapperProps, dangerouslySetInnerHTML: { __html: String(rendered || '') } });
}

const rootEl = document.getElementById('root') || document.body;
createRoot(rootEl).render(React.createElement(MobileApp));
