import { renderCalendarSheet } from '../../components/calendar-sheet.js';
import { renderModal } from '../../components/modal.js';
import { renderSheet } from '../../components/sheet.js';
import { CRACKY_SRC } from '../../constants/assets.js';
import { formatCompactCalendarTitle } from '../../constants/admission-calendar.js';
import { EXAM_OPTIONS } from '../../constants/options.js';
import { buildMissionSubjectRows, getHomeScorePresentation } from './presentation.js';

const DEFAULT_MENU_ITEMS = [
  ['analysis', '분석'],
  ['strategy', '학습 코칭'],
  ['planner', '플래너'],
  ['weekly', '주간 점검'],
  ['report', '프로 보고서']
];

const DEFAULT_STUDY_SUBJECTS = ['국어', '수학', '영어', '탐구'];

function renderExamOptions(scoreExamType = '') {
  return EXAM_OPTIONS.map((label) => `<option value="${label}" ${scoreExamType === label ? 'selected' : ''}>${label}</option>`).join('');
}

export function defaultScoreTierClass(score) {
  const n = Number(score) || 0;
  if (n <= 100) return 'score-tier-low';
  if (n <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

export function defaultFormatHms(total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const h = Math.floor(safeTotal / 3600);
  const m = Math.floor((safeTotal % 3600) / 60);
  const s = safeTotal % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function defaultFormatMinutesLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safeMinutes / 60);
  const min = safeMinutes % 60;
  if (hour && min) return `${hour}시간 ${min}분`;
  if (hour) return `${hour}시간`;
  return `${min}분`;
}

function renderUniversityCard({ item, scoreTierClass }) {
  const score = getHomeScorePresentation(item);
  const major = escapeHtml(item.major);
  const scoreInner = score.pending
    ? '<strong class="home-score-skeleton" aria-label="분석 중"></strong>'
    : `<strong>${score.scoreValue}</strong>`;
  return `<button class="university-card-slide card home-kpi-card admission-card slider-card home-result-card-v3" data-action="selectUniversity" data-target-major="${major}">
          <div class="home-result-top"><div class="home-result-copy"><span class="home-result-eyebrow">선택 대학</span><p class="home-result-major">${major}</p><span class="home-result-state">${escapeHtml(item.rank)}</span></div><div class="home-result-score ${score.noScore ? 'is-pending' : ''} ${item.scoreUpdating ? 'is-updating' : ''}">${scoreInner}<small>${score.scoreLabel}</small></div><span class="home-univ-remove" data-action="removeAnalysisTarget" data-target-major="${major}">✕</span></div>
          <div class="home-result-gauge-panel"><div class="home-result-gauge"><i class="${scoreTierClass(score.score)}" style="width:${score.scorePct}%"></i><span class="cut pass" style="left:40%"></span><span class="cut safe" style="left:60%"></span></div><div class="home-result-gauge-meta"><span>0</span><span>합격컷 100</span><span>안정컷 150</span><span>MAX 250</span></div></div>
          <div class="home-result-kpi-panel"><div class="kpi-row score-row"><div class="kpi-item"><span>현재 환산점수</span><b>${score.scoreValue}</b></div><div class="kpi-item ${score.neededToPass > 0 ? 'danger' : 'success'}"><span>합격컷까지</span><b>${score.neededLabel}</b></div></div></div>
        </button>`;
}

export function renderUniversityModal(ctx) {
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

export function renderTargetDeleteModal(ctx = {}) {
  const {
    targetDeleteCandidate = '',
    targetDeleteError = '',
    targetDeleteModalOpen = false,
    targetDeleteSaving = false
  } = ctx;
  if (!targetDeleteModalOpen) return '';
  const body = `<div class="target-delete-modal-head"><span>목표 대학</span><h3>목표 대학에서 삭제할까요?</h3><p><b>${escapeHtml(targetDeleteCandidate)}</b>을 홈과 분석 탭의 지원학과 목록에서 함께 삭제합니다.</p></div>${targetDeleteError ? `<p class="target-delete-error">${escapeHtml(targetDeleteError)}</p>` : ''}<div class="support-btns target-delete-actions"><button type="button" class="btn btn-secondary" data-action="cancelTargetDelete" ${targetDeleteSaving ? 'disabled' : ''}>취소</button><button type="button" class="btn btn-primary danger" data-action="confirmTargetDelete" ${targetDeleteSaving ? 'disabled' : ''}>${targetDeleteSaving ? '삭제 중...' : '삭제'}</button></div>`;
  return renderModal({
    dismissAction: targetDeleteSaving ? 'noopModal' : 'cancelTargetDelete',
    panelClass: 'target-delete-modal',
    body
  });
}

export function renderStudyBreakdown(ctx) {
  const {
    breakdownDetailMap = {},
    breakdownSubjects = [],
    expandedBreakdownSubject = '',
    formatHms = defaultFormatHms,
    showStudyBreakdown = false,
    todaySubjectsWithTimer = {}
  } = ctx;

  if (!showStudyBreakdown) return '';

  if (!breakdownSubjects.length) return '<div class="home-breakdown-list"><p class="home-breakdown-empty">아직 과목별 공부 기록이 없습니다.</p></div>';

  return `<div class="home-breakdown-list">${breakdownSubjects.map((subject) => {
    const sec = todaySubjectsWithTimer[subject] || 0;
    const rows = breakdownDetailMap[subject] || [];
    const expanded = expandedBreakdownSubject === subject;
    return `<button type="button" class="home-breakdown-item ${expanded ? 'expanded' : ''}" data-action="toggleBreakdownSubject" data-breakdown-subject="${escapeHtml(subject)}"><span class="home-breakdown-subject"><b>${escapeHtml(subject)}</b><small>${rows.length}개 항목</small></span><span class="home-breakdown-time">${formatHms(sec)}</span></button>${expanded ? `<div class="home-breakdown-detail">${rows.length ? rows.map((row) => {
      const plannedSec = Math.round(row.plannedHour * 3600);
      const actualSec = Math.round(row.actualHour * 3600);
      const rate = plannedSec > 0 ? Math.min(100, Math.round((actualSec / plannedSec) * 100)) : 0;
      return `<div class="home-breakdown-detail-row"><small>${escapeHtml(row.content || '학습 항목')}</small><em>계획 ${formatHms(plannedSec)} · 실제 ${formatHms(actualSec)}</em><span>${rate}%</span></div>`;
    }).join('') : '<p class="home-breakdown-empty">오늘 등록된 학습 계획이 없습니다.</p>'}</div>` : ''}`;
  }).join('')}</div>`;
}

export function renderStudySubjectSheet(ctx) {
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

function reportStatusText(status = 'idle', hasItem = false) {
  if (status === 'loading') return '불러오는 중';
  if (status === 'error') return '확인 필요';
  return hasItem ? '생성됨' : '대기 중';
}

function renderHomeReportPreview({ proReports = [], proReportsStatus = 'idle', weeklyReports = [], weeklyReportsStatus = 'idle' } = {}) {
  const latestWeekly = weeklyReports[0] || null;
  const latestPro = proReports[0] || null;
  return `<section class="home-report-preview-section"><div class="home-card-head"><p class="analysis-title">리포트 미리보기</p><span class="home-mini-badge">학습 기록 기반</span></div><div class="home-report-preview-grid"><button type="button" class="home-report-preview-item" data-action="goto" data-target="weekly"><span>주간 리포트</span><b>${escapeHtml(latestWeekly?.title || latestWeekly?.weekId || '이번 주 학습 요약')}</b><small>${reportStatusText(weeklyReportsStatus, Boolean(latestWeekly))}</small></button><button type="button" class="home-report-preview-item pro" data-action="goto" data-target="report"><span>PRO 리포트</span><b>${escapeHtml(latestPro?.key ? `${latestPro.key} 전략 리포트` : '상위권 전략 리포트')}</b><small>${reportStatusText(proReportsStatus, Boolean(latestPro))}</small></button></div></section>`;
}

// 서버 알림 데이터(title/body)는 innerHTML로 들어가므로 XSS 방지 이스케이프 필수.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 미읽음 알림 개수(FAB badge용).
export function countUnreadNotifications(notiList = []) {
  if (!Array.isArray(notiList)) return 0;
  return notiList.reduce((sum, n) => (n && !n.isRead ? sum + 1 : sum), 0);
}

// 알림 팝오버: 우하단 FAB 위로 뜨는 부분 팝오버.
// 최근 알림 미리보기를 보여주고, 항목/전체 보기 클릭 시 알림 목록 화면(notificationList)으로 이동.
// 하위호환: 옛 시그니처(boolean notifModalOpen)도 허용.
const NOTIF_POPOVER_PREVIEW_COUNT = 4;

export function renderNotificationModal(ctx = {}) {
  const open = typeof ctx === 'boolean' ? ctx : ctx.notifModalOpen;
  if (!open) return '';
  const notiList = typeof ctx === 'object' && Array.isArray(ctx.notiList) ? ctx.notiList : [];
  const notiStatus = (typeof ctx === 'object' && ctx.notiStatus) || 'idle';
  const itemsHtml = notiList.length
    ? notiList
        .slice(0, NOTIF_POPOVER_PREVIEW_COUNT)
        .map(
          (n, idx) => {
            const id = String(n.notiId || n.id || n.notificationId || idx);
            return `<button type="button" class="notif-popover-item ${n.isRead ? '' : 'pro-notif-unread'}" data-action="openNotificationList" data-noti-id="${escapeHtml(id)}"><b>${escapeHtml(n.title)}</b><p>${escapeHtml(n.body || n.message || '')}</p></button>`;
          }
        )
        .join('')
    : `<div class="notif-popover-empty"><p>${
        notiStatus === 'loading'
          ? '알림을 불러오는 중...'
          : notiStatus === 'error'
            ? '알림을 불러오지 못했습니다.'
            : '새로운 알림이 없습니다.'
      }</p></div>`;
  const moreCount = Math.max(0, notiList.length - NOTIF_POPOVER_PREVIEW_COUNT);
  const footer = notiList.length
    ? `<button type="button" class="notif-popover-all" data-action="openNotificationList">${moreCount ? `알림 ${moreCount}건 더 보기` : '알림 전체 보기'}</button>`
    : '';
  return `<div class="notif-popover-overlay" data-action="closeNotificationModal"><div class="notif-popover" data-action="noopModal"><div class="notif-popover-head"><b>알림</b><button type="button" class="qna-modal-close" data-action="closeNotificationModal" aria-label="닫기">✕</button></div><div class="notif-popover-list">${itemsHtml}</div>${footer}</div></div>`;
}

export function renderDrawer({ drawerOpen = false, icon, menuItems = DEFAULT_MENU_ITEMS }) {
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
    canAccessBasic = false,
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
    myRank = 0,
    notifModalOpen = false,
    notiList = [],
    notiStatus = 'idle',
    percentile = 0,
    plannedScheduleOptions = [],
    proReports = [],
    proReportsStatus = 'idle',
    rankingProgress = 0,
    rankingTotal = 0,
    rankTier = 'bronze',
    rankTierLabel = 'BRONZE',
    scoreTierClass = defaultScoreTierClass,
    scoreExamType = '',
    showStudyBreakdown = false,
    studySubjectSheetOnlyPlanned = false,
    studySubjectSheetOpen = false,
    studyTimerRunning = false,
    todayPlannerItems = [],
    todayPlannerProgress = 0,
    todayPlannerTotalMinutes = 0,
    todayRecord = null,
    todayStudySeconds = 0,
    todaySubjectsWithTimer = {},
    user = {},
    universityModalOpen = false,
    weeklyReports = [],
    weeklyReportsStatus = 'idle'
  } = ctx;

  const safeHomeSlideIndex = Math.max(0, Number(homeSlideIndex) || 0);
  const homeSlideGapPx = 12;
  const slideTransition = homeDragOffset !== 0 ? '0s' : 'transform .42s cubic-bezier(.22,1,.36,1)';
  const universityCards = homeTargets.map((item) => renderUniversityCard({ item, scoreTierClass })).join('');
  const indicators = [...homeTargets, { add: true }].map((_, idx) => `<i class="${idx === safeHomeSlideIndex ? 'active' : ''}" data-action="setHomeSlide" data-slide-index="${idx}"></i>`).join('');
  const timerDisabled = studyTimerRunning ? 'disabled' : '';
  const stopDisabled = studyTimerRunning ? '' : 'disabled';
  const rankingShine = ['gold', 'platinum', 'diamond'].includes(rankTier) ? 'rank-shine' : '';
  const missionSubjectRows = buildMissionSubjectRows(todayPlannerItems, todaySubjectsWithTimer);
  const missionSubjectsHtml = missionSubjectRows.map((row) => `<div class="home-mission-subject"><span>${escapeHtml(row.subject)}</span><div><i style="width:${row.progress}%"></i></div><small>${formatMinutesLabel(Math.round(row.actualSeconds / 60))} / ${formatMinutesLabel(row.plannedMinutes)}</small></div>`).join('');

  return `<div class="home-dashboard home-container">
    <div class="home-content">
    <div class="home-header">
      <div class="home-greeting-bubble">
        <img loading="lazy" decoding="async" src="${crackySrc}" class="home-greeting-cracky" alt="크랙이" />
        <div class="home-greeting-speech">
          <p class="home-greeting">안녕하세요, ${escapeHtml(user?.name || '회원')}님 👋</p>
          <p class="home-sub">오늘도 크랙한 하루 되세요!</p>
        </div>
      </div>
      <div class="home-top-icons">
        <button type="button" class="home-calendar-btn" data-action="openCalendarSheet" aria-label="수험 일정"><span class="home-calendar-btn-icon">${icon('calendar', false)}</span><span class="home-calendar-copy"><strong class="home-calendar-dday">${escapeHtml(ctx.calendarNearestDdayLabel || '일정')}</strong><small class="home-calendar-summary">${escapeHtml(formatCompactCalendarTitle(ctx.calendarNearestEvent))}</small></span></button>
      </div>
    </div>
    <section class="home-score-section">
      <div class="home-score-section-head"><div class="home-score-section-copy"><span>대학 분석</span><h2>지원학과 AI 점수</h2></div><select class="planner-input" data-field="scoreExamType">${renderExamOptions(scoreExamType)}</select></div>
      <div class="home-kpi-slider">
        <div class="home-kpi-track anchor-volatile ${homeSlideMotion}" data-home-slide-index="${safeHomeSlideIndex}" style="--home-slide-card-width:100%;--home-slide-gap:${homeSlideGapPx}px;--home-slide-x:calc(-${safeHomeSlideIndex * 100}% - ${safeHomeSlideIndex * homeSlideGapPx}px + ${homeDragOffset}px);--home-slide-transition:${slideTransition};">
        ${universityCards}<button class="university-card-slide university-card card slider-card home-add-univ-card" data-action="openAnalysisSearchFromHome"><span class="home-add-univ-icon">${icon('plus', false)}</span><span class="home-add-univ-copy"><b>목표 대학 추가</b><p>대학과 학과를 검색해 AI 분석에 추가하세요.</p></span><span class="home-add-univ-action">검색하기</span></button></div>
      </div>
      <div class="home-kpi-indicator card-indicator">${indicators}</div>
      ${renderUniversityModal({ analysisRecommended, analysisSearchList, analysisSearchTerm, analysisTargetList, universityModalOpen })}
      ${renderTargetDeleteModal(ctx)}
    </section>
    <div class="home-primary-stack">
      <section class="home-mission-card sc-card">
        <div class="home-card-head"><div><span class="home-card-eyebrow">오늘 미션</span><h2>오늘의 학습을 이어가세요</h2></div><span class="home-mini-badge">${studyTimerRunning ? '진행 중' : `${todayPlannerProgress}%`}</span></div>
        <div class="study-timer-row"><div class="home-timer-copy"><span>오늘 누적 공부</span><b class="timer premium-clock" data-study-base-seconds="${todayRecord?.studyTime || 0}">${formatHms(todayStudySeconds)}</b></div><div class="timer-actions"><button class="btn btn-primary mini ${timerDisabled}" data-action="openStudySubjectSheet" ${timerDisabled}>공부 시작</button><button class="btn btn-secondary mini ${stopDisabled}" data-action="stopStudyTimer" ${stopDisabled}>정지</button></div></div>
        ${canAccessBasic && todayPlannerItems.length ? `<div class="home-mission-plan"><div class="home-mission-progress-head"><span>${todayPlannerItems.length}개 계획</span><b>목표 ${formatMinutesLabel(todayPlannerTotalMinutes)}</b></div><div class="home-mission-progress"><i style="width:${todayPlannerProgress}%"></i></div><div class="home-mission-subjects">${missionSubjectsHtml}</div></div>` : `<div class="home-mission-empty ${canAccessBasic ? '' : 'is-locked'}"><b>${canAccessBasic ? '아직 등록한 계획이 없어요' : '오늘 목표 관리는 Basic부터 사용할 수 있어요'}</b><p>${canAccessBasic ? '플래너에서 오늘 할 일을 추가해보세요.' : '학습 시간을 기록하고 일일 계획을 한곳에서 관리하세요.'}</p></div>`}
        <button type="button" class="home-mission-planner-link" data-action="goto" data-target="planner"><span>${canAccessBasic ? '오늘 계획 관리' : 'Basic 기능 보기'}</span><span aria-hidden="true">›</span></button>
        <button type="button" class="home-breakdown-toggle" data-action="toggleStudyBreakdown">${showStudyBreakdown ? '과목별 기록 접기' : '과목별 기록 보기'}</button>
        ${renderStudyBreakdown({ breakdownDetailMap, breakdownSubjects, expandedBreakdownSubject, formatHms, showStudyBreakdown, todaySubjectsWithTimer })}
      </section>
      <section class="home-learning-flow-card sc-card">
        <div class="home-card-head"><div><span class="home-card-eyebrow">학습 흐름</span><h2>오늘의 기록</h2></div><span class="home-mini-badge">오늘 기준</span></div>
        <div class="home-flow-stats"><div><span>공부 시간</span><b>${formatMinutesLabel(Math.round(todayStudySeconds / 60))}</b></div><div><span>완료율</span><b>${todayPlannerProgress}%</b></div><div><span>계획</span><b>${todayPlannerItems.length}개</b></div></div>
        <button type="button" class="home-ranking-row rank-tier-${rankTier} ${rankingShine}" data-action="goRanking"><div class="home-ranking-copy"><span>내 공부 랭킹</span><b>${myRank ? `${myRank}등` : '집계 전'}</b><small>${rankingTotal ? `전체 ${rankingTotal}명 중 · ${rankTierLabel}` : '공부 기록을 기다리고 있어요'}</small></div><div class="home-ranking-meter"><span>${percentile ? `상위 ${percentile}%` : '오늘 기준'}</span><div><i style="width:${rankingProgress}%"></i></div></div><span class="home-ranking-chevron" aria-hidden="true">›</span></button>
      </section>
      ${renderHomeReportPreview({ proReports, proReportsStatus, weeklyReports, weeklyReportsStatus })}
    </div>
    ${renderStudySubjectSheet({ plannedScheduleOptions, studySubjectSheetOnlyPlanned, studySubjectSheetOpen })}
    <button type="button" class="home-notif-fab" data-action="openNotificationModal" aria-label="${countUnreadNotifications(notiList) ? `알림 ${countUnreadNotifications(notiList)}건` : '알림'}"><span class="home-notif-fab-icon">${icon('bell', false)}</span>${countUnreadNotifications(notiList) ? `<span class="home-notif-fab-badge">${countUnreadNotifications(notiList) > 9 ? '9+' : countUnreadNotifications(notiList)}</span>` : ''}</button>
    ${renderNotificationModal({ notifModalOpen, notiList, notiStatus })}
    ${renderCalendarSheet(ctx)}
    ${renderDrawer({ drawerOpen, icon })}
  </div>
  </div>`;
}

export function renderHomeScreen(ctx) {
  return ctx.layout(renderHomeView(ctx), true);
}
