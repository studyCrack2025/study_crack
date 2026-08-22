import { useEffect, useRef } from 'react';
import { fetchStudySummary } from './api.js';

export function useStudySummaryResource({ enabled, getApiBinding, refreshTick = 0, setState } = {}) {
  const requestKeyRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ studySummaryStatus: 'loading', studySummaryError: '' });
    fetchStudySummary({ ...getApiBinding(), signal: controller?.signal }).then((result) => {
      if (requestKeyRef.current !== requestKey) return;
      setState(result.ok ? {
        studySummary: result.data,
        studySummaryStatus: result.data.available ? 'ready' : 'unavailable',
        studySummaryError: ''
      } : {
        studySummaryStatus: 'error',
        studySummaryError: result.error || '공부 요약을 불러오지 못했습니다.'
      });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, getApiBinding, refreshTick, setState]);
}
