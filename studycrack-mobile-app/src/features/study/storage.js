import { STORAGE_KEYS, safeParse, safeStringifySet } from '../../state/storage.js';
import { normalizeStoredStudySession, validateStudySessionId } from './session-model.js';
import { getMobileAccountStorage } from '../../shared/browser/mobile-runtime.js';

export function hydrateStudyStorage(storage = getMobileAccountStorage()) {
  const activeStudySession = normalizeStoredStudySession(safeParse(STORAGE_KEYS.activeStudySession, null, storage));
  const studyRecords = safeParse(STORAGE_KEYS.studyRecords, null, storage);
  const studySubjectRecords = safeParse(STORAGE_KEYS.studySubjectRecords, null, storage);
  const rewardPendingSessionId = validateStudySessionId(safeParse(STORAGE_KEYS.rewardPendingSessionId, '', storage)).value || '';
  return {
    ...(Array.isArray(studyRecords) ? { studyRecords } : {}),
    ...(Array.isArray(studySubjectRecords) ? { studySubjectRecords } : {}),
    activeStudySession,
    rewardPendingSessionId,
    studyTimerRunning: activeStudySession?.status === 'running',
    timerPhase: activeStudySession?.status === 'running' ? 'running' : activeStudySession ? 'recoverable-error' : 'idle',
    completionError: activeStudySession?.status === 'starting'
        ? '공부 시작 연결을 다시 확인해주세요.'
        : '',
    ...(activeStudySession ? {
      activeStudySubject: activeStudySession.subject,
      activePlannerItemId: activeStudySession.plannerItemId || ''
    } : {})
  };
}

export function persistStudyStorage(state = {}, storage = getMobileAccountStorage()) {
  safeStringifySet(STORAGE_KEYS.studyRecords, state.studyRecords || [], storage);
  safeStringifySet(STORAGE_KEYS.studySubjectRecords, state.studySubjectRecords || [], storage);
  safeStringifySet(STORAGE_KEYS.activeStudySession, state.activeStudySession || null, storage);
  safeStringifySet(STORAGE_KEYS.rewardPendingSessionId, state.rewardPendingSessionId || '', storage);
}
