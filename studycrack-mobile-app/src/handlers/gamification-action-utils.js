export function requestId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function replaceFish(list, fish) {
  const rows = Array.isArray(list) ? list : [];
  const index = rows.findIndex((item) => item?.fishId === fish?.fishId);
  if (index < 0) return fish ? [...rows, fish] : rows;
  const next = [...rows];
  next[index] = fish;
  return next;
}

export function aquariumBusy(status) {
  return ['acknowledging-draw', 'claiming-starter', 'drawing', 'feeding', 'renaming', 'sharing', 'updating-slot', 'uncertain', 'checking-care'].includes(status);
}

export function careBlocked(ctx) {
  return (ctx.isCurrentProfile && !ctx.isCurrentProfile()) || aquariumBusy(ctx.aquariumActionStatus) || ctx.aquariumResult?.type === 'care-uncertain' || ctx.operationLocksRef?.current?.has('aquarium-care');
}
