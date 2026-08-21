import { isRecord } from '../../shared/model/contracts.js';

function contract(ok, value, error = '') {
  return ok ? { ok: true, value } : { ok: false, error };
}

export function validateFish(value) {
  const valid = isRecord(value) && typeof value.fishId === 'string' && typeof value.speciesId === 'string'
    && typeof value.name === 'string' && Number.isInteger(Number(value.level))
    && Number.isFinite(Number(value.exp)) && Number.isFinite(Number(value.progressPct));
  return contract(valid, value, '물고기 응답이 올바르지 않습니다.');
}

export function validateGameProfile(value) {
  const valid = isRecord(value)
    && Number.isFinite(Number(value.shellBalance))
    && Number.isFinite(Number(value.foodBalance))
    && Number.isFinite(Number(value.waterQuality))
    && Array.isArray(value.activeFishIds)
    && isRecord(value.dailyReward);
  return contract(valid, value, '게임 프로필 응답이 올바르지 않습니다.');
}

export function validateGameProfileResponse(value) {
  const profile = validateGameProfile(value?.profile);
  const valid = isRecord(value) && profile.ok && Array.isArray(value.activeFish)
    && Number.isFinite(Number(value.fishCount));
  return contract(valid, value, '게임 프로필 응답이 올바르지 않습니다.');
}

function validateGameRules(value) {
  return isRecord(value) && isRecord(value.dailyCaps) && Array.isArray(value.rewardTiers) && Array.isArray(value.habitatStages)
    && isRecord(value.fishCare) && Number.isFinite(Number(value.drawCostShells));
}

export function validateHabitatResponse(value) {
  const validDays = Array.isArray(value?.days) && value.days.every((day) => (
    isRecord(day) && /^\d{4}-\d{2}-\d{2}$/.test(day.date || '')
      && Number.isFinite(Number(day.studySeconds))
      && Number.isInteger(Number(day.stage))
      && Number(day.stage) >= 0 && Number(day.stage) <= 4
  ));
  return contract(isRecord(value) && validDays && Number.isFinite(Number(value.streakDays)), value, '공부 서식지 응답이 올바르지 않습니다.');
}

export function validateStudyRewardResponse(value) {
  const profile = validateGameProfile(value?.profile);
  const valid = isRecord(value) && typeof value.sessionId === 'string'
    && isRecord(value.reward) && Number.isFinite(Number(value.reward.shells))
    && Number.isFinite(Number(value.reward.food)) && profile.ok;
  return contract(valid, value, '공부 보상 응답이 올바르지 않습니다.');
}

export function validateFishCatalogResponse(value) {
  const supportedRarities = ['common', 'rare', 'epic', 'legendary', 'special'];
  const validCatalog = Array.isArray(value?.catalog) && value.catalog.every((fish) => (
    isRecord(fish) && typeof fish.speciesId === 'string' && typeof fish.displayName === 'string'
      && supportedRarities.includes(fish.rarity) && Array.isArray(fish.colors)
  ));
  const validInventory = Array.isArray(value?.inventory) && value.inventory.every((fish) => validateFish(fish).ok);
  return contract(isRecord(value) && validCatalog && validInventory, value, '물고기 카탈로그 응답이 올바르지 않습니다.');
}

export function validateStarterClaimResponse(value) {
  const profile = validateGameProfile(value?.profile);
  const fish = validateFish(value?.fish);
  return contract(isRecord(value) && profile.ok && fish.ok, value, '첫 물고기 선택 응답이 올바르지 않습니다.');
}

export function validateFeedFishResponse(value) {
  const profile = validateGameProfile(value?.profile);
  const fish = validateFish(value?.fish);
  const valid = isRecord(value) && profile.ok && fish.ok && typeof value.requestId === 'string'
    && Number.isFinite(Number(value.expGranted)) && Number.isFinite(Number(value.waterGain));
  return contract(valid, value, '먹이 주기 응답이 올바르지 않습니다.');
}

export function validateActiveFishResponse(value) {
  const profile = validateGameProfile(value?.profile);
  return contract(isRecord(value) && profile.ok, value, '물고기 배치 응답이 올바르지 않습니다.');
}

export function validateRenameFishResponse(value) {
  const fish = validateFish(value?.fish);
  return contract(isRecord(value) && fish.ok, value, '물고기 이름 변경 응답이 올바르지 않습니다.');
}

export function validateDrawResult(value) {
  const valid = isRecord(value) && typeof value.requestId === 'string' && typeof value.speciesId === 'string'
    && ['common', 'rare', 'epic', 'legendary', 'special'].includes(value.rarity) && typeof value.duplicate === 'boolean'
    && Number.isFinite(Number(value.expGranted)) && Number.isFinite(Number(value.shellsRefunded))
    && Number.isFinite(Number(value.cost)) && typeof value.createdAt === 'string';
  return contract(valid, value, '물고기 뽑기 결과가 올바르지 않습니다.');
}

export function validateDrawResponse(value) {
  const profile = validateGameProfile(value?.profile);
  const fish = validateFish(value?.fish);
  const result = validateDrawResult(value?.result);
  return contract(isRecord(value) && profile.ok && fish.ok && result.ok, value, '물고기 뽑기 응답이 올바르지 않습니다.');
}

export function validatePendingDrawResponse(value) {
  const profile = validateGameProfile(value?.profile);
  if (!isRecord(value) || !profile.ok) return contract(false, value, '미확인 뽑기 응답이 올바르지 않습니다.');
  if (value.pending === null) return contract(true, value);
  return validateDrawResponse(value).ok
    ? contract(true, value)
    : contract(false, value, '미확인 뽑기 응답이 올바르지 않습니다.');
}

export function validateDrawAcknowledgeResponse(value) {
  const profile = validateGameProfile(value?.profile);
  return contract(isRecord(value) && profile.ok, value, '뽑기 결과 확인 응답이 올바르지 않습니다.');
}

export function normalizeGameProfileResponse(value) {
  return {
    gameProfile: value.profile,
    activeFish: Array.isArray(value.activeFish) ? value.activeFish : [],
    fishCount: Number(value.fishCount) || 0,
    gameRules: validateGameRules(value.rules) ? value.rules : null
  };
}
