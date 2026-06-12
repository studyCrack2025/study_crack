import { renderModal } from '../../components/modal.js';
import { renderSheet } from '../../components/sheet.js';
import { CRACKY_SRC } from '../../constants/assets.js';

const DEFAULT_MENU_ITEMS = [
  ['analysis', '분석'],
  ['strategy', '학습 코칭'],
  ['planner', '플래너'],
  ['weekly', '주간 점검'],
  ['report', '프로 보고서']
];

const DEFAULT_STUDY_SUBJECTS = ['국어', '수학', '영어', '탐구'];

function defaultScoreTierClass(score) {
  const n = Number(score) || 0;
  if (n <= 100) return 'score-tier-low';
  if (n <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

function defaultFormatHms(total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const h = Math.floor(safeTotal / 3600);
  const m = Math.floor((safeTotal % 3600) / 60);
  const s = safeTotal % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function defaultFormatMinutesLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safeMinutes / 60);
  const min = safeMinutes % 60;
  if (hour && min) return `${hour}시간 ${min}분`;
  if (hour) return `${hour}시간`;
  return `${min}분`;
}

function renderUniversityCard({ item, plannerBadges, scoreTierClass }) {
  return `<button class="university-card-slide card home-kpi-card admission-card slider-card home-result-card-v3" data-action="selectUniversity" data-target-major="${item.major}">
          <span class="home-univ-remove" data-action="removeAnalysisTarget" data-target-major="${item.major}">✕</span>
          <div class="home-result-top"><div><p class="home-result-major">${item.major}</p><span class="home-result-state">${item.rank}</span></div><div class="home-result-score"><strong>${item.score}점</strong><small>AI 점수</small></div></div>
          <div class="home-result-gauge"><i class="${scoreTierClass(item.score)}" style="width:${Math.min((item.score / 250) * 100, 100)}%"></i><span class="cut pass" style="left:40%"></span><span class="cut safe" style="left:60%"></span></div>
          <div class="home-result-gauge-meta"><span>0</span><span>합격컷 100</span><span>안정컷 150</span><span>MAX 250</span></div>
          <div class="kpi-row score-row"><div class="kpi-item"><b>${item.score}점</b>현재 점수</div><div class="kpi-item"><b>${item.cut}점</b>합격 컷</div><div class="kpi-item danger"><b>${item.gap}점</b>부족 점수</div></div>
          <div class="home-planner-badges chip-row">${plannerBadges.map((badge) => `<span class="chip">${badge}</span>`).join('')}</div>
        </button>`;
}

function renderUniversityModal(ctx) {
  const {
    analysisRecommended = [],
    analysisSearchList = [],
    analysisSearchTerm = '',
    analysisTargetList = [],
    universityModalOpen = false
  } = ctx;

  if (!universityModalOpen) return '';

  const body = `<div class="analysis-search-head"><h4>희망 대학 선택</h4><button data-action="closeUniversityModal">✕</button></div><div class="analysis-search-inline"><input class="planner-input" data-field="analysisSearchTerm" value="${analysisSearchTerm}" placeholder="대학명 또는 학과명을 검색하세요"/><button type="button" class="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div><div class="analysis-search-section recommend"><p>현재 성적 기준 추천</p><div class="analysis-search-rec-grid">${analysisRecommended.map((name) => `<button class="analysis-rec-card" data-action="addAnalysisTarget" data-target-major="${name}"><div><strong>${name}</strong><span class="badge">추천</span></div><em>${analysisTargetList.includes(name) ? '추가됨' : '선택'}</em></button>`).join('')}</div></div><div class="analysis-search-section"><p>검색 결과</p>${analysisSearchList.map((name) => `<button class="analysis-search-row" data-action="addAnalysisTarget" data-target-major="${name}">${name}<span>${analysisTargetList.includes(name) ? '추가됨' : '추가'}</span></button>`).join('')}</div>`;

  return renderModal({ dismissAction: 'closeUniversityModal', body });
}

function renderStudyBreakdown(ctx) {
  const {
    breakdownDetailMap = {},
    breakdownSubjects = [],
    expandedBreakdownSubject = '',
    formatHms = defaultFormatHms,
    showStudyBreakdown = false,
    todaySubjectsWithTimer = {}
  } = ctx;

  if (!showStudyBreakdown) return '';

  return `<div class="home-breakdown-list">${breakdownSubjects.map((subject) => {
    const sec = todaySubjectsWithTimer[subject] || 0;
    const rows = breakdownDetailMap[subject] || [];
    const expanded = expandedBreakdownSubject === subject;
    return `<button class="home-breakdown-item" data-action="toggleBreakdownSubject" data-breakdown-subject="${subject}"><div><b>${subject}</b><small style="margin-left:6px;color:#1D4ED8;font-weight:800;">${rows.length}개 항목</small><span>${formatHms(sec)}</span></div></button>${expanded ? `<div class="home-breakdown-detail">${rows.length ? rows.map((row) => {
      const plannedSec = Math.round(row.plannedHour * 3600);
      const actualSec = Math.round(row.actualHour * 3600);
      const rate = plannedSec > 0 ? Math.min(100, Math.round((actualSec / plannedSec) * 100)) : 0;
      return `<div class="home-breakdown-detail-row"><small>${row.content}</small><em>계획 ${formatHms(plannedSec)} · 실제 ${formatHms(actualSec)}</em><span>${rate}%</span></div>`;
    }).join('') : '<p>오늘 등록된 학습 계획이 없습니다</p>'}</div>` : ''}`;
  }).join('')}</div>`;
}

function renderStudySubjectSheet(ctx) {
  const {
    plannedScheduleOptions = [],
    studySubjectSheetOnlyPlanned = false,
    studySubjectSheetOpen = false
  } = ctx;

  if (!studySubjectSheetOpen) return '';

  const freeSubjects = studySubjectSheetOnlyPlanned
    ? ''
    : `<div class="study-subject-grid">${DEFAULT_STUDY_SUBJECTS.map((subject) => `<button class="planner-pill" data-action="selectStudySubject" data-study-subject="${subject}">${subject}</button>`).join('')}<button class="planner-pill" data-action="selectStudySubjectCustom">기타 직접 입력</button><button class="planner-pill" data-action="selectSelfStudy">자율공부</button></div>`;
  const planned = plannedScheduleOptions.length
    ? `<p class="sub" style="margin:8px 0 6px">오늘 플래너 일정</p><div class="study-subject-grid">${plannedScheduleOptions.map((row) => `<button class="planner-pill" data-action="selectStudySubject" data-study-subject="${row.subject}" data-study-item-id="${row.id}">${row.label}</button>`).join('')}</div>`
    : '<p class="sub" style="margin-top:8px">오늘 플래너 일정이 없습니다.</p>';

  const body = `<h3>어떤 과목을 공부할까요?</h3>${freeSubjects}${planned}`;
  return renderSheet({ panelClass: 'study-subject-sheet', dismissAction: 'closeStudySubjectSheet', body });
}

function renderNotificationModal(notifModalOpen = false) {
  if (!notifModalOpen) return '';
  const body = `<p class="home-modal-title">알림</p><div class="pro-notif-list"><div><b>주간 코칭 알림</b><p>이번 주 코칭 작성 마감이 오늘 20:00입니다.</p></div><div><b>PRO 리포트 알림</b><p>26년 4월 4주차 리포트가 도착했습니다.</p></div><div><b>플래너 알림</b><p>오늘 계획 3개 중 1개를 완료했어요.</p></div></div><button class="btn btn-primary" data-action="closeNotificationModal">확인</button>`;
  return renderModal({ panelClass: 'pro-notif-modal', dismissAction: 'closeNotificationModal', body });
}

function renderDrawer({ drawerOpen = false, icon, menuItems = DEFAULT_MENU_ITEMS }) {
  if (!drawerOpen) return '';
  return `<div class="home-modal-overlay drawer-overlay" data-action="closeDrawer"><aside class="side-drawer" data-action="noopModal"><h3>메뉴</h3>${menuItems.map(([target, label]) => `<button class="my-row" data-action="drawerGoto" data-target="${target}">${label}<span>${icon('chevron', false)}</span></button>`).join('')}</aside></div>`;
}

export function renderHomeView(ctx) {
  const {
    analysisRecommended = [],
    analysisSearchList = [],
    analysisSearchTerm = '',
    analysisTargetList = [],
    breakdownDetailMap = {},
    breakdownSubjects = [],
    crackySrc = CRACKY_SRC,
    drawerOpen = false,
    expandedBreakdownSubject = '',
    formatHms = defaultFormatHms,
    formatMinutesLabel = defaultFormatMinutesLabel,
    homeDragOffset = 0,
    homeSlideIndex = 0,
    homeSlideMotion = '',
    homeTargets = [],
    icon = () => '',
    myRank = 124,
    notifModalOpen = false,
    percentile = 100,
    plannedScheduleOptions = [],
    plannerBadges = [],
    rankingProgress = 0,
    rankTier = 'bronze',
    rankTierLabel = 'BRONZE',
    scoreTierClass = defaultScoreTierClass,
    showStudyBreakdown = false,
    studySubjectSheetOnlyPlanned = false,
    studySubjectSheetOpen = false,
    studyTimerRunning = false,
    todayPlannerItems = [],
    todayPlannerProgress = 0,
    todayPlannerSubjectSummary = [],
    todayPlannerTotalMinutes = 0,
    todayRecord = null,
    todayStudySeconds = 0,
    todaySubjectsWithTimer = {},
    universityModalOpen = false
  } = ctx;

  const slideTransition = homeDragOffset !== 0 ? '0s' : 'transform .72s cubic-bezier(.22,1,.36,1)';
  const universityCards = homeTargets.map((item) => renderUniversityCard({ item, plannerBadges, scoreTierClass })).join('');
  const indicators = [...homeTargets, { add: true }].map((_, idx) => `<i class="${idx === homeSlideIndex ? 'active' : ''}" data-action="setHomeSlide" data-slide-index="${idx}"></i>`).join('');
  const timerDisabled = studyTimerRunning ? 'disabled' : '';
  const stopDisabled = studyTimerRunning ? '' : 'disabled';
  const rankingShine = ['gold', 'platinum', 'diamond'].includes(rankTier) ? 'rank-shine' : '';

  return `<div class="home-dashboard home-container">
    <div class="home-content">
    <div class="home-header">
      <div class="home-top-icons">
        <button class="top-icon-btn" data-action="openNotificationModal">${icon('bell', false)}</button>
      </div>
      <div class="home-greeting-bubble">
        <img loading="lazy" decoding="async" src="${crackySrc}" class="home-greeting-cracky" alt="크랙이" />
        <div class="home-greeting-speech">
          <p class="home-greeting">안녕하세요, 지민님 👋</p>
          <p class="home-sub">오늘도 크랙한 하루 되세요!</p>
        </div>
      </div>
    </div>
    <div class="section home-section">
      <div class="home-kpi-slider">
        <div class="home-kpi-track anchor-volatile ${homeSlideMotion}" style="--home-slide-card-width:100%;--home-slide-gap:12px;--home-slide-x:calc(-${homeSlideIndex} * (var(--home-slide-card-width) + var(--home-slide-gap)) + ${homeDragOffset}px);--home-slide-transition:${slideTransition};">
        ${universityCards}<button class="university-card-slide university-card card slider-card home-add-univ-card" data-action="openAnalysisSearchFromHome"><b>+ 대학 추가</b><p>추천/검색으로 추가</p></button></div>
      </div>
      <div class="home-kpi-indicator card-indicator">${indicators}</div>
      <button class="pro-top-btn home-pro-below-card-btn" data-action="goto" data-target="proElite"><span>PRO LOUNGE 입장</span></button>
      ${renderUniversityModal({ analysisRecommended, analysisSearchList, analysisSearchTerm, analysisTargetList, universityModalOpen })}
    </div>
    <div class="section home-section home-section-last">
      <div class="card home-study-summary study-summary-card home-insight-card premium-panel">
        <div class="home-card-head"><p class="analysis-title">오늘 누적 공부</p><span class="home-mini-badge">${studyTimerRunning ? '진행중' : '대기'}</span></div>
        <div class="study-timer-row"><b class="timer premium-clock" data-study-base-seconds="${todayRecord?.studyTime || 0}">${formatHms(todayStudySeconds)}</b><div class="timer-actions"><button class="btn btn-primary mini ${timerDisabled}" data-action="openStudySubjectSheet" ${timerDisabled}>공부 시작</button><button class="btn btn-secondary mini ${stopDisabled}" data-action="stopStudyTimer" ${stopDisabled}>정지</button></div></div>
        <button type="button" class="home-breakdown-toggle" data-action="toggleStudyBreakdown">${showStudyBreakdown ? '접기' : '펼쳐보기'}</button>
        ${renderStudyBreakdown({ breakdownDetailMap, breakdownSubjects, expandedBreakdownSubject, formatHms, showStudyBreakdown, todaySubjectsWithTimer })}
      </div>
      <button class="card study-goal-card home-goal-linked-card home-insight-card premium-panel" data-action="goto" data-target="planner">
        <p class="analysis-title">오늘 공부 목표</p>
        ${todayPlannerItems.length ? `<div class="goal-compact"><b>${todayPlannerProgress}%</b><span>달성</span><em>${formatMinutesLabel(todayPlannerTotalMinutes)}</em></div><div class="track"><i style="width:${todayPlannerProgress}%"></i></div><div class="goal-tags">${todayPlannerSubjectSummary.slice(0, 3).map((value) => `<span>${value}</span>`).join('')}</div>` : `<p class="sub">오늘 계획을 추가해보세요</p><span class="home-goal-empty-cta">플래너로 이동</span>`}
      </button>
      <button type="button" class="card home-bottom-summary ranking-card home-insight-card premium-panel rank-tier-${rankTier} ${rankingShine}" data-action="goRanking">
        <div class="home-ranking-head"><p class="analysis-title">내 공부 랭킹</p><span class="badge">오늘 기준</span></div>
        <p class="home-ranking-main">${Math.min(myRank, 124)}등</p>
        <p class="home-ranking-tier">${rankTierLabel}</p>
        <p class="home-ranking-sub">전체 124명 중</p>
        <div class="home-ranking-progress"><i style="width:${rankingProgress}%"></i></div>
        <p class="home-ranking-foot">상위 ${percentile}%</p>
        <p class="home-ranking-tip">오늘 공부를 시작하면 순위가 올라가요</p>
      </button>
    </div>
    ${renderStudySubjectSheet({ plannedScheduleOptions, studySubjectSheetOnlyPlanned, studySubjectSheetOpen })}
    ${renderNotificationModal(notifModalOpen)}
    ${renderDrawer({ drawerOpen, icon })}
  </div>
  </div>`;
}

export function renderHomeScreen(ctx) {
  return ctx.layout(renderHomeView(ctx), true);
}
