import assert from 'node:assert/strict';
import { claimStudyReward, fetchGameProfile, fetchStudyHabitat } from '../src/features/gamification/api.js';
import { GAME_REQUEST_TYPES } from '../src/shared/api/request-types.js';

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const profile = {
  shellBalance: 4,
  foodBalance: 2,
  waterQuality: 96,
  activeFishIds: [],
  dailyReward: {}
};
const payloads = [];
const apiFetch = async (_url, options) => {
  const payload = JSON.parse(options.body);
  payloads.push(payload);
  if (payload.type === GAME_REQUEST_TYPES.GET_PROFILE) return response({ profile, activeFish: [], fishCount: 0 });
  if (payload.type === GAME_REQUEST_TYPES.GET_HABITAT) {
    return response({ days: [{ date: '2026-08-11', studySeconds: 1800, stage: 2 }], streakDays: 1 });
  }
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

const invalid = await fetchGameProfile({
  gameApiUrl: '/game',
  apiFetch: async () => response({ profile: {}, activeFish: [], fishCount: 0 })
});
assert.equal(invalid.ok, false);
assert.equal(invalid.code, 'INVALID_RESPONSE');

console.log('game API request and response contracts passed');
