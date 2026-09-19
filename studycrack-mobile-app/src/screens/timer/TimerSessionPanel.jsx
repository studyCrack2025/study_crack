import { Icon } from '../../components/Icon.jsx';
import { StudyJourneyPanel } from './StudyGamificationPanels.jsx';

const STUDY_START_BUSY_PHASES = ['starting-session', 'settling-session', 'claiming-reward'];

function sessionTimeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function StudySessionRows({ activeStudySession, formatHms, liveSeconds = 0, sessions = [] }) {
  const rows = activeStudySession ? [{ ...activeStudySession, durationSeconds: liveSeconds, isActive: true }, ...sessions] : sessions;
  if (!rows.length) return <p className="timer-session-empty">새로 완료한 공부부터 과목별 상세 기록이 여기에 쌓여요.</p>;
  return <div className="timer-session-list">{rows.map((session, index) => <div className={`timer-session-row ${session.isActive ? 'is-active' : ''}`} key={session.sessionId || `${session.startedAt}-${index}`}><span><b>{session.subject || '기타'}</b><small>{session.activity || `${session.subject || '기타'} 학습`}</small></span><span><b>{formatHms(Number(session.durationSeconds) || 0)}</b><small>{sessionTimeLabel(session.startedAt)}{session.endedAt ? ` - ${sessionTimeLabel(session.endedAt)}` : ' - 진행 중'}</small></span></div>)}</div>;
}

function TimerControlCard({ activeStudySession, confirmedLabel, summaryReady, displayedTodaySeconds, formatHms, liveSeconds, studySessionDetailsOpen, studyStartBlocked, studySummary, studyTimerRunning, timerPhase }) {
  const timerBusy = STUDY_START_BUSY_PHASES.includes(timerPhase);
  const canComplete = Boolean(activeStudySession) && ['running', 'recoverable-error'].includes(timerPhase);
  const subject = activeStudySession?.subject || '';
  return (
    <section className={`timer-v2-control sc-card ${studyTimerRunning ? 'is-running' : ''}`}>
      <div className="timer-v2-control-top"><span>{studyTimerRunning ? '현재 집중 시간' : confirmedLabel}</span>{subject ? <b>{subject}</b> : <b>대기</b>}</div>
      <button type="button" className="timer-v2-clock-trigger" data-action="toggleStudySessionDetails" aria-expanded={studySessionDetailsOpen}><strong className="timer-v2-clock" data-study-base-seconds={studyTimerRunning ? 0 : undefined}>{studyTimerRunning ? formatHms(liveSeconds) : summaryReady ? formatHms(displayedTodaySeconds) : '확인 필요'}</strong><span>{studySessionDetailsOpen ? '개별 기록 접기' : '개별 기록 보기'} <b aria-hidden="true">⌄</b></span></button>
      <p>{studyTimerRunning ? `${subject || '선택 과목'} 공부가 기록되고 있어요.` : '플래너 일정이나 직접 입력한 공부로 시작할 수 있어요.'}</p>
      {studyTimerRunning ? <div className="timer-resume-note" role="status"><Icon name="timer" /><span>앱을 벗어나도 시작 시각 기준으로 이어 기록돼요.</span></div> : null}
      {studySessionDetailsOpen ? <StudySessionRows activeStudySession={activeStudySession} formatHms={formatHms} liveSeconds={liveSeconds} sessions={studySummary?.today?.sessions || []} /> : null}
      <div className="timer-v2-actions">
        <button type="button" className="btn btn-secondary" data-action="stopStudyTimer" disabled={!canComplete || timerBusy}>{timerPhase === 'recoverable-error' ? '완료 다시 확인' : '공부 완료'}</button>
      </div>
    </section>
  );
}


export function TimerSessionPanel({ expanded, forcedOpen, onToggle, panelRef, ...props }) {
  return <section className="timer-session-panel sc-card" aria-label="공부 타이머" ref={panelRef} tabIndex={-1}>
    <button type="button" className="timer-session-disclosure" aria-expanded={expanded} aria-controls="home-timer-detail" aria-disabled={forcedOpen} onClick={() => { if (!forcedOpen) onToggle(); }}><span><b>공부 기록</b><small>{forcedOpen ? '진행 중인 기록을 확인해주세요' : '타이머와 과목별 기록'}</small></span><span>{expanded ? forcedOpen ? '진행 중' : '접기' : '펼치기'} <Icon name="chevron" /></span></button>
    <div id="home-timer-detail" hidden={!expanded}>
      <TimerControlCard {...props} />
      <StudyJourneyPanel {...props} />
    </div>
    <div className="timer-v2-actions">
        <button type="button" className="btn btn-primary" data-action="openStudySubjectSheet" disabled={props.studyStartBlocked} aria-describedby={props.studyStartBlocked ? 'timer-study-start-blocked' : undefined}><Icon name="timer" /> 공부 시작</button>
    </div>
  </section>;
}
