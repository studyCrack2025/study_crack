import { normalizePlannerItems } from '../../state/planner-storage.js';
import { STORAGE_KEYS, safeParse, safeStringifySet } from '../../state/storage.js';
import { validatePlannerItem } from '../../shared/model/contracts.js';

function removeLegacyDemoPlannerItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => !String(item?.id || '').startsWith('pl-default-'));
}

export function hydratePlannerStorage(storage = globalThis.localStorage) {
  const plannerItems = safeParse(STORAGE_KEYS.plannerItems, null, storage);
  const normalizedPlannerItems = Array.isArray(plannerItems)
    ? normalizePlannerItems(removeLegacyDemoPlannerItems(plannerItems)).filter((item) => validatePlannerItem(item).ok)
    : null;

  return Array.isArray(plannerItems) ? { plannerItems: normalizedPlannerItems } : {};
}

export function persistPlannerStorage(state = {}, storage = globalThis.localStorage) {
  safeStringifySet(STORAGE_KEYS.plannerItems, state.plannerItems || [], storage);
}
