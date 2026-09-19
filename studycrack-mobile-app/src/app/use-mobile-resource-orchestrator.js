import React from 'react';
import { canUseReverseProjection, canUseScoreSimulation } from './access-policy.js';
import { useAdmissionCalendarResource } from '../features/account/use-admission-calendar-resource.js';
import { useAnalysisResources } from '../features/analysis/use-analysis-resources.js';
import { useNotificationResource } from '../features/notifications/use-notification-resource.js';
import { useRankingResource } from '../features/planner/use-ranking-resource.js';
import { useGameProfileResource } from '../features/gamification/use-game-profile-resource.js';
import { useReportResources } from '../features/reports/use-report-resources.js';
import { useSession } from '../features/session/use-session.js';
import { createUserDataResetPatch, mapUserToStatePatch } from '../features/session/user-state.js';
import { blockNonStudentMobileSession } from '../features/session/mobile-session-adapter.js';
import { useSupportResource } from '../features/support/use-support-resource.js';
import { useStudySummaryResource } from '../features/study/use-study-summary-resource.js';
import { persistMobileUserRole } from '../shared/browser/mobile-runtime.js';

const { useCallback, useRef } = React;

export function useMobileResourceOrchestrator({ api, setState, state, stateRef } = {}) {
  const userFetchRetryRef = useRef(0);
  const retryUserLoad = useCallback(() => {
    userFetchRetryRef.current = 0;
    setState({
      ...createUserDataResetPatch(),
      userLoadStatus: 'idle',
      userLoadError: '',
      userFetchRetryTick: (stateRef.current.userFetchRetryTick || 0) + 1
    });
  }, [setState, stateRef]);

  const applyUserData = useCallback((userData) => {
    const role = String(userData?.role || 'student').toLowerCase();
    if (role && role !== 'student') {
      blockNonStudentMobileSession(role);
      return;
    }
    if (userData?.role) persistMobileUserRole(userData.role);
    const patch = mapUserToStatePatch(userData, stateRef.current);
    setState({ ...patch, userLoadStatus: 'ready', userLoadError: '' });
  }, [setState, stateRef]);

  useSession({
    applyUserData,
    configRetryRef: userFetchRetryRef,
    getApiBinding: api.getUserApiBinding,
    hasSession: api.hasClientSession,
    resetPatch: createUserDataResetPatch,
    retryTick: state.userFetchRetryTick,
    setState
  });

  const resourceSessionReady = state.userLoadStatus === 'ready' && api.hasClientSession();
  useRankingResource({
    enabled: resourceSessionReady && ['timer', 'ranking'].includes(state.screen),
    getApiBinding: api.getUserApiBinding,
    period: state.screen === 'ranking' ? state.rankingPeriod : 'daily',
    refreshTick: state.rankingRefreshTick,
    setState
  });
  useGameProfileResource({
    enabled: resourceSessionReady && ['timer', 'aquarium', 'my'].includes(state.screen),
    getApiBinding: api.getGameApiBinding,
    includeCatalog: state.screen === 'aquarium',
    refreshTick: state.gameRefreshTick,
    setState
  });
  useStudySummaryResource({
    enabled: resourceSessionReady && ['timer', 'aquarium', 'strategy', 'my'].includes(state.screen),
    getApiBinding: api.getUserApiBinding,
    refreshTick: state.studySummaryRefreshTick,
    setState
  });
  useAdmissionCalendarResource({
    enabled: state.userLoadStatus === 'ready' && state.screen === 'planner' && state.calendarSyncStatus !== 'error',
    getApiBinding: api.getUserApiBinding,
    hasSession: api.hasClientSession,
    setState
  });
  useReportResources({ enabled: resourceSessionReady, getApiBinding: api.getReportApiBinding, screen: state.screen, refreshTick: state.reportsRefreshTick, setState });
  useSupportResource({ enabled: resourceSessionReady && ['customerSupport', 'tutor'].includes(state.screen), getApiBinding: api.getQnaApiBinding, refreshTick: state.qnaRefreshTick, setState });
  useNotificationResource({
    enabled: resourceSessionReady && (state.screen === 'notificationList' || state.notifModalOpen),
    getApiBinding: api.getNotiApiBinding,
    refreshTick: state.notiRefreshTick,
    setState
  });
  useAnalysisResources({
    canBacktrace: canUseReverseProjection(state),
    canSimulate: canUseScoreSimulation(state),
    getApiBinding: api.getAnalysisApiBinding,
    setState,
    state,
    stateRef
  });

  return { resourceSessionReady, retryUserLoad };
}
