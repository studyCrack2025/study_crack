import { normalizePlannerItems } from '../../state/planner-storage.js';
import { STORAGE_KEYS } from '../../state/storage.js';
import { validatePlannerItem } from '../../shared/model/contracts.js';

function removeLegacyDemoPlannerItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => !String(item?.id || '').startsWith('pl-default-'));
}

export function readPlannerStorage(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (typeof target?.getItem !== 'function') return { ok: false };
    const raw = target.getItem(STORAGE_KEYS.plannerItems);
    const parsed = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item !== 'object' || Array.isArray(item))) return { ok: false };
    const plannerItems = normalizePlannerItems(removeLegacyDemoPlannerItems(parsed));
    if (plannerItems.some(item => !validatePlannerItem(item).ok)) return { ok: false };
    return { ok: true, raw, plannerItems };
  } catch {
    return { ok: false };
  }
}

export function hydratePlannerStorage(storage) {
  const result = readPlannerStorage(storage);
  return result.ok ? { plannerItems: result.plannerItems } : {};
}

export function persistPlannerStorage(state = {}, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (typeof target?.setItem !== 'function') return false;
    target.setItem(STORAGE_KEYS.plannerItems, JSON.stringify(state.plannerItems || []));
    return true;
  } catch {
    return false;
  }
}
