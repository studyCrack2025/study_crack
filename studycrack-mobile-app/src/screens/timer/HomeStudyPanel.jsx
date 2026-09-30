import { useEffect, useId, useRef, useState } from 'react';
import { StudySubjectSheet } from './TimerOverlays.jsx';
import { TimerSessionPanel } from './TimerSessionPanel.jsx';

export function HomeStudyPanel(props) {
  const { studySubjectSheetOpen, studyPanelMode, activeStudySession, showStudyPanel, studyTimerRunning, liveSeconds, formatHms } = props;
  const available = Boolean(studySubjectSheetOpen || showStudyPanel || studyPanelMode === 'timer');
  const [expanded, setExpanded] = useState(available);
  const id = useId();
  const trigger = useRef(null);
  const body = useRef(null);
  useEffect(() => { if (available && expanded) body.current?.querySelector('input, button')?.focus({ preventScroll: true }); }, [available, expanded, studySubjectSheetOpen]);
  useEffect(() => { if (available) setExpanded(true); }, [available, studySubjectSheetOpen, studyPanelMode, activeStudySession?.sessionId]);
  return <div className="home-study-inline">
    <button ref={trigger} type="button" className="home-active-study" data-action={available ? undefined : 'openStudySubjectSheet'} aria-expanded={available && expanded} aria-controls={id} onClick={() => { if (available) setExpanded(value => !value); }}><span>{studyTimerRunning ? `${activeStudySession?.subject || '공부'} · ${formatHms(liveSeconds)}` : studySubjectSheetOpen ? '공부 준비' : showStudyPanel ? '공부 기록·보상 확인' : '공부 시작'}</span><span aria-hidden="true">{available ? expanded ? '접기 −' : '펼치기 +' : '＋'}</span></button>
    <div ref={body} id={id} className="home-study-body" hidden={!available || !expanded}>
      {studySubjectSheetOpen ? <StudySubjectSheet {...props} /> : available ? <TimerSessionPanel {...props} /> : null}
      <button type="button" className="btn btn-secondary" onClick={() => { setExpanded(false); trigger.current?.focus({ preventScroll: true }); }}>공부 영역 접기</button>
    </div>
  </div>;
}
