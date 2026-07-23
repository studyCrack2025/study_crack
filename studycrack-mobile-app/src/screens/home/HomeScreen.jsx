import { useLayoutEffect, useRef } from 'react';
import { CRACKY_SRC } from '../../constants/assets.js';
import { EXAM_OPTIONS } from '../../constants/options.js';
import {
  CALENDAR_CATEGORIES,
  PERSONAL_CALENDAR_CATEGORIES,
  formatCompactCalendarTitle,
  getCalendarCategoryMeta
} from '../../constants/admission-calendar.js';
import {
  countUnreadNotifications,
  defaultFormatHms,
  defaultFormatMinutesLabel,
  defaultScoreTierClass,
  renderDrawer,
  renderNotificationModal,
  renderStudyBreakdown,
  renderStudySubjectSheet,
  renderTargetDeleteModal,
  renderUniversityModal
} from './renderers.js';

// home 화면의 React-트리(JSX) 버전. 문자열 renderer(renderHomeView)와 DOM 구조·data-action을 1:1로 맞춘다.
// 핵심: KPI 슬라이더 트랙(.home-kpi-track)을 실제 React 노드로 두어, 슬라이드 전환 시 트랙 엘리먼트가
// 유지되고 transform(--home-slide-x) 변화에 CSS transition이 적용된다(문자열 경로는 매 렌더 트랙을
// 재생성해 transition이 끊겨 점프). 이벤트는 셸 래퍼의 위임 디스패처가 처리하므로 data-action만 유지.
// 스크롤/전환 상태가 없는 오버레이(대학 검색 모달·공부 과목 시트·알림 모달·drawer)와 펼침 breakdown,
// 탭바는 기존 문자열 renderer를 leaf로 임베드해 변환 범위를 한정한다.

function UniversityCard({ item, plannerBadges, scoreTierClass }) {
  const scorePct = Math.min((item.score / 250) * 100, 100);
  // 점수 출처 상태별 표기. pending(분석 대기)은 0점 대신 스켈레톤, empty(성적 없음)는 안내 문구.
  const status = item.scoreStatus || 'confirmed';
  const pending = status === 'pending';
  const empty = status === 'empty';
  const noScore = pending || empty;
  const scoreLabel =
    status === 'confirmed' ? (item.scoreUpdating ? '갱신 중…' : 'AI 점수')
      : status === 'live' ? '예상 점수'
        : pending ? '분석 중' : '성적 입력 필요';
  const scoreValue = empty ? '—' : `${item.score}점`;
  const gapValue = noScore ? '—' : Number(item.gap || 0) > 0 ? `-${item.gap}점` : '0점';
  return (
    <button
      className="university-card-slide card home-kpi-card admission-card slider-card home-result-card-v3"
      data-action="selectUniversity"
      data-target-major={item.major}
    >
      <div className="home-result-top">
        <div className="home-result-copy">
          <p className="home-result-major">{item.major}</p>
          <span className="home-result-state">{item.rank}</span>
        </div>
        <div className={`home-result-score ${noScore ? 'is-pending' : ''} ${item.scoreUpdating ? 'is-updating' : ''}`}>
          {pending ? <strong className="home-score-skeleton" aria-label="분석 중" /> : <strong>{scoreValue}</strong>}
          <small>{scoreLabel}</small>
        </div>
        <span className="home-univ-remove" data-action="removeAnalysisTarget" data-target-major={item.major}>
          ✕
        </span>
      </div>
      <div className="home-result-gauge-panel">
        <div className="home-result-gauge">
          <i className={scoreTierClass(item.score)} style={{ width: `${scorePct}%` }} />
          <span className="cut pass" style={{ left: '40%' }} />
          <span className="cut safe" style={{ left: '60%' }} />
        </div>
        <div className="home-result-gauge-meta">
          <span>0</span>
          <span>합격컷 100</span>
          <span>안정컷 150</span>
          <span>MAX 250</span>
        </div>
      </div>
      <div className="home-result-kpi-panel">
        <div className="kpi-row score-row">
          <div className="kpi-item">
            <b>{noScore ? '—' : scoreValue}</b>현재 점수
          </div>
          <div className="kpi-item danger">
            <b>{gapValue}</b>부족 점수
          </div>
        </div>
      </div>
      <div className="home-planner-badges chip-row">
        {plannerBadges.map((badge, idx) => (
          <span className="chip" key={idx}>
            {badge}
          </span>
        ))}
      </div>
    </button>
  );
}

// 인사말은 이름 길이에 따라 한 줄을 넘기지 않도록 폰트 크기를 동적 축소한다(줄바꿈 방지).
// CSS로 지정된 크기에서 시작해, 내용이 박스를 넘으면 하한(12px)까지 0.5px씩 줄인다.
function HomeGreeting({ name = '회원' }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return undefined;
    const fit = () => {
      el.style.fontSize = '';
      let size = parseFloat(window.getComputedStyle(el).fontSize) || 18;
      const min = 12;
      let guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > min && guard < 24) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
        guard += 1;
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [name]);
  return (
    <p className="home-greeting home-greeting-fit" ref={ref}>안녕하세요, {name}님 👋</p>
  );
}

// 로그인 직후 홈 진입 로딩: 단순 스피너 대신 홈 레이아웃 스켈레톤을 보여
// 체감 로딩을 줄이고 실데이터 도착 시 레이아웃 점프(CLS)를 방지한다.
function HomeLoadingPanel({ tabBarHtml = '', crackySrc = CRACKY_SRC }) {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="screen app-screen app-content">
          <div className="home-dashboard home-container">
            <div className="home-content home-skeleton" aria-busy="true" aria-label="홈 화면을 불러오는 중입니다">
              <div className="home-skeleton-header">
                <img loading="lazy" decoding="async" src={crackySrc} className="home-greeting-cracky" alt="" aria-hidden="true" />
                <div className="home-skeleton-speech">
                  <span className="home-skeleton-line w70" />
                  <span className="home-skeleton-line w45" />
                </div>
              </div>
              <div className="home-skeleton-card lg">
                <div className="home-skeleton-row">
                  <span className="home-skeleton-line w50" />
                  <span className="home-skeleton-pill" />
                </div>
                <span className="home-skeleton-gauge" />
                <div className="home-skeleton-kpis"><span /><span /><span /></div>
              </div>
              <div className="home-skeleton-card sm" />
              <div className="home-skeleton-card sm" />
              <p className="home-skeleton-note">저장된 성적과 목표 대학을 불러오고 있어요</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}

function reportStatusText(status = 'idle', hasItem = false) {
  if (status === 'loading') return '불러오는 중';
  if (status === 'error') return '확인 필요';
  return hasItem ? '생성됨' : '대기 중';
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLabel(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

function periodLabel(event) {
  if (!event?.endDate || event.endDate === event.date) return '';
  return ` · ${event.date} ~ ${event.endDate}`;
}

function CalendarEventRow({ event }) {
  const meta = getCalendarCategoryMeta(event.category);
  const editable = event.source === 'personal';
  return (
    <div
      className={`calendar-event-row ${editable ? 'is-editable' : ''}`}
      data-action={editable ? 'openCalendarEventForm' : undefined}
      data-event-id={editable ? event.id : undefined}
    >
      <span className="calendar-event-dot" style={{ background: meta.color }} />
      <div className="calendar-event-main">
        <b>{event.title}</b>
        {event.note ? <p>{event.note}</p> : null}
        <small>{meta.label}{periodLabel(event)}</small>
      </div>
      {editable ? <span className="calendar-event-chev" aria-hidden="true">›</span> : <span className="calendar-event-tag">공식</span>}
    </div>
  );
}

function CalendarMonthCell({ cell }) {
  if (cell.blank) return <span className="calendar-cell calendar-cell-blank" />;
  const dots = (cell.eventDots || []).map((dot, idx) => (
    <i key={idx} style={{ background: getCalendarCategoryMeta(dot.category).color }} />
  ));
  const cls = ['calendar-cell'];
  if (cell.isToday) cls.push('is-today');
  if (cell.isSelected) cls.push('is-selected');
  return (
    <button type="button" className={cls.join(' ')} data-action="selectCalendarDate" data-date={cell.ymd}>
      <i className="calendar-cell-day">{cell.day}</i>
      <span className="calendar-cell-dots">{dots}</span>
    </button>
  );
}

function CalendarEventForm(ctx) {
  const {
    calendarEventFormOpen = false,
    calendarEventEditId = null,
    calendarEventDraft = null,
    calendarSaving = false
  } = ctx;
  if (!calendarEventFormOpen) return null;
  const draft = calendarEventDraft || {};
  return (
    <div className="home-modal-overlay calendar-event-overlay" data-action="closeCalendarEventForm">
      <div className="home-modal calendar-event-modal" data-action="noopModal">
        <div className="calendar-form-head">
          <div>
            <span>내 일정</span>
            <p className="home-modal-title">{calendarEventEditId ? '내 일정 수정' : '내 일정 추가'}</p>
          </div>
          <button type="button" className="qna-modal-close" data-action="closeCalendarEventForm" aria-label="닫기">✕</button>
        </div>
        <div className="calendar-form-fields">
          <label>일정 제목</label>
          <input className="planner-input calendar-form-title" data-calendar-field="title" maxLength="60" defaultValue={draft.title || ''} placeholder="예: 수시 원서 접수 마감" />
          <div className="calendar-form-date-grid">
            <div>
              <label>시작일</label>
              <input className="planner-input" type="date" data-calendar-field="date" defaultValue={draft.date || ''} />
            </div>
            <div>
              <label>종료일</label>
              <input className="planner-input" type="date" data-calendar-field="endDate" defaultValue={draft.endDate || ''} />
            </div>
          </div>
          <label>분류</label>
          <select className="planner-input calendar-form-select" data-calendar-field="category" defaultValue={draft.category || 'personal'}>
            {PERSONAL_CALENDAR_CATEGORIES.map((key) => (
              <option value={key} key={key}>{(CALENDAR_CATEGORIES[key] || {}).label || key}</option>
            ))}
          </select>
          <label>메모</label>
          <textarea className="planner-input calendar-form-note" data-calendar-field="note" maxLength="300" defaultValue={draft.note || ''} placeholder="준비물, 장소, 확인할 내용을 적어두세요." />
        </div>
        <div className="support-btns calendar-form-actions">
          {calendarEventEditId ? (
            <button type="button" className="btn btn-secondary calendar-delete-btn" data-action="deleteCalendarEvent" data-event-id={calendarEventEditId} disabled={calendarSaving}>삭제</button>
          ) : null}
          <button type="button" className="btn btn-secondary" data-action="closeCalendarEventForm" disabled={calendarSaving}>취소</button>
          <button type="button" className="btn btn-primary" data-action="saveCalendarEvent" disabled={calendarSaving}>{calendarSaving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

function CalendarSheet(ctx) {
  const {
    calendarSheetOpen = false,
    calendarMonthLabel = '',
    calendarMonthCells = [],
    calendarWeekdays = WEEKDAYS,
    calendarNearestEvent = null,
    calendarNearestDdayLabel = '',
    calendarSelectedDate = '',
    calendarSelectedEvents = [],
    calendarSyncStatus = 'idle'
  } = ctx;
  if (!calendarSheetOpen) return <>{CalendarEventForm(ctx)}</>;
  const addDisabled = calendarSyncStatus === 'loading';
  return (
    <>
      <div className="planner-sheet-overlay calendar-sheet-overlay" data-action="closeCalendarSheet">
        <div className="planner-sheet calendar-sheet" data-action="noopModal">
          <div className="notif-sheet-handle" aria-hidden="true" />
          <div className="notif-sheet-head calendar-sheet-head">
            <div>
              <span>입시 캘린더</span>
              <p className="home-modal-title">수험 일정</p>
            </div>
            <button type="button" className="qna-modal-close" data-action="closeCalendarSheet" aria-label="닫기">✕</button>
          </div>
          <div className="calendar-sheet-scroll">
            {calendarSyncStatus === 'loading' ? <p className="calendar-sync-note">내 일정을 동기화하고 있어요.</p> : null}
            {calendarSyncStatus === 'error' ? <p className="calendar-sync-note error">내 일정을 불러오지 못했습니다. 잠시 후 다시 열어주세요.</p> : null}
            {calendarNearestEvent ? (
              <div className="calendar-nearest">
                <span className="calendar-nearest-dday">{calendarNearestDdayLabel}</span>
                <div className="calendar-nearest-main">
                  <b>{calendarNearestEvent.title}</b>
                  <p>{formatDateLabel(calendarNearestEvent.date)} · {getCalendarCategoryMeta(calendarNearestEvent.category).label}</p>
                </div>
              </div>
            ) : (
              <div className="calendar-nearest calendar-nearest-empty"><p>다가오는 일정이 없어요. 아래에서 일정을 추가해보세요.</p></div>
            )}
            <div className="calendar-month-nav">
              <button type="button" className="calendar-nav-btn" data-action="calendarPrevMonth" aria-label="이전 달">‹</button>
              <b>{calendarMonthLabel}</b>
              <button type="button" className="calendar-nav-btn" data-action="calendarNextMonth" aria-label="다음 달">›</button>
            </div>
            <div className="calendar-weekdays">{calendarWeekdays.map((w) => <span key={w}>{w}</span>)}</div>
            <div className="calendar-grid">{calendarMonthCells.map((cell) => <CalendarMonthCell cell={cell} key={cell.key || cell.ymd} />)}</div>
            <div className="calendar-selected">
              <div className="calendar-selected-head">
                <b>{formatDateLabel(calendarSelectedDate)}</b>
                <button type="button" className="btn btn-primary mini" data-action="openCalendarEventForm" disabled={addDisabled}>+ 내 일정 추가</button>
              </div>
              <div className="calendar-selected-list">
                {calendarSelectedEvents.length
                  ? calendarSelectedEvents.map((event) => <CalendarEventRow event={event} key={event.id} />)
                  : <p className="calendar-empty">이 날짜에 등록된 일정이 없어요.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
      {CalendarEventForm(ctx)}
    </>
  );
}

function HomeReportPreviewCard({ proReports = [], proReportsStatus = 'idle', weeklyReports = [], weeklyReportsStatus = 'idle' }) {
  const latestWeekly = weeklyReports[0] || null;
  const latestPro = proReports[0] || null;
  return (
    <section className="card home-report-preview-card home-insight-card premium-panel">
      <div className="home-card-head">
        <p className="analysis-title">리포트 미리보기</p>
        <span className="home-mini-badge">학습 기록 기반</span>
      </div>
      <div className="home-report-preview-grid">
        <button type="button" className="home-report-preview-item" data-action="goto" data-target="weekly">
          <span>주간 리포트</span>
          <b>{latestWeekly?.title || latestWeekly?.weekId || '이번 주 학습 요약'}</b>
          <small>{reportStatusText(weeklyReportsStatus, Boolean(latestWeekly))}</small>
        </button>
        <button type="button" className="home-report-preview-item pro" data-action="goto" data-target="report">
          <span>PRO 리포트</span>
          <b>{latestPro?.key ? `${latestPro.key} 전략 리포트` : '상위권 전략 리포트'}</b>
          <small>{reportStatusText(proReportsStatus, Boolean(latestPro))}</small>
        </button>
      </div>
    </section>
  );
}

export function HomeScreen(ctx) {
  const {
    dimmed = false,
    tabBarHtml = '',
    canAccessBasic = false,
    canAccessPro = false,
    canAccessStandard = false,
    crackySrc = CRACKY_SRC,
    user = {},
    formatHms = defaultFormatHms,
    formatMinutesLabel = defaultFormatMinutesLabel,
    scoreTierClass = defaultScoreTierClass,
    scoreExamType = '',
    homeDragOffset = 0,
    homeSlideIndex = 0,
    homeSlideMotion = '',
    homeTargets = [],
    icon = () => '',
    myRank = 124,
    percentile = 100,
    plannerBadges = [],
    rankingProgress = 0,
    rankTier = 'bronze',
    rankTierLabel = 'BRONZE',
    proReports = [],
    proReportsStatus = 'idle',
    showStudyBreakdown = false,
    studyTimerRunning = false,
    todayPlannerItems = [],
    todayPlannerProgress = 0,
    todayPlannerSubjectSummary = [],
    todayPlannerTotalMinutes = 0,
    todayRecord = null,
    todayStudySeconds = 0,
    weeklyReports = [],
    weeklyReportsStatus = 'idle',
    userLoadStatus = 'idle',
    notiList = [],
    calendarNearestEvent = null,
    calendarNearestDdayLabel = '',
    hasClientSession = () => false
  } = ctx;

  const unreadCount = countUnreadNotifications(notiList);

  const sessionActive = typeof hasClientSession === 'function' && hasClientSession();
  // 'ready'는 실데이터 병합 완료, 'error'는 네트워크/CORS 실패라 더 기다리지 않고 보유 데이터로 렌더(무한 로딩 방지).
  // 인증 만료는 별도 가드가 로그인 화면으로 이동시키므로 여기서 로딩에 머물지 않는다.
  const profileReady = userLoadStatus === 'ready' || userLoadStatus === 'error' || !sessionActive;
  if (!profileReady) return <HomeLoadingPanel tabBarHtml={tabBarHtml} crackySrc={crackySrc} />;

  const safeHomeSlideIndex = Math.max(0, Number(homeSlideIndex) || 0);
  const homeSlideGapPx = 12;
  const slideTransition = homeDragOffset !== 0 ? '0s' : 'transform .42s cubic-bezier(.22,1,.36,1)';
  const trackStyle = {
    '--home-slide-card-width': '100%',
    '--home-slide-gap': `${homeSlideGapPx}px`,
    '--home-slide-x': `calc(-${safeHomeSlideIndex * 100}% - ${safeHomeSlideIndex * homeSlideGapPx}px + ${homeDragOffset}px)`,
    '--home-slide-transition': slideTransition
  };
  const rankingShine = ['gold', 'platinum', 'diamond'].includes(rankTier) ? 'rank-shine' : '';

  // 스크롤/전환 무관 영역은 기존 문자열 renderer 재사용(leaf 임베드).
  const universityModalHtml = renderUniversityModal(ctx);
  const targetDeleteModalHtml = renderTargetDeleteModal(ctx);
  const breakdownHtml = renderStudyBreakdown(ctx);
  const overlaysHtml =
    renderStudySubjectSheet(ctx) + targetDeleteModalHtml + renderDrawer({ drawerOpen: ctx.drawerOpen, icon });
  // 알림 시트는 app-frame 직속에 둬야 스크롤 컨테이너(.app-screen)가 아닌 고정 프레임 기준으로 하단에 붙는다.
  const notifSheetHtml = renderNotificationModal(ctx);

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${dimmed ? 'modal-lock' : ''}`} data-screen="home">
          <div className="home-dashboard home-container">
            <div className="home-content">
              <div className="home-header">
                <div className="home-greeting-bubble">
                  <img loading="lazy" decoding="async" src={crackySrc} className="home-greeting-cracky" alt="크랙이" />
                  <div className="home-greeting-speech">
                    <HomeGreeting name={(user && user.name) || '회원'} />
                    <p className="home-sub">오늘도 크랙한 하루 되세요!</p>
                  </div>
                </div>
                <div className="home-top-icons">
                  <button type="button" className="home-calendar-btn" data-action="openCalendarSheet" aria-label="수험 일정">
                    <span className="home-calendar-btn-icon" dangerouslySetInnerHTML={{ __html: icon('calendar', false) }} />
                    <span className="home-calendar-copy">
                      <strong className="home-calendar-dday">{calendarNearestDdayLabel || '일정'}</strong>
                      <small className="home-calendar-summary">{formatCompactCalendarTitle(calendarNearestEvent)}</small>
                    </span>
                  </button>
                </div>
              </div>

              <div className="section home-section">
                <div className="home-analysis-criteria">
                  <div>
                    <b>지원학과 AI 점수</b>
                  </div>
                  <select className="planner-input" data-field="scoreExamType" value={scoreExamType} onChange={() => {}}>
                    {EXAM_OPTIONS.map((label) => (
                      <option value={label} key={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="home-kpi-slider">
                  <div
                    className={`home-kpi-track anchor-volatile ${homeSlideMotion}`}
                    data-home-slide-index={safeHomeSlideIndex}
                    style={trackStyle}
                  >
                    {homeTargets.map((item) => (
                      <UniversityCard key={item.major} item={item} plannerBadges={plannerBadges} scoreTierClass={scoreTierClass} />
                    ))}
                    <button
                      className="university-card-slide university-card card slider-card home-add-univ-card"
                      data-action="openAnalysisSearchFromHome"
                    >
                      <span className="home-add-univ-icon" dangerouslySetInnerHTML={{ __html: icon('plus', false) }} />
                      <span className="home-add-univ-copy">
                        <b>목표 대학 추가</b>
                        <p>대학과 학과를 검색해 AI 분석에 추가하세요.</p>
                      </span>
                      <span className="home-add-univ-action">검색하기</span>
                    </button>
                  </div>
                </div>
                <div className="home-kpi-indicator card-indicator">
                  {[...homeTargets, { add: true }].map((_, idx) => (
                    <i
                      key={idx}
                      className={idx === safeHomeSlideIndex ? 'active' : ''}
                      data-action="setHomeSlide"
                      data-slide-index={idx}
                    />
                  ))}
                </div>
                <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: universityModalHtml }} />
              </div>

              <div className="section home-section home-section-last">
                <div className="card home-study-summary study-summary-card home-insight-card premium-panel">
                  <div className="home-card-head">
                    <p className="analysis-title">오늘 누적 공부</p>
                    <span className="home-mini-badge">{studyTimerRunning ? '진행중' : '대기'}</span>
                  </div>
                  <div className="study-timer-row">
                    <b className="timer premium-clock" data-study-base-seconds={todayRecord?.studyTime || 0}>
                      {formatHms(todayStudySeconds)}
                    </b>
                    <div className="timer-actions">
                      <button
                        className={`btn btn-primary mini ${studyTimerRunning ? 'disabled' : ''}`}
                        data-action="openStudySubjectSheet"
                        disabled={studyTimerRunning}
                      >
                        공부 시작
                      </button>
                      <button
                        className={`btn btn-secondary mini ${studyTimerRunning ? '' : 'disabled'}`}
                        data-action="stopStudyTimer"
                        disabled={!studyTimerRunning}
                      >
                        정지
                      </button>
                    </div>
                  </div>
                  <button type="button" className="home-breakdown-toggle" data-action="toggleStudyBreakdown">
                    {showStudyBreakdown ? '접기' : '펼쳐보기'}
                  </button>
                  <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: breakdownHtml }} />
                </div>

                <button
                  className={`card study-goal-card home-goal-linked-card home-insight-card premium-panel ${canAccessBasic ? '' : 'is-locked'}`}
                  data-action="goto"
                  data-target="planner"
                >
                  <div className="home-goal-title-row">
                    <p className="analysis-title">오늘 공부 목표</p>
                    {!canAccessBasic && <span className="home-goal-plan-badge">Basic부터</span>}
                  </div>
                  {canAccessBasic && todayPlannerItems.length ? (
                    <>
                      <div className="home-goal-progress-head">
                        <div className="goal-compact">
                          <b>{todayPlannerProgress}%</b>
                          <span>달성</span>
                          <i>{studyTimerRunning ? '진행중' : '시작 전'}</i>
                        </div>
                        <em>목표 {formatMinutesLabel(todayPlannerTotalMinutes)}</em>
                      </div>
                      <div className="track">
                        <i style={{ width: `${todayPlannerProgress}%` }} />
                      </div>
                      <div className="goal-tags">
                        {todayPlannerSubjectSummary.slice(0, 3).map((value, idx) => (
                          <span key={idx}>{value}</span>
                        ))}
                      </div>
                    </>
                  ) : canAccessBasic ? (
                    <>
                      <p className="sub">오늘 계획을 추가해보세요</p>
                      <span className="home-goal-empty-cta">플래너로 이동</span>
                    </>
                  ) : (
                    <>
                      <p className="sub">개인 플래너로 오늘의 공부 목표를 관리할 수 있어요.</p>
                      <span className="home-goal-empty-cta">Basic 기능 보기</span>
                    </>
                  )}
                </button>

                <HomeReportPreviewCard
                  proReports={proReports}
                  proReportsStatus={proReportsStatus}
                  weeklyReports={weeklyReports}
                  weeklyReportsStatus={weeklyReportsStatus}
                />

                <button
                  type="button"
                  className={`card home-bottom-summary ranking-card home-insight-card premium-panel rank-tier-${rankTier} ${rankingShine}`}
                  data-action="goRanking"
                >
                  <div className="home-ranking-head">
                    <p className="analysis-title">내 공부 랭킹</p>
                    <span className="badge">오늘 기준</span>
                  </div>
                  <p className="home-ranking-main">{Math.min(myRank, 124)}등</p>
                  <p className="home-ranking-tier">{rankTierLabel}</p>
                  <p className="home-ranking-sub">전체 124명 중</p>
                  <div className="home-ranking-progress">
                    <i style={{ width: `${rankingProgress}%` }} />
                  </div>
                  <p className="home-ranking-foot">상위 {percentile}%</p>
                  <p className="home-ranking-tip">오늘 공부를 시작하면 순위가 올라가요</p>
                </button>
              </div>

              <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: overlaysHtml }} />
            </div>
          </div>
        </div>
        <button
          type="button"
          className="home-notif-fab"
          data-action="openNotificationModal"
          aria-label={unreadCount ? `알림 ${unreadCount}건` : '알림'}
        >
          <span className="home-notif-fab-icon" dangerouslySetInnerHTML={{ __html: icon('bell', false) }} />
          {unreadCount ? <span className="home-notif-fab-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
        </button>
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: notifSheetHtml }} />
        <CalendarSheet {...ctx} />
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}
