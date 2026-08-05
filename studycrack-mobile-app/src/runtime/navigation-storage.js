import { STORAGE_KEYS, readString } from '../state/storage.js';

export function hydrateNavigationStorage(storage = globalThis.localStorage) {
  const tab = readString(STORAGE_KEYS.activeTab, '', storage);
  return tab ? { tab } : {};
}

export function persistNavigationStorage({ tab } = {}, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(STORAGE_KEYS.activeTab, String(tab || ''));
  } catch (_error) {}
}
