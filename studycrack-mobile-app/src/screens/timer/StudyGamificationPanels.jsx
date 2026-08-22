import { useState } from 'react';

const STUDY_WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function minutesLabel(seconds = 0) {
  const minutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}

function exactDurationLabel(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const remainder = String(total % 60).padStart(2, '0');
  return `${hours}:${minutes}:${remainder}`;
}

function subjectTone(subject = '') {
  const value = String(subject);
  if (/국어|언매|화작/.test(value)) return 'korean';
  if (/수학|미적|확통|기하/.test(value)) return 'math';
  if (/영어/.test(value)) return 'english';
  if (/탐구|과학|사회|물리|화학|생명|지구|윤리|역사|지리|정치|경제/.test(value)) return 'science';
  return 'other';
}

export function StudyWeekSummary({ activeSubject = '', liveSeconds = 0, summary = null, status = 'idle' }) {
  const [selectedDate, setSelectedDate] = useState('');
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
  const days = summary.week.days.map((day) => {
    const subjects = (day.subjects || []).map((row) => ({ ...row, seconds: Number(row.seconds) || 0 }));
    if (day.date === todayDate && activeSubject && currentLive) {
      const activeIndex = subjects.findIndex((row) => row.subject === activeSubject);
      if (activeIndex >= 0) subjects[activeIndex] = { ...subjects[activeIndex], seconds: subjects[activeIndex].seconds + currentLive };
      else subjects.push({ subject: activeSubject, seconds: currentLive });
    }
    return { ...day, subjects, totalSeconds: (Number(day.totalSeconds) || 0) + (day.date === todayDate ? currentLive : 0) };
  });
  const maxSeconds = Math.max(1, ...days.map((day) => day.totalSeconds));
  const selectedDay = days.find((day) => day.date === selectedDate) || days.find((day) => day.date === todayDate) || days[days.length - 1];
  const selectedSubjects = [...(selectedDay?.subjects || [])].filter((row) => row.seconds > 0).sort((left, right) => right.seconds - left.seconds);
  return (
    <div className="timer-week-summary">
      <div className="timer-week-summary-head"><span>이번 주 누적</span><b>{exactDurationLabel((Number(summary.week.totalSeconds) || 0) + currentLive)}</b></div>
      <div className="timer-week-chart" aria-label="이번 주 일별 공부 시간">
        {days.map((day, index) => (
          <button type="button" className={`timer-week-day ${day.date === todayDate ? 'is-today' : ''} ${day.date === selectedDay?.date ? 'is-selected' : ''}`} onClick={() => setSelectedDate(day.date)} aria-label={`${STUDY_WEEK_LABELS[index]}요일 ${exactDurationLabel(day.totalSeconds)}`} key={day.date}>
            <span className="timer-week-track"><span className="timer-week-stack" style={{ height: `${Math.max(day.totalSeconds ? 10 : 2, Math.round((day.totalSeconds / maxSeconds) * 100))}%` }}>{day.subjects.length ? day.subjects.map((row) => <i data-subject-tone={subjectTone(row.subject)} style={{ flexGrow: Math.max(1, row.seconds) }} title={`${row.subject} ${exactDurationLabel(row.seconds)}`} key={row.subject} />) : <i className="is-empty" />}</span></span>
            <b>{STUDY_WEEK_LABELS[index]}</b>
            <small>{day.date.slice(-2)}</small>
          </button>
        ))}
      </div>
      <div className="timer-day-subjects">
        <div><span>{selectedDay?.date?.slice(5).replace('-', '월 ')}일 과목별 기록</span><b>{exactDurationLabel(selectedDay?.totalSeconds)}</b></div>
        <div>{selectedSubjects.length ? selectedSubjects.map((row) => <span data-subject-tone={subjectTone(row.subject)} key={row.subject}><i /><b>{row.subject}</b><small>{exactDurationLabel(row.seconds)}</small></span>) : <p>선택한 날짜에는 아직 완료한 공부가 없어요.</p>}</div>
      </div>
    </div>
  );
}

const HABITAT_STAGE_FALLBACK = ['기록 대기', '물결 시작', '수초 성장', '활기찬 서식지', '풍성한 서식지'];

function habitatDayLabel(dateKey = '') {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? '' : `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
}

function calculateHabitatStreak(days = []) {
  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if ((Number(days[index]?.studySeconds) || 0) < 600) break;
    streak += 1;
  }
  return streak;
}

export function HabitatMonth({ days = [], onSelect = () => {}, selectedDate = '' }) {
  if (!days.length) return null;
  const firstDate = new Date(`${days[0].date}T00:00:00.000Z`);
  const leadingCells = Number.isNaN(firstDate.getTime()) ? 0 : (firstDate.getUTCDay() + 6) % 7;
  return (
    <div className="timer-habitat-month-wrap"><div className="timer-habitat-weekdays" aria-hidden="true">{STUDY_WEEK_LABELS.map((label) => <span key={label}>{label}</span>)}</div><div className="timer-habitat-month" aria-label="최근 30일 공부 서식지">
      {Array.from({ length: leadingCells }, (_, index) => <span className="timer-habitat-blank" key={`blank-${index}`} />)}
      {days.slice(-30).map((day) => (
        <button type="button" className={`timer-habitat-cell ${selectedDate === day.date ? 'is-selected' : ''}`} data-stage={day.stage} onClick={() => onSelect(day.date)} key={day.date} title={`${day.date} ${Math.round((Number(day.studySeconds) || 0) / 60)}분`}><small>{Number(day.date.slice(-2))}</small><i /></button>
      ))}
    </div></div>
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

export function StudyHabitatCard({ gameProfileError = '', gameProfileStatus = 'idle', gameRules = null, habitatDays = [], habitatStatus = 'idle' }) {
  const [selectedDate, setSelectedDate] = useState('');
  if (gameProfileStatus === 'unavailable' || habitatStatus === 'unavailable') return null;
  const habitatStreak = calculateHabitatStreak(habitatDays);
  const selectedDay = habitatDays.find((day) => day.date === selectedDate) || habitatDays[habitatDays.length - 1] || null;
  const stageLabels = Array.isArray(gameRules?.habitatStages) ? gameRules.habitatStages.map((stage) => stage.label) : HABITAT_STAGE_FALLBACK;
  return (
    <section className="timer-habitat-card sc-card">
      <div className="timer-section-head"><div><span>최근 30일</span><h2>공부 서식지</h2></div><b>{habitatStreak ? `${habitatStreak}일 연속` : '첫 기록 대기'}</b></div>
      <p className="timer-habitat-intro">하루 공부 시간이 길어질수록 날짜의 물결과 수초가 풍성해져요.</p>
      {habitatStatus === 'loading' ? <div className="timer-habitat-loading">서식지 기록을 불러오고 있어요.</div> : habitatDays.length ? <HabitatMonth days={habitatDays} onSelect={setSelectedDate} selectedDate={selectedDay?.date || ''} /> : <div className="timer-habitat-empty">첫 공부를 완료하면 이곳에 하루의 서식지가 생겨요.</div>}
      {selectedDay ? <div className="timer-habitat-detail"><span><b>{habitatDayLabel(selectedDay.date)}</b><small>{stageLabels[Number(selectedDay.stage)] || HABITAT_STAGE_FALLBACK[0]}</small></span><strong>{minutesLabel(selectedDay.studySeconds)}</strong></div> : null}
      <div className="timer-habitat-legend"><span><i data-stage="0" />기록 대기</span><span><i data-stage="2" />성장 중</span><span><i data-stage="4" />풍성함</span></div>
      {gameProfileStatus === 'error' ? <div className="timer-game-error"><p>{gameProfileError}</p><button type="button" data-action="retryGameResources">다시 불러오기</button></div> : null}
    </section>
  );
}
