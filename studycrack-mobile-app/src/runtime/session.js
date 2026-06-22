// 세션이 있을 때만 사용자 데이터를 가져와 mock 위에 병합한다(미인증/실패 시 데모 유지).
import { createBlankScoreState, mapExamDataToScorePatch, scoreExamKeyToLabel } from './persistence.js';

// 사용자 분석 데이터 호출. 성공 시 백엔드 userData 반환, 그 외 null.
// 미인증/네트워크/CORS 실패는 throw 없이 null(데모 유지).
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
  } catch (_error) {
    return null;
  }
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

const EXAM_PRIORITY = ['active', 'jun', 'may', 'mar', 'apr', 'jul', 'sep', 'oct', 'csat'];

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

// 백엔드 userData → 모듈 state 병합 패치.
// R1: 웹 소비처와 동일 필드명(data.name/computedTier) 사용 + UI가 실제 읽는 state 필드로 매핑.
//   - name      → user.name      (마이 카드가 user?.name 사용)
//   - computedTier → selectedPlan(표시) + userTier(원시, 후속 게이팅용). 마이 등급 배지가 selectedPlan 사용.
export function mapUserToStatePatch(userData, base = {}) {
  if (!userData || typeof userData !== 'object') return {};
  const patch = {};
  const userPatch = { ...(base.user || {}) };
  if (userData.role) userPatch.role = userData.role;
  if (userData.name) userPatch.name = userData.name;
  ['email', 'socialEmail', 'phone', 'school', 'mbti', 'authProvider', 'marketingAgreedAt'].forEach((key) => {
    if (userData[key] !== undefined && userData[key] !== null) userPatch[key] = userData[key];
  });
  if (userData.marketingAgreed !== undefined) userPatch.marketingAgreed = userData.marketingAgreed === true;
  if (Array.isArray(userData.linkedProviders)) userPatch.linkedProviders = userData.linkedProviders;
  if (userData.quantitative && typeof userData.quantitative === 'object') userPatch.quantitative = userData.quantitative;
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
    patch.selectedPlan = TIER_TO_PLAN_DISPLAY[tier] || (base.selectedPlan || '');
  }
  const explicitTargets = mapTargetUnivs(userData.targetUnivs);
  const targetList = explicitTargets.length ? explicitTargets : mapTargetUnivs(userData.qualitative?.targets || []);
  if (targetList.length) {
    userPatch.targetUniversity = targetList[0];
    patch.targetMajor = targetList[0];
    patch.homeTargetList = targetList;
    patch.analysisTargetList = targetList;
    patch.selectedUniversityIndex = 0;
  }
  const mappedScore = mapQuantitativeToScores(userData.quantitative);
  if (mappedScore) {
    patch.scores = { ...(base.scores || {}), ...mappedScore.scores };
    patch.scoreState = { ...(base.scoreState || {}), ...mappedScore.scoreState };
    patch.scoreEditState = { ...(base.scoreEditState || {}), ...mappedScore.scoreState };
    patch.scoreExamType = mappedScore.examLabel;
    patch.scoreExamKey = mappedScore.examKey;
  } else if (userData.quantitative && typeof userData.quantitative === 'object') {
    const blankScoreState = createBlankScoreState();
    patch.scores = {};
    patch.scoreState = blankScoreState;
    patch.scoreEditState = blankScoreState;
  }
  if (Object.keys(userPatch).length) patch.user = userPatch;
  return patch;
}
