import { CRACKY_SRC } from '../../constants/assets.js';
import { EXAM_OPTIONS } from '../../constants/options.js';
import { renderCalendarSheet } from '../../components/calendar-sheet.js';
import {
  countUnreadNotifications,
  defaultFormatHms,
  defaultFormatMinutesLabel,
  defaultScoreTierClass,
  renderDrawer,
  renderNotificationModal,
  renderStudyBreakdown,
  renderStudySubjectSheet,
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
  return (
    <button
      className="university-card-slide card home-kpi-card admission-card slider-card home-result-card-v3"
      data-action="selectUniversity"
      data-target-major={item.major}
    >
      <span className="home-univ-remove" data-action="removeAnalysisTarget" data-target-major={item.major}>
        ✕
      </span>
      <div className="home-result-top">
        <div>
          <p className="home-result-major">{item.major}</p>
          <span className="home-result-state">{item.rank}</span>
        </div>
        <div className="home-result-score">
          <strong>{item.score}점</strong>
          <small>AI 점수</small>
        </div>
      </div>
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
      <div className="kpi-row score-row">
        <div className="kpi-item">
          <b>{item.score}점</b>현재 점수
        </div>
        <div className="kpi-item">
          <b>{item.cut}점</b>합격 컷
        </div>
        <div className="kpi-item danger">
          <b>{item.gap}점</b>부족 점수
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

function HomeLoadingPanel({ tabBarHtml = '' }) {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="screen app-screen app-content">
          <div className="home-dashboard home-container">
            <div className="home-content">
              <div className="home-user-loading">
                <div className="analysis-loading-orbit" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <div>
                  <b>계정 정보를 불러오는 중입니다</b>
                  <p>저장된 성적, 구독 상태, 목표 대학을 확인하고 있어요.</p>
                </div>
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
    calendarNearestDdayLabel = '',
    hasClientSession = () => false
  } = ctx;

  const unreadCount = countUnreadNotifications(notiList);
  const calendarSheetHtml = renderCalendarSheet(ctx);

  const sessionActive = typeof hasClientSession === 'function' && hasClientSession();
  // 'ready'는 실데이터 병합 완료, 'error'는 네트워크/CORS 실패라 더 기다리지 않고 보유 데이터로 렌더(무한 로딩 방지).
  // 인증 만료는 별도 가드가 로그인 화면으로 이동시키므로 여기서 로딩에 머물지 않는다.
  const profileReady = userLoadStatus === 'ready' || userLoadStatus === 'error' || !sessionActive;
  if (!profileReady) return <HomeLoadingPanel tabBarHtml={tabBarHtml} />;

  const slideTransition = homeDragOffset !== 0 ? '0s' : 'transform .72s cubic-bezier(.22,1,.36,1)';
  const trackStyle = {
    '--home-slide-card-width': '100%',
    '--home-slide-gap': '12px',
    '--home-slide-x': `calc(-${homeSlideIndex} * (var(--home-slide-card-width) + var(--home-slide-gap)) + ${homeDragOffset}px)`,
    '--home-slide-transition': slideTransition
  };
  const rankingShine = ['gold', 'platinum', 'diamond'].includes(rankTier) ? 'rank-shine' : '';

  // 스크롤/전환 무관 영역은 기존 문자열 renderer 재사용(leaf 임베드).
  const universityModalHtml = renderUniversityModal(ctx);
  const breakdownHtml = renderStudyBreakdown(ctx);
  const overlaysHtml =
    renderStudySubjectSheet(ctx) + renderDrawer({ drawerOpen: ctx.drawerOpen, icon });
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
                    <p className="home-greeting">안녕하세요, {(user && user.name) || '회원'}님 👋</p>
                    <p className="home-sub">오늘도 크랙한 하루 되세요!</p>
                  </div>
                </div>
                <div className="home-top-icons">
                  <button type="button" className="home-calendar-btn" data-action="openCalendarSheet" aria-label="수험 일정">
                    <span className="home-calendar-btn-icon" dangerouslySetInnerHTML={{ __html: icon('calendar', false) }} />
                    {calendarNearestDdayLabel ? <span className="home-calendar-dday">{calendarNearestDdayLabel}</span> : null}
                  </button>
                </div>
              </div>

              <div className="section home-section">
                <div className="home-analysis-criteria">
                  <div>
                    <b>지원학과 AI 점수</b>
                  </div>
                  <select className="planner-input" data-field="scoreExamType" defaultValue={scoreExamType}>
                    {EXAM_OPTIONS.map((label) => (
                      <option value={label} key={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="home-kpi-slider">
                  <div className={`home-kpi-track anchor-volatile ${homeSlideMotion}`} style={trackStyle}>
                    {homeTargets.map((item) => (
                      <UniversityCard key={item.major} item={item} plannerBadges={plannerBadges} scoreTierClass={scoreTierClass} />
                    ))}
                    <button
                      className="university-card-slide university-card card slider-card home-add-univ-card"
                      data-action="openAnalysisSearchFromHome"
                    >
                      <b>+ 대학 추가</b>
                      <p>추천/검색으로 추가</p>
                    </button>
                  </div>
                </div>
                <div className="home-kpi-indicator card-indicator">
                  {[...homeTargets, { add: true }].map((_, idx) => (
                    <i
                      key={idx}
                      className={idx === homeSlideIndex ? 'active' : ''}
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
                  className={`card study-goal-card home-goal-linked-card home-insight-card premium-panel ${canAccessStandard ? '' : 'is-locked'}`}
                  data-action="goto"
                  data-target="planner"
                >
                  <div className="home-goal-title-row">
                    <p className="analysis-title">오늘 공부 목표</p>
                    {!canAccessStandard && <span className="home-goal-plan-badge">Standard부터</span>}
                  </div>
                  {canAccessStandard && todayPlannerItems.length ? (
                    <>
                      <div className="goal-compact">
                        <b>{todayPlannerProgress}%</b>
                        <span>달성</span>
                        <em>{formatMinutesLabel(todayPlannerTotalMinutes)}</em>
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
                  ) : canAccessStandard ? (
                    <>
                      <p className="sub">오늘 계획을 추가해보세요</p>
                      <span className="home-goal-empty-cta">플래너로 이동</span>
                    </>
                  ) : (
                    <>
                      <p className="sub">주간 플래너와 학습 코칭을 연결해 공부 목표를 관리할 수 있어요.</p>
                      <span className="home-goal-empty-cta">Standard 기능 보기</span>
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
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: calendarSheetHtml }} />
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}
