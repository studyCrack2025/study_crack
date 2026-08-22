import { getMbtiProfile, normalizeMbtiCode } from '../../constants/mbti.js';
import { buildSubscriptionSummary } from './account-presentation.js';

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

function recordSeconds(record = {}) {
  const value = record.studyTime ?? record.durationSeconds ?? record.seconds ?? 0;
  return Math.max(0, Number(value) || 0);
}

function formatStudyDuration(seconds = 0) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}시간 ${rest}분`;
  if (hours) return `${hours}시간`;
  return `${rest}분`;
}

function dayNumber(value = '') {
  const match = safeText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

export function getLongestStudyStreak(records = []) {
  const days = Array.from(new Set((Array.isArray(records) ? records : [])
    .filter((record) => recordSeconds(record) > 0)
    .map((record) => dayNumber(record.date || record.startedAt?.slice?.(0, 10)))
    .filter(Number.isFinite)))
    .sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let previous = null;
  days.forEach((day) => {
    current = previous !== null && day === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  });
  return longest;
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

function buildProfileMeta(user = {}) {
  const qualitative = user?.qualitative && typeof user.qualitative === 'object' ? user.qualitative : {};
  const grade = safeText(qualitative.status);
  const track = safeText(qualitative.stream);
  return [grade, track].filter(Boolean).join(' · ') || '학년·계열 정보를 등록해주세요';
}

export function buildMyPagePresentation({ liveStudySeconds = 0, mbtiResult = '', plannerItems = [], selectedPlan = '', studyRecords = [], user = {} } = {}) {
  const totalStudySeconds = (Array.isArray(studyRecords) ? studyRecords : []).reduce((sum, record) => sum + recordSeconds(record), 0)
    + Math.max(0, Number(liveStudySeconds) || 0);
  const completedCount = (Array.isArray(plannerItems) ? plannerItems : []).filter((item) => item?.done === true).length;
  const plan = buildPlanPresentation(user, selectedPlan);
  const subscription = buildSubscriptionSummary(user, selectedPlan);
  const mbti = buildMbtiPresentation(user, mbtiResult);

  return {
    mbti,
    plan: { ...plan, renewalLine: subscription.renewalLine, pendingLine: subscription.pendingLine },
    profile: {
      avatarUrl: safeText(user?.profileImage),
      meta: buildProfileMeta(user),
      name: safeText(user?.name) || '회원'
    },
    stats: [
      { label: '누적 공부', value: formatStudyDuration(totalStudySeconds) },
      { label: '완료 계획', value: `${completedCount}개` },
      { label: '최장 연속', value: `${getLongestStudyStreak(studyRecords)}일` }
    ]
  };
}
