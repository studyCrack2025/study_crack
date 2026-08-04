export function parseTargetMajor(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = text.match(/^(.+?(?:대학교|대학))\s+(.+)$/);
  if (match) return { univ: match[1].trim(), major: match[2].trim(), date: null };
  const [first, ...rest] = text.split(/\s+/);
  return { univ: first || text, major: rest.join(' ') || text, date: null };
}

export function formatTargetSlot(slot) {
  if (!slot || typeof slot !== 'object') return '';
  const univ = String(slot.univ || '').trim();
  const major = String(slot.major || '').trim();
  if (!univ && !major) return '';
  if (!univ) return major;
  if (!major) return univ;
  return major.includes(univ) ? major : `${univ} ${major}`.trim();
}

export function normalizeTargetSlot(input, nowIso = new Date().toISOString()) {
  if (!input) return null;
  if (typeof input === 'string') {
    const parsed = parseTargetMajor(input);
    return parsed ? { ...parsed, date: parsed.date || nowIso } : null;
  }
  if (typeof input !== 'object') return null;
  const univ = String(input.univ || '').trim();
  const major = String(input.major || '').trim();
  if (!univ && !major) return null;
  return { univ, major, date: input.date || nowIso };
}

export function normalizeTargetUnivSlots(slots = [], fallbackList = [], nowIso = new Date().toISOString()) {
  const source = Array.isArray(slots) && slots.length ? slots : fallbackList;
  return Array.from({ length: 6 }, (_, index) => normalizeTargetSlot(source?.[index], nowIso));
}

export function targetSlotsToList(slots = []) {
  return (Array.isArray(slots) ? slots : []).map(formatTargetSlot).filter(Boolean);
}

export function upsertTargetSlot(slots = [], targetText = '', nowIso = new Date().toISOString()) {
  const normalized = normalizeTargetUnivSlots(slots, [], nowIso);
  const nextSlot = normalizeTargetSlot(targetText, nowIso);
  const nextLabel = formatTargetSlot(nextSlot);
  if (!nextSlot || !nextLabel || normalized.some((slot) => formatTargetSlot(slot) === nextLabel)) return normalized;
  const emptyIndex = normalized.findIndex((slot) => !slot);
  if (emptyIndex >= 0) normalized[emptyIndex] = nextSlot;
  return normalized;
}

export function removeTargetSlot(slots = [], targetText = '', fallbackList = [], nowIso = new Date().toISOString()) {
  const targetLabel = String(targetText || '').trim();
  return normalizeTargetUnivSlots(slots, fallbackList, nowIso)
    .map((slot) => (formatTargetSlot(slot) === targetLabel ? null : slot));
}

export function buildTargetUnivsPayload(targetList = [], nowIso = new Date().toISOString(), targetSlots = null) {
  return normalizeTargetUnivSlots(targetSlots || [], targetList, nowIso);
}

export function toAnalysisTargetPayload(targetList = []) {
  return buildTargetUnivsPayload(targetList)
    .map((item) => item ? { univ: item.univ, major: item.major } : null)
    .filter((item) => item?.univ && item?.major);
}
