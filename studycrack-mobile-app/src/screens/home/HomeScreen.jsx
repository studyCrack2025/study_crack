import { CRACKY_SRC } from '../../constants/assets.js';
import {
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
        <i className={scoreTierClass(item.score)} style={{ width: `${Math.min((item.score / 250) * 100, 100)}%` }} />
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
    showStudyBreakdown = false,
    studyTimerRunning = false,
    todayPlannerItems = [],
    todayPlannerProgress = 0,
    todayPlannerSubjectSummary = [],
    todayPlannerTotalMinutes = 0,
    todayRecord = null,
    todayStudySeconds = 0
  } = ctx;

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
    renderStudySubjectSheet(ctx) + renderNotificationModal(ctx.notifModalOpen) + renderDrawer({ drawerOpen: ctx.drawerOpen, icon });

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${dimmed ? 'modal-lock' : ''}`}>
          <div className="home-dashboard home-container">
            <div className="home-content">
              <div className="home-header">
                <div className="home-top-icons">
                  <button
                    className="top-icon-btn"
                    data-action="openNotificationModal"
                    dangerouslySetInnerHTML={{ __html: icon('bell', false) }}
                  />
                </div>
                <div className="home-greeting-bubble">
                  <img loading="lazy" decoding="async" src={crackySrc} className="home-greeting-cracky" alt="크랙이" />
                  <div className="home-greeting-speech">
                    <p className="home-greeting">안녕하세요, {(user && user.name) || '지민'}님 👋</p>
                    <p className="home-sub">오늘도 크랙한 하루 되세요!</p>
                  </div>
                </div>
              </div>

              <div className="section home-section">
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
                <button className="pro-top-btn home-pro-below-card-btn" data-action="goto" data-target={canAccessPro ? 'proElite' : 'proIntro'}>
                  <span>{canAccessPro ? 'PRO LOUNGE 입장' : '플랜 업그레이드'}</span>
                </button>
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
                  className="card study-goal-card home-goal-linked-card home-insight-card premium-panel"
                  data-action="goto"
                  data-target={canAccessStandard ? 'planner' : 'proIntro'}
                >
                  <p className="analysis-title">{canAccessStandard ? '오늘 공부 목표' : '플래너는 Standard 이상 전용'}</p>
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
                      <p className="sub">학습 계획과 주간 코칭을 이용하려면 업그레이드가 필요해요.</p>
                      <span className="home-goal-empty-cta">플랜 보기</span>
                    </>
                  )}
                </button>

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
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}
