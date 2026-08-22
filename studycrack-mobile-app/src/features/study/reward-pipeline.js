export async function completeStudyRewardPipeline({ claimReward, completeSession, onPhase, sessionId } = {}) {
  onPhase?.('settling-session');
  const completion = await completeSession(sessionId);
  if (!completion?.ok) return { ok: false, stage: 'completion', completion, reward: null };
  onPhase?.('claiming-reward');
  const reward = await claimReward(sessionId);
  if (!reward?.ok) return { ok: false, stage: 'reward', completion, reward };
  return { ok: true, stage: 'rewarded', completion, reward };
}

