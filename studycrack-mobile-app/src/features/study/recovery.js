import { STORAGE_KEYS, safeParse, safeStringifySet } from '../../state/storage.js';
import { getMobileAccountStorage } from '../../shared/browser/mobile-runtime.js';

export const MAX_PENDING_REWARDS = 100;

export function saveStudyRecovery(ctx, recovery) {
  if (currentStudy(ctx).rewardRecoveryError?.startsWith('복구 기록을 읽지')) return false;
  let saved = false;
  try { saved = safeStringifySet(STORAGE_KEYS.studyRecovery, recovery, ctx.studyStorage || getMobileAccountStorage()); } catch { /* Keep recovery in memory until storage is available. */ }
  if (!saved) {
    ctx.setRewardRecoveryError('복구 기록을 기기에 저장하지 못했어요. 저장 공간을 확인하고 다시 시도해주세요.');
    return false;
  }
  ctx.setStudyRecovery(recovery);
  ctx.studyRecovery = recovery;
  ctx.setRewardPendingSessionId(recovery.pending[0]?.sessionId || '');
  ctx.setRewardRecoveryError('');
  return true;
}

export function currentStudy(ctx) {
  return ctx.getStudyState?.() || ctx;
}

export function currentRecovery(ctx) {
  const state = currentStudy(ctx);
  const stored = safeParse(STORAGE_KEYS.studyRecovery, null, ctx.studyStorage || getMobileAccountStorage());
  return stored?.pending && stored?.applied ? stored : ctx.studyRecovery || state.studyRecovery || { pending: state.rewardPendingSessionId ? [{ sessionId: state.rewardPendingSessionId, status: 'pending' }] : [], applied: [], records: null, subjects: null };
}
