import { getData } from './action-utils.js';
import { withOperationLock } from '../shared/async/operation-lock.js';
import { fetchFishCatalog, fetchGameProfile } from '../features/gamification/api.js';
import { requestId, replaceFish, careBlocked } from './gamification-action-utils.js';

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

function careFailure(ctx, response, operation, fishId) {
  const definite = response?.status >= 400 && response.status < 500 && response.status !== 408 && response.code !== 'INVALID_RESPONSE';
  ctx.setAquariumResult(definite ? null : { type: 'care-uncertain', operation, fishId });
  ctx.setAquariumActionStatus(definite ? 'error' : 'uncertain');
  ctx.setAquariumActionError(definite ? response.error : '처리 결과를 확인하지 못했어요. 다시 실행하기 전에 현재 먹이와 물고기 상태를 확인해주세요.');
}

export function createAquariumCareHandlers(ctx) {
  return {
    async retryGameResources() {
      if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
      if (ctx.aquariumResult?.type === 'care-uncertain') {
        return withOperationLock(ctx.operationLocksRef, 'aquarium-care', async () => {
          ctx.setAquariumActionStatus('checking-care');
          const binding = ctx.getGameApiBinding();
          const [profile, catalog] = await Promise.all([
            fetchGameProfile(binding), fetchFishCatalog(binding)
          ]);
          if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
          if (!profile.ok || !catalog.ok) {
            ctx.setAquariumActionStatus('uncertain');
            ctx.setAquariumActionError('최신 상태를 확인하지 못했어요. 연결을 확인하고 상태만 다시 확인해주세요.');
            return true;
          }
          ctx.setGameProfile(profile.data.gameProfile);
          ctx.setActiveFish(profile.data.activeFish);
          ctx.setFishCount(profile.data.fishCount);
          ctx.setFishCatalog(catalog.data.catalog);
          ctx.setFishInventory(catalog.data.inventory);
          ctx.setGameProfileStatus('ready');
          ctx.setGameProfileError('');
          ctx.setFishCatalogStatus('ready');
          ctx.setFishCatalogError('');
          ctx.setAquariumResult({ type: 'care-checked' });
          ctx.setAquariumActionStatus('idle');
          ctx.setAquariumActionError('');
          return true;
        });
      }
      if (careBlocked(ctx)) return false;
      ctx.setGameRefreshTick((value) => Number(value || 0) + 1);
      return true;
    },
    async feedAquariumFish() {
      const activeFish = Array.isArray(ctx.activeFish) ? ctx.activeFish : [];
      const fish = ctx.aquariumSelectedFishId
        ? activeFish.find((item) => item?.fishId === ctx.aquariumSelectedFishId)
        : activeFish.find(Boolean);
      if (!fish || careBlocked(ctx)) return false;
      return withOperationLock(ctx.operationLocksRef, 'aquarium-care', async () => {
        ctx.setAquariumActionStatus('feeding');
        ctx.setAquariumActionError('');
        ctx.setAquariumResult(null);
        const eventId = requestId('feed');
        const result = await ctx.feedAquariumFish(fish.fishId, eventId).catch(() => null);
        if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
        if (!result?.ok) {
          careFailure(ctx, result, 'feed', fish.fishId);
          return true;
        }
        const updated = result.data.fish;
        if (updated.fishId !== fish.fishId || result.data.requestId !== eventId) {
          careFailure(ctx, null, 'feed', fish.fishId);
          return true;
        }
        ctx.setGameProfile(result.data.profile);
        ctx.setActiveFish((items) => (items || []).map((item) => item?.fishId === updated.fishId ? updated : item));
        ctx.setFishInventory((items) => replaceFish(items, updated));
        ctx.setAquariumResult({ type: 'feed', eventId, fish: updated, expGranted: result.data.expGranted, levelUp: result.data.levelUp });
        ctx.setAquariumActionStatus('success');
        return true;
      });
    },
    async setAquariumFishSlot({ actionEl }) {
      const fishId = ctx.aquariumSelectedFishId;
      const slot = getData(actionEl, 'slot');
      if (!fishId || !AQUARIUM_SLOTS.includes(slot) || careBlocked(ctx)) return false;
      const remove = currentSlot(ctx.activeFish, fishId) === slot;
      const arriving = !remove && !currentSlot(ctx.activeFish, fishId);
      return withOperationLock(ctx.operationLocksRef, 'aquarium-care', async () => {
        ctx.setAquariumActionStatus('updating-slot');
        ctx.setAquariumActionError('');
        ctx.setAquariumResult(null);
        const result = await ctx.updateAquariumActiveFish(remove ? '' : fishId, slot).catch(() => null);
        if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
        if (!result?.ok) {
          careFailure(ctx, result, 'slot', fishId);
          return true;
        }
        const profile = result.data.profile;
        if ((profile.activeFishIds[AQUARIUM_SLOTS.indexOf(slot)] || null) !== (remove ? null : fishId)) {
          careFailure(ctx, null, 'slot', fishId);
          return true;
        }
        ctx.setGameProfile(profile);
        ctx.setActiveFish(projectActiveFish(profile, ctx.fishInventory));
        ctx.setAquariumResult({ type: 'slot', eventId: requestId('slot'), fishId, remove, slot, arriving });
        ctx.setAquariumActionStatus('success');
        return true;
      });
    },
    async saveAquariumFishName() {
      const fishId = ctx.aquariumSelectedFishId;
      const name = readFishName(ctx);
      if (!fishId || careBlocked(ctx)) return false;
      if (!validFishName(name)) {
        ctx.setAquariumActionStatus('error');
        ctx.setAquariumActionError('이름은 한글, 영문, 숫자로 10자까지 입력해주세요.');
        return true;
      }
      return withOperationLock(ctx.operationLocksRef, 'aquarium-care', async () => {
        ctx.setAquariumActionStatus('renaming');
        ctx.setAquariumActionError('');
        ctx.setAquariumResult(null);
        const result = await ctx.updateAquariumFishName(fishId, name).catch(() => null);
        if (ctx.isCurrentProfile && !ctx.isCurrentProfile()) return false;
        if (!result?.ok) {
          careFailure(ctx, result, 'rename', fishId);
          return true;
        }
        const fish = result.data.fish;
        ctx.setFishInventory((items) => replaceFish(items, fish));
        ctx.setActiveFish((items) => (items || []).map((item) => item?.fishId === fish.fishId ? fish : item));
        ctx.setAquariumResult({ type: 'rename', fish });
        ctx.setAquariumActionStatus('success');
        return true;
      });
    },
  };
}
