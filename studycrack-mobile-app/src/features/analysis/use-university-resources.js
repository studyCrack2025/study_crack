import { useEffect, useRef } from 'react';
import { fetchUniversityCatalog, fetchUniversityRecommendations } from './api.js';

export function useUniversityResources({ examData, examMode, excludeTargets, getApiBinding, retryTick = 0, savedStream = '', screen, setState, userReady } = {}) {
  const catalogRequestRef = useRef(0);
  const recommendationRequestRef = useRef(0);

  useEffect(() => {
    if (screen !== 'addUniversity') return undefined;
    const requestKey = catalogRequestRef.current + 1;
    catalogRequestRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ universityCatalogStatus: 'loading', universityCatalogError: '' });
    fetchUniversityCatalog({ ...getApiBinding(), signal: controller?.signal }).then((result) => {
      if (catalogRequestRef.current !== requestKey) return;
      setState(result.ok
        ? { universityCatalog: result.data || [], universityCatalogStatus: 'ready', universityCatalogError: '' }
        : { universityCatalog: [], universityCatalogStatus: 'error', universityCatalogError: result.error || '대학·학과 목록을 불러오지 못했습니다.' });
    });
    return () => {
      controller?.abort();
      if (catalogRequestRef.current === requestKey) catalogRequestRef.current += 1;
    };
  }, [getApiBinding, retryTick, screen, setState]);

  useEffect(() => {
    if (screen !== 'addUniversity' || !userReady) return undefined;
    const requestKey = recommendationRequestRef.current + 1;
    recommendationRequestRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ universityRecommendationStatus: 'loading', universityRecommendationError: '' });
    fetchUniversityRecommendations({
      ...getApiBinding(),
      examData,
      examMode,
      savedStream,
      excludeTargets,
      signal: controller?.signal
    }).then((result) => {
      if (recommendationRequestRef.current !== requestKey) return;
      const recommendations = result.data || [];
      setState({
        universityRecommendations: recommendations,
        universityRecommendationStatus: result.ok && recommendations.length ? 'ready' : 'empty',
        universityRecommendationError: result.error || ''
      });
    });
    return () => {
      controller?.abort();
      if (recommendationRequestRef.current === requestKey) recommendationRequestRef.current += 1;
    };
  }, [examData, examMode, excludeTargets, getApiBinding, savedStream, screen, setState, userReady]);
}
