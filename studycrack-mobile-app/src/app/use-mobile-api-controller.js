import React from 'react';
import { saveNotificationPreferences, saveQualitative, saveQuantitative, saveTargetUnivs } from '../features/account/api.js';
import { saveStudySession } from '../features/planner/api.js';
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
  const getReportApiBinding = useCallback(() => getMobileApiBinding('report', 'reportApiUrl'), []);
  const getQnaApiBinding = useCallback(() => getMobileApiBinding('qna', 'qnaApiUrl'), []);
  const getNotiApiBinding = useCallback(() => getMobileApiBinding('noti', 'notiApiUrl'), []);
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
  const persistStudySession = useCallback(
    (session) => saveStudySession({ ...getUserApiBinding(), session }),
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
    getFileApiBinding,
    hasClientSession,
    persistTargetUnivs,
    persistQuantitative,
    persistQualitative,
    persistStudySession,
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
    getFileApiBinding,
    hasClientSession,
    persistTargetUnivs,
    persistQuantitative,
    persistQualitative,
    persistStudySession,
    refreshStudyRanking,
    persistNotificationPreferences,
    persistMobileQna,
    persistProReportRequest,
    persistWeeklyCheck,
    uploadWeeklyCheckFiles,
    uploadProfileImage
  ]);
}
