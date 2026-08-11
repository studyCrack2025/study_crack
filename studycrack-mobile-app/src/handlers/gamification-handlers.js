import { getData } from './action-utils.js';

function requestId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function replaceFish(list, fish) {
  const rows = Array.isArray(list) ? list : [];
  const index = rows.findIndex((item) => item?.fishId === fish?.fishId);
  if (index < 0) return fish ? [...rows, fish] : rows;
  const next = [...rows];
  next[index] = fish;
  return next;
}

const AQUARIUM_SLOTS = ['left', 'center', 'right'];

function projectActiveFish(profile, inventory) {
  const fishById = new Map((Array.isArray(inventory) ? inventory : []).map((fish) => [fish?.fishId, fish]));
  return AQUARIUM_SLOTS.map((_, index) => fishById.get(profile?.activeFishIds?.[index]) || null);
}

function currentSlot(activeFish, fishId) {
  const index = (Array.isArray(activeFish) ? activeFish : []).findIndex((fish) => fish?.fishId === fishId);
  return index >= 0 ? AQUARIUM_SLOTS[index] : '';
}

function readFishName(ctx) {
  return String((ctx.document || globalThis.document)?.querySelector?.('[data-field="aquariumFishName"]')?.value || '')
    .trim().replace(/\s+/g, ' ');
}

function validFishName(name) {
  return name.replace(/\s/g, '').length <= 10 && /^[가-힣A-Za-z0-9 ]*$/u.test(name);
}

function aquariumBusy(status) {
  return ['claiming-starter', 'feeding', 'renaming', 'updating-slot'].includes(status);
}

export function createGamificationHandlers(ctx) {
  return {
    selectStarterCandidate({ actionEl }) {
      ctx.setAquariumStarterSpeciesId(getData(actionEl, 'species-id'));
      ctx.setAquariumActionError('');
      return true;
    },
    async claimStarterFish() {
      const speciesId = ctx.aquariumStarterSpeciesId;
      if (!speciesId || aquariumBusy(ctx.aquariumActionStatus)) return false;
      ctx.setAquariumActionStatus('claiming-starter');
      ctx.setAquariumActionError('');
      const result = await ctx.claimAquariumStarter(speciesId);
      if (!result?.ok) {
        ctx.setAquariumActionStatus('error');
        ctx.setAquariumActionError(result?.error || '첫 물고기를 선택하지 못했습니다.');
        return true;
      }
      const fish = result.data.fish;
      ctx.setGameProfile(result.data.profile);
      ctx.setActiveFish([null, fish, null]);
      ctx.setFishInventory((items) => replaceFish(items, fish));
      ctx.setFishCount((count) => Math.max(1, Number(count) || 0));
      ctx.setAquariumSelectedFishId(fish.fishId);
      ctx.setAquariumResult({ type: 'starter', fish });
      ctx.setAquariumActionStatus('success');
      ctx.setGameRefreshTick((tick) => Number(tick || 0) + 1);
      return true;
    },
    selectAquariumFish({ actionEl }) {
      const fishId = getData(actionEl, 'fish-id');
      if (!fishId) return false;
      ctx.setAquariumSelectedFishId(fishId);
      ctx.setAquariumActionError('');
      ctx.setAquariumActionStatus('idle');
      ctx.setAquariumResult(null);
      return true;
    },
    async feedAquariumFish() {
      const activeFish = Array.isArray(ctx.activeFish) ? ctx.activeFish : [];
      const fish = ctx.aquariumSelectedFishId
        ? activeFish.find((item) => item?.fishId === ctx.aquariumSelectedFishId)
        : activeFish.find(Boolean);
      if (!fish || aquariumBusy(ctx.aquariumActionStatus)) return false;
      ctx.setAquariumActionStatus('feeding');
      ctx.setAquariumActionError('');
      const result = await ctx.feedAquariumFish(fish.fishId, requestId('feed'));
      if (!result?.ok) {
        ctx.setAquariumActionStatus('error');
        ctx.setAquariumActionError(result?.error || '먹이를 주지 못했습니다.');
        return true;
      }
      const updated = result.data.fish;
      ctx.setGameProfile(result.data.profile);
      ctx.setActiveFish((items) => (items || []).map((item) => item?.fishId === updated.fishId ? updated : item));
      ctx.setFishInventory((items) => replaceFish(items, updated));
      ctx.setAquariumResult({ type: 'feed', fish: updated, expGranted: result.data.expGranted, levelUp: result.data.levelUp, waterGain: result.data.waterGain });
      ctx.setAquariumActionStatus('success');
      return true;
    },
    async setAquariumFishSlot({ actionEl }) {
      const fishId = ctx.aquariumSelectedFishId;
      const slot = getData(actionEl, 'slot');
      if (!fishId || !AQUARIUM_SLOTS.includes(slot) || aquariumBusy(ctx.aquariumActionStatus)) return false;
      const remove = currentSlot(ctx.activeFish, fishId) === slot;
      ctx.setAquariumActionStatus('updating-slot');
      ctx.setAquariumActionError('');
      const result = await ctx.updateAquariumActiveFish(remove ? '' : fishId, slot);
      if (!result?.ok) {
        ctx.setAquariumActionStatus('error');
        ctx.setAquariumActionError(result?.error || '수조 배치를 변경하지 못했습니다.');
        return true;
      }
      const profile = result.data.profile;
      ctx.setGameProfile(profile);
      ctx.setActiveFish(projectActiveFish(profile, ctx.fishInventory));
      ctx.setAquariumResult({ type: 'slot', fishId, remove, slot });
      ctx.setAquariumActionStatus('success');
      return true;
    },
    async saveAquariumFishName() {
      const fishId = ctx.aquariumSelectedFishId;
      const name = readFishName(ctx);
      if (!fishId || aquariumBusy(ctx.aquariumActionStatus)) return false;
      if (!validFishName(name)) {
        ctx.setAquariumActionStatus('error');
        ctx.setAquariumActionError('이름은 한글, 영문, 숫자로 10자까지 입력해주세요.');
        return true;
      }
      ctx.setAquariumActionStatus('renaming');
      ctx.setAquariumActionError('');
      const result = await ctx.updateAquariumFishName(fishId, name);
      if (!result?.ok) {
        ctx.setAquariumActionStatus('error');
        ctx.setAquariumActionError(result?.error || '물고기 이름을 변경하지 못했습니다.');
        return true;
      }
      const fish = result.data.fish;
      ctx.setFishInventory((items) => replaceFish(items, fish));
      ctx.setActiveFish((items) => (items || []).map((item) => item?.fishId === fish.fishId ? fish : item));
      ctx.setAquariumResult({ type: 'rename', fish });
      ctx.setAquariumActionStatus('success');
      return true;
    },
    dismissAquariumResult() {
      ctx.setAquariumResult(null);
      ctx.setAquariumActionError('');
      ctx.setAquariumActionStatus('idle');
      return true;
    }
  };
}
