export const AQUARIUM_SLOTS = Object.freeze([
  Object.freeze({ className: 'slot-left', id: 'left', label: '왼쪽' }),
  Object.freeze({ className: 'slot-center', id: 'center', label: '가운데' }),
  Object.freeze({ className: 'slot-right', id: 'right', label: '오른쪽' })
]);

function count(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

function rows(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

export function normalizeAquariumSlots(activeFish = []) {
  const seen = new Set();
  return Object.freeze(AQUARIUM_SLOTS.map((slot, index) => {
    const fish = Array.isArray(activeFish) ? activeFish[index] : null;
    if (!fish || typeof fish.fishId !== 'string' || !fish.fishId.trim() || typeof fish.speciesId !== 'string' || !fish.speciesId.trim() || seen.has(fish.fishId)) return null;
    seen.add(fish.fishId);
    return Object.freeze({
      slot: slot.id, fishId: fish.fishId, speciesId: fish.speciesId,
      name: typeof fish.name === 'string' && fish.name ? fish.name : '물고기',
      assetKey: typeof fish.assetKey === 'string' ? fish.assetKey : '',
      growthStage: typeof fish.growthStage === 'string' ? fish.growthStage : 'young',
      rarity: typeof fish.rarity === 'string' ? fish.rarity : 'common'
    });
  }));
}

export function buildAquariumPresentation({ activeFish, fishCatalog, fishCatalogStatus = 'idle', fishInventory, fishCount, gameProfile, gameProfileStatus = 'idle', todayPlannerItems, planner } = {}) {
  const ready = gameProfileStatus === 'ready' && gameProfile !== null && typeof gameProfile === 'object' && !Array.isArray(gameProfile);
  const slots = normalizeAquariumSlots(ready ? activeFish : []);
  const catalog = rows(fishCatalog).filter(fish => typeof fish.speciesId === 'string' && fish.speciesId && (!fish.status || fish.status === 'active') && (!fish.catalogStatus || fish.catalogStatus === 'active'));
  const species = new Set(catalog.map(fish => fish.speciesId));
  const owned = new Set(rows(fishInventory).map(fish => fish.speciesId));
  for (const fish of catalog) if (fish.owned === true) owned.add(fish.speciesId);
  const collectionReady = fishCatalogStatus === 'ready' && Array.isArray(fishCatalog) && Array.isArray(fishInventory);
  const total = collectionReady ? species.size : null;
  const collected = collectionReady ? [...species].filter(id => owned.has(id)).length : null;
  const plans = rows(todayPlannerItems);
  const dates = new Set(plans.map(item => item.date).filter(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)));
  const plannerReady = Array.isArray(todayPlannerItems) && dates.size <= 1;
  const plannerTotal = plannerReady ? plans.length : null;
  const completed = plannerReady ? plans.filter(item => item.done === true).length : null;
  return Object.freeze({
    status: gameProfileStatus, catalogStatus: fishCatalogStatus,
    asOf: typeof gameProfile?.updatedAt === 'string' ? gameProfile.updatedAt : null,
    slots, backgroundKey: 'day1',
    ownedCount: ready ? count(fishCount) : null,
    activeCount: ready ? slots.filter(Boolean).length : null,
    streakDays: ready ? count(gameProfile.streakDays) : null,
    shells: ready ? count(gameProfile.shellBalance) : null,
    collection: Object.freeze({ status: fishCatalogStatus, collected, total, percent: total ? Math.round(collected / total * 100) : null }),
    planner: planner || Object.freeze({ source: 'local', status: plannerReady ? 'ready' : dates.size > 1 ? 'date-mismatch' : 'unknown', date: dates.size === 1 ? [...dates][0] : null, total: plannerTotal, completed, percent: plannerTotal ? Math.round(completed / plannerTotal * 100) : null })
  });
}

export function aquariumCollectionLabel(presentation) {
  const { collected, total } = presentation.collection;
  return total === null ? '수집 정보 확인 필요' : `${collected} / ${total}종`;
}

export function aquariumShareText(presentation) {
  const countLabel = presentation.collection.total === null
    ? presentation.ownedCount === null ? '물고기 정보 확인 필요' : `보유 물고기 ${presentation.ownedCount}마리`
    : `물고기 ${presentation.collection.collected}/${presentation.collection.total}종`;
  const streakLabel = presentation.streakDays === null ? '연속 학습 확인 필요' : `연속 학습 ${presentation.streakDays}일`;
  return `공부로 키운 나의 수조: ${countLabel} · ${streakLabel}`;
}
