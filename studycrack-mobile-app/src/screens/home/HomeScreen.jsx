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
  buildMissionSubjectRows,
  countUnreadNotifications,
  defaultFormatHms,
  defaultFormatMinutesLabel,
  defaultScoreTierClass,
  getHomeScorePresentation
} from './presentation.js';
import { HomeOverlays, HomeStudyBreakdown, NotificationPopover } from './HomeOverlays.jsx';
import { fitSingleLineText } from '../../shared/browser/text-fit.js';

function UniversityCard({ item, scoreTierClass }) {
  const score = getHomeScorePresentation(item);
  return (
    <button
      className="university-card-slide card home-kpi-card admission-card slider-card home-result-card-v3"
      data-action="selectUniversity"
      data-target-major={item.major}
    >
      <div className="home-result-top">
        <div className="home-result-copy">
          <span className="home-result-eyebrow">선택 대학</span>
          <p className="home-result-major">{item.major}</p>
          <span className="home-result-state">{item.rank}</span>
        </div>
        <div className={`home-result-score ${score.noScore ? 'is-pending' : ''} ${item.scoreUpdating ? 'is-updating' : ''}`}>
          {score.pending ? <strong className="home-score-skeleton" aria-label="분석 중" /> : <strong>{score.scoreValue}</strong>}
          <small>{score.scoreLabel}</small>
        </div>
        <span className="home-univ-remove" data-action="removeAnalysisTarget" data-target-major={item.major}>
          ✕
        </span>
      </div>
      <div className="home-result-gauge-panel">
        <div className="home-result-gauge">
          <i className={scoreTierClass(score.score)} style={{ width: `${score.scorePct}%` }} />
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
            <span>현재 환산점수</span>
            <b>{score.scoreValue}</b>
          </div>
          <div className={`kpi-item ${score.neededToPass > 0 ? 'danger' : 'success'}`}>
            <span>합격컷까지</span>
            <b>{score.neededLabel}</b>
          </div>
        </div>
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
    return fitSingleLineText(el, { minSize: 12, step: 0.5 });
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

function HomeLoadFailure({ message = '', tabBarHtml = '' }) {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="screen app-screen app-content">
          <div className="home-dashboard home-container">
            <div className="home-content">
              <div className="sc-empty" role="alert">
                <span className="sc-empty-mark" aria-hidden="true">!</span>
                <div>
                  <b>사용자 정보를 불러오지 못했어요</b>
                  <p>{message || '네트워크 상태를 확인한 뒤 다시 시도해주세요.'}</p>
                </div>
                <button type="button" className="btn btn-primary" data-action="retryInit">다시 시도</button>
              </div>
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
    <div className="sc-overlay sc-overlay--modal home-modal-overlay calendar-event-overlay" data-action="closeCalendarEventForm">
      <div className="sc-modal home-modal calendar-event-modal" data-action="noopModal" role="dialog" aria-modal="true">
        <div className="sc-modal-head calendar-form-head">
          <div>
            <span>내 일정</span>
            <p className="home-modal-title">{calendarEventEditId ? '내 일정 수정' : '내 일정 추가'}</p>
          </div>
          <button type="button" className="sc-overlay-close qna-modal-close" data-action="closeCalendarEventForm" aria-label="닫기">✕</button>
        </div>
        <div className="sc-modal-body calendar-form-fields">
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
        <div className="sc-modal-footer support-btns calendar-form-actions">
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
      <div className="sc-overlay sc-overlay--sheet planner-sheet-overlay calendar-sheet-overlay" data-action="closeCalendarSheet">
        <div className="sc-sheet planner-sheet calendar-sheet" data-action="noopModal" role="dialog" aria-modal="true">
          <div className="sc-sheet-handle notif-sheet-handle" aria-hidden="true" />
          <div className="sc-sheet-head notif-sheet-head calendar-sheet-head">
            <div>
              <span>입시 캘린더</span>
              <p className="home-modal-title">수험 일정</p>
            </div>
            <button type="button" className="sc-overlay-close qna-modal-close" data-action="closeCalendarSheet" aria-label="닫기">✕</button>
          </div>
          <div className="sc-sheet-body calendar-sheet-scroll">
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
    <section className="home-report-preview-section">
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
    myRank = 0,
    percentile = 0,
    rankingProgress = 0,
    rankingTotal = 0,
    rankTier = 'bronze',
    rankTierLabel = 'BRONZE',
    proReports = [],
    proReportsStatus = 'idle',
    showStudyBreakdown = false,
    studyTimerRunning = false,
    todayPlannerItems = [],
    todayPlannerProgress = 0,
    todayPlannerTotalMinutes = 0,
    todayRecord = null,
    todayStudySeconds = 0,
    todaySubjectsWithTimer = {},
    weeklyReports = [],
    weeklyReportsStatus = 'idle',
    userLoadStatus = 'idle',
    userLoadError = '',
    notiList = [],
    calendarNearestEvent = null,
    calendarNearestDdayLabel = '',
    hasClientSession = () => false
  } = ctx;

  const unreadCount = countUnreadNotifications(notiList);

  const sessionActive = typeof hasClientSession === 'function' && hasClientSession();
  if (sessionActive && userLoadStatus === 'error') {
    return <HomeLoadFailure message={userLoadError} tabBarHtml={tabBarHtml} />;
  }
  const profileReady = userLoadStatus === 'ready' || !sessionActive;
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
  const missionSubjectRows = buildMissionSubjectRows(todayPlannerItems, todaySubjectsWithTimer);

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

              <section className="home-score-section">
                <div className="home-score-section-head">
                  <div className="home-score-section-copy">
                    <span>대학 분석</span>
                    <h2>지원학과 환산 점수</h2>
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
                      <UniversityCard key={item.major} item={item} scoreTierClass={scoreTierClass} />
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
              </section>

              <div className="home-primary-stack">
                <section className="home-mission-card sc-card">
                  <div className="home-card-head">
                    <div>
                      <span className="home-card-eyebrow">오늘 미션</span>
                      <h2>오늘의 학습을 이어가세요</h2>
                    </div>
                    <span className="home-mini-badge">{studyTimerRunning ? '진행 중' : `${todayPlannerProgress}%`}</span>
                  </div>
                  <div className="study-timer-row">
                    <div className="home-timer-copy">
                      <span>오늘 누적 공부</span>
                      <b className="timer premium-clock" data-study-base-seconds={todayRecord?.studyTime || 0}>
                        {formatHms(todayStudySeconds)}
                      </b>
                    </div>
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
                  {canAccessBasic && todayPlannerItems.length ? (
                    <div className="home-mission-plan">
                      <div className="home-mission-progress-head">
                        <span>{todayPlannerItems.length}개 계획</span>
                        <b>목표 {formatMinutesLabel(todayPlannerTotalMinutes)}</b>
                      </div>
                      <div className="home-mission-progress"><i style={{ width: `${todayPlannerProgress}%` }} /></div>
                      <div className="home-mission-subjects">
                        {missionSubjectRows.map((row) => (
                          <div className="home-mission-subject" key={row.subject}>
                            <span>{row.subject}</span>
                            <div><i style={{ width: `${row.progress}%` }} /></div>
                            <small>{formatMinutesLabel(Math.round(row.actualSeconds / 60))} / {formatMinutesLabel(row.plannedMinutes)}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={`home-mission-empty ${canAccessBasic ? '' : 'is-locked'}`}>
                      <b>{canAccessBasic ? '아직 등록한 계획이 없어요' : '오늘 목표 관리는 Basic부터 사용할 수 있어요'}</b>
                      <p>{canAccessBasic ? '플래너에서 오늘 할 일을 추가해보세요.' : '학습 시간을 기록하고 일일 계획을 한곳에서 관리하세요.'}</p>
                    </div>
                  )}
                  <button type="button" className="home-mission-planner-link" data-action="goto" data-target="planner">
                    <span>{canAccessBasic ? '오늘 계획 관리' : 'Basic 기능 보기'}</span>
                    <span aria-hidden="true">›</span>
                  </button>
                  <button type="button" className="home-breakdown-toggle" data-action="toggleStudyBreakdown">
                    {showStudyBreakdown ? '과목별 기록 접기' : '과목별 기록 보기'}
                  </button>
                  <HomeStudyBreakdown {...ctx} />
                </section>

                <section className="home-learning-flow-card sc-card">
                  <div className="home-card-head">
                    <div>
                      <span className="home-card-eyebrow">학습 흐름</span>
                      <h2>오늘의 기록</h2>
                    </div>
                    <span className="home-mini-badge">오늘 기준</span>
                  </div>
                  <div className="home-flow-stats">
                    <div><span>공부 시간</span><b>{formatMinutesLabel(Math.round(todayStudySeconds / 60))}</b></div>
                    <div><span>완료율</span><b>{todayPlannerProgress}%</b></div>
                    <div><span>계획</span><b>{todayPlannerItems.length}개</b></div>
                  </div>
                  <button
                    type="button"
                    className={`home-ranking-row rank-tier-${rankTier} ${rankingShine}`}
                    data-action="goRanking"
                  >
                    <div className="home-ranking-copy">
                      <span>내 공부 랭킹</span>
                      <b>{myRank ? `${myRank}등` : '집계 전'}</b>
                      <small>{rankingTotal ? `전체 ${rankingTotal}명 중 · ${rankTierLabel}` : '공부 기록을 기다리고 있어요'}</small>
                    </div>
                    <div className="home-ranking-meter">
                      <span>{percentile ? `상위 ${percentile}%` : '오늘 기준'}</span>
                      <div><i style={{ width: `${rankingProgress}%` }} /></div>
                    </div>
                    <span className="home-ranking-chevron" aria-hidden="true">›</span>
                  </button>
                </section>

                <HomeReportPreviewCard
                  proReports={proReports}
                  proReportsStatus={proReportsStatus}
                  weeklyReports={weeklyReports}
                  weeklyReportsStatus={weeklyReportsStatus}
                />
              </div>

            </div>
          </div>
        </div>
        <div className="app-screen-overlays" style={{ display: 'contents' }}><HomeOverlays {...ctx} /></div>
        <button
          type="button"
          className="home-notif-fab"
          data-action="openNotificationModal"
          aria-label={unreadCount ? `알림 ${unreadCount}건` : '알림'}
        >
          <span className="home-notif-fab-icon" dangerouslySetInnerHTML={{ __html: icon('bell', false) }} />
          {unreadCount ? <span className="home-notif-fab-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
        </button>
        <NotificationPopover {...ctx} />
        <CalendarSheet {...ctx} />
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}
