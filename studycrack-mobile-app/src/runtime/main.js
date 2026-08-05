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
import { getScreenComponent, isDeferredAppScreen, loadAppScreenRegistry, renderMobileScreen } from '../app/screen-registry.js';
import {
  canAccessTier,
  canUseReverseProjection,
  canUseScoreSimulation,
  filterTabItemsForTier,
  resolveScreenAccess
} from '../app/access-policy.js';
import { createInitialMobileAppState, shouldLoadDeferredMobileScreens } from '../app/mobile-routing.js';
import { renderScoreEditModal } from '../screens/profile/renderers.js';
import {
  MAIN_TAB_SCREENS,
  appStateReducer,
  createNavigationOps,
  selectFlatAppState
} from './app-state.js';
import { createHandlerStateActions } from '../state/handler-state-actions.js';
import { createScreenContext } from '../app/screen-context.js';
import { useAppStatePersistence } from '../app/use-app-state-persistence.js';
import { readExamScoresMap, writeExamScoresMap } from '../state/storage.js';
import { buildDerivedContext } from './derived.js';
import { saveNotificationPreferences, saveQualitative, saveQuantitative, saveTargetUnivs } from '../features/account/api.js';
import { useAdmissionCalendarResource } from '../features/account/use-admission-calendar-resource.js';
import { useAnalysisResources } from '../features/analysis/use-analysis-resources.js';
import { createBlankScoreState, mapExamDataToScorePatch, scoreExamTypeToKey } from '../features/analysis/score-model.js';
import { targetSlotsToList, upsertTargetSlot } from '../features/analysis/target-model.js';
import { resolveAnalysisExamMode, uniqueTargetList } from '../features/analysis/resource-model.js';
import { useNotificationResource } from '../features/notifications/use-notification-resource.js';
import { saveStudySession } from '../features/planner/api.js';
import { useRankingResource } from '../features/planner/use-ranking-resource.js';
import { requestMobileProReport, saveMobileWeeklyCheck, uploadMobileFile, uploadMobileWeeklyFiles } from '../features/reports/api.js';
import { useReportResources } from '../features/reports/use-report-resources.js';
import { useSession } from '../features/session/use-session.js';
import { saveMobileQna } from '../features/support/api.js';
import { useSupportResource } from '../features/support/use-support-resource.js';
import { createUserDataResetPatch, mapUserToStatePatch } from './session.js';
import { buildAnalysisScoreView, buildSimulationTargets, buildUniversityCards, mergeScoreCache, normalizeServerResults } from '../features/analysis/score-store.js';
import { createScrollOps } from './scroll-ops.js';
import { createTimerOps } from './timer-ops.js';
import { attachVisualViewportMetrics } from './visual-viewport.js';
import { setApiAuthExpiredHandler } from '../shared/api/client.js';
import {
  getMobileApiBinding,
  getMobileFileApiBinding,
  getMobileRuntimeContext,
  getMobileScrollY,
  hasMobileClientSession,
  markMobileAppBooted,
  persistMobileUserRole
} from '../shared/browser/mobile-runtime.js';
import { blockNonStudentMobileSession, expireMobileSessionSilently } from '../features/session/mobile-session-adapter.js';

const { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } = React;

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

markMobileAppBooted({ crackySrc: CRACKY_SRC, onboardingLogoSrc: ONBOARDING_LOGO_SRC });

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

function MobileApp() {
  const [rootState, dispatchState] = useReducer(appStateReducer, undefined, createInitialMobileAppState);
  const state = useMemo(() => selectFlatAppState(rootState), [rootState]);
  const setState = useCallback((patch) => dispatchState({ type: 'app/patch', payload: patch }), []);
  const [appScreenRegistry, setAppScreenRegistry] = useState(null);
  const [appChunkStatus, setAppChunkStatus] = useState('idle');
  const [appChunkRetryTick, setAppChunkRetryTick] = useState(0);
  const stateRef = useRef(state);
  const rootStateRef = useRef(rootState);
  const plannerContentRef = useRef('');
  const plannerCustomMinutesRef = useRef('');
  const userFetchRetryRef = useRef(0);

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
  rootStateRef.current = rootState;
  useAppStatePersistence(rootState);

  useEffect(() => attachVisualViewportMetrics(), []);
  useEffect(() => setApiAuthExpiredHandler(expireMobileSessionSilently), []);

  useEffect(() => {
    const shouldLoad = shouldLoadDeferredMobileScreens(state.screen, Boolean(appScreenRegistry));
    if (!shouldLoad || appScreenRegistry) return undefined;
    let active = true;
    setAppChunkStatus('loading');
    loadAppScreenRegistry()
      .then((module) => {
        if (!active) return;
        setAppScreenRegistry(module);
        setAppChunkStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setAppChunkStatus('error');
      });
    return () => {
      active = false;
    };
  }, [appChunkRetryTick, appScreenRegistry, state.screen]);

  const handlerStateActions = useMemo(
    () => createHandlerStateActions({ setState, getRootState: () => rootStateRef.current }),
    [setState]
  );

  const nav = useMemo(
    () =>
      createNavigationOps({
        getState: () => stateRef.current,
        setState,
        onScreenChange: (from) => {
          // 스크롤 저장은 후속 단계. 현재는 위치만 보존 가드.
          if (from) stateRef.current.__lastScrollY = getMobileScrollY();
        }
      }),
    []
  );

  const getUserApiBinding = useCallback(
    () => getMobileApiBinding('user', 'userApiUrl'),
    []
  );

  const getAnalysisApiBinding = useCallback(
    () => getMobileApiBinding('analysis', 'analysisApiUrl'),
    []
  );

  const getReportApiBinding = useCallback(
    () => getMobileApiBinding('report', 'reportApiUrl'),
    []
  );

  const getQnaApiBinding = useCallback(
    () => getMobileApiBinding('qna', 'qnaApiUrl'),
    []
  );

  const getNotiApiBinding = useCallback(
    () => getMobileApiBinding('noti', 'notiApiUrl'),
    []
  );

  const getFileApiBinding = useCallback(
    () => getMobileFileApiBinding(),
    []
  );

  const hasClientSession = useCallback(() => hasMobileClientSession(), []);

  const applyUserData = useCallback((userData) => {
    const role = String(userData?.role || 'student').toLowerCase();
    if (role && role !== 'student') {
      blockNonStudentMobileSession(role);
      return;
    }
    if (userData?.role) persistMobileUserRole(userData.role);
    const patch = mapUserToStatePatch(userData, stateRef.current);
    setState({ ...patch, userLoadStatus: 'ready', userLoadError: '' });
  }, []);

  useSession({
    applyUserData,
    configRetryRef: userFetchRetryRef,
    getApiBinding: getUserApiBinding,
    hasSession: hasClientSession,
    resetPatch: createUserDataResetPatch,
    retryTick: state.userFetchRetryTick,
    setState
  });
  const resourceSessionReady = state.userLoadStatus === 'ready' && hasClientSession();
  useRankingResource({
    enabled: resourceSessionReady && ['home', 'ranking'].includes(state.screen),
    getApiBinding: getUserApiBinding,
    period: state.screen === 'ranking' ? state.rankingPeriod : 'daily',
    refreshTick: state.rankingRefreshTick,
    setState
  });
  useAdmissionCalendarResource({
    enabled: state.userLoadStatus === 'ready' && state.screen === 'home',
    getApiBinding: getUserApiBinding,
    hasSession: hasClientSession,
    setState
  });
  useReportResources({ enabled: resourceSessionReady, getApiBinding: getReportApiBinding, screen: state.screen, setState });
  useSupportResource({ enabled: resourceSessionReady && state.screen === 'customerSupport', getApiBinding: getQnaApiBinding, setState });
  useNotificationResource({
    enabled: resourceSessionReady && (state.screen === 'notificationList' || state.notifModalOpen),
    getApiBinding: getNotiApiBinding,
    setState
  });
  useAnalysisResources({
    canBacktrace: canUseReverseProjection(state),
    canSimulate: canUseScoreSimulation(state),
    getApiBinding: getAnalysisApiBinding,
    setState,
    state,
    stateRef
  });

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

  const refreshStudyRanking = useCallback(() => {
    setState({ rankingRefreshTick: Number(stateRef.current.rankingRefreshTick || 0) + 1 });
  }, []);

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
  const visibleTabItems = filterTabItemsForTier(TAB_ITEMS);

  const beforeGoto = useCallback(({ target } = {}) => {
    const access = resolveScreenAccess(stateRef.current, target);
    if (access.allowed) return true;
    setState({
      upgradePromptTier: access.requiredTier,
      upgradePromptTarget: access.label,
      lockedFeatureTarget: target,
      lockedFeatureTier: access.requiredTier,
      lockedFeatureLabel: access.label,
      ...(MAIN_TAB_SCREENS.includes(target) ? { tab: target } : {})
    });
    nav.goto('lockedFeature');
    return false;
  }, [nav]);

  const derivedCtx = buildDerivedContext(state, timerOps.studyTimerSecondsRef.current);
  const renderExamKey = resolveAnalysisExamMode(state);
  const renderScoreCache = buildRenderScoreCache(state, renderExamKey);
  const runtimeCtx = getMobileRuntimeContext();
  const baseCtx = {
    ...state,
    isAnalyzing: state.analysisApiStatus === 'loading'
      && !(state.analysisResults || []).length
      && !(state.lastAnalysisSnapshot?.analysisResults || []).length,
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
    ...runtimeCtx,
    canAccessStandard: canAccessTier(state, 'standard'),
    canAccessPro: canAccessTier(state, 'pro'),
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
    refreshStudyRanking,
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

  const events = useMemo(
    () => createMobileEventHandlers(ctx, { stateActions: handlerStateActions }),
    [ctx, handlerStateActions]
  );

  // HTML fallback timer가 정상 부팅을 인식하도록 플래그를 세운다.
  useEffect(() => {
    markMobileAppBooted({ crackySrc: CRACKY_SRC, onboardingLogoSrc: ONBOARDING_LOGO_SRC });
  }, []);

  // 초기 진입 흐름: splash를 잠깐 노출한 뒤 이동.
  // 이미 로그인된 사용자는 바로 홈으로, 미로그인은 소개 화면으로 이동한다.
  useEffect(() => {
    if (state.screen !== 'splash') return undefined;
    const loggedIn = hasMobileClientSession();
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

  if (isDeferredAppScreen(state.screen) && !appScreenRegistry) {
    const failed = appChunkStatus === 'error';
    return React.createElement(
      'div',
      wrapperProps,
      React.createElement(
        'div',
        { className: 'app-shell' },
        React.createElement(
          'div',
          { className: 'app-frame' },
          React.createElement(
            'div',
            { className: 'screen app-screen app-content', 'data-screen': state.screen },
            React.createElement(
              'div',
              { className: 'center init-loading', role: 'status', 'aria-live': 'polite' },
              React.createElement('h3', null, failed ? '화면을 불러오지 못했습니다' : '앱 화면을 준비하고 있어요'),
              React.createElement('p', { className: 'sub' }, failed ? '네트워크 상태를 확인한 뒤 다시 시도해 주세요.' : '잠시만 기다려 주세요.'),
              failed
                ? React.createElement('button', {
                    type: 'button',
                    className: 'btn btn-primary mini',
                    onClick: () => {
                      setAppChunkStatus('idle');
                      setAppChunkRetryTick((value) => value + 1);
                    }
                  }, '다시 시도')
                : null
            )
          )
        )
      )
    );
  }

  // JSX 등록 화면은 React 트리만 사용한다. 미등록 보조 화면만 문자열 renderer 경로를 사용한다.
  const ScreenComponent = getScreenComponent(state.screen, appScreenRegistry);
  if (ScreenComponent) {
    const screenContext = createScreenContext(state.screen, ctx, handlerStateActions);
    return React.createElement('div', wrapperProps, React.createElement(ScreenComponent, screenContext));
  }

  const rendered = renderMobileScreen(state.screen, ctx, { appRegistry: appScreenRegistry });
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
