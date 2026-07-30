import { TODAY_DATE } from '../constants/runtime-defaults.js';
import {
  computeDday,
  eventCoversDate,
  eventMarksDateInGrid,
  formatDdayLabel,
  getNearestUpcomingEvent,
  getOfficialAdmissionEvents,
  mergeCalendarEvents
} from '../constants/admission-calendar.js';
import { scoreExamTypeToKey } from './persistence.js';

// 런타임 derived view-model: 원시 state에서 화면 renderer가 기대하는 계산값을 파생.
// 모놀리식 App() 본문의 계산을 도메인별 순수 함수로 이식한다(로직 1:1 유지).

const PLANNER_VIEW_PALETTE = { 국어: '#8B5CF6', 수학: '#3B82F6', 영어: '#14B8A6', 탐구: '#F97316', 기타: '#64748B' };
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const LEGACY_PLANNER_YEAR_MONTH = '2026-07';

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parsePlannerDate(value = TODAY_DATE) {
  const raw = String(value || '').trim();
  const source = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : `${LEGACY_PLANNER_YEAR_MONTH}-${String(Math.max(1, Math.min(31, Number(raw) || Number(TODAY_DATE.split('-')[2]) || 1))).padStart(2, '0')}`;
  const [year, month, day] = source.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addPlannerDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function normalizePlannerDateKey(value = TODAY_DATE) {
  return toDateKey(parsePlannerDate(value));
}

function plannerStartSortValue(item = {}, index = 0) {
  const match = String(item.start || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return 99999 + index;
  return Number(match[1]) * 60 + Number(match[2]);
}

// 플래너 항목을 날짜별로 그룹(원본 plannerItemsByDate). planner/home derived 공유.
function groupPlannerByDate(plannerItems = []) {
  const grouped = plannerItems.reduce((acc, item, idx) => {
    const dateKey = normalizePlannerDateKey(item.date);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push({ ...item, __plannerSortIndex: idx });
    return acc;
  }, {});
  Object.keys(grouped).forEach((dateKey) => {
    grouped[dateKey] = grouped[dateKey]
      .sort((a, b) => plannerStartSortValue(a, a.__plannerSortIndex) - plannerStartSortValue(b, b.__plannerSortIndex))
      .map(({ __plannerSortIndex, ...item }) => item);
  });
  return grouped;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderScoreInfoCard({ grade = '', pct = '', raw = '', std = '', subject = '' } = {}) {
  const rawText = raw || '-';
  const stdText = std || '-';
  const pctText = pct || '-';
  const gradeText = grade || '-';
  return `<article class="score-info-subject-card"><div><b>${escapeHtml(subject)}</b><strong>${escapeHtml(rawText)}${rawText !== '-' ? '점' : ''}</strong></div><dl><div><dt>표준</dt><dd>${escapeHtml(stdText)}</dd></div><div><dt>백분위</dt><dd>${escapeHtml(pctText)}</dd></div><div><dt>등급</dt><dd>${escapeHtml(gradeText)}</dd></div></dl></article>`;
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

// 플래너 화면 derived.
export function buildPlannerDerived(state = {}) {
  const { plannerItems = [], selectedDate = TODAY_DATE, plannerEditIndex = null } = state;

  const selectedDateObject = parsePlannerDate(selectedDate);
  const selectedPlannerDateKey = toDateKey(selectedDateObject);
  const selectedYear = selectedDateObject.getFullYear();
  const selectedMonth = selectedDateObject.getMonth() + 1;
  const plannerMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();
  const plannerMonthLabel = `${selectedYear}년 ${selectedMonth}월`;
  const selectedPlannerDate = String(selectedDateObject.getDate());
  const selectedPlannerWeekday = WEEKDAY_LABELS[selectedDateObject.getDay()];

  const plannerItemsByDate = groupPlannerByDate(plannerItems);
  const plannerCalendarWeekStart = addPlannerDays(selectedDateObject, -selectedDateObject.getDay());
  const plannerWeekDates = Array.from({ length: 7 }, (_, idx) => {
    const date = addPlannerDays(plannerCalendarWeekStart, idx);
    return { day: String(date.getDate()), date: toDateKey(date), weekday: WEEKDAY_LABELS[date.getDay()], empty: false };
  });
  const plannerCalendarWeekDates = Array.from({ length: 7 }, (_, idx) => {
    const date = addPlannerDays(plannerCalendarWeekStart, idx);
    const dateKey = toDateKey(date);
    const items = plannerItemsByDate[dateKey] || [];
    return {
      day: String(date.getDate()),
      date: dateKey,
      weekday: WEEKDAY_LABELS[date.getDay()],
      empty: false,
      count: items.length,
      minutes: items.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0)
    };
  });
  const firstPlannerWeekday = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  const plannerCalendarMonthCells = [
    ...Array.from({ length: firstPlannerWeekday }, (_, idx) => ({ key: `blank-${idx}`, blank: true })),
    ...Array.from({ length: plannerMonthDays }, (_, idx) => {
      const day = String(idx + 1);
      const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${day.padStart(2, '0')}`;
      const items = plannerItemsByDate[dateKey] || [];
      return {
        key: dateKey,
        day,
        date: dateKey,
        blank: false,
        isSelected: selectedPlannerDateKey === dateKey,
        isToday: TODAY_DATE === dateKey,
        count: items.length,
        minutes: items.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0)
      };
    })
  ];

  const plannerViewItems = plannerItemsByDate[selectedPlannerDateKey] || [];
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
    plannerCalendarWeekDates,
    plannerCalendarMonthCells,
    plannerItemsByDate,
    plannerMonthDays,
    plannerMonthLabel,
    selectedPlannerDateKey,
    selectedPlannerDate,
    selectedPlannerWeekday,
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
  const {
    targetMajor = '',
    homeTargetList = [],
    analysisResults = [],
    analysisApiStatus = 'idle',
    lastAnalysisSnapshot = null,
    scoreExamKey = '',
    scoreExamType = ''
  } = state;
  // 홈 AI 점수는 서버 환산점수(converted_score)만 표시한다. 대학과 무관한 라이브 점수로 폴백하면
  // 비동기 로드 중 서버↔라이브↔0이 뒤바뀌어 "점수가 그때그때 다르고 0으로 리셋"되는 불안정이 생긴다(웹엔 없는 현상).
  // 재요청 중에는 examMode가 일치하는 직전 확정 스냅샷으로 폴백해 확정 점수를 유지하고, 없으면 분석중 스켈레톤을 보인다.
  const currentExamMode = scoreExamKey || scoreExamTypeToKey(scoreExamType);
  const snapshotResults =
    lastAnalysisSnapshot && lastAnalysisSnapshot.examMode === currentExamMode
      ? lastAnalysisSnapshot.analysisResults || []
      : [];
  const resultsForLookup = analysisResults.length ? analysisResults : snapshotResults;
  // 분석 결과가 아직 도착 전(idle/loading)이면 0을 "확정 점수"처럼 보여주지 않고 pending 상태로 표기.
  const analysisPending = analysisApiStatus === 'loading' || analysisApiStatus === 'idle';
  const orderedHomeTargetMajors = Array.from(
    new Set([...(targetMajor ? [targetMajor] : []), ...(homeTargetList || [])])
  ).filter(Boolean);
  return orderedHomeTargetMajors.map((major) => {
    const serverItem = findTargetItem(resultsForLookup, major);
    const serverScore = Number(serverItem?.converted_score);
    const hasServerScore = Number.isFinite(serverScore);
    // 점수 출처: 서버 환산점수(confirmed) > 미확정(pending: 분석 대기) / 빈값(empty: 결과 없음)
    const score = hasServerScore ? Math.round(serverScore) : 0;
    const scoreStatus = hasServerScore ? 'confirmed' : analysisPending ? 'pending' : 'empty';
    // confirmed 값이 떠 있는 동안 재요청 중이면 갱신 표시(이전 값 유지, 0점 추락 방지).
    const scoreUpdating = analysisApiStatus === 'loading' && hasServerScore;
    const cut = 100;
    const gap = score - cut;
    return {
      major,
      score,
      scoreStatus,
      scoreUpdating,
      cut,
      gap: gap > 0 ? `+${gap}` : String(gap),
      rank: serverItem?.status || (score >= 150 ? '안정' : score >= 100 ? '합격권' : '도전'),
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
  const norm = (value) => String(value || '').replace(/\s+/g, '');
  const target = norm(targetMajor);
  if (!target || !Array.isArray(list)) return null;
  // 1) 정확 일치(univ+major 결합) 우선.
  const exact = list.find((item) => norm(targetFullName(item)) === target);
  if (exact) return exact;
  // 2) 부분 포함 허용: 백엔드가 대학/학과명을 정규화해 입력 문자열과 미세하게 달라도
  //    (예: 입력 "서울대학교 경영학과" vs 응답 major "경영") 환산점수가 누락되지 않도록 한다.
  //    대학명이 타겟에 포함되고, 남은 학과 부분이 서로 포함관계면 동일 대상으로 본다.
  return (
    list.find((item) => {
      const univ = norm(item.univ);
      const major = norm(item.major);
      if (!univ || !target.includes(univ)) return false;
      if (!major) return true;
      const rest = target.replace(univ, '');
      return !rest || rest.includes(major) || major.includes(rest);
    }) || null
  );
}

const SIM_SUBJECT_ORDER = ['kor', 'math', 'inq1', 'inq2'];
const SIM_SUBJECT_FALLBACK = { kor: '국어', math: '수학', inq1: '탐구1', inq2: '탐구2' };

function buildServerSimRows(simulation) {
  const simData = simulation?.sim_data || {};
  const baseUiScore = Number(simulation?.base_ui_score);
  const hasBaseUiScore = Number.isFinite(baseUiScore);
  return SIM_SUBJECT_ORDER
    .map((key, idx) => {
      const item = simData[key];
      if (!item) return null;
      const gainNum = Number(item.uiDiff ?? item.diff ?? 0);
      const rounded = Number.isFinite(gainNum) ? Math.max(0, gainNum) : 0;
      const afterUiScore = Number(item.afterUiScore ?? item.after_ui_score);
      const rawNeededMatch = String(item.msg || '').match(/원점수\s*\+(\d+)점\s*필요/);
      const rawNeeded = Number(item.rawNeeded ?? item.raw_needed ?? (rawNeededMatch ? Number(rawNeededMatch[1]) : 1)) || 1;
      return {
        key,
        subject: item.name || SIM_SUBJECT_FALLBACK[key] || key,
        gain: `+${rounded.toFixed(rounded >= 10 ? 0 : 1)}점`,
        desc: item.msg || (rounded > 0 ? '점수 상승으로 합격 가능성이 높아집니다.' : '현재 조건에서는 상승 효율이 낮습니다.'),
        gainNum: rounded,
        baseUiScore: hasBaseUiScore ? baseUiScore : null,
        afterUiScore: Number.isFinite(afterUiScore) ? afterUiScore : (hasBaseUiScore ? baseUiScore + rounded : null),
        rawNeeded,
        firstPositiveUiDiff: Number(item.firstPositiveUiDiff ?? item.first_positive_ui_diff ?? 0) || 0,
        isEvaporation: rounded <= 0,
        needsBacktrace: simulation?.needs_backtrace === true,
        backtracePlan: simulation?.backtrace_plan || null,
        idx
      };
    })
    .filter(Boolean);
}

// 홈 화면 derived.
// liveStudySeconds: 라이브 타이머 ref의 현재값.
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
  const todayDateKey = TODAY_DATE;
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
  const todayKey = TODAY_DATE;
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

  const rankingMe = state.rankingStatus === 'ready' ? state.rankingMe : null;
  const myRank = Number(rankingMe?.rank) || 0;
  const rankingTotal = Number(rankingMe?.total) || 0;
  const percentile = myRank && rankingTotal ? Math.max(1, Math.min(100, Math.ceil((myRank / rankingTotal) * 100))) : 0;
  const rankingProgress = percentile ? Math.max(5, 100 - percentile) : 0;
  const rankTierLabel = String(rankingMe?.tier || 'BRONZE').toUpperCase();
  const rankTier = rankTierLabel.toLowerCase();

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
    rankingTotal,
    percentile,
    rankingProgress,
    rankTier,
    rankTierLabel
  };
}

// 분석 화면 derived.
export function buildAnalysisDerived(state = {}) {
  const {
    targetMajor = '',
    analysisTargetList = [],
    homeTargetList = [],
    analysisSearchTerm = '',
    universityCatalog = [],
    universitySelectedName = '',
    universityRecommendations = [],
    analysisResults = [],
    analysisSimulations = [],
    lastAnalysisSnapshot = null
  } = state;
  const effectiveAnalysisResults = analysisResults.length ? analysisResults : (lastAnalysisSnapshot?.analysisResults || []);
  const effectiveAnalysisSimulations = analysisSimulations.length ? analysisSimulations : (lastAnalysisSnapshot?.analysisSimulations || []);

  const serverSelected = findTargetItem(effectiveAnalysisResults, targetMajor);
  const serverSimulation = findTargetItem(effectiveAnalysisSimulations, targetMajor);
  const serverScore = Number(serverSelected?.converted_score);
  const hasServerScore = Number.isFinite(serverScore);
  const analysisSelected = {
    score: hasServerScore ? Math.round(serverScore) : 0,
    verdict: serverSelected?.status || '',
    verdictColor: serverSelected?.color || '',
    aiGrade: serverSelected?.status || '',
    comment: serverSelected?.msg || '',
    sim: []
  };

  const analysisRecommended = universityRecommendations;
  const hasUniversityCatalog = Array.isArray(universityCatalog) && universityCatalog.length;
  const normalizedSearchTerm = String(analysisSearchTerm || '').trim().toLowerCase().replace(/\s+/g, '');
  const selectedCatalog = hasUniversityCatalog
    ? universityCatalog.find((item) => item.univName === universitySelectedName)
    : null;
  const universityNames = hasUniversityCatalog ? universityCatalog.map((item) => item.univName) : [];
  const analysisSearchList = (universitySelectedName
    ? (selectedCatalog?.majors || []).map((major) => `${universitySelectedName} ${major}`)
    : universityNames)
    .filter((name) => !normalizedSearchTerm || String(name).toLowerCase().replace(/\s+/g, '').includes(normalizedSearchTerm))
    .slice(0, normalizedSearchTerm ? 80 : 40);

  const analysisGaugeFill = Math.min((analysisSelected.score / 250) * 100, 100);
  const analysisGaugeColor =
    serverSelected?.color || (hasServerScore ? (analysisSelected.score >= 150 ? '#22C55E' : analysisSelected.score >= 100 ? '#2563EB' : '#F97316') : '');
  const analysisStatus = serverSelected?.status || (hasServerScore ? (analysisSelected.score >= 150 ? '초안정' : analysisSelected.score >= 100 ? '적정' : '위험') : '');
  const analysisStatusColor =
    serverSelected?.color || (hasServerScore ? (analysisSelected.score >= 150 ? '#22C55E' : analysisSelected.score >= 100 ? '#0B6BFF' : '#F97316') : '');

  const serverSimRows = buildServerSimRows(serverSimulation);
  const analysisSimRows = serverSimRows.length ? serverSimRows : [];
  const analysisSimMax = Math.max(...analysisSimRows.map(({ gainNum }) => gainNum), 0);
  const analysisSimRecommendedIndex = analysisSimRows.findIndex(({ gainNum }) => gainNum === analysisSimMax);
  const analysisScore = Math.round(Number(analysisSelected.score) || 0);
  const reachTargetScore = analysisScore < 100
    ? 100
    : analysisScore < 150
      ? 150
      : Math.min(250, analysisScore + analysisSimMax);
  const analysisTargetScore = analysisSimMax
    ? Math.min(250, Math.max(analysisScore, reachTargetScore))
    : analysisScore;

  const gaugeTotal = 250;
  const gaugeCurrent = Math.max(0, Math.min(gaugeTotal, analysisScore));
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

  const serverSimulationTargets = (effectiveAnalysisResults || [])
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
  const analysisSimulationTargets = serverSimulationTargets;

  return {
    analysisSelected,
    analysisRecommended,
    analysisSearchList,
    universitySelectedName,
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
        return renderScoreInfoCard({
          subject,
          raw: type === 'grade-only' ? '' : item?.raw,
          std: item?.std,
          pct: item?.pct,
          grade: item?.grd
        });
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
          return renderScoreInfoCard({ subject, grade: englishGrade || '-' });
        }
        const m = scoreMetric(raw);
        const rawText = Number(raw) > 0 ? raw : '-';
        const stdText = Number(raw) > 0 ? m.std : '-';
        const pctText = Number(raw) > 0 ? m.pct : '-';
        const grdText = Number(raw) > 0 ? m.grade : '-';
        return renderScoreInfoCard({ subject, raw: rawText, std: stdText, pct: pctText, grade: grdText });
      })
      .join('') +
    renderScoreInfoCard({ subject: '한국사', grade: ses.history ? Math.max(1, Number(ses.history) || 1) : '-' });

  return { scoreInfoDetailList };
}

// 도메인 derived 집계. liveStudySeconds는 라이브 타이머 ref의 현재값(없으면 0).
const CALENDAR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

// 수험 일정 캘린더 파생: 병합 일정, 최근접 일정/D-day, 월간 그리드, 선택일 일정.
export function buildCalendarDerived(state = {}) {
  const today = TODAY_DATE;
  const personalEvents = Array.isArray(state.personalEvents) ? state.personalEvents : [];
  const todayYear = Number(today.slice(0, 4));
  const officialEvents = getOfficialAdmissionEvents(todayYear);
  const calendarEvents = mergeCalendarEvents(officialEvents, personalEvents);

  const nearestEvent = getNearestUpcomingEvent(calendarEvents, today);
  const calendarNearestDdayLabel = nearestEvent ? formatDdayLabel(nearestEvent.date, today) : '';
  const calendarNearestDday = nearestEvent ? computeDday(nearestEvent.date, today) : null;

  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(state.calendarMonthAnchor || '')
    ? state.calendarMonthAnchor
    : `${today.slice(0, 7)}-01`;
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)); // 1-12
  const calendarMonthLabel = `${year}년 ${month}월`;
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month, 0).getDate();
  const selected = state.calendarSelectedDate || today;

  const calendarMonthCells = [];
  for (let i = 0; i < firstWeekday; i += 1) calendarMonthCells.push({ blank: true, key: `b${i}` });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
    const dayMarks = calendarEvents.filter((e) => eventMarksDateInGrid(e, ymd));
    calendarMonthCells.push({
      blank: false,
      key: ymd,
      ymd,
      day,
      isToday: ymd === today,
      isSelected: ymd === selected,
      hasEvents: dayMarks.length > 0,
      eventDots: dayMarks.slice(0, 3).map((e) => ({ category: e.category, source: e.source }))
    });
  }

  const calendarSelectedEvents = calendarEvents.filter((e) => eventCoversDate(e, selected));

  return {
    calendarToday: today,
    calendarEvents,
    calendarNearestEvent: nearestEvent,
    calendarNearestDday,
    calendarNearestDdayLabel,
    calendarMonthLabel,
    calendarMonthYear: year,
    calendarMonthIndex: month,
    calendarWeekdays: CALENDAR_WEEKDAYS,
    calendarMonthCells,
    calendarSelectedEvents,
    calendarUnreadCount: 0
  };
}

export function buildDerivedContext(state = {}, liveStudySeconds = 0) {
  return {
    ...buildPlannerDerived(state),
    ...buildHomeDerived(state, liveStudySeconds),
    ...buildAnalysisDerived(state),
    ...buildScoreInfoDerived(state),
    ...buildCalendarDerived(state)
  };
}
