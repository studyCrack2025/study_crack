import React from 'react';
import { persistAccountStorage } from '../features/account/storage.js';
import { accountSlice } from '../features/account/state.js';
import { persistAnalysisStorage } from '../features/analysis/storage.js';
import { analysisSlice } from '../features/analysis/state.js';
import { persistNotificationsStorage } from '../features/notifications/storage.js';
import { notificationsSlice } from '../features/notifications/state.js';
import { persistStudyStorage } from '../features/study/storage.js';
import { studySlice } from '../features/study/state.js';
import { persistNavigationStorage } from '../runtime/navigation-storage.js';
import { navigationSlice } from '../state/navigation-state.js';
import { getMobileAccountStorage } from '../shared/browser/mobile-runtime.js';

const { useEffect } = React;

export function useAppStatePersistence(rootState) {
  const storageRef = React.useRef();
  if (!storageRef.current) storageRef.current = getMobileAccountStorage();
  const analysisResource = analysisSlice.selectors.serverResource(rootState);
  const analysisDraft = analysisSlice.selectors.localDraft(rootState);
  const studyResource = studySlice.selectors.serverResource(rootState);
  const studyDraft = studySlice.selectors.localDraft(rootState);
  const notificationResource = notificationsSlice.selectors.serverResource(rootState);
  const accountResource = accountSlice.selectors.serverResource(rootState);
  const navigationUi = navigationSlice.selectors.ephemeralUi(rootState);

  useEffect(() => {
    persistAnalysisStorage({ scores: analysisResource.scores, targetMajor: analysisDraft.targetMajor }, storageRef.current);
  }, [analysisResource.scores, analysisDraft.targetMajor]);

  useEffect(() => {
    persistStudyStorage({
      activeStudySession: studyDraft.activeStudySession,
      rewardPendingSessionId: studyDraft.rewardPendingSessionId,
      studyRecords: studyResource.studyRecords,
      studySubjectRecords: studyResource.studySubjectRecords
    }, storageRef.current);
  }, [studyDraft.activeStudySession, studyDraft.rewardPendingSessionId, studyResource.studyRecords, studyResource.studySubjectRecords]);

  useEffect(() => {
    persistNotificationsStorage({ notifications: notificationResource.notifications }, storageRef.current);
  }, [notificationResource.notifications]);

  useEffect(() => {
    persistAccountStorage({ personalEvents: accountResource.personalEvents, selectedPlan: accountResource.selectedPlan }, storageRef.current);
  }, [accountResource.personalEvents, accountResource.selectedPlan]);

  useEffect(() => {
    persistNavigationStorage({ tab: navigationUi.tab });
  }, [navigationUi.tab]);
}
