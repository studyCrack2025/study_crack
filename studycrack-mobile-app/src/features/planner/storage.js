import { normalizePlannerItems } from '../../state/planner-storage.js';
import { STORAGE_KEYS, safeParse, safeStringifySet } from '../../state/storage.js';

function removeLegacyDemoPlannerItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => !String(item?.id || '').startsWith('pl-default-'));
}

export function hydratePlannerStorage(storage = globalThis.localStorage) {
  const plannerItems = safeParse(STORAGE_KEYS.plannerItems, null, storage);
  const studyRecords = safeParse(STORAGE_KEYS.studyRecords, null, storage);
  const studySubjectRecords = safeParse(STORAGE_KEYS.studySubjectRecords, null, storage);
  const activeStudySession = safeParse(STORAGE_KEYS.activeStudySession, null, storage);
  const active = activeStudySession && typeof activeStudySession === 'object'
    && !Array.isArray(activeStudySession) && activeStudySession.status === 'running'
    ? activeStudySession
    : null;

  return {
    ...(Array.isArray(plannerItems)
      ? { plannerItems: normalizePlannerItems(removeLegacyDemoPlannerItems(plannerItems)) }
      : {}),
    ...(Array.isArray(studyRecords) ? { studyRecords } : {}),
    ...(Array.isArray(studySubjectRecords) ? { studySubjectRecords } : {}),
    activeStudySession: active,
    studyTimerRunning: Boolean(active),
    ...(active ? {
      activeStudySubject: String(active.subject || ''),
      activePlannerItemId: String(active.plannerItemId || '')
    } : {})
  };
}

export function persistPlannerStorage(state = {}, storage = globalThis.localStorage) {
  safeStringifySet(STORAGE_KEYS.plannerItems, state.plannerItems || [], storage);
  safeStringifySet(STORAGE_KEYS.studyRecords, state.studyRecords || [], storage);
  safeStringifySet(STORAGE_KEYS.studySubjectRecords, state.studySubjectRecords || [], storage);
  safeStringifySet(STORAGE_KEYS.activeStudySession, state.activeStudySession || null, storage);
}
