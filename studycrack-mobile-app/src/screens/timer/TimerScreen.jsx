import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { GameRulesGuide } from '../../components/aquarium/GameRulesGuide.jsx';
import { defaultFormatHms } from './presentation.js';
import { HomeDashboard } from './HomeDashboard.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { StudyWeekSummary } from './StudyGamificationPanels.jsx';

const STUDY_START_BUSY_PHASES = ['starting-session', 'settling-session'];

function TimerLoadingScreen({ tab = 'timer' }) {
  return (
    <AppScreenShell screen="timer" tab={tab}>
      <main className="timer-screen-v2 timer-screen-loading" aria-busy="true" aria-label="타이머 화면을 불러오는 중입니다">
        <div className="sc-skeleton timer-v2-skeleton-head" aria-hidden="true" />
        <div className="sc-skeleton timer-v2-skeleton-clock" aria-hidden="true" />
        <div className="sc-skeleton timer-v2-skeleton-summary" aria-hidden="true" />
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
export function TimerScreen(ctx) {
  const {
    activeStudySession = null,
    canAccessBasic = false,
    completionError = '',
    dimmed = false,
    formatHms = defaultFormatHms,
    gameRules = null,
    gameRulesOpen = false,
    hasClientSession = () => false,
    lastCompletedSession = null,
    rewardPendingSessionId = '',
    rewardResult = null,
    normalizedTargetMajor = '',
    calendarNearestDdayLabel = '',
    calendarNearestEvent = null,
    analysisScoreView = null,
    studySummary = null,
    studySummaryStatus = 'idle',
    studySessionDetailsOpen = false,
    studySubjectSheetOpen = false,
    studyTimerRunning = false,
    studyTimerTick = 0,
    tab = 'timer',
    timerPhase = 'idle',
    todayPlannerItems = [],
    user = {},
    userLoadError = '',
    userLoadStatus = 'idle'
  } = ctx;
  const sessionActive = typeof hasClientSession === 'function' && hasClientSession();
  if (sessionActive && userLoadStatus === 'error') return <TimerLoadFailure message={userLoadError} tab={tab} />;
  if (sessionActive && userLoadStatus !== 'ready') return <TimerLoadingScreen tab={tab} />;

  const liveSeconds = studyTimerRunning ? Math.max(0, Number(studyTimerTick) || 0) : 0;
  const hasServerSummary = ctx.studyOverview?.confirmed.seconds != null;
  const displayedTodaySeconds = ctx.studyOverview?.confirmed.seconds;
  const confirmedLabel = ctx.studyOverview?.timeGoal.datesMatch ? '오늘 확정 공부' : `${ctx.studyOverview?.confirmed.date || '날짜 확인 필요'} 확정 공부`;
  const studyStartBusy = STUDY_START_BUSY_PHASES.includes(timerPhase);
  const recoveryBlocked = (ctx.studyRecovery?.pending?.length || 0) >= 100 || ctx.rewardRecoveryError?.startsWith('복구 기록');
  const studyStartBlocked = Boolean(activeStudySession) || recoveryBlocked || studyStartBusy;
  const studyStartBlockReason = recoveryBlocked ? '복구 기록을 먼저 확인해주세요.' : activeStudySession
      ? '진행 중인 공부를 완료한 뒤 새 공부를 시작할 수 있어요.'
      : '공부 기록 처리가 끝난 뒤 새 공부를 시작할 수 있어요.';
  const overlays = gameRulesOpen ? <GameRulesGuide gameRules={gameRules} gameProfileStatus={ctx.gameProfileStatus} open /> : ctx.studyPanelMode === 'records' ? <Sheet dismissAction="closeStudyPanel" ariaLabel={ctx.studyPanelMode === 'records' ? '공부 기록' : '공부 타이머'} panelClass="study-record-sheet">
    {ctx.studyPanelMode === 'records' ? <section className="timer-v2-week"><header className="timer-session-head"><h2>공부 기록</h2><button type="button" data-action="closeStudyPanel">닫기</button></header><div className="timer-section-head"><h2>이번 주 흐름</h2><button type="button" data-action="openGameRules" aria-label="수조 성장 규칙 보기">규칙 보기</button></div><StudyWeekSummary overview={ctx.studyOverview} summary={studySummary} status={studySummaryStatus} /><button type="button" className="btn btn-secondary" data-action="openStudyPanel">타이머 열기</button></section> : null}
  </Sheet> : null;

  return (
    <AppScreenShell screen="timer" tab={tab} dimmed={dimmed} overlayOpen={Boolean(overlays)} overlays={overlays}>
      <HomeDashboard {...ctx} user={user} canAccessBasic={canAccessBasic} activeStudySession={activeStudySession} completionError={completionError} lastCompletedSession={lastCompletedSession} rewardPendingSessionId={rewardPendingSessionId} rewardResult={rewardResult} normalizedTargetMajor={normalizedTargetMajor} calendarNearestDdayLabel={calendarNearestDdayLabel} calendarNearestEvent={calendarNearestEvent} analysisScoreView={analysisScoreView} studySummary={studySummary} studySummaryStatus={studySummaryStatus} studySessionDetailsOpen={studySessionDetailsOpen} studyTimerRunning={studyTimerRunning} timerPhase={timerPhase} todayPlannerItems={todayPlannerItems} confirmedLabel={confirmedLabel} summaryReady={hasServerSummary} displayedTodaySeconds={displayedTodaySeconds} formatHms={formatHms} liveSeconds={liveSeconds} studyStartBlocked={studyStartBlocked} studyStartBlockReason={studyStartBlockReason} />
    </AppScreenShell>
  );
}
