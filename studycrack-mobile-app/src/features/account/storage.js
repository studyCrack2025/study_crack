import { normalizePersonalEvent } from '../../constants/admission-calendar.js';
import { STORAGE_KEYS, readArray, safeStringifySet } from '../../state/storage.js';

export function hydrateAccountStorage(storage = globalThis.localStorage) {
  return {
    personalEvents: readArray(STORAGE_KEYS.admissionCalendar, [], storage)
      .map((event) => normalizePersonalEvent(event))
      .filter(Boolean)
  };
}

export function persistAccountStorage({ personalEvents, selectedPlan } = {}, storage = globalThis.localStorage) {
  safeStringifySet(STORAGE_KEYS.admissionCalendar, personalEvents || [], storage);
  try {
    storage?.setItem?.(STORAGE_KEYS.selectedPlan, String(selectedPlan || ''));
  } catch (_error) {}
}
