import { isRecord } from '../../shared/model/contracts.js';

function contract(ok, value, error = '') {
  return ok ? { ok: true, value } : { ok: false, error };
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

export function normalizeGameProfileResponse(value) {
  return {
    gameProfile: value.profile,
    activeFish: Array.isArray(value.activeFish) ? value.activeFish : [],
    fishCount: Number(value.fishCount) || 0
  };
}

