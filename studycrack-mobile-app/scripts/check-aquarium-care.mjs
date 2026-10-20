import assert from 'node:assert/strict';
import { createGamificationHandlers } from '../src/handlers/gamification-handlers.js';

function fixture(response = { ok: false, status: 0, code: 'NETWORK_ERROR' }) {
  const fish = { fishId: 'fish_care_001', name: '코랄', exp: 0, level: 1 };
  const state = { activeFish: [fish, null, null], fishInventory: [fish], aquariumSelectedFishId: fish.fishId, aquariumActionStatus: 'idle', aquariumResult: null, gameProfile: { foodBalance: 3, activeFishIds: [fish.fishId, null, null] } };
  const ctx = { ...state, operationLocksRef: { current: new Set() }, calls: [], isCurrentProfile: () => true,
    feedAquariumFish: async (...args) => { ctx.calls.push(args); return response; },
    updateAquariumActiveFish: async (...args) => { ctx.calls.push(args); return { ok: true, data: { profile: { ...state.gameProfile, activeFishIds: [null, args[0] || null, null] } } }; },
    updateAquariumFishName: async () => response,
    document: { querySelector: () => ({ value: '새이름' }) }
  };
  for (const key of [...Object.keys(state), 'aquariumActionError', 'fishCount', 'fishCatalog', 'gameRefreshTick', 'aquariumMode']) {
    ctx[`set${key[0].toUpperCase()}${key.slice(1)}`] = value => { ctx[key] = typeof value === 'function' ? value(ctx[key]) : value; };
  }
  return { ctx, fish, handlers: () => createGamificationHandlers(ctx) };
}
const action = data => ({ actionEl: { getAttribute: key => data[key.replace('data-', '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] } });
for (const response of [null, { ok: false, status: 0 }, { ok: false, status: 503 }, { ok: false, status: 200, code: 'INVALID_RESPONSE' }, { ok: false, status: 408 }]) {
  const f = fixture(response);
  await f.handlers().feedAquariumFish();
  assert.equal(f.ctx.aquariumResult.type, 'care-uncertain');
  assert.equal(f.ctx.aquariumActionStatus, 'uncertain');
  assert.equal(await f.handlers().feedAquariumFish(), false);
  assert.equal(await f.handlers().setAquariumFishSlot(action({ slot: 'center' })), false);
  assert.equal(f.handlers().dismissAquariumResult(), false);
  assert.equal(f.handlers().selectAquariumFish(action({ fishId: 'other' })), false);
  assert.equal(f.handlers().openAquariumShare(), false);
  assert.equal(f.ctx.calls.length, 1);
}
{
  const f = fixture({ ok: false, status: 409, error: '먹이 부족' });
  await f.handlers().feedAquariumFish();
  assert.equal(f.ctx.aquariumActionStatus, 'error');
  assert.equal(f.ctx.aquariumResult, null);
}
{
  const f = fixture();
  let finish;
  let requestId;
  f.ctx.feedAquariumFish = (_, id) => { requestId = id; return new Promise(resolve => { finish = resolve; }); };
  const pending = f.handlers().feedAquariumFish();
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(f.handlers().selectAquariumFish(action({ fishId: 'other' })), false);
  assert.equal(await f.handlers().setAquariumFishSlot(action({ slot: 'center' })), false);
  finish({ ok: true, data: { requestId, profile: f.ctx.gameProfile, fish: { ...f.fish, exp: 10 }, expGranted: 10, levelUp: false } });
  await pending;
  assert.ok(f.ctx.aquariumResult.eventId);
  assert.equal(f.ctx.aquariumResult.type, 'feed');
  assert.equal(f.ctx.operationLocksRef.current.size, 0);
}
for (const method of ['feedAquariumFish', 'setAquariumFishSlot', 'saveAquariumFishName']) {
  const f = fixture({ ok: true, data: { fish: { fishId: 'other-account-fish' } } });
  f.ctx.isCurrentProfile = () => false;
  await f.handlers()[method](action({ slot: 'center' }));
  assert.equal(f.ctx.aquariumResult, null);
  assert.equal(f.ctx.fishInventory[0].fishId, f.fish.fishId);
}
for (const [method, apiName] of [['feedAquariumFish', 'feedAquariumFish'], ['setAquariumFishSlot', 'updateAquariumActiveFish'], ['saveAquariumFishName', 'updateAquariumFishName']]) {
  const f = fixture();
  let finish;
  let current = true;
  f.ctx.isCurrentProfile = () => current;
  f.ctx[apiName] = () => new Promise(resolve => { finish = resolve; });
  const pending = f.handlers()[method](action({ slot: 'center' }));
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
  current = false;
  finish({ ok: true, data: { fish: { fishId: 'stale_fish' } } });
  await pending;
  assert.equal(f.ctx.aquariumResult, null);
  assert.equal(f.ctx.fishInventory[0].fishId, f.fish.fishId);
}
{
  const f = fixture();
  await f.handlers().setAquariumFishSlot(action({ slot: 'center' }));
  assert.equal(f.ctx.aquariumResult.arriving, false);
  f.ctx.activeFish = [null, null, null];
  await f.handlers().setAquariumFishSlot(action({ slot: 'center' }));
  assert.equal(f.ctx.aquariumResult.arriving, true);
  await f.handlers().setAquariumFishSlot(action({ slot: 'center' }));
  assert.equal(f.ctx.aquariumResult.arriving, false);
  assert.equal(f.ctx.aquariumResult.remove, true);
}
console.log('Aquarium care contracts passed: uncertain/definite failures, no blind retry, shared lock, stale-account suppression, success event, arrival versus move/remove.');
