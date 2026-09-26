import { scoreTierClass } from '../components/score-journey.js';
import { readExamScoresMap, writeExamScoresMap } from '../state/storage.js';
import { buildDerivedContext } from '../runtime/derived.js';
import {
  canAccessTier,
  canUseReverseProjection,
  canUseScoreSimulation
} from './access-policy.js';
import { createBlankScoreState, mapExamDataToScorePatch, scoreExamTypeToKey } from '../features/analysis/score-model.js';
import { resolveAnalysisExamMode, uniqueTargetList } from '../features/analysis/resource-model.js';
import {
  buildAnalysisScoreView,
  buildSimulationTargets,
  buildUniversityCards,
  mergeScoreCache,
  normalizeServerResults
} from '../features/analysis/score-store.js';
import { getMobileRuntimeContext } from '../shared/browser/mobile-runtime.js';
import { withOperationLock } from '../shared/async/operation-lock.js';
import {
  getHomeSliderState,
  mobileInteractions,
  updatePossibleUnivSlider
} from '../shared/browser/mobile-interactions.js';


function buildScoreSelectionPatch(scoreExamType, current) {
  const scoreExamKey = scoreExamTypeToKey(scoreExamType);
  const mapped = mapExamDataToScorePatch(current.user?.quantitative?.[scoreExamKey], current);
  const selection = { scoreExamType, scoreExamKey, analysisCalculationRequested: false };
  if (mapped) {
    return {
      ...selection,
      ...mapped,
      analysisApiStatus: 'idle',
      analysisApiError: '',
      scoreFetchStatus: 'idle',
      scoreFetchSignature: ''
    };
  }
  const blankScoreState = createBlankScoreState();
  return {
    ...selection,
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
      || state.gameRulesOpen
      || state.studySubjectSheetOpen
      || state.plannerEditIndex !== null
      || state.drawerOpen
      || state.universityModalOpen
      || state.scoreEditOpen
      || state.logoutModalOpen
  );
}

export function createMobileViewContext({ api, beforeGoto, buildPresentations, nav, refs, retryUserLoad, setState, state, stateRef } = {}) {
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
    ...buildPresentations?.({ state, derived: derivedContext, liveSeconds: timerOps.studyTimerSecondsRef.current }),
    initializeApp: retryUserLoad,
    isCurrentProfile: () => stateRef.current.user === state.user && stateRef.current.userLoadStatus === 'ready' && api.hasClientSession(),
    applySavedProfileTarget: (target) => {
      if (stateRef.current.user !== state.user || stateRef.current.userLoadStatus !== 'ready' || !api.hasClientSession()) return false;
      setState({ user: { ...state.user, targetUniversity: target || '' } });
      return true;
    },
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
    rememberMy: nav.rememberMy,
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
    closeDrawer: () => setState({ drawerOpen: false, myReturn: null }),
    selectPlan: (plan) => setState({ checkoutPlan: plan }),
    markOnboardingComplete: () => setState({ loggedIn: true }),
    getExamScoresMap: readExamScoresMap,
    saveExamScoresMap: writeExamScoresMap,
    applyScoreExamSelection: (scoreExamType) => setState(buildScoreSelectionPatch(scoreExamType, stateRef.current)),
    requestAnalysisCalculation: () => setState(baseContext.analysisCalculationPatch(stateRef.current)),
    resetAnalysisCalculation: () => setState(baseContext.analysisResetPatch),
    ...api,
    ensureCoachingSubjectRows: () => {
      const current = stateRef.current;
      if ((current.coachingSubjectRows || []).length) return;
      setState({ coachingSubjectRows: baseContext.buildDefaultCoachingSubjects?.() || [] });
    },
    addMajorToTargets: (major) => withOperationLock(refs.operationLocksRef, 'profile-targets', async () => {
      if (!major || !baseContext.isCurrentProfile()) return false;
      try {
        const { saveTargetAddition } = await import('../features/analysis/save-target-addition.js');
        return await saveTargetAddition({ api, isCurrentProfile: baseContext.isCurrentProfile, setState, stateRef }, major);
      } catch {
        if (baseContext.isCurrentProfile()) setState({ addingUniversity: false, targetSaveError: '대학 추가를 준비하지 못했어요. 연결을 확인하고 다시 시도해주세요.' });
        return false;
      }
    })
  };
  return baseContext;
}
