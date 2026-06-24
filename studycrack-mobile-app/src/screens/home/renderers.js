import { renderCalendarSheet } from '../../components/calendar-sheet.js';
import { renderModal } from '../../components/modal.js';
import { renderSheet } from '../../components/sheet.js';
import { CRACKY_SRC } from '../../constants/assets.js';
import { EXAM_OPTIONS } from '../../constants/options.js';

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

function renderUniversityCard({ item, plannerBadges, scoreTierClass }) {
  const scorePct = Math.min((item.score / 250) * 100, 100);
  return `<button class="university-card-slide card home-kpi-card admission-card slider-card home-result-card-v3" data-action="selectUniversity" data-target-major="${item.major}">
          <span class="home-univ-remove" data-action="removeAnalysisTarget" data-target-major="${item.major}">✕</span>
          <div class="home-result-top"><div><p class="home-result-major">${item.major}</p><span class="home-result-state">${item.rank}</span></div><div class="home-result-score"><strong>${item.score}점</strong><small>AI 점수</small></div></div>
          <div class="home-result-gauge"><i class="${scoreTierClass(item.score)}" style="width:${scorePct}%"></i><span class="cut pass" style="left:40%"></span><span class="cut safe" style="left:60%"></span></div>
          <div class="home-result-gauge-meta"><span>0</span><span>합격컷 100</span><span>안정컷 150</span><span>MAX 250</span></div>
          <div class="kpi-row score-row"><div class="kpi-item"><b>${item.score}점</b>현재 점수</div><div class="kpi-item"><b>${item.cut}점</b>합격 컷</div><div class="kpi-item danger"><b>${item.gap}점</b>부족 점수</div></div>
          <div class="home-planner-badges chip-row">${plannerBadges.map((badge) => `<span class="chip">${badge}</span>`).join('')}</div>
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
  return `<section class="card home-report-preview-card home-insight-card premium-panel"><div class="home-card-head"><p class="analysis-title">리포트 미리보기</p><span class="home-mini-badge">학습 기록 기반</span></div><div class="home-report-preview-grid"><button type="button" class="home-report-preview-item" data-action="goto" data-target="weekly"><span>주간 리포트</span><b>${escapeHtml(latestWeekly?.title || latestWeekly?.weekId || '이번 주 학습 요약')}</b><small>${reportStatusText(weeklyReportsStatus, Boolean(latestWeekly))}</small></button><button type="button" class="home-report-preview-item pro" data-action="goto" data-target="report"><span>PRO 리포트</span><b>${escapeHtml(latestPro?.key ? `${latestPro.key} 전략 리포트` : '상위권 전략 리포트')}</b><small>${reportStatusText(proReportsStatus, Boolean(latestPro))}</small></button></div></section>`;
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

// 알림 시트(R6 → Phase 4): 중앙 모달 대신 하단 바텀시트로 표시.
// 서버 student_get_notifications 결과(notiList)를 렌더. 미인증/빈 목록/에러는 안내 문구.
// 하위호환: 옛 시그니처(boolean notifModalOpen)도 허용.
export function renderNotificationModal(ctx = {}) {
  const open = typeof ctx === 'boolean' ? ctx : ctx.notifModalOpen;
  if (!open) return '';
  const notiList = typeof ctx === 'object' && Array.isArray(ctx.notiList) ? ctx.notiList : [];
  const notiStatus = (typeof ctx === 'object' && ctx.notiStatus) || 'idle';
  const itemsHtml = notiList.length
    ? notiList
        .map(
          (n) =>
            `<div class="pro-notif-item ${n.isRead ? '' : 'pro-notif-unread'}"><b>${escapeHtml(n.title)}</b><p>${escapeHtml(n.body)}</p></div>`
        )
        .join('')
    : `<div class="pro-notif-empty"><p>${
        notiStatus === 'loading'
          ? '알림을 불러오는 중...'
          : notiStatus === 'error'
            ? '알림을 불러오지 못했습니다.'
            : '새로운 알림이 없습니다.'
      }</p></div>`;
  const body = `<div class="notif-sheet-handle" aria-hidden="true"></div><div class="notif-sheet-head"><p class="home-modal-title">알림</p><button type="button" class="qna-modal-close" data-action="closeNotificationModal" aria-label="닫기">✕</button></div><div class="pro-notif-list">${itemsHtml}</div>`;
  return renderSheet({ panelClass: 'notif-sheet', dismissAction: 'closeNotificationModal', body });
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
    canAccessPro = false,
    canAccessStandard = false,
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
    notiList = [],
    notiStatus = 'idle',
    percentile = 100,
    plannedScheduleOptions = [],
    plannerBadges = [],
    proReports = [],
    proReportsStatus = 'idle',
    rankingProgress = 0,
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
    todayPlannerSubjectSummary = [],
    todayPlannerTotalMinutes = 0,
    todayRecord = null,
    todayStudySeconds = 0,
    todaySubjectsWithTimer = {},
    user = {},
    universityModalOpen = false,
    weeklyReports = [],
    weeklyReportsStatus = 'idle'
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
        <button type="button" class="home-calendar-btn" data-action="openCalendarSheet" aria-label="수험 일정"><span class="home-calendar-btn-icon">${icon('calendar', false)}</span>${ctx.calendarNearestDdayLabel ? `<span class="home-calendar-dday">${escapeHtml(ctx.calendarNearestDdayLabel)}</span>` : ''}</button>
      </div>
      <div class="home-greeting-bubble">
        <img loading="lazy" decoding="async" src="${crackySrc}" class="home-greeting-cracky" alt="크랙이" />
        <div class="home-greeting-speech">
          <p class="home-greeting">안녕하세요, ${escapeHtml(user?.name || '회원')}님 👋</p>
          <p class="home-sub">오늘도 크랙한 하루 되세요!</p>
        </div>
      </div>
    </div>
    <div class="section home-section">
      <div class="home-analysis-criteria"><div><b>지원학과 AI 점수</b></div><select class="planner-input" data-field="scoreExamType">${renderExamOptions(scoreExamType)}</select></div>
      <div class="home-kpi-slider">
        <div class="home-kpi-track anchor-volatile ${homeSlideMotion}" style="--home-slide-card-width:100%;--home-slide-gap:12px;--home-slide-x:calc(-${homeSlideIndex} * (var(--home-slide-card-width) + var(--home-slide-gap)) + ${homeDragOffset}px);--home-slide-transition:${slideTransition};">
        ${universityCards}<button class="university-card-slide university-card card slider-card home-add-univ-card" data-action="openAnalysisSearchFromHome"><b>+ 대학 추가</b><p>추천/검색으로 추가</p></button></div>
      </div>
      <div class="home-kpi-indicator card-indicator">${indicators}</div>
      ${renderUniversityModal({ analysisRecommended, analysisSearchList, analysisSearchTerm, analysisTargetList, universityModalOpen })}
    </div>
    <div class="section home-section home-section-last">
      <div class="card home-study-summary study-summary-card home-insight-card premium-panel">
        <div class="home-card-head"><p class="analysis-title">오늘 누적 공부</p><span class="home-mini-badge">${studyTimerRunning ? '진행중' : '대기'}</span></div>
        <div class="study-timer-row"><b class="timer premium-clock" data-study-base-seconds="${todayRecord?.studyTime || 0}">${formatHms(todayStudySeconds)}</b><div class="timer-actions"><button class="btn btn-primary mini ${timerDisabled}" data-action="openStudySubjectSheet" ${timerDisabled}>공부 시작</button><button class="btn btn-secondary mini ${stopDisabled}" data-action="stopStudyTimer" ${stopDisabled}>정지</button></div></div>
        <button type="button" class="home-breakdown-toggle" data-action="toggleStudyBreakdown">${showStudyBreakdown ? '접기' : '펼쳐보기'}</button>
        ${renderStudyBreakdown({ breakdownDetailMap, breakdownSubjects, expandedBreakdownSubject, formatHms, showStudyBreakdown, todaySubjectsWithTimer })}
      </div>
      <button class="card study-goal-card home-goal-linked-card home-insight-card premium-panel ${canAccessStandard ? '' : 'is-locked'}" data-action="goto" data-target="planner">
        <div class="home-goal-title-row"><p class="analysis-title">오늘 공부 목표</p>${canAccessStandard ? '' : '<span class="home-goal-plan-badge">Standard부터</span>'}</div>
        ${canAccessStandard && todayPlannerItems.length ? `<div class="goal-compact"><b>${todayPlannerProgress}%</b><span>달성</span><em>${formatMinutesLabel(todayPlannerTotalMinutes)}</em></div><div class="track"><i style="width:${todayPlannerProgress}%"></i></div><div class="goal-tags">${todayPlannerSubjectSummary.slice(0, 3).map((value) => `<span>${value}</span>`).join('')}</div>` : canAccessStandard ? `<p class="sub">오늘 계획을 추가해보세요</p><span class="home-goal-empty-cta">플래너로 이동</span>` : `<p class="sub">주간 플래너와 학습 코칭을 연결해 공부 목표를 관리할 수 있어요.</p><span class="home-goal-empty-cta">Standard 기능 보기</span>`}
      </button>
      ${renderHomeReportPreview({ proReports, proReportsStatus, weeklyReports, weeklyReportsStatus })}
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
