import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { Icon } from '../../components/Icon.jsx';
import { StudySubjectSheet } from '../home/HomeOverlays.jsx';
import { RewardPanel, StudyHabitatCard, StudyWeekSummary } from '../home/StudyGamificationPanels.jsx';
import { defaultFormatHms, defaultFormatMinutesLabel } from '../home/presentation.js';
import { ProfileDrawer } from '../mypage/ProfileDrawer.jsx';

function TimerLoadingScreen({ tab = 'timer' }) {
  return (
    <AppScreenShell screen="timer" tab={tab}>
      <main className="timer-screen-v2 timer-screen-loading" aria-busy="true" aria-label="타이머 화면을 불러오는 중입니다">
        <div className="timer-v2-skeleton timer-v2-skeleton-head" />
        <div className="timer-v2-skeleton timer-v2-skeleton-clock" />
        <div className="timer-v2-skeleton timer-v2-skeleton-summary" />
      </main>
    </AppScreenShell>
  );
}

function TimerLoadFailure({ message = '', tab = 'timer' }) {
  return (
    <AppScreenShell screen="timer" tab={tab}>
      <main className="timer-screen-v2 timer-screen-failure">
        <div className="sc-empty" role="alert">
          <span className="sc-empty-mark" aria-hidden="true">!</span>
          <div><b>학습 정보를 불러오지 못했어요</b><p>{message || '네트워크 상태를 확인한 뒤 다시 시도해주세요.'}</p></div>
          <button type="button" className="btn btn-primary" data-action="retryInit">다시 시도</button>
        </div>
      </main>
    </AppScreenShell>
  );
}

function TimerHeader({ gameProfile = null, user = {} }) {
  const shells = Math.max(0, Number(gameProfile?.shellBalance) || 0);
  const food = Math.max(0, Number(gameProfile?.foodBalance) || 0);
  return (
    <header className="timer-v2-header">
      <div className="timer-v2-heading"><span>오늘의 집중</span><h1>타이머</h1><p>{user?.name ? `${user.name}님의 공부를 기록해요.` : '공부를 시작하고 성장 기록을 남겨보세요.'}</p></div>
      <button type="button" className="timer-v2-profile" data-action="openDrawer" aria-label="프로필 메뉴 열기"><Icon name="user" /></button>
      <div className="timer-v2-wallet" aria-label="게임 재화"><span>조개 <b>{shells}</b></span><span>먹이 <b>{food}</b></span></div>
    </header>
  );
}

function TimerControlCard({ activeStudySession, displayedTodaySeconds, formatHms, studyTimerRunning, timerPhase }) {
  const timerBusy = ['starting-session', 'settling-session', 'claiming-reward'].includes(timerPhase);
  const canComplete = Boolean(activeStudySession) && ['running', 'recoverable-error'].includes(timerPhase);
  const subject = activeStudySession?.subject || '';
  return (
    <section className={`timer-v2-control sc-card ${studyTimerRunning ? 'is-running' : ''}`}>
      <div className="timer-v2-control-top"><span>{studyTimerRunning ? '집중 중' : '오늘 누적 공부'}</span>{subject ? <b>{subject}</b> : <b>준비</b>}</div>
      <strong className="timer-v2-clock" data-study-base-seconds={displayedTodaySeconds}>{formatHms(displayedTodaySeconds)}</strong>
      <p>{studyTimerRunning ? `${subject || '선택 과목'}에 집중한 시간이 안전하게 기록되고 있어요.` : '과목이나 오늘의 플래너 일정을 골라 바로 시작하세요.'}</p>
      <div className="timer-v2-actions">
        <button type="button" className="btn btn-primary" data-action="openStudySubjectSheet" disabled={studyTimerRunning || Boolean(activeStudySession) || timerBusy}><Icon name="timer" /> 공부 시작</button>
        <button type="button" className="btn btn-secondary" data-action="stopStudyTimer" disabled={!canComplete || timerBusy}>{timerPhase === 'recoverable-error' ? '완료 다시 확인' : '공부 완료'}</button>
      </div>
    </section>
  );
}

function TodayPlanCard({ canAccessBasic, displayedPlannerProgress, formatMinutesLabel, todayPlannerItems, todayPlannerTotalMinutes }) {
  const preview = todayPlannerItems.slice(0, 3);
  return (
    <section className="timer-v2-plan sc-card">
      <div className="timer-section-head"><div><span>오늘 계획</span><h2>{todayPlannerItems.length ? `${todayPlannerItems.length}개 학습` : '아직 계획이 없어요'}</h2></div><button type="button" data-action="goto" data-target="planner">플래너 <b aria-hidden="true">›</b></button></div>
      {canAccessBasic && preview.length ? <>
        <div className="timer-v2-plan-progress"><span><i style={{ width: `${displayedPlannerProgress}%` }} /></span><b>{displayedPlannerProgress}%</b><small>목표 {formatMinutesLabel(todayPlannerTotalMinutes)}</small></div>
        <div className="timer-v2-plan-list">{preview.map((item) => <button type="button" data-action="selectStudySubject" data-study-subject={item.subject || '기타'} data-study-item-id={item.id} disabled={item.done} key={item.id}><span>{item.subject || '기타'}</span><b>{item.content || '학습 계획'}</b><small>{item.done ? '완료' : `${Number(item.minutes) || 0}분`}</small></button>)}</div>
      </> : <div className="timer-v2-plan-empty"><p>{canAccessBasic ? '플래너에서 오늘 할 일을 추가하면 바로 타이머로 시작할 수 있어요.' : 'Basic 이상에서 일일 계획과 타이머를 연결할 수 있어요.'}</p><button type="button" data-action="goto" data-target="planner">계획 만들기</button></div>}
    </section>
  );
}

function TimerQuickLinks() {
  return (
    <section className="timer-v2-quick" aria-label="보조 기능">
      <button type="button" data-action="goto" data-target="home"><Icon name="home" /><span><b>학습 대시보드</b><small>대학·캘린더·리포트</small></span><i aria-hidden="true">›</i></button>
      <button type="button" data-action="goRanking"><Icon name="chart" /><span><b>공부 랭킹</b><small>오늘의 집중 순위</small></span><i aria-hidden="true">›</i></button>
      <button type="button" data-action="goto" data-target="notificationList"><Icon name="bell" /><span><b>알림</b><small>새 소식 확인</small></span><i aria-hidden="true">›</i></button>
    </section>
  );
}

export function TimerScreen(ctx) {
  const {
    activeStudySession = null,
    canAccessBasic = false,
    completionError = '',
    dimmed = false,
    drawerOpen = false,
    formatHms = defaultFormatHms,
    formatMinutesLabel = defaultFormatMinutesLabel,
    gameProfile = null,
    gameProfileError = '',
    gameProfileStatus = 'idle',
    habitatDays = [],
    habitatStatus = 'idle',
    hasClientSession = () => false,
    rewardPendingSessionId = '',
    rewardResult = null,
    selectedPlan = '',
    studySummary = null,
    studySummaryStatus = 'idle',
    studySubjectSheetOpen = false,
    studyTimerRunning = false,
    studyTimerTick = 0,
    tab = 'timer',
    timerPhase = 'idle',
    todayPlannerItems = [],
    todayPlannerProgress = 0,
    todayPlannerTotalMinutes = 0,
    todayStudySeconds = 0,
    user = {},
    userLoadError = '',
    userLoadStatus = 'idle'
  } = ctx;
  const sessionActive = typeof hasClientSession === 'function' && hasClientSession();
  if (sessionActive && userLoadStatus === 'error') return <TimerLoadFailure message={userLoadError} tab={tab} />;
  if (sessionActive && userLoadStatus !== 'ready') return <TimerLoadingScreen tab={tab} />;

  const liveSeconds = studyTimerRunning ? Math.max(0, Number(studyTimerTick) || 0) : 0;
  const hasServerSummary = studySummaryStatus === 'ready' && studySummary?.available !== false;
  const baseTodaySeconds = hasServerSummary ? Math.max(0, Number(studySummary?.today?.totalSeconds) || 0) : Math.max(0, Number(todayStudySeconds) || 0);
  const displayedTodaySeconds = baseTodaySeconds + liveSeconds;
  const displayedPlannerProgress = todayPlannerTotalMinutes ? Math.min(100, Math.round((displayedTodaySeconds / (todayPlannerTotalMinutes * 60)) * 100)) : todayPlannerProgress;
  const overlays = studySubjectSheetOpen || drawerOpen ? <><StudySubjectSheet {...ctx} /><ProfileDrawer drawerOpen={drawerOpen} gameProfile={gameProfile} gameProfileStatus={gameProfileStatus} selectedPlan={selectedPlan} studySummary={studySummary} studySummaryStatus={studySummaryStatus} user={user} /></> : null;

  return (
    <AppScreenShell screen="timer" tab={tab} dimmed={dimmed} overlays={overlays}>
      <main className="timer-screen-v2">
        <TimerHeader gameProfile={gameProfile} user={user} />
        <TimerControlCard activeStudySession={activeStudySession} displayedTodaySeconds={displayedTodaySeconds} formatHms={formatHms} studyTimerRunning={studyTimerRunning} timerPhase={timerPhase} />
        <RewardPanel activeStudySession={activeStudySession} completionError={completionError} rewardPendingSessionId={rewardPendingSessionId} rewardResult={rewardResult} timerPhase={timerPhase} />
        <TodayPlanCard canAccessBasic={canAccessBasic} displayedPlannerProgress={displayedPlannerProgress} formatMinutesLabel={formatMinutesLabel} todayPlannerItems={todayPlannerItems} todayPlannerTotalMinutes={todayPlannerTotalMinutes} />
        <section className="timer-v2-week sc-card"><div className="timer-section-head"><div><span>학습 기록</span><h2>이번 주 흐름</h2></div></div><StudyWeekSummary activeSubject={activeStudySession?.subject || ''} liveSeconds={liveSeconds} summary={studySummary} status={studySummaryStatus} /></section>
        <StudyHabitatCard gameProfileError={gameProfileError} gameProfileStatus={gameProfileStatus} habitatDays={habitatDays} habitatStatus={habitatStatus} />
        <TimerQuickLinks />
      </main>
    </AppScreenShell>
  );
}
