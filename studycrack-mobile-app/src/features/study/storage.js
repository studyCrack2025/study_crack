import { STORAGE_KEYS, safeParse, safeStringifySet } from '../../state/storage.js';
import { normalizeStoredStudySession } from './session-model.js';

export function hydrateStudyStorage(storage = globalThis.localStorage) {
  const activeStudySession = normalizeStoredStudySession(safeParse(STORAGE_KEYS.activeStudySession, null, storage));
  const studyRecords = safeParse(STORAGE_KEYS.studyRecords, null, storage);
  const studySubjectRecords = safeParse(STORAGE_KEYS.studySubjectRecords, null, storage);
  const rewardPendingSessionId = String(safeParse(STORAGE_KEYS.rewardPendingSessionId, '', storage) || '');
  return {
    ...(Array.isArray(studyRecords) ? { studyRecords } : {}),
    ...(Array.isArray(studySubjectRecords) ? { studySubjectRecords } : {}),
    activeStudySession,
    rewardPendingSessionId,
    studyTimerRunning: activeStudySession?.status === 'running',
    timerPhase: activeStudySession?.status === 'running' ? 'running' : (activeStudySession || rewardPendingSessionId) ? 'recoverable-error' : 'idle',
    completionError: rewardPendingSessionId
      ? '저장된 공부 보상을 다시 확인해주세요.'
      : activeStudySession?.status === 'starting'
        ? '공부 시작 연결을 다시 확인해주세요.'
        : '',
    ...(activeStudySession ? {
      activeStudySubject: activeStudySession.subject,
      activePlannerItemId: activeStudySession.plannerItemId || ''
    } : {})
  };
}

export function persistStudyStorage(state = {}, storage = globalThis.localStorage) {
  safeStringifySet(STORAGE_KEYS.studyRecords, state.studyRecords || [], storage);
  safeStringifySet(STORAGE_KEYS.studySubjectRecords, state.studySubjectRecords || [], storage);
  safeStringifySet(STORAGE_KEYS.activeStudySession, state.activeStudySession || null, storage);
  safeStringifySet(STORAGE_KEYS.rewardPendingSessionId, state.rewardPendingSessionId || '', storage);
}
