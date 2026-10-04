import React from 'react';
import { saveNotificationPreferences, saveQualitative, saveQuantitative, saveTargetUnivs } from '../features/account/api.js';
import { acknowledgeFishDraw, claimStarterFish, claimStudyReward, drawFish, feedFish, renameFish, setActiveFish } from '../features/gamification/api.js';
import { requestMobileProReport, saveMobileWeeklyCheck, uploadMobileFile, uploadMobileWeeklyFiles } from '../features/reports/api.js';
import { saveMobileQna } from '../features/support/api.js';
import {
  getMobileApiBinding,
  getMobileFileApiBinding,
  hasMobileClientSession,
  loadMobileModule
} from '../shared/browser/mobile-runtime.js';

const { useCallback, useMemo } = React;

async function studyRequest(binding, operation, data) {
  const browser = globalThis.window;
  const scope = browser?.captureClientSession?.();
  let api;
  try { api = await loadMobileModule(() => import('../features/study/api.js')); }
  catch { return { ok: false, error: '공부 기록 연결을 다시 확인해주세요.' }; }
  if (scope && !browser.isClientSessionCurrent(scope)) return { ok: false, code: 'REQUEST_ABORTED' };
  return api[operation]({ ...binding, ...data });
}

export function useMobileApiController({ setState, stateRef } = {}) {
  const getUserApiBinding = useCallback(() => getMobileApiBinding('user', 'userApiUrl'), []);
  const getAnalysisApiBinding = useCallback(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const getReportApiBinding = useCallback(() => getMobileApiBinding('report', 'reportApiUrl'), []);
  const getQnaApiBinding = useCallback(() => getMobileApiBinding('qna', 'qnaApiUrl'), []);
  const getNotiApiBinding = useCallback(() => getMobileApiBinding('noti', 'notiApiUrl'), []);
  const getGameApiBinding = useCallback(() => getMobileApiBinding('game', 'gameApiUrl'), []);
  const getFileApiBinding = useCallback(() => getMobileFileApiBinding(), []);
  const hasClientSession = useCallback(() => hasMobileClientSession(), []);

  const persistTargetUnivs = useCallback(
    (targetList, targetSlots) => saveTargetUnivs({ ...getUserApiBinding(), targetList, targetSlots }),
    [getUserApiBinding]
  );
  const persistQuantitative = useCallback(
    (quantitative) => saveQuantitative({ ...getUserApiBinding(), quantitative }),
    [getUserApiBinding]
  );
  const persistQualitative = useCallback(
    (qualitative) => saveQualitative({ ...getUserApiBinding(), qualitative }),
    [getUserApiBinding]
  );
  const startStudySession = useCallback(
    session => studyRequest(getUserApiBinding(), 'startServerStudySession', { session }),
    [getUserApiBinding]
  );
  const claimCompletedStudyReward = useCallback(
    (sessionId) => claimStudyReward({ ...getGameApiBinding(), sessionId }),
    [getGameApiBinding]
  );
  const claimAquariumStarter = useCallback(
    (speciesId) => claimStarterFish({ ...getGameApiBinding(), speciesId }),
    [getGameApiBinding]
  );
  const feedAquariumFish = useCallback(
    (fishId, requestId) => feedFish({ ...getGameApiBinding(), fishId, requestId }),
    [getGameApiBinding]
  );
  const updateAquariumActiveFish = useCallback(
    (fishId, slot) => setActiveFish({ ...getGameApiBinding(), fishId, slot }),
    [getGameApiBinding]
  );
  const updateAquariumFishName = useCallback(
    (fishId, name) => renameFish({ ...getGameApiBinding(), fishId, name }),
    [getGameApiBinding]
  );
  const startAquariumFishDraw = useCallback(
    (requestId) => drawFish({ ...getGameApiBinding(), requestId }),
    [getGameApiBinding]
  );
  const acknowledgeAquariumFishDraw = useCallback(
    (requestId) => acknowledgeFishDraw({ ...getGameApiBinding(), requestId }),
    [getGameApiBinding]
  );
  const completeStudySession = useCallback(
    sessionId => studyRequest(getUserApiBinding(), 'completeServerStudySession', { sessionId }),
    [getUserApiBinding]
  );
  const refreshStudyRanking = useCallback(() => {
    setState({ rankingRefreshTick: Number(stateRef.current.rankingRefreshTick || 0) + 1 });
  }, [setState, stateRef]);
  const persistNotificationPreferences = useCallback(
    (preferences) => saveNotificationPreferences({ ...getUserApiBinding(), preferences }),
    [getUserApiBinding]
  );
  const persistMobileQna = useCallback(
    ({ title, content } = {}) => saveMobileQna({ ...getQnaApiBinding(), title, content }),
    [getQnaApiBinding]
  );
  const persistProReportRequest = useCallback(
    (requestText) => requestMobileProReport({ ...getReportApiBinding(), requestText }),
    [getReportApiBinding]
  );
  const persistWeeklyCheck = useCallback(
    (payload) => saveMobileWeeklyCheck({ ...getReportApiBinding(), payload }),
    [getReportApiBinding]
  );
  const uploadWeeklyCheckFiles = useCallback(
    ({ examFiles, plannerFiles } = {}) => uploadMobileWeeklyFiles({ ...getFileApiBinding(), examFiles, plannerFiles }),
    [getFileApiBinding]
  );
  const uploadProfileImage = useCallback(
    (file) => uploadMobileFile({ ...getFileApiBinding(), file, folder: 'profile' }),
    [getFileApiBinding]
  );

  return useMemo(() => ({
    getUserApiBinding,
    getAnalysisApiBinding,
    getReportApiBinding,
    getQnaApiBinding,
    getNotiApiBinding,
    getGameApiBinding,
    getFileApiBinding,
    hasClientSession,
    persistTargetUnivs,
    persistQuantitative,
    persistQualitative,
    startStudySession,
    completeStudySession,
    claimCompletedStudyReward,
    claimAquariumStarter,
    feedAquariumFish,
    updateAquariumActiveFish,
    updateAquariumFishName,
    startAquariumFishDraw,
    acknowledgeAquariumFishDraw,
    refreshStudyRanking,
    persistNotificationPreferences,
    persistMobileQna,
    persistProReportRequest,
    persistWeeklyCheck,
    uploadWeeklyCheckFiles,
    uploadProfileImage
  }), [
    getUserApiBinding,
    getAnalysisApiBinding,
    getReportApiBinding,
    getQnaApiBinding,
    getNotiApiBinding,
    getGameApiBinding,
    getFileApiBinding,
    hasClientSession,
    persistTargetUnivs,
    persistQuantitative,
    persistQualitative,
    startStudySession,
    completeStudySession,
    claimCompletedStudyReward,
    claimAquariumStarter,
    feedAquariumFish,
    updateAquariumActiveFish,
    updateAquariumFishName,
    startAquariumFishDraw,
    acknowledgeAquariumFishDraw,
    refreshStudyRanking,
    persistNotificationPreferences,
    persistMobileQna,
    persistProReportRequest,
    persistWeeklyCheck,
    uploadWeeklyCheckFiles,
    uploadProfileImage
  ]);
}
