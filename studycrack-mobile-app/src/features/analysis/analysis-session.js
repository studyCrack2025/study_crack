import { fetchMobileBacktrace, fetchMobileScoreSimulation, fetchMobileTargetAnalysis } from './api.js';

export function createAnalysisSession() {
  let scope = '';
  let lastRefresh = 0;
  const entries = new Map();
  const clear = () => { for (const entry of entries.values()) entry.controller.abort(); entries.clear(); };
  return {
    clear,
    scope(value) { if (value !== scope) { clear(); scope = value; } },
    get(exam) { return entries.get(exam); },
    ensure(options) {
      const { exam, scores, targets, signature, selected, refresh, canSimulate, canBacktrace, binding, notify } = options;
      const forced = refresh !== lastRefresh;
      lastRefresh = refresh;
      const previous = entries.get(exam);
      if (previous && (!forced || previous.busy)) { previous.notify = notify; return; }
      previous?.controller.abort();
      const preserve = previous?.signature === signature ? previous : null;
      const entry = { signature, refresh, scores: structuredClone(scores || {}), targets: [...targets], results: preserve?.results || [], simulations: preserve?.simulations || [], backtraces: { ...preserve?.backtraces }, mainStatus: 'loading', simulationStatus: canSimulate ? 'loading' : 'empty', busy: true, updatedAt: preserve?.updatedAt || 0, error: '', controller: new AbortController(), notify };
      entries.set(exam, entry);
      const valid = () => entries.get(exam) === entry && !entry.controller.signal.aborted;
      const emit = () => { if (valid()) entry.notify(); };
      if (!scores || !targets.length) {
        Object.assign(entry, { mainStatus: 'empty', simulationStatus: 'empty', busy: false, error: !scores ? '선택한 시험의 성적을 입력해주세요.' : '희망 대학을 추가해주세요.' });
        return;
      }
      const args = { ...binding, examMode: exam, userScores: entry.scores, targetList: entry.targets, signal: entry.controller.signal };
      const run = async () => {
        try {
          const main = await fetchMobileTargetAnalysis(args);
          if (!valid()) return;
          if (!main.ok) { entry.mainStatus = 'error'; entry.simulationStatus = 'error'; entry.error = main.error; return; }
          entry.results = main.data?.analysisResults || [];
          entry.mainStatus = entry.results.length ? 'ready' : 'empty';
          entry.updatedAt = Date.now();
          emit();
          if (!entry.results.length) { entry.simulationStatus = 'empty'; return; }
          const simulate = async () => {
            if (!canSimulate) return;
            const result = await fetchMobileScoreSimulation(args);
            if (!valid()) return;
            if (result.ok) entry.simulations = result.data || [];
            else entry.error = '일부 분석을 완료하지 못했어요. 새로고침으로 다시 시도해주세요.';
            entry.simulationStatus = result.ok ? entry.simulations.length ? 'ready' : 'empty' : 'error';
            emit();
          };
          const queue = canBacktrace ? [selected, ...targets].filter((target, index, all) => target && all.indexOf(target) === index) : [];
          const worker = async () => {
            while (queue.length && valid()) {
              const targetMajor = queue.shift();
              entry.backtraces[targetMajor] = { ...entry.backtraces[targetMajor], status: 'loading' };
              emit();
              const result = await fetchMobileBacktrace({ ...args, targetMajor });
              if (!valid()) return;
              if (!result.ok) entry.error = '일부 분석을 완료하지 못했어요. 새로고침으로 다시 시도해주세요.';
              entry.backtraces[targetMajor] = { status: result.ok ? result.data ? 'ready' : 'empty' : 'error', data: result.ok ? result.data : entry.backtraces[targetMajor]?.data, error: result.error || '' };
              emit();
            }
          };
          await Promise.all([simulate(), worker(), worker()]);
        } catch {
          if (valid()) { entry.error = '분석 결과를 확인하지 못했어요. 새로고침으로 다시 시도해주세요.'; if (entry.mainStatus === 'loading') entry.mainStatus = 'error'; }
        } finally {
          if (valid()) {
            entry.busy = false;
            if (entry.simulationStatus === 'loading') entry.simulationStatus = 'error';
            for (const row of Object.values(entry.backtraces)) if (row.status === 'loading') row.status = 'error';
            emit();
          }
        }
      };
      void run();
    }
  };
}
