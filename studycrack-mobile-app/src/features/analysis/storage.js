import { STORAGE_KEYS, safeParse, safeStringifySet } from '../../state/storage.js';

const LEGACY_DEMO_SCORES = { korean: 82, math: 68, english: 77, inquiry1: 70, inquiry2: 66 };

function isLegacyDemoScores(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(LEGACY_DEMO_SCORES);
  return keys.every((key) => Number(value[key]) === LEGACY_DEMO_SCORES[key])
    && Object.keys(value).every((key) => keys.includes(key));
}

export function hydrateAnalysisStorage(storage = globalThis.localStorage) {
  const scores = safeParse(STORAGE_KEYS.scores, null, storage);
  const valid = scores && typeof scores === 'object' && !Array.isArray(scores) && !isLegacyDemoScores(scores);
  return { scores: valid ? scores : {} };
}

export function persistAnalysisStorage({ scores, targetMajor } = {}, storage = globalThis.localStorage) {
  safeStringifySet(STORAGE_KEYS.scores, scores || {}, storage);
  try {
    storage?.setItem?.(STORAGE_KEYS.selectedUniversity, String(targetMajor || ''));
  } catch (_error) {}
}
