import { displayAccountPlan } from '../mypage/account-presentation.js';

function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}` : '';
}

export function buildMembershipSummary({ user = {}, userTier = '', selectedPlan = '', targetPolicy = {} } = {}) {
  const tier = String(userTier || selectedPlan || '').toLowerCase();
  const label = tier ? (tier === 'trial' ? '무료 체험' : displayAccountPlan(tier).toUpperCase()) : '확인 중';
  const subscription = user.currentSubscription;
  const remaining = targetPolicy.label || '변경 횟수 확인 필요';
  if (!tier) return { label, detail: '멤버십 정보를 확인하고 있어요.' };
  if (tier === 'free') return { label, detail: '현재 이용 중인 유료 이용권이 없어요.' };
  if (['standard', 'pro', 'trial'].includes(tier)) {
    const start = subscription?.startDate ? new Date(subscription.startDate).getTime() : NaN;
    const end = subscription?.tier?.toLowerCase() === tier
      ? dateLabel(subscription.endDate || (Number.isFinite(start) ? start + 28 * 86400000 : null)) : '';
    return { label, detail: `${end ? `${end}까지` : '이용 기한 확인 필요'} · ${remaining}` };
  }
  const grace = dateLabel(user.gracePeriodUntil);
  return { label, detail: `${remaining}${grace ? ` · 조회 유예 ${grace}까지` : ''}` };
}
