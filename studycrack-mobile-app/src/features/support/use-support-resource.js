import { useEffect, useRef } from 'react';
import { fetchMobileQnaHistory } from './api.js';

export function useSupportResource({ enabled, getApiBinding, setState } = {}) {
  const requestKeyRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ qnaStatus: 'loading' });
    fetchMobileQnaHistory({ ...getApiBinding(), signal: controller?.signal }).then((result) => {
      if (requestKeyRef.current !== requestKey) return;
      const items = result.data || [];
      setState({ qnaHistory: items, qnaStatus: result.ok ? (items.length ? 'ready' : 'empty') : 'error' });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, getApiBinding, setState]);
}
