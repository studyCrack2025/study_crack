import { getData } from './action-utils.js';
import { withOperationLock } from '../shared/async/operation-lock.js';
import { requestId, replaceFish, aquariumBusy, careBlocked } from './gamification-action-utils.js';

function aquariumSharePayload(ctx) {
  const baseUrl = `${globalThis.location?.origin || ''}/studycrack-mobile.html`;
  return {
    title: 'StudyCrack 공부 수조',
    text: ctx.aquariumShareText || '공부로 키운 나의 수조',
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
  const focused = document.activeElement;
  try {
    textarea.select();
    if (!document.execCommand('copy')) throw new Error('공유 링크를 복사할 수 없습니다.');
  } finally {
    textarea.remove();
    focused?.focus?.({ preventScroll: true });
    document.defaultView?.requestAnimationFrame(() => {
      if (document.activeElement === document.body && focused?.isConnected) focused.focus({ preventScroll: true });
    });
  }
}

export function createGamificationHandlers(ctx) {
  return {
    async retryGameResources() {
      const { createAquariumCareHandlers } = await import('./aquarium-care-handlers.js');
      return createAquariumCareHandlers(ctx).retryGameResources();
    },
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
      if (careBlocked(ctx)) return false;
      ctx.setAquariumSelectedFishId(fishId);
      ctx.setAquariumActionError('');
      ctx.setAquariumActionStatus('idle');
      ctx.setAquariumResult(null);
      return true;
    },
    async feedAquariumFish(event) {
      const { createAquariumCareHandlers } = await import('./aquarium-care-handlers.js');
      return createAquariumCareHandlers(ctx).feedAquariumFish(event);
    },
    async setAquariumFishSlot(event) {
      const { createAquariumCareHandlers } = await import('./aquarium-care-handlers.js');
      return createAquariumCareHandlers(ctx).setAquariumFishSlot(event);
    },
    async saveAquariumFishName(event) {
      const { createAquariumCareHandlers } = await import('./aquarium-care-handlers.js');
      return createAquariumCareHandlers(ctx).saveAquariumFishName(event);
    },
    dismissAquariumResult() {
      if (careBlocked(ctx)) return false;
      ctx.setAquariumResult(null);
      ctx.setAquariumActionError('');
      ctx.setAquariumActionStatus('idle');
      return true;
    },
    openAquariumCatalog() {
      if (careBlocked(ctx)) return false;
      ctx.setAquariumMode('catalog');
      ctx.setAquariumActionError('');
      return true;
    },
    openAquariumDraw() {
      if (careBlocked(ctx)) return false;
      ctx.setAquariumMode('draw');
      ctx.setAquariumDrawRevealStep(0);
      ctx.setAquariumActionError('');
      return true;
    },
    openAquariumShare() {
      if (careBlocked(ctx)) return false;
      ctx.setAquariumMode('share');
      ctx.setAquariumActionError('');
      ctx.setAquariumActionStatus('idle');
      ctx.setAquariumResult(null);
      return true;
    },
    closeAquariumMode() {
      if (careBlocked(ctx)) return false;
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
      return withOperationLock(ctx.operationLocksRef, 'aquarium-share', async () => {
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
      });
    }
  };
}
