import { useEffect, useRef } from 'react';
import { fetchStudyRanking } from './api.js';

export function useRankingResource({ enabled, getApiBinding, period = 'daily', refreshTick = 0, setState } = {}) {
  const requestKeyRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ rankingStatus: 'loading', rankingError: '' });
    fetchStudyRanking({ ...getApiBinding(), period, signal: controller?.signal }).then((result) => {
      if (requestKeyRef.current !== requestKey) return;
      const ranking = result.data || { rows: [], me: null };
      setState({
        rankingRows: ranking.rows || [],
        rankingMe: ranking.me || null,
        rankingStatus: result.ok ? ((ranking.rows || []).length ? 'ready' : 'empty') : 'error',
        rankingError: result.error || ''
      });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, getApiBinding, period, refreshTick, setState]);
}
