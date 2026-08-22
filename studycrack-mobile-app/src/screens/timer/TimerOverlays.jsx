import { Sheet } from '../../components/Sheet.jsx';
import { useState } from 'react';
const DEFAULT_STUDY_SUBJECTS = ['국어', '수학', '영어', '탐구'];
function StudyStartActivity({ defaultValue = '', selectedSubject = '' }) {
  const [activity, setActivity] = useState(defaultValue);
  return <><label className="study-start-activity"><span>구체적인 학습 내용</span><input className="planner-input" data-field="studyStartActivity" value={activity} onChange={(event) => setActivity(event.currentTarget.value.slice(0, 80))} maxLength="80" placeholder="예: 미적분 기출 20문제 풀이" /><small>최대 80자 · 공부 완료 후 개별 기록에 저장됩니다.</small></label><button type="button" className="btn btn-primary study-start-confirm" data-action="confirmStudyStart" disabled={!selectedSubject || !activity.trim()}>공부 시작</button></>;
}
export function StudySubjectSheet({
  plannedScheduleOptions = [],
  studyStartDraft = {},
  studySubjectSheetOnlyPlanned = false,
  studySubjectSheetOpen = false
}) {
  const selectedSubject = String(studyStartDraft.subject || '');
  const selectedActivity = String(studyStartDraft.activity || '');
  return (
    <Sheet open={studySubjectSheetOpen} panelClass="study-subject-sheet" dismissAction="closeStudySubjectSheet">
      <div className="study-start-head"><span>공부 기록</span><h3>무엇을 공부할까요?</h3><p>과목과 구체적인 학습 내용을 남기면 오늘 기록에서 다시 확인할 수 있어요.</p></div>
      {plannedScheduleOptions.length ? <section className="study-start-section"><b>오늘 플래너에서 선택</b><div className="study-plan-options">{plannedScheduleOptions.map((row) => <button type="button" className={studyStartDraft.plannerItemId === row.id ? 'is-selected' : ''} data-action="selectStudySubject" data-study-subject={row.subject} data-study-activity={row.activity} data-study-item-id={row.id} key={row.id || row.label}><span>{row.subject}</span><b>{row.activity || row.label}</b></button>)}</div></section> : null}
      {!studySubjectSheetOnlyPlanned ? <section className="study-start-section"><b>직접 공부 선택</b><div className="study-subject-grid">{DEFAULT_STUDY_SUBJECTS.map((subject) => <button type="button" className={`planner-pill ${selectedSubject === subject && !studyStartDraft.plannerItemId ? 'active' : ''}`} data-action="selectStudySubject" data-study-subject={subject} key={subject}>{subject}</button>)}<button type="button" className={`planner-pill ${selectedSubject === '기타' && !studyStartDraft.plannerItemId ? 'active' : ''}`} data-action="selectStudySubject" data-study-subject="기타">기타</button></div>{selectedSubject === '기타' ? <input className="planner-input" data-field="studyStartCustomSubject" maxLength="30" placeholder="과목 또는 영역을 입력하세요" /> : null}</section> : null}
      {selectedSubject ? <StudyStartActivity defaultValue={selectedActivity} key={`${selectedSubject}-${studyStartDraft.plannerItemId || 'direct'}`} selectedSubject={selectedSubject} /> : <p className="study-start-guide">플래너 일정이나 과목을 먼저 선택해주세요.</p>}
    </Sheet>
  );

}
