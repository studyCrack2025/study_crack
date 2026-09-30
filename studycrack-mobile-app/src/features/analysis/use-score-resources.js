import { useEffect, useRef } from 'react';
import { createAnalysisSession } from './analysis-session.js';
import { resolveAnalysisExamMode, uniqueTargetList } from './resource-model.js';
import { buildScoreSignature, mergeScoreCache, normalizeServerResults } from './score-store.js';

const ownerOf = state => state.user?.sub || state.user?.email || '';

export function useScoreResources({ canBacktrace, canSimulate, enabled, getApiBinding, setState, state, stateRef } = {}) {
  const session = useRef(null);
  if (!session.current) session.current = createAnalysisSession();
  const owner = state.userLoadStatus === 'ready' ? ownerOf(state) : '';
  const exam = resolveAnalysisExamMode(state);
  const scores = state.user?.quantitative?.[exam];
  const targets = uniqueTargetList([...(state.analysisTargetList || []), ...(state.homeTargetList || []), state.targetMajor]);
  const signature = buildScoreSignature(exam, targets, scores || {});
  const access = `${Boolean(canSimulate)}:${Boolean(canBacktrace)}`;
  const resourceKey = JSON.stringify([owner, access, enabled, exam, signature, state.targetMajor, state.scoreFetchRetryTick]);
  useEffect(() => () => session.current.clear(), []);
  useEffect(() => {
    const store = session.current;
    if (state.userLoadStatus === 'loading' || state.userLoadStatus === 'error') return;
    store.scope(`${owner}:${access}`);
    if (!owner || !enabled) return;
    const publish = () => {
      const current = stateRef.current;
      if (current.userLoadStatus !== 'ready' || ownerOf(current) !== owner || resolveAnalysisExamMode(current) !== exam) return;
      const entry = store.get(exam);
      if (!entry) return;
      const selected = current.targetMajor || entry.targets[0];
      const backtrace = entry.backtraces[selected];
      const nowScores = current.user?.quantitative?.[exam];
      const nowTargets = uniqueTargetList([...(current.analysisTargetList || []), ...(current.homeTargetList || []), current.targetMajor]);
      const changed = entry.signature !== buildScoreSignature(exam, nowTargets, nowScores || {});
      const merged = normalizeServerResults(entry.results, entry.simulations, entry.signature);
      setState({
        analysisCalculationRequested: true,
        analysisResults: entry.results, analysisSimulations: entry.simulations,
        analysisResultExamMode: exam, analysisResultSignature: entry.signature,
        analysisApiStatus: entry.results.length && (changed || entry.mainStatus === 'error') ? 'stale' : entry.mainStatus,
        analysisApiError: changed ? '입력 정보가 변경됐어요. 새로고침하면 새 기준으로 계산해요.' : entry.error,
        analysisSimulationStatus: entry.simulationStatus,
        analysisBacktraceStatus: backtrace?.status || (entry.busy && canBacktrace ? 'loading' : 'empty'),
        analysisBacktracePlan: backtrace?.data || null, analysisBacktraceError: backtrace?.error || '',
        analysisBacktraceSignature: `backtrace::${buildScoreSignature(exam, [selected || ''], entry.scores || {})}`,
        scoreFetchStatus: entry.results.length ? 'ready' : entry.mainStatus,
        scoreFetchSignature: entry.signature,
        scoreCache: Object.keys(merged).length ? mergeScoreCache(current.scoreCache, exam, merged) : {},
        lastAnalysisSnapshot: { examMode: exam, targetList: entry.targets, analysisResults: entry.results, analysisSimulations: entry.simulations, scores: entry.scores, signature: entry.signature, updatedAt: entry.updatedAt, busy: entry.busy, changed }
      });
    };
    store.ensure({ exam, scores, targets, signature, selected: state.targetMajor, refresh: Number(state.scoreFetchRetryTick || 0), canSimulate, canBacktrace, binding: getApiBinding(), notify: publish });
    publish();
  }, [resourceKey, getApiBinding, setState, stateRef]);
}
