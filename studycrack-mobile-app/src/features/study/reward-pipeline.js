export async function completeStudyRewardPipeline({ claimReward, completeSession, onCompleted, onPhase, sessionId } = {}) {
  onPhase?.('settling-session');
  let completion;
  try { completion = await completeSession(sessionId); }
  catch { completion = { ok: false, error: '공부 완료 연결을 다시 확인해주세요. 기록은 유지됩니다.' }; }
  if (!completion?.ok) return { ok: false, stage: 'completion', completion, reward: null };
  if (onCompleted?.(completion.data) === false) return { ok: false, stage: 'recovery-storage', completion, reward: null };
  onPhase?.('claiming-reward');
  let reward;
  try { reward = await claimReward(sessionId); }
  catch { reward = { ok: false, error: '보상 연결을 확인하지 못했어요. 다시 시도해주세요.' }; }
  if (!reward?.ok) return { ok: false, stage: 'reward', completion, reward };
  return { ok: true, stage: 'rewarded', completion, reward };
}
