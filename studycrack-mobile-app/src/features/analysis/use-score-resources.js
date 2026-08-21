import { useEffect, useRef } from 'react';
import { fetchMobileBacktrace, fetchMobileScoreSimulation, fetchMobileTargetAnalysis } from './api.js';
import { resolveAnalysisExamMode, uniqueTargetList } from './resource-model.js';
import {
  buildScoreSignature,
  canRetryInitialScore,
  canRetryInitialScorePayload,
  mergeScoreCache,
  normalizeServerResults
} from './score-store.js';

export function useScoreResources({ canBacktrace, canSimulate, enabled, getApiBinding, setState, state, stateRef } = {}) {
  const configRetryRef = useRef(0);
  const requestKeyRef = useRef(0);
  const resultRetryRef = useRef({ signature: '', attempts: 0 });
  const scoreSignatureRef = useRef('');
  const simulationSignatureRef = useRef('');
  const backtraceSignatureRef = useRef('');
  const previousUserStatusRef = useRef(state.userLoadStatus);
  const primaryResourceKey = JSON.stringify({
    enabled: Boolean(enabled),
    examMode: resolveAnalysisExamMode(state),
    retryTick: Number(state.scoreFetchRetryTick || 0),
    scores: state.user?.quantitative || {},
    targets: uniqueTargetList([state.targetMajor, ...(state.analysisTargetList || []), ...(state.homeTargetList || [])]),
    userError: state.userLoadError || '',
    userStatus: state.userLoadStatus || ''
  });

  useEffect(() => {
    if (state.userLoadStatus === 'ready' && previousUserStatusRef.current !== 'ready') {
      requestKeyRef.current += 1;
      scoreSignatureRef.current = '';
      simulationSignatureRef.current = '';
      configRetryRef.current = 0;
      resultRetryRef.current = { signature: '', attempts: 0 };
    }
    previousUserStatusRef.current = state.userLoadStatus;
  }, [state.userLoadStatus]);

  useEffect(() => {
    if (!enabled) {
      requestKeyRef.current += 1;
      scoreSignatureRef.current = '';
      simulationSignatureRef.current = '';
      backtraceSignatureRef.current = '';
      return undefined;
    }
    const examMode = resolveAnalysisExamMode(state);
    const userScores = state.user?.quantitative?.[examMode] || state.user?.quantitative?.active;
    const targetList = uniqueTargetList([state.targetMajor, ...(state.analysisTargetList || []), ...(state.homeTargetList || [])]);
    if (state.userLoadStatus === 'error') {
      requestKeyRef.current += 1;
      scoreSignatureRef.current = '';
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
      requestKeyRef.current += 1;
      scoreSignatureRef.current = '';
      if (state.scoreFetchStatus !== 'loading' || state.scoreFetchSignature) {
        setState({ analysisApiStatus: 'loading', analysisApiError: '', scoreFetchStatus: 'loading', scoreFetchSignature: '' });
      }
      return undefined;
    }
    if (!userScores || !targetList.length) {
      requestKeyRef.current += 1;
      configRetryRef.current = 0;
      scoreSignatureRef.current = '';
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
    if (resultRetryRef.current.signature !== scoreSignature) resultRetryRef.current = { signature: scoreSignature, attempts: 0 };
    const apiBinding = getApiBinding();
    if (typeof apiBinding.apiFetch !== 'function' || !apiBinding.analysisApiUrl) {
      requestKeyRef.current += 1;
      const retryDelay = Math.min(1200, 250 + configRetryRef.current * 100);
      const timer = globalThis.setTimeout?.(() => {
        configRetryRef.current += 1;
        if (configRetryRef.current >= 40) {
          setState({ analysisApiStatus: 'error', analysisApiError: '분석 설정을 불러오지 못했습니다.', scoreFetchStatus: 'error' });
          return;
        }
        setState({ scoreFetchRetryTick: stateRef.current.scoreFetchRetryTick + 1 });
      }, retryDelay);
      return () => globalThis.clearTimeout?.(timer);
    }
    if (
      scoreSignatureRef.current === scoreSignature
      && state.scoreFetchSignature === scoreSignature
      && (state.scoreFetchStatus === 'loading' || state.scoreFetchStatus === 'ready')
    ) return undefined;

    configRetryRef.current = 0;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    scoreSignatureRef.current = scoreSignature;
    simulationSignatureRef.current = '';
    setState({ analysisApiStatus: 'loading', analysisApiError: '', scoreFetchStatus: 'loading', scoreFetchSignature: scoreSignature });
    fetchMobileTargetAnalysis({ ...apiBinding, targetList, userScores, examMode, signal: controller?.signal }).then((result) => {
      if (requestKeyRef.current !== requestKey || scoreSignatureRef.current !== scoreSignature) return;
      const payload = result.data || { analysisResults: [], simulationResults: [] };
      const analysisResults = payload.analysisResults || [];
      const analysisSimulations = [];
      const hasPrevious = (stateRef.current.analysisResults || []).length || stateRef.current.lastAnalysisSnapshot?.analysisResults?.length;
      const analysisError = result.ok ? null : { message: result.error, status: result.status, code: result.code };
      if (canRetryInitialScorePayload({ error: analysisError, resultCount: analysisResults.length }, resultRetryRef.current.attempts)) {
        resultRetryRef.current.attempts += 1;
        globalThis.setTimeout?.(() => {
          if (requestKeyRef.current !== requestKey || scoreSignatureRef.current !== scoreSignature) return;
          setState({ analysisApiStatus: 'loading', analysisApiError: '', scoreFetchStatus: 'idle', scoreFetchRetryTick: stateRef.current.scoreFetchRetryTick + 1 });
        }, 300 * resultRetryRef.current.attempts);
        return;
      }
      if (analysisResults.length) resultRetryRef.current.attempts = 0;
      const nextStatus = analysisResults.length ? 'ready' : analysisError ? (hasPrevious ? 'stale' : 'error') : 'empty';
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
        analysisApiError: analysisError?.message || '',
        scoreCache: hasEntries ? mergeScoreCache(stateRef.current.scoreCache, examMode, merged) : stateRef.current.scoreCache,
        scoreFetchStatus: hasScores ? 'ready' : analysisError ? 'error' : 'empty'
      });
    }).catch((error) => {
      if (requestKeyRef.current !== requestKey || scoreSignatureRef.current !== scoreSignature) return;
      if (canRetryInitialScore(error, resultRetryRef.current.attempts)) {
        resultRetryRef.current.attempts += 1;
        globalThis.setTimeout?.(() => {
          if (requestKeyRef.current !== requestKey || scoreSignatureRef.current !== scoreSignature) return;
          setState({ analysisApiStatus: 'loading', analysisApiError: '', scoreFetchStatus: 'idle', scoreFetchRetryTick: stateRef.current.scoreFetchRetryTick + 1 });
        }, 300 * resultRetryRef.current.attempts);
        return;
      }
      const hasPrevious = (stateRef.current.analysisResults || []).length || stateRef.current.lastAnalysisSnapshot?.analysisResults?.length;
      setState({
        analysisApiStatus: hasPrevious ? 'stale' : 'error',
        analysisApiError: error?.message || '분석 결과를 불러오지 못했습니다.',
        scoreFetchStatus: stateRef.current.scoreFetchSignature === scoreSignature ? 'error' : stateRef.current.scoreFetchStatus
      });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [getApiBinding, primaryResourceKey, setState, stateRef]);

  useEffect(() => {
    if (state.screen !== 'analysis' || !canSimulate) {
      simulationSignatureRef.current = '';
      return undefined;
    }
    if (state.userLoadStatus !== 'ready' || state.analysisApiStatus !== 'ready') return undefined;
    const examMode = resolveAnalysisExamMode(state);
    const userScores = state.user?.quantitative?.[examMode] || state.user?.quantitative?.active;
    const targetList = uniqueTargetList([state.targetMajor, ...(state.analysisTargetList || []), ...(state.homeTargetList || [])]);
    if (!userScores || !targetList.length || !(state.analysisResults || []).length) return undefined;
    const scoreSignature = buildScoreSignature(examMode, targetList, userScores);
    const simulationSignature = `sim::${scoreSignature}`;
    if (simulationSignatureRef.current === simulationSignature) return undefined;
    const apiBinding = getApiBinding();
    if (typeof apiBinding.apiFetch !== 'function' || !apiBinding.analysisApiUrl) return undefined;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    simulationSignatureRef.current = simulationSignature;
    fetchMobileScoreSimulation({ ...apiBinding, targetList, userScores, examMode, signal: controller?.signal }).then((result) => {
      if (simulationSignatureRef.current !== simulationSignature) return;
      const simulationResults = result.data || [];
      const currentAnalysisResults = stateRef.current.analysisResults || [];
      const merged = normalizeServerResults(currentAnalysisResults, simulationResults, scoreSignature);
      setState({
        analysisSimulations: simulationResults,
        lastAnalysisSnapshot: currentAnalysisResults.length
          ? { examMode, targetList, analysisResults: currentAnalysisResults, analysisSimulations: simulationResults, updatedAt: Date.now() }
          : stateRef.current.lastAnalysisSnapshot,
        scoreCache: Object.keys(merged).length ? mergeScoreCache(stateRef.current.scoreCache, examMode, merged) : stateRef.current.scoreCache
      });
    });
    return () => controller?.abort();
  }, [canSimulate, getApiBinding, setState, state.analysisApiStatus, state.analysisResults, state.analysisTargetList, state.homeTargetList, state.scoreExamKey, state.scoreExamType, state.screen, state.targetMajor, state.userLoadStatus, state.user?.quantitative, stateRef]);

  useEffect(() => {
    if (state.screen !== 'analysis' || !canBacktrace) {
      backtraceSignatureRef.current = '';
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
    if (backtraceSignatureRef.current === signature && state.analysisBacktraceSignature === signature) return undefined;
    const apiBinding = getApiBinding();
    if (typeof apiBinding.apiFetch !== 'function' || !apiBinding.analysisApiUrl) return undefined;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    backtraceSignatureRef.current = signature;
    setState({ analysisBacktraceStatus: 'loading', analysisBacktracePlan: null, analysisBacktraceError: '', analysisBacktraceSignature: signature });
    fetchMobileBacktrace({ ...apiBinding, targetMajor, userScores, examMode, signal: controller?.signal }).then((result) => {
      if (backtraceSignatureRef.current !== signature) return;
      setState({
        analysisBacktraceStatus: result.ok ? (result.data ? 'ready' : 'empty') : 'error',
        analysisBacktracePlan: result.data || null,
        analysisBacktraceError: result.error || '',
        analysisBacktraceSignature: signature
      });
    });
    return () => controller?.abort();
  }, [canBacktrace, getApiBinding, setState, state.analysisApiStatus, state.analysisSimulations, state.scoreExamKey, state.scoreExamType, state.screen, state.targetMajor, state.userLoadStatus, state.user?.quantitative]);
}
