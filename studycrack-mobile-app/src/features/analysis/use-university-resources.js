import { useEffect, useRef } from 'react';
import { fetchUniversityCatalog, fetchUniversityRecommendations } from './api.js';

export function useUniversityResources({ examData, examMode, excludeTargets, getApiBinding, recommendationRetryTick = 0, retryTick = 0, savedStream = '', screen, setState, userReady } = {}) {
  const catalogRequestRef = useRef(0);
  const recommendationRequestRef = useRef(0);
  const pageRef = useRef({ key: '', cursor: null, exhausted: false });

  useEffect(() => {
    if (screen !== 'addUniversity' || !userReady) return undefined;
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
  }, [getApiBinding, retryTick, screen, setState, userReady]);

  useEffect(() => {
    if (!['addUniversity', 'ob4'].includes(screen) || !userReady) {
      pageRef.current = { key: '', cursor: null, exhausted: false };
      return undefined;
    }
    const recommendationCount = screen === 'addUniversity' ? 6 : 3;
    const recommendationMode = screen === 'addUniversity' ? 'balanced' : 'fit';
    const key = JSON.stringify([examData, examMode, excludeTargets, savedStream, screen, recommendationCount, recommendationMode]);
    if (key !== pageRef.current.key || pageRef.current.exhausted) pageRef.current = { key, cursor: null, exhausted: false };
    const requestKey = recommendationRequestRef.current + 1;
    recommendationRequestRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ universityRecommendations: [], universityRecommendationDetails: [], universityRecommendationSummary: null,
      universityRecommendationStatus: 'loading', universityRecommendationError: '' });
    fetchUniversityRecommendations({
      ...getApiBinding(),
      examData,
      examMode,
      savedStream,
      excludeTargets,
      cursor: pageRef.current.cursor,
      recommendationCount,
      recommendationMode,
      signal: controller?.signal
    }).then((result) => {
      if (recommendationRequestRef.current !== requestKey) return;
      if (result.ok) pageRef.current = { key, cursor: result.page?.nextCursor || null, exhausted: result.page?.hasMore !== true };
      else if (result.code === 'RECOMMENDATION_CURSOR_STALE') pageRef.current = { key, cursor: null, exhausted: false };
      const recommendations = result.data || [];
      setState({
        universityRecommendations: recommendations,
        universityRecommendationDetails: result.ok ? result.details || [] : [],
        universityRecommendationSummary: result.ok ? result.summary : null,
        universityRecommendationStatus: !result.ok ? 'error' : !result.page?.hasMore ? 'exhausted' : recommendations.length ? 'ready' : 'empty',
        universityRecommendationError: result.code === 'RECOMMENDATION_CURSOR_STALE'
          ? '성적이나 추천 기준이 변경되었습니다. 다시 시도하면 처음부터 확인합니다.' : result.error || ''
      });
    });
    return () => {
      controller?.abort();
      if (recommendationRequestRef.current === requestKey) recommendationRequestRef.current += 1;
    };
  }, [examData, examMode, excludeTargets, getApiBinding, recommendationRetryTick, savedStream, screen, setState, userReady]);
}
