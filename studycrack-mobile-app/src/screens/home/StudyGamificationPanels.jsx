import { selectRecentHabitat } from '../../features/gamification/selectors.js';

const STUDY_WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function minutesLabel(seconds = 0) {
  const minutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}

export function StudyWeekSummary({ activeSubject = '', liveSeconds = 0, summary = null, status = 'idle' }) {
  if (status === 'loading' && !summary) return <div className="timer-week-loading" role="status"><i /><span>이번 주 공부 흐름을 정리하고 있어요.</span></div>;
  if (!summary?.week?.days?.length || status === 'error' || status === 'unavailable') {
    return (
      <div className="timer-week-empty">
        <span>{status === 'error' ? '공부 요약을 잠시 불러오지 못했어요.' : '공부를 완료하면 주간 흐름이 이곳에 쌓여요.'}</span>
        {status === 'error' ? <button type="button" data-action="retryStudySummary">다시 불러오기</button> : null}
      </div>
    );
  }
  const currentLive = Math.max(0, Number(liveSeconds) || 0);
  const todayDate = summary.today?.date || '';
  const days = summary.week.days.map((day) => ({
    ...day,
    totalSeconds: (Number(day.totalSeconds) || 0) + (day.date === todayDate ? currentLive : 0)
  }));
  const maxSeconds = Math.max(1, ...days.map((day) => day.totalSeconds));
  const subjectMap = new Map((summary.today?.subjects || []).map((row) => [row.subject, Number(row.seconds) || 0]));
  if (activeSubject && currentLive) subjectMap.set(activeSubject, (subjectMap.get(activeSubject) || 0) + currentLive);
  const subjects = [...subjectMap.entries()].map(([subject, seconds]) => ({ subject, seconds })).sort((left, right) => right.seconds - left.seconds).slice(0, 4);
  return (
    <div className="timer-week-summary">
      <div className="timer-week-summary-head"><span>이번 주</span><b>{minutesLabel((Number(summary.week.totalSeconds) || 0) + currentLive)}</b></div>
      <div className="timer-week-chart" aria-label="이번 주 일별 공부 시간">
        {days.map((day, index) => (
          <div className={`timer-week-day ${day.date === todayDate ? 'is-today' : ''}`} key={day.date}>
            <span><i style={{ height: `${Math.max(day.totalSeconds ? 10 : 2, Math.round((day.totalSeconds / maxSeconds) * 100))}%` }} /></span>
            <b>{STUDY_WEEK_LABELS[index]}</b>
            <small>{Math.round(day.totalSeconds / 60)}</small>
          </div>
        ))}
      </div>
      <div className="timer-today-subjects">
        <span>오늘 과목</span>
        <div>{subjects.length ? subjects.map((row) => <b key={row.subject}>{row.subject}<small>{minutesLabel(row.seconds)}</small></b>) : <p>아직 완료한 공부가 없어요.</p>}</div>
      </div>
    </div>
  );
}

export function HabitatStrip({ days = [], status = 'idle' }) {
  const recent = selectRecentHabitat(days, 7);
  if (status === 'loading') return <div className="timer-habitat-loading">최근 공부 기록을 불러오고 있어요.</div>;
  if (!recent.length) return <div className="timer-habitat-empty">첫 공부를 완료하면 이곳에 하루의 서식지가 생겨요.</div>;
  return (
    <div className="timer-habitat-days" aria-label="최근 7일 공부 서식지">
      {recent.map((day) => (
        <div className="timer-habitat-day" data-stage={day.stage} key={day.date}>
          <span className="timer-habitat-scene"><i /><i /><i /></span>
          <b>{day.date.slice(5).replace('-', '.')}</b>
          <small>{Math.round((Number(day.studySeconds) || 0) / 60)}분</small>
        </div>
      ))}
    </div>
  );
}

function calculateHabitatStreak(days = []) {
  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if ((Number(days[index]?.studySeconds) || 0) <= 0) break;
    streak += 1;
  }
  return streak;
}

export function HabitatMonth({ days = [] }) {
  if (!days.length) return null;
  return (
    <div className="timer-habitat-month" aria-label="최근 30일 공부 서식지">
      {days.slice(-30).map((day) => (
        <span className="timer-habitat-cell" data-stage={day.stage} key={day.date} title={`${day.date} ${Math.round((Number(day.studySeconds) || 0) / 60)}분`}><i /></span>
      ))}
    </div>
  );
}

export function RewardPanel({ activeStudySession, completionError, rewardPendingSessionId, rewardResult, timerPhase }) {
  if (timerPhase === 'settling-session' || timerPhase === 'claiming-reward') {
    return <div className="timer-status-panel is-loading" role="status"><i /><b>{timerPhase === 'settling-session' ? '공부 기록을 저장하고 있어요' : '오늘의 성장 보상을 확인하고 있어요'}</b></div>;
  }
  if (timerPhase === 'recoverable-error' && completionError) {
    return (
      <div className="timer-status-panel is-error" role="alert">
        <div><b>{rewardPendingSessionId ? '공부 기록은 안전하게 저장됐어요' : '연결을 다시 확인해주세요'}</b><p>{completionError}</p></div>
        {rewardPendingSessionId ? <button type="button" className="btn btn-secondary" data-action="retryStudyReward">보상 다시 확인</button> : null}
        {!rewardPendingSessionId && activeStudySession?.status === 'starting' ? <button type="button" className="btn btn-secondary" data-action="retryStudyStart">공부 시작 다시 연결</button> : null}
      </div>
    );
  }
  if (!rewardResult) return null;
  const hasReward = rewardResult.shells > 0 || rewardResult.food > 0;
  return (
    <div className="timer-reward-panel" role="status">
      <div className="timer-reward-copy"><span>공부 완료</span><b>{hasReward ? '수조가 한 걸음 성장했어요' : '공부 기록이 차곡차곡 쌓였어요'}</b></div>
      <div className="timer-reward-values"><span>조개 <b>+{rewardResult.shells}</b></span><span>먹이 <b>+{rewardResult.food}</b></span></div>
      <button type="button" className="timer-reward-close" data-action="dismissRewardResult">확인</button>
    </div>
  );
}

export function StudyHabitatCard({ gameProfileError = '', gameProfileStatus = 'idle', habitatDays = [], habitatStatus = 'idle' }) {
  const habitatStreak = calculateHabitatStreak(habitatDays);
  return (
    <section className="timer-habitat-card sc-card">
      <div className="timer-section-head"><div><span>최근 30일</span><h2>공부 서식지</h2></div><b>{habitatStreak ? `${habitatStreak}일 연속` : '첫 기록 대기'}</b></div>
      <HabitatStrip days={habitatDays} status={habitatStatus} />
      <HabitatMonth days={habitatDays} />
      {gameProfileStatus === 'error' ? <div className="timer-game-error"><p>{gameProfileError}</p><button type="button" data-action="retryGameResources">다시 불러오기</button></div> : null}
    </section>
  );
}
