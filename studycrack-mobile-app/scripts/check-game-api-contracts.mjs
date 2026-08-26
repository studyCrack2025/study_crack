import assert from 'node:assert/strict';
import { acknowledgeFishDraw, claimStudyReward, drawFish, fetchGameProfile, fetchPendingDraw, fetchStudyHabitat, renameFish, setActiveFish } from '../src/features/gamification/api.js';
import { GAME_REQUEST_TYPES } from '../src/shared/api/request-types.js';

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const profile = {
  shellBalance: 4,
  foodBalance: 2,
  activeFishIds: [],
  dailyReward: {}
};
const payloads = [];
const fish = { fishId: 'fish_contract_1', speciesId: 'clownfish', name: '코랄', level: 1, exp: 0, progressPct: 0 };
const drawResult = { requestId: 'draw-contract', speciesId: 'clownfish', rarity: 'common', duplicate: false, expGranted: 0, shellsRefunded: 0, cost: 30, createdAt: '2026-08-11T00:00:00.000Z' };
const apiFetch = async (_url, options) => {
  const payload = JSON.parse(options.body);
  payloads.push(payload);
  if (payload.type === GAME_REQUEST_TYPES.GET_PROFILE) return response({ profile, activeFish: [], fishCount: 0 });
  if (payload.type === GAME_REQUEST_TYPES.GET_HABITAT) {
    return response({ days: [{ date: '2026-08-11', studySeconds: 1800, stage: 2 }], streakDays: 1 });
  }
  if (payload.type === GAME_REQUEST_TYPES.SET_ACTIVE_FISH) return response({ profile: { ...profile, activeFishIds: [payload.data.fishId, null, null] } });
  if (payload.type === GAME_REQUEST_TYPES.RENAME_FISH) return response({ fish: { ...fish, name: payload.data.name } });
  if (payload.type === GAME_REQUEST_TYPES.GET_PENDING_DRAW) return response({ pending: null, profile });
  if (payload.type === GAME_REQUEST_TYPES.DRAW_FISH) return response({ result: { ...drawResult, requestId: payload.data.requestId }, profile, fish });
  if (payload.type === GAME_REQUEST_TYPES.ACKNOWLEDGE_DRAW) return response({ profile, alreadyAcknowledged: false });
  return response({ sessionId: payload.data.sessionId, durationSeconds: 1800, reward: { shells: 2, food: 1 }, profile });
};

const gameProfile = await fetchGameProfile({ apiFetch, gameApiUrl: '/game' });
assert.equal(gameProfile.ok, true);
assert.equal(gameProfile.data.gameProfile.shellBalance, 4);
assert.equal(payloads.at(-1).type, GAME_REQUEST_TYPES.GET_PROFILE);

const habitat = await fetchStudyHabitat({ apiFetch, days: 30, gameApiUrl: '/game' });
assert.equal(habitat.ok, true);
assert.equal(habitat.data.days[0].stage, 2);
assert.equal(payloads.at(-1).data.days, 30);

const reward = await claimStudyReward({ apiFetch, gameApiUrl: '/game', sessionId: 'session-reward' });
assert.equal(reward.ok, true);
assert.equal(reward.data.reward.shells, 2);
assert.equal(payloads.at(-1).type, GAME_REQUEST_TYPES.CLAIM_STUDY_REWARD);

const placement = await setActiveFish({ apiFetch, fishId: fish.fishId, gameApiUrl: '/game', slot: 'left' });
assert.equal(placement.ok, true);
assert.equal(payloads.at(-1).data.slot, 'left');
assert.equal(payloads.at(-1).type, GAME_REQUEST_TYPES.SET_ACTIVE_FISH);

const renamed = await renameFish({ apiFetch, fishId: fish.fishId, gameApiUrl: '/game', name: '코랄별' });
assert.equal(renamed.ok, true);
assert.equal(renamed.data.fish.name, '코랄별');
assert.equal(payloads.at(-1).type, GAME_REQUEST_TYPES.RENAME_FISH);

const pending = await fetchPendingDraw({ apiFetch, gameApiUrl: '/game' });
assert.equal(pending.ok, true);
assert.equal(pending.data.pending, null);
assert.equal(payloads.at(-1).type, GAME_REQUEST_TYPES.GET_PENDING_DRAW);

const drawn = await drawFish({ apiFetch, gameApiUrl: '/game', requestId: drawResult.requestId });
assert.equal(drawn.ok, true);
assert.equal(drawn.data.result.speciesId, 'clownfish');
assert.equal(payloads.at(-1).data.requestId, drawResult.requestId);

const acknowledged = await acknowledgeFishDraw({ apiFetch, gameApiUrl: '/game', requestId: drawResult.requestId });
assert.equal(acknowledged.ok, true);
assert.equal(payloads.at(-1).type, GAME_REQUEST_TYPES.ACKNOWLEDGE_DRAW);

const invalid = await fetchGameProfile({
  gameApiUrl: '/game',
  apiFetch: async () => response({ profile: {}, activeFish: [], fishCount: 0 })
});
assert.equal(invalid.ok, false);
assert.equal(invalid.code, 'INVALID_RESPONSE');

console.log('game API request and response contracts passed');
