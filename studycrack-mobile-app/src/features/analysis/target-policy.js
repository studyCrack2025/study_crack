import { canUseReverseProjection } from '../../app/access-policy.js';
import { targetSlotsToList } from './target-model.js';

export function buildTargetPolicy(state = {}) {
  const count = targetSlotsToList(state.targetUnivSlots || []).length || (state.analysisTargetList || []).length;
  const unlimited = canUseReverseProjection(state);
  const value = state.user?.univChangeRemaining;
  const remaining = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  const tier = String(state.userTier || state.selectedPlan || 'free').toLowerCase();
  const plan = ({ free: 'Free', trial: 'Free', basic: 'Basic', test: 'Basic', starter: 'Starter', standard: 'Standard', pro: 'Pro' })[tier] || '현재 요금제';
  const reason = count >= 6 ? '희망 대학은 최대 6개까지 등록할 수 있어요. 기존 대학을 삭제한 뒤 추가해주세요.'
    : !unlimited && remaining === 0 ? '대학 변경 횟수를 모두 사용했어요. 현재 대학의 분석은 계속 확인할 수 있어요.' : '';
  return { count, plan, remaining, unlimited, canAdd: !reason, reason,
    label: unlimited ? '대학 변경 무제한' : remaining === null ? '변경 횟수 확인 필요' : `대학 변경 ${remaining}회 남음` };
}
