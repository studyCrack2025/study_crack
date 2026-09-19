import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { Modal } from '../../components/Modal.jsx';
import { StudySubjectSheet } from './TimerOverlays.jsx';
import { defaultFormatHms } from './presentation.js';
import { HomeDashboard } from './HomeDashboard.jsx';

const STUDY_START_BUSY_PHASES = ['starting-session', 'settling-session', 'claiming-reward'];

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



function GameRulesModal({ gameRules = null, open = false }) {
  const tiers = Array.isArray(gameRules?.rewardTiers) ? gameRules.rewardTiers : [];
  const stages = Array.isArray(gameRules?.habitatStages) ? gameRules.habitatStages : [];
  const drawOdds = gameRules?.drawPolicy?.oddsBasisPoints || null;
  const drawPity = gameRules?.drawPolicy?.pityLimits || null;
  const rarityLabels = { common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' };
  return <Modal open={open} dismissAction="closeGameRules" ariaLabel="수조 성장 규칙" panelClass="timer-rules-modal"><div className="timer-rules-head"><span>수조 성장 규칙</span><h3>공부한 만큼 수조가 자라요</h3><p>완료한 공부 시간으로 조개와 먹이를 받고, 하루의 서식지도 달라집니다.</p></div>{tiers.length ? <section><b>공부 완료 보상</b><div className="timer-rules-tiers">{tiers.map((tier) => <span key={tier.minimumMinutes}><b>{tier.minimumMinutes}분 이상</b><small>조개 {tier.shells} · 먹이 {tier.food}</small></span>)}</div><p>하루 최대 조개 {gameRules.dailyCaps?.shells || 0}개, 먹이 {gameRules.dailyCaps?.food || 0}개까지 받을 수 있어요.</p></section> : <p className="timer-rules-unavailable">규칙 정보를 불러오는 중이에요. 잠시 후 다시 확인해주세요.</p>}{stages.length ? <section><b>서식지 성장</b><div className="timer-rules-stages">{stages.map((stage, index) => <span data-stage={index} key={stage.minimumMinutes}><i /><b>{stage.minimumMinutes}분</b><small>{stage.label}</small></span>)}</div></section> : null}{gameRules?.fishCare ? <section><b>물고기 돌보기</b><div className="timer-rules-care"><span>먹이 {gameRules.fishCare.foodCost}개로 EXP {gameRules.fishCare.expGain} 획득</span><span>조개 {gameRules.drawCostShells}개로 새 물고기 만나기</span></div></section> : null}{drawOdds ? <section><b>물고기 만남 확률</b><div className="timer-rules-odds">{Object.entries(drawOdds).map(([rarity, basisPoints]) => <span data-rarity={rarity} key={rarity}><b>{rarityLabels[rarity] || rarity}</b><small>{Number(basisPoints) / 100}%</small></span>)}</div>{drawPity ? <p>희귀 {drawPity.rare}회, 영웅 {drawPity.epic}회, 전설 {drawPity.legendary}회 안에는 해당 등급 이상을 확정해요.</p> : null}<p>Special 물고기는 일반 뽑기가 아닌 업적과 이벤트 보상으로 만날 수 있어요.</p></section> : null}<button type="button" className="btn btn-primary" data-action="closeGameRules">확인</button></Modal>;
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
  const studyStartBlocked = Boolean(activeStudySession) || Boolean(rewardPendingSessionId) || studyStartBusy;
  const studyStartBlockReason = rewardPendingSessionId
    ? '저장된 공부 보상 확인을 마친 뒤 새 공부를 시작할 수 있어요.'
    : activeStudySession
      ? '진행 중인 공부를 완료한 뒤 새 공부를 시작할 수 있어요.'
      : '공부 기록 처리가 끝난 뒤 새 공부를 시작할 수 있어요.';
  const overlays = studySubjectSheetOpen || gameRulesOpen ? <><StudySubjectSheet {...ctx} /><GameRulesModal gameRules={gameRules} open={gameRulesOpen} /></> : null;

  return (
    <AppScreenShell screen="timer" tab={tab} dimmed={dimmed} overlays={overlays}>
      <HomeDashboard {...ctx} user={user} canAccessBasic={canAccessBasic} activeStudySession={activeStudySession} completionError={completionError} lastCompletedSession={lastCompletedSession} rewardPendingSessionId={rewardPendingSessionId} rewardResult={rewardResult} normalizedTargetMajor={normalizedTargetMajor} calendarNearestDdayLabel={calendarNearestDdayLabel} calendarNearestEvent={calendarNearestEvent} analysisScoreView={analysisScoreView} studySummary={studySummary} studySummaryStatus={studySummaryStatus} studySessionDetailsOpen={studySessionDetailsOpen} studyTimerRunning={studyTimerRunning} timerPhase={timerPhase} todayPlannerItems={todayPlannerItems} confirmedLabel={confirmedLabel} summaryReady={hasServerSummary} displayedTodaySeconds={displayedTodaySeconds} formatHms={formatHms} liveSeconds={liveSeconds} studyStartBlocked={studyStartBlocked} studyStartBlockReason={studyStartBlockReason} />
    </AppScreenShell>
  );
}
