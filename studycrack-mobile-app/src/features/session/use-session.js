import { useEffect, useRef } from 'react';
import { fetchCurrentUser } from './api.js';

export function useSession({ applyUserData, configRetryRef: providedConfigRetryRef, getApiBinding, hasSession, resetPatch, retryTick, setState } = {}) {
  const internalConfigRetryRef = useRef(0);
  const configRetryRef = providedConfigRetryRef || internalConfigRetryRef;
  const requestKeyRef = useRef(0);

  useEffect(() => {
    if (!hasSession?.()) return undefined;
    const binding = getApiBinding();
    if (typeof binding.apiFetch !== 'function' || !binding.userApiUrl) {
      const retryDelay = Math.min(1200, 250 + configRetryRef.current * 100);
      setState({ ...resetPatch(), userLoadStatus: 'loading', userLoadError: '' });
      const timer = globalThis.setTimeout?.(() => {
        configRetryRef.current += 1;
        if (configRetryRef.current >= 40) {
          setState({ userLoadStatus: 'error', userLoadError: '사용자 정보 연결을 준비하지 못했습니다. 다시 시도해주세요.' });
          return;
        }
        setState({ userFetchRetryTick: Number(retryTick || 0) + 1 });
      }, retryDelay);
      return () => globalThis.clearTimeout?.(timer);
    }

    configRetryRef.current = 0;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ ...resetPatch(), userLoadStatus: 'loading', userLoadError: '' });
    fetchCurrentUser({ ...binding, signal: controller?.signal }).then((result) => {
      if (requestKeyRef.current !== requestKey) return;
      if (!result.ok) {
        if (result.code !== 'AUTH_EXPIRED') {
          setState({ userLoadStatus: 'error', userLoadError: result.error || '사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
        }
        return;
      }
      applyUserData(result.data);
    }).catch(() => {
      if (requestKeyRef.current === requestKey) {
        setState({ userLoadStatus: 'error', userLoadError: '사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
      }
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [applyUserData, getApiBinding, hasSession, resetPatch, retryTick, setState]);

}
