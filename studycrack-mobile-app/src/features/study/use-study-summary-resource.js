import { useEffect, useRef } from 'react';
import { fetchStudySummary } from './api.js';

export function useStudySummaryResource({ enabled, getApiBinding, dayKey, owner, refreshTick = 0, setState } = {}) {
  const requestKeyRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ studySummaryStatus: 'loading', studySummaryError: '' });
    fetchStudySummary({ ...getApiBinding(), signal: controller?.signal }).then((result) => {
      if (requestKeyRef.current !== requestKey) return;
      if (controller?.signal.aborted) return;
      if (result.ok && result.data.today.date !== dayKey) result = { ok: false, error: '공부 기록의 기준 날짜를 다시 확인해주세요.' };
      setState(result.ok ? {
        ...(result.data.available ? { studySummary: result.data } : {}),
        studySummaryStatus: result.data.available ? 'ready' : 'unavailable',
        studySummaryError: ''
      } : {
        studySummaryStatus: 'error',
        studySummaryError: result.error || '공부 요약을 불러오지 못했습니다.'
      });
    }).catch(() => {
      if (requestKeyRef.current === requestKey && !controller?.signal.aborted) setState({ studySummaryStatus: 'error', studySummaryError: '공부 기록 연결을 다시 확인해주세요.' });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, getApiBinding, dayKey, owner, refreshTick, setState]);
}
