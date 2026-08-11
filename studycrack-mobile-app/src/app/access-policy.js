const PLAN_RANK = { free: 0, trial: 0, basic: 1, starter: 1, standard: 2, pro: 3 };

const SCREEN_REQUIREMENTS = {
  strategy: 'standard',
  planner: 'basic',
  plannerAdd: 'basic',
  weekly: 'standard',
  report: 'pro',
  reportDetail: 'pro',
  proElite: 'pro',
  tutor: 'pro'
};

const LOCKED_SCREEN_LABELS = {
  strategy: '학습 코칭',
  planner: '플래너',
  plannerAdd: '플래너 작성',
  weekly: '주간 피드백',
  report: 'PRO 리포트',
  reportDetail: '리포트 상세',
  proElite: 'PRO 전용 리포트',
  tutor: 'SKY튜터 1:1 피드백'
};

function normalizeAccessTier(value) {
  const tier = String(value || '').toLowerCase();
  return tier === 'test' ? 'basic' : tier;
}

function parseAccessDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getEffectiveTier(state = {}) {
  return normalizeAccessTier(state.userTier || state.selectedPlan || '');
}

function pickActiveAccessSubscription(user = {}, now = Date.now()) {
  const pick = (subscription) => {
    if (!subscription || subscription.status !== 'active') return null;
    const tier = normalizeAccessTier(subscription.tier);
    const start = parseAccessDate(subscription.startDate);
    if (start && now < start.getTime()) return null;
    if (tier === 'basic' || tier === 'starter') return subscription;
    const end = parseAccessDate(subscription.endDate)
      || (start ? new Date(start.getTime() + 28 * 24 * 60 * 60 * 1000) : null);
    if (end && now > end.getTime()) return null;
    return subscription;
  };
  return pick(user.currentSubscription) || pick(user.pendingSubscription);
}

export function canAccessTier(state, requiredTier) {
  if (!requiredTier) return true;
  return (PLAN_RANK[getEffectiveTier(state)] || 0) >= (PLAN_RANK[requiredTier] || 0);
}

export function canUseScoreSimulation(state) {
  const activeSubscription = pickActiveAccessSubscription(state?.user || {});
  if (!activeSubscription) return false;
  return ['basic', 'starter', 'standard', 'pro'].includes(normalizeAccessTier(activeSubscription.tier));
}

export function canUseReverseProjection(state) {
  const activeSubscription = pickActiveAccessSubscription(state?.user || {});
  if (!activeSubscription) return false;
  return ['standard', 'pro'].includes(normalizeAccessTier(activeSubscription.tier));
}

export function resolveScreenAccess(state, target) {
  const requiredTier = SCREEN_REQUIREMENTS[target];
  if (!requiredTier || canAccessTier(state, requiredTier)) return { allowed: true, requiredTier: '', label: '' };
  return {
    allowed: false,
    requiredTier,
    label: LOCKED_SCREEN_LABELS[target] || '선택한 기능'
  };
}

export function filterTabItemsForTier(items = []) {
  return items;
}
