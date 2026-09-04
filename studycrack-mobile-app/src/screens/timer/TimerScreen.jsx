import { useEffect, useState } from 'react';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Modal } from '../../components/Modal.jsx';
import { STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';
import { StudySubjectSheet } from './TimerOverlays.jsx';
import { StudyJourneyPanel, StudyWeekSummary } from './StudyGamificationPanels.jsx';
import { defaultFormatHms, defaultFormatMinutesLabel } from './presentation.js';
import { ProfileDrawer } from '../mypage/ProfileDrawer.jsx';

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

function HomeStatusRail({ fishCount = 0, gameProfile = null, normalizedTargetMajor = '' }) {
  const targetLabel = normalizedTargetMajor ? String(normalizedTargetMajor).split(' ')[0] : '목표 설정';
  const streakDays = Math.max(0, Number(gameProfile?.streakDays) || 0);
  return (
    <section className="timer-v2-status-rail" aria-label="학습 현황 바로가기">
      <button type="button" data-action="goto" data-target="analysis"><small>목표 대학</small><b>{targetLabel}</b></button>
      <span><small>합격 스트릭</small><b>{streakDays}일</b></span>
      <button type="button" data-action="goto" data-target="aquarium"><small>물고기</small><b>{Math.max(0, Number(fishCount) || 0)}종</b></button>
      <button type="button" data-action="goto" data-target="strategy"><small>SKY 코칭</small><b>바로가기</b></button>
    </section>
  );
}

function HomeTargetSummary({ analysisScoreView = null, calendarNearestDdayLabel = '', calendarNearestEvent = null, normalizedTargetMajor = '' }) {
  const scoreReady = Boolean(analysisScoreView?.hasScore) && !analysisScoreView?.pending;
  const score = Math.max(0, Number(analysisScoreView?.score) || 0);
  return (
    <button type="button" className="timer-v2-target-summary" data-action="goto" data-target="analysis">
      <span><small>1지망 목표</small><b>{normalizedTargetMajor || '희망 대학을 설정해주세요'}</b><em>{scoreReady ? `현재 환산점수 ${Math.round(score)}점` : '저장 성적으로 환산점수를 확인해보세요'}</em></span>
      <span><b>{calendarNearestDdayLabel || '일정'}</b><small>{calendarNearestEvent?.title || '입시 일정 확인'}</small></span>
    </button>
  );
}

function sessionTimeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function StudySessionRows({ activeStudySession, formatHms, liveSeconds = 0, sessions = [] }) {
  const rows = activeStudySession ? [{ ...activeStudySession, durationSeconds: liveSeconds, isActive: true }, ...sessions] : sessions;
  if (!rows.length) return <p className="timer-session-empty">새로 완료한 공부부터 과목별 상세 기록이 여기에 쌓여요.</p>;
  return <div className="timer-session-list">{rows.map((session, index) => <div className={`timer-session-row ${session.isActive ? 'is-active' : ''}`} key={session.sessionId || `${session.startedAt}-${index}`}><span><b>{session.subject || '기타'}</b><small>{session.activity || `${session.subject || '기타'} 학습`}</small></span><span><b>{formatHms(Number(session.durationSeconds) || 0)}</b><small>{sessionTimeLabel(session.startedAt)}{session.endedAt ? ` - ${sessionTimeLabel(session.endedAt)}` : ' - 진행 중'}</small></span></div>)}</div>;
}

function TimerControlCard({ activeStudySession, displayedTodaySeconds, formatHms, liveSeconds, studySessionDetailsOpen, studyStartBlocked, studySummary, studyTimerRunning, timerPhase }) {
  const timerBusy = STUDY_START_BUSY_PHASES.includes(timerPhase);
  const canComplete = Boolean(activeStudySession) && ['running', 'recoverable-error'].includes(timerPhase);
  const subject = activeStudySession?.subject || '';
  return (
    <section className={`timer-v2-control sc-card ${studyTimerRunning ? 'is-running' : ''}`}>
      <div className="timer-v2-control-top"><span>{studyTimerRunning ? '현재 집중 시간' : '오늘 누적 공부'}</span>{subject ? <b>{subject}</b> : <b>대기</b>}</div>
      <button type="button" className="timer-v2-clock-trigger" data-action="toggleStudySessionDetails" aria-expanded={studySessionDetailsOpen}><strong className="timer-v2-clock" data-study-base-seconds={displayedTodaySeconds}>{formatHms(displayedTodaySeconds)}</strong><span>{studySessionDetailsOpen ? '개별 기록 접기' : '개별 기록 보기'} <b aria-hidden="true">⌄</b></span></button>
      <p>{studyTimerRunning ? `${subject || '선택 과목'} 공부가 기록되고 있어요.` : '플래너 일정이나 직접 입력한 공부로 시작할 수 있어요.'}</p>
      {studyTimerRunning ? <div className="timer-resume-note" role="status"><Icon name="timer" /><span>앱을 벗어나도 시작 시각 기준으로 이어 기록돼요.</span></div> : null}
      {studySessionDetailsOpen ? <StudySessionRows activeStudySession={activeStudySession} formatHms={formatHms} liveSeconds={liveSeconds} sessions={studySummary?.today?.sessions || []} /> : null}
      <div className="timer-v2-actions">
        <button type="button" className="btn btn-primary" data-action="openStudySubjectSheet" disabled={studyStartBlocked} aria-describedby={studyStartBlocked ? 'timer-study-start-blocked' : undefined}><Icon name="timer" /> 공부 시작</button>
        <button type="button" className="btn btn-secondary" data-action="stopStudyTimer" disabled={!canComplete || timerBusy}>{timerPhase === 'recoverable-error' ? '완료 다시 확인' : '공부 완료'}</button>
      </div>
    </section>
  );
}

function GameRulesModal({ gameRules = null, open = false }) {
  const tiers = Array.isArray(gameRules?.rewardTiers) ? gameRules.rewardTiers : [];
  const stages = Array.isArray(gameRules?.habitatStages) ? gameRules.habitatStages : [];
  const drawOdds = gameRules?.drawPolicy?.oddsBasisPoints || null;
  const drawPity = gameRules?.drawPolicy?.pityLimits || null;
  const rarityLabels = { common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' };
  return <Modal open={open} dismissAction="closeGameRules" panelClass="timer-rules-modal"><div className="timer-rules-head"><span>수조 성장 규칙</span><h3>공부한 만큼 수조가 자라요</h3><p>완료한 공부 시간으로 조개와 먹이를 받고, 하루의 서식지도 달라집니다.</p></div>{tiers.length ? <section><b>공부 완료 보상</b><div className="timer-rules-tiers">{tiers.map((tier) => <span key={tier.minimumMinutes}><b>{tier.minimumMinutes}분 이상</b><small>조개 {tier.shells} · 먹이 {tier.food}</small></span>)}</div><p>하루 최대 조개 {gameRules.dailyCaps?.shells || 0}개, 먹이 {gameRules.dailyCaps?.food || 0}개까지 받을 수 있어요.</p></section> : <p className="timer-rules-unavailable">규칙 정보를 불러오는 중이에요. 잠시 후 다시 확인해주세요.</p>}{stages.length ? <section><b>서식지 성장</b><div className="timer-rules-stages">{stages.map((stage, index) => <span data-stage={index} key={stage.minimumMinutes}><i /><b>{stage.minimumMinutes}분</b><small>{stage.label}</small></span>)}</div></section> : null}{gameRules?.fishCare ? <section><b>물고기 돌보기</b><div className="timer-rules-care"><span>먹이 {gameRules.fishCare.foodCost}개로 EXP {gameRules.fishCare.expGain} 획득</span><span>조개 {gameRules.drawCostShells}개로 새 물고기 만나기</span></div></section> : null}{drawOdds ? <section><b>물고기 만남 확률</b><div className="timer-rules-odds">{Object.entries(drawOdds).map(([rarity, basisPoints]) => <span data-rarity={rarity} key={rarity}><b>{rarityLabels[rarity] || rarity}</b><small>{Number(basisPoints) / 100}%</small></span>)}</div>{drawPity ? <p>희귀 {drawPity.rare}회, 영웅 {drawPity.epic}회, 전설 {drawPity.legendary}회 안에는 해당 등급 이상을 확정해요.</p> : null}<p>Special 물고기는 일반 뽑기가 아닌 업적과 이벤트 보상으로 만날 수 있어요.</p></section> : null}<button type="button" className="btn btn-primary" data-action="closeGameRules">확인</button></Modal>;
}

function TodayPlanCard({ canAccessBasic, displayedPlannerProgress, formatMinutesLabel, studyStartBlocked, studyStartBlockReason, todayPlannerItems, todayPlannerTotalMinutes }) {
  const preview = todayPlannerItems.slice(0, 3);
  const completedCount = todayPlannerItems.filter((item) => item.done).length;
  const nextItem = todayPlannerItems.find((item) => !item.done);
  return (
    <section className="timer-v2-plan sc-card">
      <div className="timer-section-head"><div><span>TODAY PLAN</span><h2>오늘의 플래너</h2><p>{todayPlannerItems.length ? `해야 할 공부 ${todayPlannerItems.length}개` : '아직 등록한 계획이 없어요'}</p></div><button type="button" data-action="goto" data-target="planner">전체 보기 <b aria-hidden="true">›</b></button></div>
      {studyStartBlocked ? <p className="timer-start-blocked-note" id="timer-study-start-blocked" role="status">{studyStartBlockReason}</p> : null}
      {canAccessBasic && preview.length ? <>
        <div className="timer-v2-plan-progress"><span><i style={{ width: `${displayedPlannerProgress}%` }} /></span><b>{completedCount}/{todayPlannerItems.length}</b><small>오늘 공부 {displayedPlannerProgress}% 완료 · 목표 {formatMinutesLabel(todayPlannerTotalMinutes)}</small></div>
        <div className="timer-v2-plan-list">{preview.map((item) => <button type="button" data-action="selectStudySubject" data-study-subject={item.subject || '기타'} data-study-activity={item.content || ''} data-study-item-id={item.id} disabled={item.done || studyStartBlocked} aria-describedby={studyStartBlocked ? 'timer-study-start-blocked' : undefined} key={item.id}><span>{item.subject || '기타'}</span><b>{item.content || '학습 계획'}</b><small>{item.done ? '완료' : `${Number(item.minutes) || 0}분`}</small></button>)}</div>
        <button type="button" className="timer-v2-plan-primary" data-action={nextItem ? 'selectStudySubject' : 'goto'} data-target={nextItem ? undefined : 'planner'} data-study-subject={nextItem?.subject || undefined} data-study-activity={nextItem?.content || undefined} data-study-item-id={nextItem?.id || undefined} disabled={Boolean(nextItem) && studyStartBlocked} aria-describedby={nextItem && studyStartBlocked ? 'timer-study-start-blocked' : undefined}>{nextItem ? `먼저 ${nextItem.subject || '다음 공부'}부터 시작하기` : '오늘 계획을 모두 완료했어요'}</button>
      </> : <div className="timer-v2-plan-empty"><p>{canAccessBasic ? '플래너에서 오늘 할 일을 추가하면 바로 타이머로 시작할 수 있어요.' : 'Basic 이상에서 일일 계획과 타이머를 연결할 수 있어요.'}</p><button type="button" data-action="goto" data-target="planner">계획 만들기</button></div>}
    </section>
  );
}

function TimerQuickLinks() {
  return (
    <section className="timer-v2-quick" aria-label="보조 기능">
      <button type="button" data-action="goto" data-target="analysis"><Icon name="chart" /><span><b>환산 분석</b><small>대학별 점수와 효율</small></span><i aria-hidden="true">›</i></button>
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
    gameProfile = null,
    gameProfileStatus = 'idle',
    gameRules = null,
    gameRulesOpen = false,
    hasClientSession = () => false,
    lastCompletedSession = null,
    rewardPendingSessionId = '',
    rewardResult = null,
    selectedPlan = '',
    normalizedTargetMajor = '',
    calendarNearestDdayLabel = '',
    calendarNearestEvent = null,
    fishCount = 0,
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
  const studyStartBusy = STUDY_START_BUSY_PHASES.includes(timerPhase);
  const studyStartBlocked = Boolean(activeStudySession) || Boolean(rewardPendingSessionId) || studyStartBusy;
  const studyStartBlockReason = rewardPendingSessionId
    ? '저장된 공부 보상 확인을 마친 뒤 새 공부를 시작할 수 있어요.'
    : activeStudySession
      ? '진행 중인 공부를 완료한 뒤 새 공부를 시작할 수 있어요.'
      : '공부 기록 처리가 끝난 뒤 새 공부를 시작할 수 있어요.';
  const overlays = studySubjectSheetOpen || drawerOpen || gameRulesOpen ? <><StudySubjectSheet {...ctx} /><ProfileDrawer drawerOpen={drawerOpen} gameProfile={gameProfile} gameProfileStatus={gameProfileStatus} selectedPlan={selectedPlan} studySummary={studySummary} studySummaryStatus={studySummaryStatus} user={user} /><GameRulesModal gameRules={gameRules} open={gameRulesOpen} /></> : null;

  return (
    <AppScreenShell screen="timer" tab={tab} dimmed={dimmed} overlays={overlays}>
      <main className="timer-screen-v2">
        <TimerHeader user={user} />
        <HomeStatusRail fishCount={fishCount} gameProfile={gameProfile} normalizedTargetMajor={normalizedTargetMajor} />
        <HomeTargetSummary analysisScoreView={analysisScoreView} calendarNearestDdayLabel={calendarNearestDdayLabel} calendarNearestEvent={calendarNearestEvent} normalizedTargetMajor={normalizedTargetMajor} />
        <TodayPlanCard canAccessBasic={canAccessBasic} displayedPlannerProgress={displayedPlannerProgress} formatMinutesLabel={defaultFormatMinutesLabel} studyStartBlocked={studyStartBlocked} studyStartBlockReason={studyStartBlockReason} todayPlannerItems={todayPlannerItems} todayPlannerTotalMinutes={todayPlannerTotalMinutes} />
        <TimerControlCard activeStudySession={activeStudySession} displayedTodaySeconds={displayedTodaySeconds} formatHms={formatHms} liveSeconds={liveSeconds} studySessionDetailsOpen={studySessionDetailsOpen} studyStartBlocked={studyStartBlocked} studySummary={studySummary} studyTimerRunning={studyTimerRunning} timerPhase={timerPhase} />
        <StudyJourneyPanel activeStudySession={activeStudySession} completionError={completionError} lastCompletedSession={lastCompletedSession} rewardPendingSessionId={rewardPendingSessionId} rewardResult={rewardResult} timerPhase={timerPhase} />
        <section className="timer-v2-week sc-card"><div className="timer-section-head"><div><span>학습 기록</span><h2>이번 주 흐름</h2></div><button type="button" data-action="openGameRules" aria-label="수조 성장 규칙 보기">규칙 보기</button></div><StudyWeekSummary activeSubject={activeStudySession?.subject || ''} liveSeconds={liveSeconds} summary={studySummary} status={studySummaryStatus} /></section>
        <TimerQuickLinks />
      </main>
    </AppScreenShell>
  );
}
