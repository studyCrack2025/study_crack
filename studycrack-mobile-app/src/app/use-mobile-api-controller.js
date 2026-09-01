import React from 'react';
import { saveNotificationPreferences, saveQualitative, saveQuantitative, saveTargetUnivs } from '../features/account/api.js';
import { fetchConsultingHome } from '../features/consulting/api.js';
import { acknowledgeFishDraw, claimStarterFish, claimStudyReward, drawFish, feedFish, renameFish, setActiveFish } from '../features/gamification/api.js';
import { completeServerStudySession, startServerStudySession } from '../features/study/api.js';
import { completeStudyRewardPipeline } from '../features/study/reward-pipeline.js';
import { requestMobileProReport, saveMobileWeeklyCheck, uploadMobileFile, uploadMobileWeeklyFiles } from '../features/reports/api.js';
import { saveMobileQna } from '../features/support/api.js';
import {
  getMobileApiBinding,
  getMobileFileApiBinding,
  hasMobileClientSession
} from '../shared/browser/mobile-runtime.js';

const { useCallback, useMemo } = React;

export function useMobileApiController({ setState, stateRef } = {}) {
  const getUserApiBinding = useCallback(() => getMobileApiBinding('user', 'userApiUrl'), []);
  const getAnalysisApiBinding = useCallback(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const getConsultingApiBinding = useCallback(() => getMobileApiBinding('consulting', 'consultingApiUrl'), []);
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
    (session) => startServerStudySession({ ...getUserApiBinding(), session }),
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
    (sessionId, onPhase) => completeStudyRewardPipeline({
      sessionId,
      onPhase,
      completeSession: (id) => completeServerStudySession({ ...getUserApiBinding(), sessionId: id }),
      claimReward: claimCompletedStudyReward
    }),
    [claimCompletedStudyReward, getUserApiBinding]
  );
  const refreshStudyRanking = useCallback(() => {
    setState({ rankingRefreshTick: Number(stateRef.current.rankingRefreshTick || 0) + 1 });
  }, [setState, stateRef]);
  const persistNotificationPreferences = useCallback(
    (preferences) => saveNotificationPreferences({ ...getUserApiBinding(), preferences }),
    [getUserApiBinding]
  );
  const loadConsultingHome = useCallback(
    (signal) => fetchConsultingHome({ ...getConsultingApiBinding(), signal }),
    [getConsultingApiBinding]
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
    getConsultingApiBinding,
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
    loadConsultingHome,
    persistMobileQna,
    persistProReportRequest,
    persistWeeklyCheck,
    uploadWeeklyCheckFiles,
    uploadProfileImage
  }), [
    getUserApiBinding,
    getAnalysisApiBinding,
    getConsultingApiBinding,
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
    loadConsultingHome,
    persistMobileQna,
    persistProReportRequest,
    persistWeeklyCheck,
    uploadWeeklyCheckFiles,
    uploadProfileImage
  ]);
}
