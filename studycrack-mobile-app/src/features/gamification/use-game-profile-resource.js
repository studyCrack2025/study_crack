import { useEffect, useRef } from 'react';
import { fetchGameProfile, fetchStudyHabitat } from './api.js';

export function useGameProfileResource({ enabled, getApiBinding, refreshTick = 0, setState } = {}) {
  const requestKeyRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ gameProfileStatus: 'loading', gameProfileError: '', habitatStatus: 'loading', habitatError: '' });
    Promise.allSettled([
      fetchGameProfile({ ...getApiBinding(), signal: controller?.signal }),
      fetchStudyHabitat({ ...getApiBinding(), days: 30, signal: controller?.signal })
    ]).then(([profileResult, habitatResult]) => {
      if (requestKeyRef.current !== requestKey) return;
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
      const habitat = habitatResult.status === 'fulfilled' ? habitatResult.value : null;
      setState({
        ...(profile?.ok ? {
          ...profile.data,
          gameProfileStatus: 'ready',
          gameProfileError: ''
        } : {
          gameProfileStatus: 'error',
          gameProfileError: profile?.error || '수조 상태를 불러오지 못했습니다.'
        }),
        ...(habitat?.ok ? {
          habitatDays: habitat.data.days || [],
          habitatStatus: 'ready',
          habitatError: ''
        } : {
          habitatStatus: 'error',
          habitatError: habitat?.error || '공부 서식지를 불러오지 못했습니다.'
        })
      });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, getApiBinding, refreshTick, setState]);
}

