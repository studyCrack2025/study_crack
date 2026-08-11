import { scoreTierClass } from '../components/score-journey.js';
import { readExamScoresMap, writeExamScoresMap } from '../state/storage.js';
import { buildDerivedContext } from '../runtime/derived.js';
import {
  canAccessTier,
  canUseReverseProjection,
  canUseScoreSimulation
} from './access-policy.js';
import { createBlankScoreState, mapExamDataToScorePatch, scoreExamTypeToKey } from '../features/analysis/score-model.js';
import { targetSlotsToList, upsertTargetSlot } from '../features/analysis/target-model.js';
import { resolveAnalysisExamMode, uniqueTargetList } from '../features/analysis/resource-model.js';
import {
  buildAnalysisScoreView,
  buildSimulationTargets,
  buildUniversityCards,
  mergeScoreCache,
  normalizeServerResults
} from '../features/analysis/score-store.js';
import { getMobileBrowserServices, getMobileRuntimeContext } from '../shared/browser/mobile-runtime.js';
import {
  getHomeSliderState,
  mobileInteractions,
  updatePossibleUnivSlider
} from '../shared/browser/mobile-interactions.js';

function notifySaveFailure(result, message) {
  if (!result || result.ok !== false) return;
  getMobileBrowserServices().alert(result.error || message);
}

function buildDefaultCoachingSubjects(derived = {}) {
  const { todayPlannerItems = [], todayStudySeconds = 0, todaySubjectsWithTimer = {} } = derived;
  const rows = todayPlannerItems.map((item, index) => {
    const subject = item.subject || '기타';
    const plannedHour = Number(item.minutes || 0) / 60;
    const actualHour = Number(todaySubjectsWithTimer[subject] || 0) / 3600;
    return {
      id: `plan-${index}-${subject}`,
      sourceId: item.id || `plan-${index}`,
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
    const placeholders = {
      국어: '세부과목 (예: 언매)',
      수학: '세부과목 (예: 미적)',
      영어: '세부과목 (예: 독해)',
      탐구: '세부과목 (예: 생1)'
    };
    return {
      id: `${subject}-base`,
      sourceId: `${subject}-base`,
      subject,
      detail: '',
      planned: '',
      actual: actualHour ? actualHour.toFixed(1) : '',
      removable: subject === '기타',
      placeholder: placeholders[subject] || '세부과목 입력'
    };
  });
}

function buildScoreSelectionPatch(scoreExamType, current) {
  const scoreExamKey = scoreExamTypeToKey(scoreExamType);
  const mapped = mapExamDataToScorePatch(current.user?.quantitative?.[scoreExamKey], current);
  if (mapped) {
    return {
      scoreExamType,
      scoreExamKey,
      ...mapped,
      analysisApiStatus: 'loading',
      analysisApiError: ''
    };
  }
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

export function isTabbarDimmed(state = {}) {
  return Boolean(
    state.coachingSheetOpen
      || state.studySubjectSheetOpen
      || state.plannerEditIndex !== null
      || state.drawerOpen
      || state.universityModalOpen
      || state.scoreEditOpen
      || state.logoutModalOpen
  );
}

export function createMobileViewContext({ api, beforeGoto, nav, refs, retryUserLoad, setState, state, stateRef } = {}) {
  const { scrollOps, timerOps, ...gestureRefs } = mobileInteractions;
  const derivedContext = buildDerivedContext(state, timerOps.studyTimerSecondsRef.current);
  const examKey = resolveAnalysisExamMode(state);
  const scoreCache = buildRenderScoreCache(state, examKey);
  const targets = uniqueTargetList([...(state.analysisTargetList || []), ...(state.homeTargetList || [])]);
  const selectedMajor = targets.includes(state.targetMajor) ? state.targetMajor : targets[0] || state.targetMajor || '';
  const analysisView = buildAnalysisScoreView(selectedMajor, scoreCache, examKey, state.scoreFetchStatus);
  const dimmed = isTabbarDimmed(state);
  const baseContext = {
    isAnalyzing: state.analysisApiStatus === 'loading'
      && !(state.analysisResults || []).length
      && !(state.lastAnalysisSnapshot?.analysisResults || []).length,
    ...derivedContext,
    initializeApp: retryUserLoad,
    homeTargets: buildUniversityCards(
      uniqueTargetList(state.homeTargetList || []),
      scoreCache,
      examKey,
      state.scoreFetchStatus
    ),
    analysisSelected: { ...(derivedContext.analysisSelected || {}), score: analysisView.score },
    analysisScoreView: analysisView,
    analysisStatus: analysisView.status,
    analysisStatusColor: analysisView.color,
    analysisGaugeColor: analysisView.color,
    analysisGaugeFill: analysisView.pct,
    gaugeCurrent: analysisView.score,
    gaugeCurrentPct: analysisView.pct,
    gaugeTarget: analysisView.score,
    gaugeTargetPct: analysisView.pct,
    gaugePassPct: 40,
    gaugeSafePct: 60,
    analysisSimulationTargets: buildSimulationTargets(targets, scoreCache, examKey),
    analysisMajorOptions: targets,
    normalizedTargetMajor: selectedMajor,
    dimmed,
    tab: state.tab,
    goto: nav.goto,
    back: nav.back,
    beforeGoto,
    ...getMobileRuntimeContext(),
    canAccessStandard: canAccessTier(state, 'standard'),
    canAccessPro: canAccessTier(state, 'pro'),
    canAccessBasic: canAccessTier(state, 'basic'),
    canUseScoreSimulation: canUseScoreSimulation(state),
    canUseReverseProjection: canUseReverseProjection(state),
    preserveScroll: (task) => scrollOps.preserveScrollAfterStateChange(task),
    preserveScrollAfterStateChange: scrollOps.preserveScrollAfterStateChange,
    preserveY: scrollOps.preserveY,
    afterSafariViewportStable: scrollOps.afterSafariViewportStable,
    restoreIfUnexpectedTopJump: scrollOps.restoreIfUnexpectedTopJump,
    markStableScrollPosition: scrollOps.markStableScrollPosition,
    centerPlannerDate: scrollOps.centerPlannerDate,
    studyTimerSecondsRef: timerOps.studyTimerSecondsRef,
    startLiveStudyTimer: timerOps.startLiveStudyTimer,
    stopLiveStudyTimer: timerOps.stopLiveStudyTimer,
    syncLiveStudyTimer: timerOps.syncLiveStudyTimer,
    syncLiveStudyTimerUi: timerOps.syncLiveStudyTimerUi,
    ...gestureRefs,
    ...refs,
    qnaDraftTitle: refs.qnaDraftRef.current.title,
    qnaDraftContent: refs.qnaDraftRef.current.content,
    isIOSSafari: scrollOps.isIOSSafari,
    getHomeSliderState,
    updatePossibleUnivSlider,
    scoreTierClass,
    setHomeSlideDom: (index, motion = '') => {
      const { total } = getHomeSliderState();
      const max = Math.max(0, total - 1);
      const next = Math.max(0, Math.min(Number(index) || 0, max));
      setState({ homeSlideIndex: next, homeSlideMotion: motion || '' });
    },
    closeDrawer: () => setState({ drawerOpen: false }),
    selectPlan: (plan) => setState({ checkoutPlan: plan }),
    markOnboardingComplete: () => setState({ loggedIn: true }),
    getExamScoresMap: readExamScoresMap,
    saveExamScoresMap: writeExamScoresMap,
    applyScoreExamSelection: (scoreExamType) => setState(buildScoreSelectionPatch(scoreExamType, stateRef.current)),
    ...api,
    ensureCoachingSubjectRows: () => {
      const current = stateRef.current;
      if ((current.coachingSubjectRows || []).length) return;
      setState({ coachingSubjectRows: buildDefaultCoachingSubjects(derivedContext) });
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
      api.persistTargetUnivs(nextHome, nextSlots).then((result) => {
        notifySaveFailure(result, '목표 대학 저장에 실패했습니다.');
      });
      return true;
    }
  };
  return baseContext;
}
