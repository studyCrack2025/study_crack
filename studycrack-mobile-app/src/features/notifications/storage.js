import { STORAGE_KEYS, safeParse, safeStringifySet } from '../../state/storage.js';
import { getMobileAccountStorage } from '../../shared/browser/mobile-runtime.js';

export function hydrateNotificationsStorage(storage = getMobileAccountStorage()) {
  const notifications = safeParse(STORAGE_KEYS.notifications, null, storage);
  return notifications && typeof notifications === 'object' && !Array.isArray(notifications)
    ? { notifications }
    : {};
}

export function persistNotificationsStorage({ notifications } = {}, storage = getMobileAccountStorage()) {
  safeStringifySet(STORAGE_KEYS.notifications, notifications || {}, storage);
}
