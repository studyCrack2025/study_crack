import { FIXED_TODAY_DATE } from '../constants/mock-data.js';
import { ANALYSIS_PROFILES, ANALYSIS_RECOMMENDED, ANALYSIS_SEARCH_SEED } from '../constants/universities.js';

// 런타임 derived view-model: 원시 state에서 화면 renderer가 기대하는 계산값을 파생.
// 모놀리식 App() 본문의 계산을 도메인별 순수 함수로 이식한다(로직 1:1 유지).

const PLANNER_VIEW_PALETTE = { 국어: '#8B5CF6', 수학: '#3B82F6', 영어: '#14B8A6', 탐구: '#F97316', 기타: '#64748B' };
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 플래너 항목을 날짜별로 그룹(원본 plannerItemsByDate). planner/home derived 공유.
function groupPlannerByDate(plannerItems = []) {
  return plannerItems.reduce((acc, item) => {
    const dateKey = item.date || '14';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});
}

function formatMinutesLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safeMinutes / 60);
  const min = safeMinutes % 60;
  if (hour && min) return `${hour}시간 ${min}분`;
  if (hour) return `${hour}시간`;
  return `${min}분`;
}

// 현재 입력 성적 기준 평균 점수(원본 liveCurrentScore).
function computeLiveCurrentScore(scores = {}) {
  return Math.round(
    (Number(scores.korean || 0) +
      Number(scores.math || 0) +
      Number(scores.english || 0) +
      Number(scores.inquiry1 || 0) +
      Number(scores.inquiry2 || 0)) /
      5
  );
}

// 플래너 화면 derived (원본 js/studycrack-mobile.js 플래너 계산 블록과 동일).
export function buildPlannerDerived(state = {}) {
  const { plannerItems = [], selectedDate = '14', plannerEditIndex = null } = state;

  const plannerWeekDates = Array.from({ length: 15 }, (_, idx) => {
    const day = Math.min(31, Math.max(1, Number(selectedDate) - 7 + idx));
    const weekday = WEEKDAY_LABELS[new Date(2024, 4, day).getDay()];
    return { day: String(day), weekday };
  });

  const selectedPlannerDate = selectedDate;

  const plannerItemsByDate = groupPlannerByDate(plannerItems);

  const plannerViewItems = plannerItemsByDate[selectedPlannerDate] || [];
  const plannerViewMinutes = plannerViewItems.reduce((acc, item) => acc + (item.minutes || 0), 0);
  const plannerViewHour = Math.floor(plannerViewMinutes / 60);
  const plannerViewMinute = plannerViewMinutes % 60;

  const plannerViewSubjectMinutes = plannerViewItems.reduce((acc, item) => {
    const key = item.subject || '기타';
    acc[key] = (acc[key] || 0) + (item.minutes || 0);
    return acc;
  }, {});

  const plannerViewSubjectStats = Object.entries(plannerViewSubjectMinutes)
    .filter(([, minutes]) => minutes > 0)
    .map(([subject, minutes]) => ({
      subject,
      minutes,
      percent: plannerViewMinutes ? Math.round((minutes / plannerViewMinutes) * 100) : 0,
      color: PLANNER_VIEW_PALETTE[subject] || PLANNER_VIEW_PALETTE['기타']
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const plannerViewDonutGradient = plannerViewSubjectStats.length
    ? `conic-gradient(${plannerViewSubjectStats
        .map((item, idx) => {
          const start = plannerViewSubjectStats.slice(0, idx).reduce((sum, cur) => sum + cur.percent, 0);
          const end = Math.min(100, start + item.percent);
          return `${item.color} ${start}% ${end}%`;
        })
        .join(',')})`
    : 'conic-gradient(#E2E8F0 0 100%)';

  const plannerEditItem = plannerItems.find((item) => item.id === plannerEditIndex) || null;

  return {
    plannerWeekDates,
    selectedPlannerDate,
    plannerViewItems,
    plannerViewHour,
    plannerViewMinute,
    plannerViewSubjectStats,
    plannerViewDonutGradient,
    plannerEditItem
  };
}

// 홈 대학 KPI 카드(원본 homeTargets). planner-by-date처럼 home/analysis derived 공유.
// 원본은 profile을 계산하되 결과 객체엔 쓰지 않으므로(점수=liveCurrentScore, cut=100) 동일하게 생략.
function computeHomeTargets(state = {}) {
  const { scores = {}, targetMajor = '', homeTargetList = [] } = state;
  const liveCurrentScore = computeLiveCurrentScore(scores);
  const orderedHomeTargetMajors = Array.from(
    new Set([...(targetMajor ? [targetMajor] : []), ...(homeTargetList || [])])
  ).filter(Boolean);
  return orderedHomeTargetMajors.map((major) => {
    const score = Number(liveCurrentScore || computeLiveCurrentScore(scores));
    const cut = 100;
    const gap = score - cut;
    return {
      major,
      score,
      cut,
      gap: gap > 0 ? `+${gap}` : String(gap),
      rank: score >= 150 ? '안정' : score >= 100 ? '합격권' : '도전',
      rate: Math.round(Math.min(99, Math.max(20, (score / 150) * 100)))
    };
  });
}

// 홈 화면 derived (원본 js/studycrack-mobile.js 홈 계산 블록과 동일).
export function buildHomeDerived(state = {}) {
  const { scores = {}, plannerItems = [] } = state;

  const liveCurrentScore = computeLiveCurrentScore(scores);
  const homeTargets = computeHomeTargets(state);

  // 오늘 플래너 요약
  const byDate = groupPlannerByDate(plannerItems);
  const todayDateKey = String(Number(FIXED_TODAY_DATE.split('-')[2]));
  const todayPlannerItems = byDate[todayDateKey] || [];
  const todayPlannerTotalMinutes = todayPlannerItems.reduce((acc, item) => acc + (item.minutes || 0), 0);
  const todayPlannerSubjectSummary = Object.entries(
    todayPlannerItems.reduce((acc, item) => {
      const key = item.subject || '기타';
      acc[key] = (acc[key] || 0) + (item.minutes || 0);
      return acc;
    }, {})
  )
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([subject, minutes]) => `${subject} ${formatMinutesLabel(minutes)}`);

  return {
    liveCurrentScore,
    homeTargets,
    todayPlannerItems,
    todayPlannerTotalMinutes,
    todayPlannerSubjectSummary
  };
}

// 분석 화면 derived (원본 js/studycrack-mobile.js 분석 계산 블록과 동일).
export function buildAnalysisDerived(state = {}) {
  const {
    scores = {},
    targetMajor = '',
    analysisTargetList = [],
    homeTargetList = [],
    analysisSearchTerm = ''
  } = state;

  const liveCurrentScore = computeLiveCurrentScore(scores);

  const analysisBaseProfile = ANALYSIS_PROFILES[targetMajor] || ANALYSIS_PROFILES['연세대학교 경영학과'];
  const analysisSelected = {
    ...analysisBaseProfile,
    score: liveCurrentScore,
    sim: (analysisBaseProfile.sim || []).map((r, idx) => {
      const boost = Math.max(0, Math.round((liveCurrentScore - 60) / 10));
      const g = Number(String(r[1]).replace(/[^0-9.-]/g, '')) || 0;
      const totalGain = Math.round(g + boost);
      return [r[0], `+${totalGain}점`, r[2], idx === 0];
    })
  };

  const analysisRecommended = ANALYSIS_RECOMMENDED;
  const analysisSearchPool = Array.from(
    new Set([...ANALYSIS_SEARCH_SEED, ...(analysisTargetList || []), ...(homeTargetList || []), ...analysisRecommended])
  ).filter(Boolean);
  const normalizedSearchTerm = String(analysisSearchTerm || '').trim().toLowerCase().replace(/\s+/g, '');
  const analysisSearchList = analysisSearchPool.filter((name) => {
    if (!normalizedSearchTerm) return true;
    return String(name).toLowerCase().replace(/\s+/g, '').includes(normalizedSearchTerm);
  });

  const analysisGaugeFill = Math.min((analysisSelected.score / 250) * 100, 100);
  const analysisGaugeColor =
    analysisSelected.score >= 150 ? '#22C55E' : analysisSelected.score >= 100 ? '#2563EB' : '#F97316';
  const analysisStatus = analysisSelected.score >= 150 ? '초안정' : analysisSelected.score >= 100 ? '적정' : '위험';
  const analysisStatusColor =
    analysisSelected.score >= 150 ? '#22C55E' : analysisSelected.score >= 100 ? '#0B6BFF' : '#F97316';
  const analysisTargetScore = Math.min(analysisSelected.score + 34, 180);

  const analysisSimRows = analysisSelected.sim.map(([subject, gain, desc], idx) => {
    const gainNum = Number(String(gain).replace(/[^0-9.]/g, '')) || 0;
    return { subject, gain, desc, gainNum, idx };
  });
  const analysisSimMax = Math.max(...analysisSimRows.map(({ gainNum }) => gainNum), 0);
  const analysisSimRecommendedIndex = analysisSimRows.findIndex(({ gainNum }) => gainNum === analysisSimMax);

  const gaugeTotal = 250;
  const gaugeCurrent = Math.max(0, Math.min(gaugeTotal, Math.round(analysisSelected.score)));
  const gaugeTarget = Math.max(gaugeCurrent, Math.min(gaugeTotal, Math.round(analysisTargetScore)));
  const gaugePass = 100;
  const gaugeSafe = 150;
  const gaugeCurrentPct = Math.min((gaugeCurrent / gaugeTotal) * 100, 100);
  const gaugeTargetPct = Math.min((gaugeTarget / gaugeTotal) * 100, 100);
  const gaugePassPct = (gaugePass / gaugeTotal) * 100;
  const gaugeSafePct = (gaugeSafe / gaugeTotal) * 100;

  const analysisMajorOptions = Array.from(
    new Set([...(analysisTargetList || []), ...(homeTargetList || [])])
  ).filter(Boolean);
  const normalizedTargetMajor = analysisMajorOptions.includes(targetMajor)
    ? targetMajor
    : analysisMajorOptions[0] || targetMajor || '';

  const analysisSimulationBaseOrder = Array.from(
    new Set([...(targetMajor ? [targetMajor] : []), ...(analysisTargetList || []), ...(homeTargetList || [])])
  ).filter(Boolean);
  const homeTargets = computeHomeTargets(state);
  const analysisSimulationTargets = (analysisSimulationBaseOrder.length ? analysisSimulationBaseOrder : [targetMajor])
    .filter(Boolean)
    .map((major) => {
      const base = homeTargets.find((item) => item.major === major) || homeTargets[0];
      const score = Number(base?.score || liveCurrentScore || 0);
      const cut = Number(base?.cut || 100);
      return {
        major,
        label: major.replace('대학교', '대').replace('학부', '').replace('학과', ''),
        score,
        cut,
        gap: score - cut
      };
    });

  return {
    analysisSelected,
    analysisRecommended,
    analysisSearchList,
    analysisGaugeFill,
    analysisGaugeColor,
    analysisStatus,
    analysisStatusColor,
    analysisMajorOptions,
    normalizedTargetMajor,
    gaugeCurrent,
    gaugeTarget,
    gaugeCurrentPct,
    gaugeTargetPct,
    gaugePassPct,
    gaugeSafePct,
    analysisSimRows,
    analysisSimMax,
    analysisSimRecommendedIndex,
    analysisSimulationTargets
  };
}

// 도메인 derived 집계.
export function buildDerivedContext(state = {}) {
  return {
    ...buildPlannerDerived(state),
    ...buildHomeDerived(state),
    ...buildAnalysisDerived(state)
  };
}
