import React from 'react';
import { persistAccountStorage } from '../features/account/storage.js';
import { accountSlice } from '../features/account/state.js';
import { persistAnalysisStorage } from '../features/analysis/storage.js';
import { analysisSlice } from '../features/analysis/state.js';
import { persistNotificationsStorage } from '../features/notifications/storage.js';
import { notificationsSlice } from '../features/notifications/state.js';
import { persistPlannerStorage } from '../features/planner/storage.js';
import { plannerSlice } from '../features/planner/state.js';
import { persistNavigationStorage } from '../runtime/navigation-storage.js';
import { navigationSlice } from '../state/navigation-state.js';

const { useEffect } = React;

export function useAppStatePersistence(rootState) {
  const analysisResource = analysisSlice.selectors.serverResource(rootState);
  const analysisDraft = analysisSlice.selectors.localDraft(rootState);
  const plannerResource = plannerSlice.selectors.serverResource(rootState);
  const notificationResource = notificationsSlice.selectors.serverResource(rootState);
  const accountResource = accountSlice.selectors.serverResource(rootState);
  const navigationUi = navigationSlice.selectors.ephemeralUi(rootState);

  useEffect(() => {
    persistAnalysisStorage({ scores: analysisResource.scores, targetMajor: analysisDraft.targetMajor });
  }, [analysisResource.scores, analysisDraft.targetMajor]);

  useEffect(() => {
    persistPlannerStorage({
      activeStudySession: plannerResource.activeStudySession,
      plannerItems: plannerResource.plannerItems,
      studyRecords: plannerResource.studyRecords,
      studySubjectRecords: plannerResource.studySubjectRecords
    });
  }, [plannerResource.activeStudySession, plannerResource.plannerItems, plannerResource.studyRecords, plannerResource.studySubjectRecords]);

  useEffect(() => {
    persistNotificationsStorage({ notifications: notificationResource.notifications });
  }, [notificationResource.notifications]);

  useEffect(() => {
    persistAccountStorage({ personalEvents: accountResource.personalEvents, selectedPlan: accountResource.selectedPlan });
  }, [accountResource.personalEvents, accountResource.selectedPlan]);

  useEffect(() => {
    persistNavigationStorage({ tab: navigationUi.tab });
  }, [navigationUi.tab]);
}
