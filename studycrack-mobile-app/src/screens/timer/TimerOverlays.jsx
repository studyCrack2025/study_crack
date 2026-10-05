import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
const DEFAULT_STUDY_SUBJECTS = ['국어', '수학', '영어', '탐구'];
function StudyStartForm({
  plannedScheduleOptions = [],
  studyStartDraft = {},
  studySubjectSheetOnlyPlanned = false,
  activeStudySession,
  timerPhase,
  completionError = ''
}) {
  const selectedSubject = String(studyStartDraft.subject || '');
  const [activity, setActivity] = useState(String(studyStartDraft.activity || '').slice(0, 80));
  const [customSubject, setCustomSubject] = useState('');
  const busy = ['starting-session', 'settling-session'].includes(timerPhase);
  const pending = activeStudySession?.status === 'starting';
  const custom = selectedSubject === '기타' && !studyStartDraft.plannerItemId;
  const ready = Boolean(selectedSubject && (!custom || customSubject.trim()) && activity.trim());
  return <>
    <div className="sc-modal-body">
      {pending ? <section className="study-start-pending" aria-label="공부 시작 확인"><b>{activeStudySession.subject}</b><p>{activeStudySession.activity}</p><p role={completionError ? 'alert' : 'status'}>{completionError || '시작 확인 중…'}</p>{!busy ? <p>같은 공부 기록으로 다시 확인해요.</p> : null}</section> : <fieldset className="home-study-form" disabled={busy} aria-label="공부 시작 입력">
        {plannedScheduleOptions.length ? <section className="study-start-section"><b>오늘 계획</b><div className="study-plan-options">{plannedScheduleOptions.map((row) => <button type="button" className={studyStartDraft.plannerItemId === row.id ? 'is-selected' : ''} aria-pressed={studyStartDraft.plannerItemId === row.id} data-action="selectStudySubject" data-study-subject={row.subject} data-study-activity={row.activity} data-study-item-id={row.id} key={row.id || row.label}><span>{row.subject}</span><b>{row.activity || row.label}</b></button>)}</div></section> : null}
        {!studySubjectSheetOnlyPlanned ? <section className="study-start-section"><b>직접 과목 선택</b><div className="study-subject-grid">{DEFAULT_STUDY_SUBJECTS.map((subject) => <button type="button" className={`planner-pill ${selectedSubject === subject && !studyStartDraft.plannerItemId ? 'active' : ''}`} aria-pressed={selectedSubject === subject && !studyStartDraft.plannerItemId} data-action="selectStudySubject" data-study-subject={subject} key={subject}>{subject}</button>)}<button type="button" className={`planner-pill ${custom ? 'active' : ''}`} aria-pressed={custom} data-action="selectStudySubject" data-study-subject="기타">기타</button></div>{custom ? <label className="study-start-activity"><span>과목 또는 영역</span><input className="planner-input" data-field="studyStartCustomSubject" value={customSubject} onChange={event => setCustomSubject(event.currentTarget.value.slice(0, 30))} maxLength="30" placeholder="과목 또는 영역을 입력하세요" /></label> : null}</section> : null}
        {selectedSubject ? <label className="study-start-activity"><span>학습 내용</span><input className="planner-input" aria-label="학습 내용" data-field="studyStartActivity" value={activity} onChange={event => setActivity(event.currentTarget.value.slice(0, 80))} maxLength="80" placeholder="예: 미적분 기출 20문제 풀이" /><small>{activity.length}/80</small></label> : <p className="study-start-guide">계획이나 과목을 선택해주세요.</p>}
      </fieldset>}
    </div>
    <div className="sc-modal-footer"><button type="button" className="btn btn-secondary" data-action="closeStudySubjectSheet" disabled={busy}>{pending ? '나중에 확인' : '취소'}</button>{pending ? <button type="button" className="btn btn-primary study-start-confirm" data-action="retryStudyStart" disabled={busy}>{busy ? '시작 확인 중…' : '시작 다시 확인'}</button> : <button type="button" className="btn btn-primary study-start-confirm" data-action="confirmStudyStart" disabled={busy || !ready}>{busy ? '시작 확인 중…' : '공부 시작'}</button>}</div>
  </>;
}

export function StudySubjectSheet(props) {
  const busy = ['starting-session', 'settling-session'].includes(props.timerPhase);
  return <Modal open={Boolean(props.studySubjectSheetOpen)} dismissAction={busy ? '' : 'closeStudySubjectSheet'} panelClass="study-subject-sheet study-start-modal" ariaLabel="공부 시작"><div className="sc-modal-head"><h3>공부 시작</h3><button type="button" className="sc-overlay-close" data-action="closeStudySubjectSheet" aria-label="닫기" disabled={busy}>×</button></div><StudyStartForm key={`${props.studyStartDraft?.subject || ''}-${props.studyStartDraft?.plannerItemId || 'direct'}`} {...props} /></Modal>;
}
