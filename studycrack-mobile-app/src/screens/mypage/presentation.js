import { getMbtiProfile, normalizeMbtiCode } from '../../constants/mbti.js';
import { buildSubscriptionSummary } from './account-presentation.js';
import { buildAccountProfile } from '../../features/account/profile-presentation.js';

const PLAN_LABELS = {
  basic: 'Basic',
  free: 'Free',
  pro: 'Pro',
  standard: 'Standard',
  starter: 'Starter',
  test: 'Basic',
  trial: 'Free'
};

const WEAKNESS_COPY = {
  M: '새로운 방식을 자주 바꾸면 학습 누적이 약해질 수 있어요.',
  S: '예상 밖의 변화가 생기면 익숙한 루틴이 흔들릴 수 있어요.'
};

const FLEX_COPY = {
  F: '컨디션이 흔들릴 때는 최소 목표 하나만 정해 흐름을 이어가세요.',
  R: '계획이 밀려도 전체를 다시 짜기보다 다음 한 칸부터 복구하세요.'
};

const STUDY_COPY = {
  CD: '개념을 기준으로 근거를 정리한 뒤 문제에 적용하는 방식이 잘 맞아요.',
  CE: '개념의 큰 흐름을 먼저 잡고 대표 문제로 연결해 보세요.',
  ID: '문제를 먼저 풀고 오답 근거를 짧게 기록하는 방식이 효율적이에요.',
  IE: '다양한 문제를 빠르게 경험하며 풀이 패턴을 묶어 보세요.'
};

function safeText(value = '') {
  return String(value || '').trim();
}

function planKey(user = {}, selectedPlan = '') {
  const tier = safeText(user?.currentSubscription?.tier || user?.computedTier || selectedPlan).toLowerCase();
  return tier.replace(/\s+/g, '');
}

function formatDate(value = '') {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function buildPlanPresentation(user = {}, selectedPlan = '') {
  const key = planKey(user, selectedPlan);
  const label = PLAN_LABELS[key] || safeText(selectedPlan) || '이용권 없음';
  const subscription = user?.currentSubscription && typeof user.currentSubscription === 'object' ? user.currentSubscription : null;
  const lifetime = key === 'basic' || key === 'starter' || key === 'test';
  const endDate = formatDate(subscription?.endDate);
  const periodLabel = label === '이용권 없음'
    ? '현재 이용 중인 플랜이 없습니다.'
    : lifetime
      ? '평생 이용'
      : endDate
        ? `${endDate}까지 이용`
        : '이용 기간 확인 중';
  return { key, label, periodLabel };
}

function formatStudyDuration(seconds = 0) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}시간 ${rest}분`;
  if (hours) return `${hours}시간`;
  return `${rest}분`;
}

function buildMbtiPresentation(user = {}, mbtiResult = '') {
  const code = normalizeMbtiCode(user?.mbti || user?.qualitative?.mbti || mbtiResult);
  if (!code) return { code: '', empty: true, rows: [] };
  const profile = getMbtiProfile(code);
  return {
    code,
    desc: profile.desc,
    empty: false,
    name: profile.name,
    rows: [
      { label: '강점', value: profile.traits.join(' · ') },
      { label: '주의점', value: WEAKNESS_COPY[code[1]] },
      { label: '공부법', value: STUDY_COPY[`${code[0]}${code[2]}`] },
      { label: '멘탈 관리', value: FLEX_COPY[code[3]] }
    ]
  };
}

export function buildMyPagePresentation({ user = {}, userLoadStatus = 'idle', selectedPlan = '', studyOverview, aquariumPresentation } = {}) {
  const profile = buildAccountProfile({ user, userLoadStatus });
  const plan = buildPlanPresentation(userLoadStatus === 'ready' ? user : {}, userLoadStatus === 'ready' ? selectedPlan : '');
  const subscription = buildSubscriptionSummary(user, selectedPlan);
  const mbti = buildMbtiPresentation({ mbti: profile.mbtiCode });
  const week = studyOverview?.week;
  const aquarium = aquariumPresentation;
  return {
    mbti, profile,
    plan: { ...plan, renewalLine: subscription.renewalLine, pendingLine: subscription.pendingLine },
    stats: [
      { label: '이번 주 확정 공부', value: week?.seconds != null ? formatStudyDuration(week.seconds) : '확인 필요' },
      { label: '보유 물고기', value: aquarium?.ownedCount != null ? `${aquarium.ownedCount}마리` : '확인 필요' },
      { label: '연속 학습', value: aquarium?.streakDays != null ? `${aquarium.streakDays}일` : '확인 필요' }
    ],
    studyStatus: week?.status || 'idle',
    studyStale: week?.seconds != null && !week.fresh,
    weekRange: week?.startDate && week?.endDate ? `${week.startDate} ~ ${week.endDate}` : '',
    gameStatus: aquarium?.status || 'idle',
    shells: aquarium?.shells != null ? `${aquarium.shells}개` : '확인 필요'
  };
}
