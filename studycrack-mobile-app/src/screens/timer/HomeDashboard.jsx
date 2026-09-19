import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';
import { StudyOverviewCard } from '../../components/StudyOverviewCard.jsx';
import { StudyWeekSummary } from './StudyGamificationPanels.jsx';
import { HomePlannerPreview } from './HomePlannerPreview.jsx';
import { HomeAquariumPreview } from './HomeAquariumPreview.jsx';
import { TimerSessionPanel } from './TimerSessionPanel.jsx';

function TimerProfileShortcut({ user = {} }) {
  const profileImage = String(user?.profileImage || '').trim();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [profileImage]);
  return (
    <button type="button" className="timer-v2-profile" data-action="openDrawer" aria-label="프로필 메뉴 열기">
      {profileImage && !imageFailed ? <img src={profileImage} alt="" onError={() => setImageFailed(true)} /> : <Icon name="user" />}
    </button>
  );
}

function TimerHeader({ user = {} }) {
  return (
    <header className="timer-v2-brand-head">
      <span className="timer-v2-brand"><img src={STUDYCRACK_LOGO_SRC} alt="StudyCrack" /><span><b>StudyCrack</b><small>{user?.name ? `${user.name}님의 합격 루틴` : '오늘의 합격 루틴'}</small></span></span>
      <TimerProfileShortcut user={user} />
    </header>
  );
}

function HomeStatusRail({ aquariumPresentation, normalizedTargetMajor = '' }) {
  const targetLabel = normalizedTargetMajor ? String(normalizedTargetMajor).split(' ')[0] : '목표 설정';
  const streakDays = aquariumPresentation?.streakDays;
  return (
    <section className="timer-v2-status-rail" aria-label="학습 현황 바로가기">
      <button type="button" data-action="goto" data-target="analysis"><Icon name="target" /><small>목표 대학</small><b>{targetLabel}</b></button>
      <button type="button" data-action="openStreakSummary"><Icon name="bolt" /><small>연속 학습</small><b>{streakDays != null ? `${streakDays}일` : '확인 필요'}</b></button>
      <button type="button" data-action="goto" data-target="aquarium"><Icon name="fish" /><small>보유 물고기</small><b>{aquariumPresentation?.ownedCount != null ? `${aquariumPresentation.ownedCount}마리` : '확인 필요'}</b></button>
      <button type="button" data-action="goto" data-target="strategy"><Icon name="chat" /><small>SKY 코칭</small><b>바로가기</b></button>
    </section>
  );
}

function HomeTargetSummary({ calendarNearestDdayLabel = '', calendarNearestEvent = null, normalizedTargetMajor = '' }) {
  return (
    <button type="button" className="timer-v2-target-summary" data-action="goto" data-target="analysis">
      <span><small>1지망 목표</small><b>{normalizedTargetMajor || '희망 대학을 설정해주세요'}</b><em>오늘의 공부를 목표와 연결해보세요</em></span>
      <span><b>{calendarNearestDdayLabel || '일정'}</b><small>{calendarNearestEvent?.title || '입시 일정 확인'}</small></span>
    </button>
  );
}

function TimerQuickLinks() {
  return (
    <section className="timer-v2-quick" aria-label="보조 기능">
      <button type="button" data-action="goto" data-target="my"><Icon name="user" /><span><b>학습 프로필 설정</b><small>저장한 정보 확인과 보완</small></span><i aria-hidden="true">›</i></button>
      <button type="button" data-action="goto" data-target="analysis"><Icon name="chart" /><span><b>환산 분석</b><small>대학별 점수와 효율</small></span><i aria-hidden="true">›</i></button>
      <button type="button" data-action="goRanking"><Icon name="chart" /><span><b>공부 랭킹</b><small>오늘의 집중 순위</small></span><i aria-hidden="true">›</i></button>
      <button type="button" data-action="goto" data-target="notificationList"><Icon name="bell" /><span><b>알림</b><small>새 소식 확인</small></span><i aria-hidden="true">›</i></button>
    </section>
  );
}


export function HomeDashboard(props) {
  const { user, aquariumPresentation, normalizedTargetMajor, analysisScoreView, calendarNearestDdayLabel, calendarNearestEvent, studyOverview, studySummary, studySummaryStatus } = props;
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const panelRef = useRef(null);
  const forcedOpen = Boolean(props.studyStartBlocked || props.studyTimerRunning || props.timerPhase !== 'idle' || props.lastCompletedSession || props.rewardResult);
  const expanded = forcedOpen || manuallyExpanded;
  const showTimer = () => { panelRef.current?.scrollIntoView({ block: 'start' }); panelRef.current?.focus({ preventScroll: true }); };
  return <main className="timer-screen-v2">
    <TimerHeader user={user} />
    <HomeStatusRail aquariumPresentation={aquariumPresentation} normalizedTargetMajor={normalizedTargetMajor} />
    <HomeTargetSummary analysisScoreView={analysisScoreView} calendarNearestDdayLabel={calendarNearestDdayLabel} calendarNearestEvent={calendarNearestEvent} normalizedTargetMajor={normalizedTargetMajor} />
    {forcedOpen ? <button type="button" className="home-active-study" onClick={showTimer}><Icon name="timer" /><span>{props.studyTimerRunning ? '공부 기록 중' : '공부 기록·보상 확인'} · 타이머로 이동</span><Icon name="chevron" /></button> : null}
    <section className="home-study-highlight sc-card" aria-label="오늘의 학습 지표"><button type="button" className="home-score-summary" data-action="goto" data-target="analysis"><span><small>저장 성적 기반 환산점수</small><b>{analysisScoreView?.hasScore && Number.isFinite(analysisScoreView.score) ? `${Math.round(analysisScoreView.score)}점` : normalizedTargetMajor ? '환산점수 확인하기' : '목표 대학 설정하기'}</b></span><Icon name="chevron" /></button><StudyOverviewCard overview={studyOverview} variant="inline" compact /></section>
    <HomePlannerPreview {...props} />
    <HomeAquariumPreview presentation={aquariumPresentation} />
    <TimerSessionPanel {...props} expanded={expanded} forcedOpen={forcedOpen} onToggle={() => setManuallyExpanded(value => !value)} panelRef={panelRef} />
    <section className="timer-v2-week sc-card"><div className="timer-section-head"><div><span>학습 기록</span><h2>이번 주 흐름</h2></div><button type="button" data-action="openGameRules" aria-label="수조 성장 규칙 보기">규칙 보기</button></div><StudyWeekSummary overview={studyOverview} summary={studySummary} status={studySummaryStatus} /></section>
    <TimerQuickLinks />
  </main>;
}
