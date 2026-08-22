export function formatMarketingConsentDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function displayAccountEmail(user = {}) {
  const raw = user.socialEmail || user.email || '';
  return raw.includes('@social.studycrack.co.kr') ? '소셜 계정 이메일 미제공' : raw || '등록된 이메일 없음';
}

export function displayProvider(provider = '') {
  if (provider === 'google') return 'Google';
  if (provider === 'naver') return 'Naver';
  return provider || '';
}

export function displayAccountName(user = {}) {
  return String(user?.name || '').trim() || '회원';
}

export function displayAccountPlan(plan = '') {
  const raw = String(plan || '').trim();
  const labels = { basic: 'Basic', free: 'Free', pro: 'Pro', standard: 'Standard', starter: 'Starter', test: 'Basic', trial: 'Free' };
  return labels[raw.toLowerCase()] || raw || '미구독';
}

export function displayPlanStatus(plan = '') {
  const label = displayAccountPlan(plan);
  return label === '미구독' ? '이용권 없음' : `${label} 이용 중`;
}

function isLifetimePlan(tier = '') {
  const raw = String(tier || '').toLowerCase();
  return raw.includes('basic') || raw.includes('starter');
}

function formatSubscriptionDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function buildSubscriptionSummary(user = {}, selectedPlan = '') {
  const current = user?.currentSubscription && typeof user.currentSubscription === 'object' ? user.currentSubscription : null;
  const pending = user?.pendingSubscription && typeof user.pendingSubscription === 'object' ? user.pendingSubscription : null;
  const planLabel = displayAccountPlan(current?.tier || user?.computedTier || selectedPlan);
  const tier = current?.tier || selectedPlan;
  const hasPlan = planLabel !== '미구독';
  const lifetime = hasPlan && isLifetimePlan(tier);
  const startDate = current ? formatSubscriptionDate(current.startDate) : '';
  const endDate = current ? formatSubscriptionDate(current.endDate) : '';
  const renewalLine = !hasPlan
    ? '이용권 없음'
    : lifetime
      ? '별도 갱신 없이 이용'
      : endDate
        ? `${endDate} 전 연장 필요`
        : '이용 기간 확인 중';
  const pendingLine = pending?.tier
    ? `다음 플랜 ${displayAccountPlan(pending.tier)}${pending.startDate ? ` · ${formatSubscriptionDate(pending.startDate)} 시작` : ''}`
    : '';
  return { planLabel, hasPlan, lifetime, startDate, endDate, renewalLine, pendingLine };
}

export function canViewTutorInfo(plan = '', user = {}) {
  const raw = String(user?.computedTier || user?.tier || plan || '').toLowerCase();
  return raw.includes('standard') || raw.includes('pro');
}

export function buildSocialProviders(user = {}) {
  const primaryProvider = user.authProvider || 'local';
  const linked = Array.isArray(user.linkedProviders) ? user.linkedProviders : [];
  const linkedSet = new Set(linked.map((item) => item?.provider).filter(Boolean));
  if (primaryProvider !== 'local') linkedSet.add(primaryProvider);
  return [
    { key: 'google', label: 'Google', mark: 'G' },
    { key: 'naver', label: 'Naver', mark: 'N' }
  ].map((provider) => ({
    ...provider,
    isLinked: linkedSet.has(provider.key),
    isPrimary: primaryProvider === provider.key
  }));
}
