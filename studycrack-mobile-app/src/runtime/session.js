import { EMPTY_USER } from '../constants/runtime-defaults.js';
import {
  createBlankScoreState,
  mapExamDataToScorePatch,
  normalizeTargetUnivSlots,
  scoreExamKeyToLabel,
  targetSlotsToList
} from './persistence.js';

// 사용자 분석 데이터 호출. 성공 시 백엔드 userData 반환, 그 외 null.
// 인증 만료(AUTH_EXPIRED)는 상위 부트스트랩이 세션 정리/로그인 이동을 분기하도록 전달한다.
export async function fetchCurrentUser({ apiFetch, userApiUrl } = {}) {
  if (typeof apiFetch !== 'function' || !userApiUrl) return null;
  try {
    const res = await apiFetch(userApiUrl, {
      method: 'POST',
      body: JSON.stringify({ type: 'get_user_analysis' })
    });
    if (!res || !res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && typeof data === 'object' ? data : null;
  } catch (error) {
    if (error && error.code === 'AUTH_EXPIRED') throw error;
    return null;
  }
}

export function createUserDataResetPatch() {
  return {
    user: { ...EMPTY_USER },
    userTier: '',
    selectedPlan: '',
    targetMajor: '',
    homeTargetList: [],
    analysisTargetList: [],
    targetUnivSlots: normalizeTargetUnivSlots([]),
    selectedUniversityIndex: 0,
    analysisSelectedIndex: 0,
    homeSlideIndex: 0,
    scores: {},
    scoreState: createBlankScoreState(),
    scoreEditState: createBlankScoreState(),
    analysisResults: [],
    analysisSimulations: [],
    analysisResultExamMode: '',
    analysisResultSignature: '',
    analysisApiStatus: 'idle',
    analysisApiError: '',
    lastAnalysisSnapshot: null,
    scoreCache: {},
    scoreFetchStatus: 'idle',
    scoreFetchSignature: ''
  };
}

// 백엔드 computedTier(소문자 tier) → 마이/요금 UI가 읽는 표시 plan명.
// 등급 시스템: free/trial/basic/starter/standard/pro (ARCHITECTURE.md §6).
const TIER_TO_PLAN_DISPLAY = {
  free: 'Free',
  trial: 'Trial',
  basic: 'Basic',
  starter: 'Starter',
  standard: 'Standard',
  pro: 'Pro'
};

const EXAM_PRIORITY = ['jun', 'may', 'mar', 'apr', 'jul', 'sep', 'oct', 'csat', 'active'];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getLatestExamEntry(quantitative = {}) {
  if (!quantitative || typeof quantitative !== 'object') return null;
  const key = EXAM_PRIORITY.find((examKey) => {
    const item = quantitative[examKey];
    return item && typeof item === 'object' && (item.kor || item.math || item.eng || item.inq1 || item.inq2);
  });
  return key ? { key, data: quantitative[key] } : null;
}

function mapQuantitativeToScores(quantitative = {}) {
  const latest = getLatestExamEntry(quantitative);
  if (!latest) return null;
  const patch = mapExamDataToScorePatch(latest.data);
  if (!patch) return null;
  return {
    examKey: latest.key,
    examLabel: scoreExamKeyToLabel(latest.key),
    ...patch
  };
}

function formatTargetUniv(target) {
  if (typeof target === 'string') return target.trim();
  if (!target || typeof target !== 'object') return '';
  const univ = String(target.univ || '').trim();
  const major = String(target.major || '').trim();
  if (!univ && !major) return '';
  if (!univ) return major;
  if (!major) return univ;
  return major.includes(univ) ? major : `${univ} ${major}`.trim();
}

function mapTargetUnivs(targetUnivs = []) {
  if (!Array.isArray(targetUnivs)) return [];
  return Array.from(new Set(targetUnivs.map(formatTargetUniv).filter(Boolean))).slice(0, 5);
}

// 사용자 응답을 모바일 state 필드로 병합한다.
export function mapUserToStatePatch(userData, base = {}) {
  if (!userData || typeof userData !== 'object') return {};
  const patch = {
    userTier: '',
    selectedPlan: '',
    scores: {},
    scoreState: createBlankScoreState(),
    scoreEditState: createBlankScoreState(),
    analysisApiStatus: 'idle',
    analysisApiError: '',
    scoreFetchStatus: 'idle',
    scoreFetchSignature: ''
  };
  const userPatch = { ...EMPTY_USER };
  if (userData.role) userPatch.role = userData.role;
  if (userData.name) userPatch.name = userData.name;
  ['email', 'socialEmail', 'phone', 'school', 'mbti', 'authProvider', 'marketingAgreedAt', 'profileImage', 'tutorName'].forEach((key) => {
    if (userData[key] !== undefined && userData[key] !== null) userPatch[key] = userData[key];
  });
  if (userData.tutorInfo && typeof userData.tutorInfo === 'object') userPatch.tutorInfo = userData.tutorInfo;
  // 구독 정보는 마이페이지 카드/상세 모달 표시값으로 병합한다.
  if (userData.currentSubscription && typeof userData.currentSubscription === 'object') {
    userPatch.currentSubscription = userData.currentSubscription;
  }
  if (userData.pendingSubscription && typeof userData.pendingSubscription === 'object') {
    userPatch.pendingSubscription = userData.pendingSubscription;
  }
  if (userData.gracePeriodUntil !== undefined && userData.gracePeriodUntil !== null) {
    userPatch.gracePeriodUntil = userData.gracePeriodUntil;
  }
  if (typeof userData.univChangeRemaining === 'number') {
    userPatch.univChangeRemaining = userData.univChangeRemaining;
  }
  if (userData.marketingAgreed !== undefined) userPatch.marketingAgreed = userData.marketingAgreed === true;
  if (userData.notificationPreferences && typeof userData.notificationPreferences === 'object') {
    patch.notifications = {
      ...(base.notifications || {}),
      ...Object.fromEntries(['planner', 'weekly', 'report', 'billing'].map((key) => [key, userData.notificationPreferences[key] !== false]))
    };
  }
  if (Array.isArray(userData.linkedProviders)) userPatch.linkedProviders = userData.linkedProviders;
  userPatch.quantitative = userData.quantitative && typeof userData.quantitative === 'object' ? userData.quantitative : {};
  if (userData.qualitative && typeof userData.qualitative === 'object') {
    userPatch.qualitative = userData.qualitative;
    if (userData.qualitative.status) patch.obGradeStatus = userData.qualitative.status;
    if (userData.qualitative.school) patch.obSchoolName = userData.qualitative.school;
    if (userData.qualitative.stream) patch.obTrack = userData.qualitative.stream;
    if (userData.qualitative.benefits) patch.obGoalText = userData.qualitative.benefits;
    if (userData.qualitative.questions) patch.obQuestionText = userData.qualitative.questions;
    if (userData.qualitative.mbti) patch.mbtiResult = userData.qualitative.mbti;
  }
  if (userData.computedTier) {
    const tier = String(userData.computedTier).toLowerCase();
    patch.userTier = tier;
    patch.selectedPlan = TIER_TO_PLAN_DISPLAY[tier] || '';
  }
  const normalizedTargetSlots = normalizeTargetUnivSlots(userData.targetUnivs);
  const explicitTargets = targetSlotsToList(normalizedTargetSlots);
  const targetList = explicitTargets.length ? explicitTargets : mapTargetUnivs(userData.qualitative?.targets || []);
  userPatch.targetUniversity = targetList[0] || '';
  patch.targetMajor = targetList[0] || '';
  patch.homeTargetList = targetList;
  patch.analysisTargetList = targetList;
  patch.targetUnivSlots = explicitTargets.length
    ? normalizedTargetSlots
    : normalizeTargetUnivSlots([], targetList);
  patch.selectedUniversityIndex = 0;
  patch.analysisSelectedIndex = 0;
  patch.homeSlideIndex = 0;
  const mappedScore = mapQuantitativeToScores(userData.quantitative);
  if (mappedScore) {
    patch.scores = { ...mappedScore.scores };
    patch.scoreState = { ...createBlankScoreState(), ...mappedScore.scoreState };
    patch.scoreEditState = { ...createBlankScoreState(), ...mappedScore.scoreState };
    patch.scoreExamType = mappedScore.examLabel;
    patch.scoreExamKey = mappedScore.examKey;
  }
  patch.user = userPatch;
  return patch;
}
