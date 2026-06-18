// 세션이 있을 때만 사용자 데이터를 가져와 mock 위에 병합한다(미인증/실패 시 데모 유지).

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

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function optionalNumber(value) {
  return hasValue(value) ? toNumber(value, 0) : undefined;
}

function englishGradeToScore(grade) {
  const n = toNumber(grade, 0);
  return n ? Math.max(0, Math.round(100 - (n - 1) * 12.5)) : 0;
}

function getLatestExamEntry(quantitative = {}) {
  if (!quantitative || typeof quantitative !== 'object') return null;
  const key = EXAM_PRIORITY.find((examKey) => {
    const item = quantitative[examKey];
    return item && typeof item === 'object' && (item.kor || item.math || item.eng || item.inq1 || item.inq2);
  });
  return key ? { key, data: quantitative[key] } : null;
}

function mapExamKeyToLabel(key) {
  const labels = {
    active: '최근 성적',
    mar: '3월 모의고사',
    apr: '4월 모의고사',
    may: '5월 모의고사',
    jun: '6월 모의고사',
    jul: '7월 모의고사',
    sep: '9월 모의고사',
    oct: '10월 모의고사',
    csat: '수능'
  };
  return labels[key] || '최근 성적';
}

function mapQuantitativeToScores(quantitative = {}) {
  const latest = getLatestExamEntry(quantitative);
  if (!latest) return null;
  const d = latest.data || {};
  const englishGrade = toNumber(d.eng?.grd, 0);
  const englishScore = optionalNumber(d.eng?.raw) ?? (englishGrade ? englishGradeToScore(englishGrade) : undefined);
  const scores = {
    korean: optionalNumber(d.kor?.raw),
    math: optionalNumber(d.math?.raw),
    english: englishScore,
    inquiry1: optionalNumber(d.inq1?.raw),
    inquiry2: optionalNumber(d.inq2?.raw)
  };
  return {
    examKey: latest.key,
    examLabel: mapExamKeyToLabel(latest.key),
    scores: Object.fromEntries(Object.entries(scores).filter(([, value]) => value !== undefined)),
    scoreState: {
      korean: { type: d.kor?.opt || '', common: d.kor?.common || '', elective: d.kor?.elective || '' },
      math: { type: d.math?.opt || '', common: d.math?.common || '', elective: d.math?.elective || '' },
      english: englishGrade || '',
      history: d.hist?.grd || d.history?.grd || '',
      inquiry1: { subject: d.inq1?.name || '', score: d.inq1?.raw || '' },
      inquiry2: { subject: d.inq2?.name || '', score: d.inq2?.raw || '' }
    }
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
  if (userData.name) userPatch.name = userData.name;
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
  }
  if (Object.keys(userPatch).length) patch.user = userPatch;
  return patch;
}
