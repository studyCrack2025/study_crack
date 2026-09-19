import { canUseReverseProjection, canUseScoreSimulation } from '../../app/access-policy.js';
import { resolveAnalysisExamMode, uniqueTargetList } from '../../features/analysis/resource-model.js';
import { buildScoreSignature, univKey } from '../../features/analysis/score-store.js';
import { buildServerSimRows } from '../../runtime/derived.js';

export function buildAnalysisSnapshot(state = {}) {
  const exam = resolveAnalysisExamMode(state);
  const targets = uniqueTargetList([...(state.analysisTargetList || []), ...(state.homeTargetList || []), state.targetMajor]);
  const scores = state.user?.quantitative?.[exam] || state.user?.quantitative?.active || {};
  const signature = buildScoreSignature(exam, targets, scores);
  const ready = state.userLoadStatus === 'ready' && Boolean(state.user?.quantitative?.[exam]) && state.analysisCalculationRequested === true
    && state.analysisApiStatus === 'ready' && state.analysisResultExamMode === exam
    && state.analysisResultSignature === signature;
  const results = ready ? state.analysisResults || [] : [];
  const comparison = targets.map(major => {
    const result = results.find(item => univKey(`${item.univ}${item.major || ''}`) === univKey(major));
    const value = result?.converted_score;
    const available = result && value !== null && value !== '' && Number.isFinite(Number(value))
      && result.score_available !== false && result.is_eligible !== false && !['분석 불가', '지원 불가'].includes(result.status);
    return { major, score: available ? Math.max(0, Math.min(250, Number(value))) : null, status: result?.status || '', reason: result?.score_unavailable_reason || result?.msg || '' };
  });
  const selected = comparison.find(item => item.major === state.targetMajor) || comparison[0];
  const simulation = ready && canUseScoreSimulation(state) && selected?.score !== null
    ? (state.analysisSimulations || []).find(item => univKey(`${item.univ}${item.major || ''}`) === univKey(selected?.major)) : null;
  const base = simulation?.base_ui_score;
  const rows = base !== null && base !== undefined && base !== '' && Number.isFinite(Number(base)) ? buildServerSimRows(simulation) : [];
  return {
    ready, score: selected?.score ?? null, needsCalculation: state.analysisCalculationRequested !== true, comparison,
    simulationStatus: ready ? state.analysisSimulationStatus === 'ready' && !rows.length ? 'empty' : state.analysisSimulationStatus || 'idle' : 'idle',
    currentScores: state.userLoadStatus === 'ready' && state.user?.quantitative?.[exam] ? [
      ['국어', scores.kor?.raw, '점'], ['수학', scores.math?.raw, '점'],
      ['영어', scores.eng?.grade ?? scores.eng?.grd, '등급'],
      [scores.inq1?.name || '탐구1', scores.inq1?.raw, '점'], [scores.inq2?.name || '탐구2', scores.inq2?.raw, '점']
    ].filter(([, value]) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) : [],
    rows, canSimulate: canUseScoreSimulation(state),
    backtraceReady: ready && canUseReverseProjection(state)
      && state.analysisBacktraceSignature === `backtrace::${buildScoreSignature(exam, [selected?.major || ''], scores)}`
  };
}
