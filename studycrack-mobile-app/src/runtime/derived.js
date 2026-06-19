import { FIXED_TODAY_DATE } from '../constants/mock-data.js';
import { ANALYSIS_PROFILES, ANALYSIS_RECOMMENDED, ANALYSIS_SEARCH_SEED } from '../constants/universities.js';
import { scoreExamTypeToKey } from './persistence.js';

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

// 원점수 → 표준점수/백분위/등급 환산(원본 scoreMetric, 순수 공식·테이블 없음).
function scoreMetric(raw) {
  const n = Math.max(0, Number(raw) || 0);
  const std = Math.min(160, Math.round(n * 0.95 + 22));
  const pct = Math.min(99, Math.max(1, Math.round(n * 0.9 + 10)));
  const grade = pct >= 96 ? 1 : pct >= 89 ? 2 : pct >= 77 ? 3 : pct >= 64 ? 4 : pct >= 52 ? 5 : pct >= 40 ? 6 : pct >= 28 ? 7 : pct >= 16 ? 8 : 9;
  return { std, pct, grade };
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

function targetFullName(item = {}) {
  const univ = String(item.univ || '').trim();
  const major = String(item.major || '').trim();
  if (!univ && !major) return '';
  if (!univ) return major;
  if (!major) return univ;
  return major.includes(univ) ? major : `${univ} ${major}`;
}

function compactTargetLabel(name = '') {
  return String(name || '').replace('대학교', '대').replace('학부', '').replace('학과', '');
}

function findTargetItem(list = [], targetMajor = '') {
  const normalized = String(targetMajor || '').replace(/\s+/g, '');
  if (!normalized) return null;
  return (list || []).find((item) => targetFullName(item).replace(/\s+/g, '') === normalized) || null;
}

const SIM_SUBJECT_ORDER = ['kor', 'math', 'inq1', 'inq2'];
const SIM_SUBJECT_FALLBACK = { kor: '국어', math: '수학', inq1: '탐구1', inq2: '탐구2' };

function buildServerSimRows(simulation) {
  const simData = simulation?.sim_data || {};
  return SIM_SUBJECT_ORDER
    .map((key, idx) => {
      const item = simData[key];
      if (!item) return null;
      const gainNum = Number(item.uiDiff ?? item.diff ?? 0);
      const rounded = Number.isFinite(gainNum) ? Math.max(0, gainNum) : 0;
      return {
        subject: item.name || SIM_SUBJECT_FALLBACK[key] || key,
        gain: `+${rounded.toFixed(rounded >= 10 ? 0 : 1)}점`,
        desc: item.msg || (rounded > 0 ? '점수 상승으로 합격 가능성이 높아집니다.' : '현재 조건에서는 상승 효율이 낮습니다.'),
        gainNum: rounded,
        idx
      };
    })
    .filter(Boolean);
}

// 홈 화면 derived (원본 js/studycrack-mobile.js 홈 계산 블록과 동일).
// liveStudySeconds: 라이브 타이머 ref의 현재값(원본 todayStudySeconds = 저장값 + liveStudySeconds).
// 매초 interval은 DOM을 직접 갱신하고, 재렌더 시 표시/랭킹/진행률 일관성을 위해 여기서 더한다.
export function buildHomeDerived(state = {}, liveStudySeconds = 0) {
  const {
    scores = {},
    plannerItems = [],
    studyRecords = [],
    studySubjectRecords = [],
    studyTimerRunning = false,
    activeStudySubject = ''
  } = state;
  const live = Number(liveStudySeconds) || 0;

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

  // 오늘 공부 기록 / 진행률 / 과목 breakdown / 랭킹.
  // 원본 todayStudySeconds = (todayRecord?.studyTime||0) + liveStudySeconds(타이머 ref).
  // derived는 순수 함수라 라이브 ref가 없어 정지 상태(liveStudySeconds=0)와 동일하게 누적 기록만 반영.
  // 라이브 타이머 가산은 후속 effect 단계에서 연결한다.
  const todayKey = FIXED_TODAY_DATE;
  const todayRecord = studyRecords.find((item) => item.date === todayKey) || null;
  const todayStudySeconds = (todayRecord?.studyTime || 0) + live;
  const todayPlannerTotalSeconds = todayPlannerTotalMinutes * 60;
  const todayPlannerProgress = todayPlannerTotalSeconds
    ? Math.min(100, Math.round((todayStudySeconds / todayPlannerTotalSeconds) * 100))
    : 0;

  const todaySubjectRecord = studySubjectRecords.find((item) => item.date === todayKey) || { date: todayKey, subjects: {} };
  const todaySubjectsWithTimer = { ...todaySubjectRecord.subjects };
  if (studyTimerRunning && activeStudySubject) {
    todaySubjectsWithTimer[activeStudySubject] = (todaySubjectsWithTimer[activeStudySubject] || 0) + live;
  }

  const plannedScheduleOptions = todayPlannerItems.map((item) => ({
    id: item.id,
    subject: item.subject || '기타',
    label: `${item.subject || '기타'}${item.content ? ` - ${item.content}` : ''}`
  }));

  const breakdownSubjects = Array.from(
    new Set(['국어', '수학', '영어', '탐구', '기타', ...Object.keys(todaySubjectsWithTimer), ...todayPlannerItems.map((item) => item.subject || '기타')])
  );
  const breakdownDetailMap = breakdownSubjects.reduce((acc, subject) => {
    acc[subject] = todayPlannerItems
      .filter((item) => (item.subject || '기타') === subject)
      .map((item) => ({
        content: item.content || '학습 내용 없음',
        plannedHour: (item.minutes || 0) / 60,
        actualHour: (item.doneMinutes || 0) / 60
      }));
    return acc;
  }, {});

  const myRank = Math.max(1, 160 - Math.floor(todayStudySeconds / 60));
  const percentile = Math.max(1, Math.min(100, 100 - Math.floor(todayStudySeconds / 120)));
  const rankingProgress = Math.max(5, 100 - percentile);
  const rankTier = percentile <= 5 ? 'diamond' : percentile <= 15 ? 'platinum' : percentile <= 30 ? 'gold' : percentile <= 60 ? 'silver' : 'bronze';
  const rankTierLabel = rankTier === 'diamond' ? 'DIAMOND' : rankTier === 'platinum' ? 'PLATINUM' : rankTier === 'gold' ? 'GOLD' : rankTier === 'silver' ? 'SILVER' : 'BRONZE';

  return {
    liveCurrentScore,
    homeTargets,
    todayPlannerItems,
    todayPlannerTotalMinutes,
    todayPlannerSubjectSummary,
    todayRecord,
    todayStudySeconds,
    todayPlannerProgress,
    todaySubjectsWithTimer,
    plannedScheduleOptions,
    breakdownSubjects,
    breakdownDetailMap,
    myRank,
    percentile,
    rankingProgress,
    rankTier,
    rankTierLabel
  };
}

// 분석 화면 derived (원본 js/studycrack-mobile.js 분석 계산 블록과 동일).
export function buildAnalysisDerived(state = {}) {
  const {
    scores = {},
    targetMajor = '',
    analysisTargetList = [],
    homeTargetList = [],
    analysisSearchTerm = '',
    universityCatalog = [],
    analysisResults = [],
    analysisSimulations = []
  } = state;

  const liveCurrentScore = computeLiveCurrentScore(scores);

  const serverSelected = findTargetItem(analysisResults, targetMajor);
  const serverSimulation = findTargetItem(analysisSimulations, targetMajor);
  const serverScore = Number(serverSelected?.converted_score);
  const hasServerScore = Number.isFinite(serverScore);
  const analysisBaseProfile = ANALYSIS_PROFILES[targetMajor] || ANALYSIS_PROFILES['연세대학교 경영학과'];
  const analysisSelected = {
    ...analysisBaseProfile,
    score: hasServerScore ? Math.round(serverScore) : liveCurrentScore,
    verdict: serverSelected?.status || analysisBaseProfile.verdict,
    verdictColor: serverSelected?.color || analysisBaseProfile.verdictColor,
    aiGrade: serverSelected?.status || analysisBaseProfile.aiGrade,
    comment: serverSelected?.msg || analysisBaseProfile.comment,
    sim: (analysisBaseProfile.sim || []).map((r, idx) => {
      const boost = Math.max(0, Math.round((liveCurrentScore - 60) / 10));
      const g = Number(String(r[1]).replace(/[^0-9.-]/g, '')) || 0;
      const totalGain = Math.round(g + boost);
      return [r[0], `+${totalGain}점`, r[2], idx === 0];
    })
  };

  const analysisRecommended = ANALYSIS_RECOMMENDED;
  const hasUniversityCatalog = Array.isArray(universityCatalog) && universityCatalog.length;
  const catalogPool = hasUniversityCatalog
    ? universityCatalog
    : ANALYSIS_SEARCH_SEED;
  const recommendedSearchPool = hasUniversityCatalog ? [] : analysisRecommended;
  const analysisSearchPool = Array.from(
    new Set([...catalogPool, ...(analysisTargetList || []), ...(homeTargetList || []), ...recommendedSearchPool])
  ).filter(Boolean);
  const normalizedSearchTerm = String(analysisSearchTerm || '').trim().toLowerCase().replace(/\s+/g, '');
  const analysisSearchList = analysisSearchPool
    .filter((name) => {
      if (!normalizedSearchTerm) return true;
      return String(name).toLowerCase().replace(/\s+/g, '').includes(normalizedSearchTerm);
    })
    .slice(0, normalizedSearchTerm ? 80 : 30);

  const analysisGaugeFill = Math.min((analysisSelected.score / 250) * 100, 100);
  const analysisGaugeColor =
    serverSelected?.color || (analysisSelected.score >= 150 ? '#22C55E' : analysisSelected.score >= 100 ? '#2563EB' : '#F97316');
  const analysisStatus = serverSelected?.status || (analysisSelected.score >= 150 ? '초안정' : analysisSelected.score >= 100 ? '적정' : '위험');
  const analysisStatusColor =
    serverSelected?.color || (analysisSelected.score >= 150 ? '#22C55E' : analysisSelected.score >= 100 ? '#0B6BFF' : '#F97316');

  const serverSimRows = buildServerSimRows(serverSimulation);
  const analysisSimRows = serverSimRows.length ? serverSimRows : [];
  const analysisSimMax = Math.max(...analysisSimRows.map(({ gainNum }) => gainNum), 0);
  const analysisSimRecommendedIndex = analysisSimRows.findIndex(({ gainNum }) => gainNum === analysisSimMax);
  const analysisTargetScore = analysisSimMax
    ? Math.min(250, Math.max(analysisSelected.score, Math.round(analysisSelected.score + analysisSimMax)))
    : Math.round(analysisSelected.score);

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
  const serverSimulationTargets = (analysisResults || [])
    .map((item) => {
      const major = targetFullName(item);
      const score = Number(item.converted_score);
      if (!major || !Number.isFinite(score)) return null;
      return {
        major,
        label: compactTargetLabel(major),
        score: Math.round(score),
        cut: 100,
        gap: score - 100
      };
    })
    .filter(Boolean);
  const fallbackSimulationTargets = (analysisSimulationBaseOrder.length ? analysisSimulationBaseOrder : [targetMajor])
    .filter(Boolean)
    .map((major) => {
      const base = homeTargets.find((item) => item.major === major) || homeTargets[0];
      const score = Number(base?.score || liveCurrentScore || 0);
      const cut = Number(base?.cut || 100);
      return {
        major,
        label: compactTargetLabel(major),
        score,
        cut,
        gap: score - cut
      };
    });
  const analysisSimulationTargets = serverSimulationTargets.length ? serverSimulationTargets : fallbackSimulationTargets;

  return {
    analysisSelected,
    analysisRecommended,
    analysisSearchList,
    analysisGaugeFill,
    analysisGaugeColor,
    analysisTargetScore,
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

// 성적 정보 화면 derived. 과목별 원점수/표준/백분위/등급 행 HTML을 1:1 생성(원본 scoreInfoDetailList).
// plannerViewDonutGradient 선례처럼 derived가 표현용 문자열을 반환한다.
export function buildScoreInfoDerived(state = {}) {
  const { scores = {}, scoreEditState = {}, scoreExamKey = '', scoreExamType = '', user = {} } = state;
  const examKey = scoreExamKey || scoreExamTypeToKey(scoreExamType);
  const examData = user?.quantitative?.[examKey] || null;
  if (examData) {
    const rows = [
      [examData.kor?.opt || '국어', examData.kor],
      [examData.math?.opt || '수학', examData.math],
      ['영어', examData.eng, 'grade-only'],
      [examData.inq1?.name || '탐구1', examData.inq1],
      [examData.inq2?.name || '탐구2', examData.inq2],
      ['한국사', examData.hist || examData.history, 'grade-only']
    ];
    const scoreInfoDetailList = rows
      .map(([subject, item, type]) => {
        if (type === 'grade-only') {
          return `<div class="score-info-detail-row"><b>${subject}</b><span>${item?.raw || '-'}</span><span>${item?.std || '-'}</span><span>${item?.pct || '-'}</span><span>${item?.grd || '-'}</span></div>`;
        }
        return `<div class="score-info-detail-row"><b>${subject}</b><span>${item?.raw || '-'}</span><span>${item?.std || '-'}</span><span>${item?.pct || '-'}</span><span>${item?.grd || '-'}</span></div>`;
      })
      .join('');
    return { scoreInfoDetailList };
  }
  const ses = {
    korean: scoreEditState.korean || {},
    math: scoreEditState.math || {},
    inquiry1: scoreEditState.inquiry1 || {},
    inquiry2: scoreEditState.inquiry2 || {},
    english: scoreEditState.english,
    history: scoreEditState.history
  };

  const scoreRows = [
    [ses.korean.type || '국어', scores.korean, 'raw'],
    [ses.math.type || '수학', scores.math, 'raw'],
    ['영어', scores.english, 'grade-only'],
    [ses.inquiry1.subject || '탐구1', scores.inquiry1, 'raw'],
    [ses.inquiry2.subject || '탐구2', scores.inquiry2, 'raw']
  ];

  const scoreInfoDetailList =
    scoreRows
      .map(([subject, raw, type]) => {
        if (type === 'grade-only') {
          const englishGrade = Number(ses.english || 0)
            || (Number(raw) > 0 ? Math.min(9, Math.max(1, Math.round((100 - Number(raw || 0)) / 12.5) + 1)) : '');
          return `<div class="score-info-detail-row"><b>${subject}</b><span>-</span><span>-</span><span>-</span><span>${englishGrade || '-'}</span></div>`;
        }
        const m = scoreMetric(raw);
        const rawText = Number(raw) > 0 ? raw : '-';
        const stdText = Number(raw) > 0 ? m.std : '-';
        const pctText = Number(raw) > 0 ? m.pct : '-';
        const grdText = Number(raw) > 0 ? m.grade : '-';
        return `<div class="score-info-detail-row"><b>${subject}</b><span>${rawText}</span><span>${stdText}</span><span>${pctText}</span><span>${grdText}</span></div>`;
      })
      .join('') +
    `<div class="score-info-detail-row"><b>한국사</b><span>-</span><span>-</span><span>-</span><span>${ses.history ? Math.max(1, Number(ses.history) || 1) : '-'}</span></div>`;

  return { scoreInfoDetailList };
}

// 도메인 derived 집계. liveStudySeconds는 라이브 타이머 ref의 현재값(없으면 0).
export function buildDerivedContext(state = {}, liveStudySeconds = 0) {
  return {
    ...buildPlannerDerived(state),
    ...buildHomeDerived(state, liveStudySeconds),
    ...buildAnalysisDerived(state),
    ...buildScoreInfoDerived(state)
  };
}
