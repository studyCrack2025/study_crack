import { normalizePersonalEvent } from '../../constants/admission-calendar.js';
import { STORAGE_KEYS, readArray, safeStringifySet } from '../../state/storage.js';
import { getMobileAccountStorage } from '../../shared/browser/mobile-runtime.js';

export function hydrateAccountStorage(storage = getMobileAccountStorage()) {
  return {
    personalEvents: readArray(STORAGE_KEYS.admissionCalendar, [], storage)
      .map((event) => normalizePersonalEvent(event))
      .filter(Boolean)
  };
}

export function persistAccountStorage({ personalEvents, selectedPlan } = {}, storage = getMobileAccountStorage()) {
  safeStringifySet(STORAGE_KEYS.admissionCalendar, personalEvents || [], storage);
  try {
    storage?.setItem?.(STORAGE_KEYS.selectedPlan, String(selectedPlan || ''));
  } catch (_error) {}
}
