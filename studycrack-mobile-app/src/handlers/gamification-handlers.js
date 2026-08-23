import { getData } from './action-utils.js';
import { withOperationLock } from '../shared/async/operation-lock.js';

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
  return ['acknowledging-draw', 'claiming-starter', 'drawing', 'feeding', 'renaming', 'sharing', 'updating-slot'].includes(status);
}

function aquariumSharePayload(ctx) {
  const fishCount = Math.max(0, Number(ctx.fishCount) || 0);
  const streakDays = Math.max(0, Number(ctx.gameProfile?.streakDays) || 0);
  const baseUrl = `${globalThis.location?.origin || ''}/studycrack-mobile.html`;
  return {
    title: 'StudyCrack 공부 수조',
    text: `공부로 키운 나의 수조: 물고기 ${fishCount}/12종 · 연속 학습 ${streakDays}일`,
    url: baseUrl
  };
}

async function copyAquariumShareText(payload, documentRef) {
  const shareText = `${payload.text}\n${payload.url}`;
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(shareText);
    return;
  }
  const document = documentRef || globalThis.document;
  if (!document?.body || typeof document.execCommand !== 'function') throw new Error('공유 링크를 복사할 수 없습니다.');
  const textarea = document.createElement('textarea');
  textarea.value = shareText;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('공유 링크를 복사할 수 없습니다.');
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
      return withOperationLock(ctx.operationLocksRef, 'aquarium-starter', async () => {
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
      });
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
      return withOperationLock(ctx.operationLocksRef, `aquarium-feed:${fish.fishId}`, async () => {
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
        ctx.setAquariumResult({ type: 'feed', fish: updated, expGranted: result.data.expGranted, levelUp: result.data.levelUp });
        ctx.setAquariumActionStatus('success');
        return true;
      });
    },
    async setAquariumFishSlot({ actionEl }) {
      const fishId = ctx.aquariumSelectedFishId;
      const slot = getData(actionEl, 'slot');
      if (!fishId || !AQUARIUM_SLOTS.includes(slot) || aquariumBusy(ctx.aquariumActionStatus)) return false;
      const remove = currentSlot(ctx.activeFish, fishId) === slot;
      return withOperationLock(ctx.operationLocksRef, `aquarium-slot:${fishId}`, async () => {
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
      });
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
      return withOperationLock(ctx.operationLocksRef, `aquarium-rename:${fishId}`, async () => {
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
      });
    },
    dismissAquariumResult() {
      ctx.setAquariumResult(null);
      ctx.setAquariumActionError('');
      ctx.setAquariumActionStatus('idle');
      return true;
    },
    openAquariumCatalog() {
      ctx.setAquariumMode('catalog');
      ctx.setAquariumActionError('');
      return true;
    },
    openAquariumDraw() {
      ctx.setAquariumMode('draw');
      ctx.setAquariumDrawRevealStep(0);
      ctx.setAquariumActionError('');
      return true;
    },
    openAquariumShare() {
      ctx.setAquariumMode('share');
      ctx.setAquariumActionError('');
      ctx.setAquariumActionStatus('idle');
      ctx.setAquariumResult(null);
      return true;
    },
    closeAquariumMode() {
      ctx.setAquariumMode('view');
      ctx.setAquariumDrawRevealStep(0);
      ctx.setAquariumActionError('');
      return true;
    },
    async startAquariumDraw() {
      if (ctx.pendingDraw || aquariumBusy(ctx.aquariumActionStatus) || ctx.pendingDrawStatus !== 'ready') return false;
      if (Number(ctx.gameProfile?.shellBalance) < 30) {
        ctx.setAquariumActionStatus('error');
        ctx.setAquariumActionError('조개가 30개 이상 있어야 물고기를 만날 수 있어요.');
        return true;
      }
      return withOperationLock(ctx.operationLocksRef, 'aquarium-draw', async () => {
        const drawRequestId = ctx.activeDrawRequestId || requestId('draw');
        ctx.setActiveDrawRequestId(drawRequestId);
        ctx.setAquariumActionStatus('drawing');
        ctx.setAquariumActionError('');
        const response = await ctx.startAquariumFishDraw(drawRequestId);
        if (!response?.ok) {
          ctx.setAquariumActionStatus('error');
          ctx.setAquariumActionError(response?.error || '물고기를 뽑지 못했습니다.');
          return true;
        }
        const { fish, profile, result } = response.data;
        ctx.setGameProfile(profile);
        ctx.setPendingDraw({ fish, result });
        ctx.setPendingDrawStatus('ready');
        ctx.setPendingDrawError('');
        ctx.setFishInventory((items) => replaceFish(items, fish));
        ctx.setFishCatalog((items) => (items || []).map((item) => item.speciesId === fish.speciesId ? { ...item, owned: true } : item));
        ctx.setFishCount((count) => result.duplicate ? Number(count) || 0 : Number(count || 0) + 1);
        ctx.setAquariumDrawRevealStep(0);
        ctx.setAquariumActionStatus('success');
        return true;
      });
    },
    advanceAquariumDrawReveal() {
      if (!ctx.pendingDraw || aquariumBusy(ctx.aquariumActionStatus)) return false;
      ctx.setAquariumDrawRevealStep((step) => Math.min(3, Number(step || 0) + 1));
      return true;
    },
    async acknowledgeAquariumDraw({ actionEl }) {
      const requestIdValue = ctx.pendingDraw?.result?.requestId;
      if (!requestIdValue || aquariumBusy(ctx.aquariumActionStatus)) return false;
      return withOperationLock(ctx.operationLocksRef, `aquarium-draw-ack:${requestIdValue}`, async () => {
        ctx.setAquariumActionStatus('acknowledging-draw');
        ctx.setAquariumActionError('');
        const response = await ctx.acknowledgeAquariumFishDraw(requestIdValue);
        if (!response?.ok) {
          ctx.setAquariumActionStatus('error');
          ctx.setAquariumActionError(response?.error || '뽑기 결과를 확인하지 못했습니다.');
          return true;
        }
        ctx.setGameProfile(response.data.profile);
        ctx.setPendingDraw(null);
        ctx.setActiveDrawRequestId('');
        ctx.setAquariumDrawRevealStep(0);
        ctx.setAquariumMode(getData(actionEl, 'target') === 'catalog' ? 'catalog' : 'view');
        ctx.setAquariumActionStatus('idle');
        return true;
      });
    },
    async shareAquarium() {
      if (aquariumBusy(ctx.aquariumActionStatus)) return false;
      const payload = aquariumSharePayload(ctx);
      ctx.setAquariumActionStatus('sharing');
      ctx.setAquariumActionError('');
      ctx.setAquariumResult(null);
      try {
        if (typeof globalThis.navigator?.share === 'function') {
          await globalThis.navigator.share(payload);
          ctx.setAquariumResult({ type: 'share', method: 'native' });
        } else {
          await copyAquariumShareText(payload, ctx.document);
          ctx.setAquariumResult({ type: 'share', method: 'clipboard' });
        }
        ctx.setAquariumActionStatus('success');
      } catch (error) {
        if (error?.name === 'AbortError') {
          ctx.setAquariumActionStatus('idle');
          return true;
        }
        ctx.setAquariumActionStatus('error');
        ctx.setAquariumActionError('수조를 공유하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
      return true;
    }
  };
}
