import { STORAGE_KEYS, safeParse, safeStringifySet } from '../../state/storage.js';

export function hydrateNotificationsStorage(storage = globalThis.localStorage) {
  const notifications = safeParse(STORAGE_KEYS.notifications, null, storage);
  return notifications && typeof notifications === 'object' && !Array.isArray(notifications)
    ? { notifications }
    : {};
}

export function persistNotificationsStorage({ notifications } = {}, storage = globalThis.localStorage) {
  safeStringifySet(STORAGE_KEYS.notifications, notifications || {}, storage);
}
