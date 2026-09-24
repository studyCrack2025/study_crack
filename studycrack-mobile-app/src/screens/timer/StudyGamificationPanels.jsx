import { useState } from 'react';
import { buildTimerJourneyPresentation } from './presentation.js';

const STUDY_WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const journeyStateLabel = (state) => state === 'active' ? '진행 중' : state === 'complete' ? '완료' : state === 'error' ? '오류' : '대기';

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

export function StudyWeekSummary({ overview, summary = null, status = 'idle' }) {
  const [selectedDate, setSelectedDate] = useState('');
  if (status === 'loading' && !summary) return <div className="timer-week-loading" role="status"><i /><span>이번 주 공부 흐름을 정리하고 있어요.</span></div>;
  if (!summary?.week?.days?.length || overview?.week.seconds == null) {
    return (
      <div className="timer-week-empty">
        <span>{status === 'error' ? '공부 요약을 잠시 불러오지 못했어요.' : '공부를 완료하면 주간 흐름이 이곳에 쌓여요.'}</span>
        {status === 'error' ? <button type="button" data-action="retryStudySummary">다시 불러오기</button> : null}
      </div>
    );
  }
  const todayDate = summary.today?.date || '';
  const days = summary.week.days.map((day) => {
    const subjects = (day.subjects || []).map((row) => ({ ...row, seconds: Number(row.seconds) || 0 }));
    return { ...day, subjects, totalSeconds: Number(day.totalSeconds) || 0 };
  });
  const maxSeconds = Math.max(1, ...days.map((day) => day.totalSeconds));
  const selectedDay = days.find((day) => day.date === selectedDate) || days.find((day) => day.date === todayDate) || days[days.length - 1];
  const selectedSubjects = [...(selectedDay?.subjects || [])].filter((row) => row.seconds > 0).sort((left, right) => right.seconds - left.seconds);
  return (
    <div className="timer-week-summary">
      <div className="timer-week-summary-head"><span>이번 주 확정 누적</span><b>{exactDurationLabel(overview.week.seconds)}</b></div>
      {!overview.week.fresh ? <p className="timer-session-empty">마지막 확인 기록이에요. 최신 상태는 위 학습 요약에서 다시 확인해주세요.</p> : null}
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

export function StudyJourneyPanel({ activeStudySession, completionError, lastCompletedSession, rewardPendingSessionId, rewardResult, timerPhase }) {
  const journey = buildTimerJourneyPresentation({ activeStudySession, completionError, lastCompletedSession, rewardPendingSessionId, rewardResult, timerPhase });
  if (!journey.visible) return null;
  const hasError = journey.completionState === 'error' || journey.rewardState === 'error' || journey.sessionState === 'error';
  const eyebrow = journey.sessionState === 'running'
    ? '진행 중인 공부'
    : journey.completionState === 'complete'
      ? '공부 완료'
      : '공부 기록 확인';
  return (
    <section className={`timer-journey-panel ${hasError ? 'is-error' : ''}`} role={hasError ? 'alert' : 'status'} aria-live={hasError ? 'assertive' : 'polite'}>
      <ol className="timer-journey-steps" aria-label="공부 완료 단계">
        <li data-step="completion" data-state={journey.completionState}><i aria-hidden="true" /><span>공부 기록 · {journeyStateLabel(journey.completionState)}</span></li>
        <li data-step="reward" data-state={journey.rewardState}><i aria-hidden="true" /><span>성장 보상 · {journeyStateLabel(journey.rewardState)}</span></li>
      </ol>
      <div className="timer-journey-copy"><span>{eyebrow}</span><b>{journey.title}</b>{journey.detail ? <p>{journey.detail}</p> : null}</div>
      {journey.hasCompletedSummary ? <dl className="timer-journey-summary"><div><dt>과목</dt><dd>{journey.session.subject || '기타'}</dd></div><div><dt>집중 시간</dt><dd>{journey.durationLabel}</dd></div></dl> : null}
      {journey.rewardState === 'active' ? <div className="timer-journey-pending"><i aria-hidden="true" /><span>오늘의 성장 보상을 확인하고 있어요.</span></div> : null}
      {rewardResult ? <><div className="timer-reward-copy"><span>보상 확인</span><b>{journey.rewardTitle}</b></div><div className="timer-reward-values"><span>조개 <b>+{Number(rewardResult.shells) || 0}</b></span><span>먹이 <b>+{Number(rewardResult.food) || 0}</b></span></div></> : null}
      {journey.retryAction === 'retryStudyReward' ? <button type="button" className="btn btn-secondary" data-action="retryStudyReward">보상 다시 확인</button> : null}
      {journey.retryAction === 'retryStudyStart' ? <button type="button" className="btn btn-secondary" data-action="retryStudyStart">공부 시작 다시 연결</button> : null}
      {journey.retryAction === 'stopStudyTimer' ? <button type="button" className="btn btn-secondary" data-action="stopStudyTimer">완료 다시 확인</button> : null}
      {journey.recoveryDismissible ? <><p className="timer-recovery-dismiss-warning" id="timer-reward-dismiss-warning">서버에서 복구할 수 없는 보상입니다. 종료하면 이 보상 복구는 다시 시도할 수 없어요.</p><button type="button" className="btn btn-secondary" data-action="dismissRewardResult" aria-describedby="timer-reward-dismiss-warning">보상 복구 종료</button></> : null}
      {rewardResult ? <div className="timer-reward-actions"><button type="button" className="btn btn-primary" data-action="goto" data-target="aquarium">수조에서 확인</button><button type="button" className="timer-reward-close" data-action="dismissRewardResult">닫기</button></div> : null}
    </section>
  );
}
