import { useEffect, useRef } from 'react';
import { fetchFishCatalog, fetchGameProfile, fetchStudyHabitat } from './api.js';

export function useGameProfileResource({ enabled, getApiBinding, includeCatalog = false, refreshTick = 0, setState } = {}) {
  const requestKeyRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ gameProfileStatus: 'loading', gameProfileError: '', habitatStatus: 'loading', habitatError: '', ...(includeCatalog ? { fishCatalogStatus: 'loading', fishCatalogError: '' } : {}) });
    Promise.allSettled([
      fetchGameProfile({ ...getApiBinding(), signal: controller?.signal }),
      fetchStudyHabitat({ ...getApiBinding(), days: 30, signal: controller?.signal }),
      includeCatalog ? fetchFishCatalog({ ...getApiBinding(), signal: controller?.signal }) : Promise.resolve(null)
    ]).then(([profileResult, habitatResult, catalogResult]) => {
      if (requestKeyRef.current !== requestKey) return;
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
      const habitat = habitatResult.status === 'fulfilled' ? habitatResult.value : null;
      const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null;
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
        }),
        ...(includeCatalog ? (catalog?.ok ? {
          fishCatalog: catalog.data.catalog || [],
          fishInventory: catalog.data.inventory || [],
          fishCatalogStatus: 'ready',
          fishCatalogError: ''
        } : {
          fishCatalogStatus: 'error',
          fishCatalogError: catalog?.error || '물고기 목록을 불러오지 못했습니다.'
        }) : {})
      });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, getApiBinding, includeCatalog, refreshTick, setState]);
}
