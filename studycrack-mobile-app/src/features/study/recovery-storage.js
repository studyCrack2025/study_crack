import { STORAGE_KEYS } from '../../state/storage.js';
import { getMobileAccountStorage } from '../../shared/browser/mobile-runtime.js';
import { validateStudySessionId } from './session-model.js';

export function hydrateStudyRecovery(state, storage = getMobileAccountStorage()) {
  let stored;
  try { const raw = storage?.getItem?.(STORAGE_KEYS.studyRecovery); stored = raw ? JSON.parse(raw) : null; }
  catch { stored = 'unreadable'; }
  const valid = stored && Array.isArray(stored.pending) && Array.isArray(stored.applied)
    && stored.pending.length <= 100 && stored.applied.length <= 128
    && stored.pending.every(row => validateStudySessionId(row?.sessionId).ok && ['pending', 'terminal'].includes(row.status))
    && stored.applied.every(id => validateStudySessionId(id).ok)
    && (stored.records === null || Array.isArray(stored.records)) && (stored.subjects === null || Array.isArray(stored.subjects));
  const recovery = valid ? stored : { pending: state.rewardPendingSessionId ? [{ sessionId: state.rewardPendingSessionId, status: 'pending' }] : [], applied: [], records: null, subjects: null };
  const completed = state.activeStudySession && recovery.applied.includes(state.activeStudySession.sessionId);
  return {
    studyRecovery: recovery,
    rewardPendingSessionId: recovery.pending[0]?.sessionId || '',
    rewardRecoveryError: stored && !valid ? '복구 기록을 읽지 못했어요. 기존 기록은 유지됩니다. 고객센터에 문의해주세요.' : '',
    ...(recovery.records ? { studyRecords: recovery.records } : {}),
    ...(recovery.subjects ? { studySubjectRecords: recovery.subjects } : {}),
    ...(completed ? { activeStudySession: null, activeStudySubject: '', activePlannerItemId: '', studyTimerRunning: false, timerPhase: 'idle' } : {})
  };
}
