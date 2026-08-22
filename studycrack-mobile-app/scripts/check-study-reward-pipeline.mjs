import assert from 'node:assert/strict';
import { completeStudyRewardPipeline } from '../src/features/study/reward-pipeline.js';

const phases = [];
let rewardClaims = 0;
const completionFailure = await completeStudyRewardPipeline({
  sessionId: 'session-completion-failure',
  onPhase: (phase) => phases.push(phase),
  completeSession: async () => ({ ok: false, error: 'completion failed' }),
  claimReward: async () => {
    rewardClaims += 1;
    return { ok: true };
  }
});
assert.equal(completionFailure.stage, 'completion');
assert.equal(rewardClaims, 0, '완료되지 않은 세션의 보상을 청구하면 안 됩니다.');
assert.deepEqual(phases, ['settling-session']);

phases.length = 0;
const rewardFailure = await completeStudyRewardPipeline({
  sessionId: 'session-reward-failure',
  onPhase: (phase) => phases.push(phase),
  completeSession: async () => ({ ok: true, data: { sessionId: 'session-reward-failure' } }),
  claimReward: async () => ({ ok: false, error: 'reward failed' })
});
assert.equal(rewardFailure.stage, 'reward');
assert.equal(rewardFailure.completion.ok, true, '보상 실패와 공부 기록 완료를 분리해야 합니다.');
assert.equal(rewardFailure.reward.ok, false);
assert.deepEqual(phases, ['settling-session', 'claiming-reward']);

phases.length = 0;
const success = await completeStudyRewardPipeline({
  sessionId: 'session-success',
  onPhase: (phase) => phases.push(phase),
  completeSession: async () => ({ ok: true, data: { sessionId: 'session-success' } }),
  claimReward: async () => ({ ok: true, data: { sessionId: 'session-success', reward: { shells: 1, food: 1 } } })
});
assert.equal(success.ok, true);
assert.equal(success.stage, 'rewarded');
assert.deepEqual(phases, ['settling-session', 'claiming-reward']);

console.log('study completion and reward pipeline contracts passed');
