import { resolveAnalysisExamMode } from './resource-model.js';
import { useScoreResources } from './use-score-resources.js';
import { useUniversityResources } from './use-university-resources.js';

export function useAnalysisResources({ canBacktrace, canSimulate, getApiBinding, setState, state, stateRef } = {}) {
  const examMode = resolveAnalysisExamMode(state);
  useUniversityResources({
    examData: state.user?.quantitative?.[examMode],
    examMode,
    excludeTargets: state.analysisTargetList,
    getApiBinding,
    recommendationRetryTick: state.universityRecommendationRetryTick,
    retryTick: state.universityCatalogRetryTick,
    savedStream: state.screen === 'ob4' ? state.obTrack : (state.user?.qualitative?.stream || ''),
    screen: state.screen,
    setState,
    userReady: state.userLoadStatus === 'ready'
  });
  useScoreResources({
    canBacktrace,
    canSimulate,
    enabled: state.screen === 'analysis',
    getApiBinding,
    setState,
    state,
    stateRef
  });
}
