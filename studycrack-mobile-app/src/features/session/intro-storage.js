import { readString, safeStringifySet, STORAGE_KEYS } from '../../state/storage.js';

export function hasSeenIntro(storage) {
  try { return readString(STORAGE_KEYS.introSeen, '', storage) === '1'; } catch { return false; }
}

export function markIntroSeen(storage) {
  try { return safeStringifySet(STORAGE_KEYS.introSeen, 1, storage); } catch { return false; }
}
