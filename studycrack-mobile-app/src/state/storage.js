export const STORAGE_KEYS = {
  introSeen: 'studycrackIntroSeen_v1',
  activeTab: 'activeTab',
  admissionCalendar: 'admissionCalendar',
  examScoresByType: 'examScoresByType',
  notifications: 'notifications',
  plannerItems: 'plannerItems',
  scores: 'scores',
  selectedPlan: 'selectedPlan',
  selectedUniversity: 'selectedUniversity',
  activeStudySession: 'activeStudySession',
  rewardPendingSessionId: 'studyRewardPendingSessionId',
  studyRecords: 'studyRecords',
  studySubjectRecords: 'studySubjectRecords',
  user: 'user'
};

export function safeParse(key, fallback, storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem?.(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`${key} parse failed`, error);
    return fallback;
  }
}

export function safeStringifySet(key, value, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
    return true;
  } catch (_error) {
    return false;
  }
}

export function readString(key, fallback = '', storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(key) || fallback;
  } catch (_error) {
    return fallback;
  }
}

function readObject(key, fallback = {}, storage = globalThis.localStorage) {
  const parsed = safeParse(key, fallback, storage);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
}

export function readArray(key, fallback = [], storage = globalThis.localStorage) {
  const parsed = safeParse(key, fallback, storage);
  return Array.isArray(parsed) ? parsed : fallback;
}

export function readExamScoresMap(storage = globalThis.localStorage) {
  return readObject(STORAGE_KEYS.examScoresByType, {}, storage);
}

export function writeExamScoresMap(map, storage = globalThis.localStorage) {
  return safeStringifySet(STORAGE_KEYS.examScoresByType, map || {}, storage);
}
