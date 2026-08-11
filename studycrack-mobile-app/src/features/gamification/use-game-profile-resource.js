import { useEffect, useRef } from 'react';
import { fetchFishCatalog, fetchGameProfile, fetchPendingDraw, fetchStudyHabitat } from './api.js';

export function useGameProfileResource({ enabled, getApiBinding, includeCatalog = false, refreshTick = 0, setState } = {}) {
  const requestKeyRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ gameProfileStatus: 'loading', gameProfileError: '', habitatStatus: 'loading', habitatError: '', ...(includeCatalog ? { fishCatalogStatus: 'loading', fishCatalogError: '', pendingDrawStatus: 'loading', pendingDrawError: '' } : {}) });
    Promise.allSettled([
      fetchGameProfile({ ...getApiBinding(), signal: controller?.signal }),
      fetchStudyHabitat({ ...getApiBinding(), days: 30, signal: controller?.signal }),
      includeCatalog ? fetchFishCatalog({ ...getApiBinding(), signal: controller?.signal }) : Promise.resolve(null),
      includeCatalog ? fetchPendingDraw({ ...getApiBinding(), signal: controller?.signal }) : Promise.resolve(null)
    ]).then(([profileResult, habitatResult, catalogResult, pendingResult]) => {
      if (requestKeyRef.current !== requestKey) return;
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
      const habitat = habitatResult.status === 'fulfilled' ? habitatResult.value : null;
      const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null;
      const pending = pendingResult.status === 'fulfilled' ? pendingResult.value : null;
      const pendingPayload = pending?.ok && pending.data?.result ? { result: pending.data.result, fish: pending.data.fish } : null;
      const gameUnavailable = profile?.code === 'GAME_DISABLED';
      setState({
        ...(profile?.ok ? {
          ...profile.data,
          gameProfileStatus: 'ready',
          gameProfileError: ''
        } : gameUnavailable ? {
          gameProfileStatus: 'unavailable',
          gameProfileError: profile?.error || '수조 기능을 순차적으로 준비하고 있습니다.'
        } : {
          gameProfileStatus: 'error',
          gameProfileError: profile?.error || '수조 상태를 불러오지 못했습니다.'
        }),
        ...(habitat?.ok ? {
          habitatDays: habitat.data.days || [],
          habitatStatus: 'ready',
          habitatError: ''
        } : gameUnavailable || habitat?.code === 'GAME_DISABLED' ? {
          habitatDays: [],
          habitatStatus: 'unavailable',
          habitatError: ''
        } : {
          habitatStatus: 'error',
          habitatError: habitat?.error || '공부 서식지를 불러오지 못했습니다.'
        }),
        ...(includeCatalog ? (catalog?.ok ? {
          fishCatalog: catalog.data.catalog || [],
          fishInventory: catalog.data.inventory || [],
          fishCatalogStatus: 'ready',
          fishCatalogError: ''
        } : {
          fishCatalogStatus: 'error',
          fishCatalogError: catalog?.error || '물고기 목록을 불러오지 못했습니다.'
        }) : {}),
        ...(includeCatalog ? (pending?.ok ? {
          ...(pending.data?.profile ? { gameProfile: pending.data.profile } : {}),
          pendingDraw: pendingPayload,
          pendingDrawStatus: 'ready',
          pendingDrawError: '',
          ...(pendingPayload ? { aquariumMode: 'draw', aquariumDrawRevealStep: 0 } : {})
        } : {
          pendingDrawStatus: 'error',
          pendingDrawError: pending?.error || '미확인 뽑기 결과를 불러오지 못했습니다.'
        }) : {})
      });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, getApiBinding, includeCatalog, refreshTick, setState]);
}
