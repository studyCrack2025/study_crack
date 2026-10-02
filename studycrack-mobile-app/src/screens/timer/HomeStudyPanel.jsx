import { useEffect, useId, useRef, useState } from 'react';
import { StudySubjectSheet } from './TimerOverlays.jsx';
import { TimerSessionPanel } from './TimerSessionPanel.jsx';
import { StudyOverviewCard } from '../../components/StudyOverviewCard.jsx';

export function HomeStudyPanel(props) {
  const { studySubjectSheetOpen, studyPanelMode, activeStudySession, showStudyPanel, studyTimerRunning, liveSeconds, studyOverview, timerPhase, rewardPendingSessionId, aquariumPresentation, canUsePersonalPlanner } = props;
  const available = Boolean(studySubjectSheetOpen || showStudyPanel || studyPanelMode === 'timer');
  const [expanded, setExpanded] = useState(available);
  const id = useId();
  const trigger = useRef(null);
  const body = useRef(null);
  const nextItem = canUsePersonalPlanner ? (props.todayPlannerItems || []).find((item) => !item.done) : null;
  const busy = ['starting-session', 'settling-session', 'claiming-reward'].includes(timerPhase);
  const canComplete = Boolean(activeStudySession?.status === 'running') && ['running', 'recoverable-error'].includes(timerPhase);
  const showNext = !available && !props.studyStartBlocked && nextItem;
  useEffect(() => { if (available && expanded) body.current?.querySelector('input, button')?.focus({ preventScroll: true }); }, [available, expanded, studySubjectSheetOpen]);
  useEffect(() => { if (available) setExpanded(true); }, [available, studySubjectSheetOpen, studyPanelMode, activeStudySession?.sessionId]);
  return <div className="home-study-inline">
    <StudyOverviewCard overview={studyOverview} variant="banner" showDetails={false} hideLiveNotice headlineSeconds={studyTimerRunning ? liveSeconds : undefined} headlineLabel={studyTimerRunning ? `${activeStudySession?.subject || '공부'} · 현재 집중 시간` : '확정 공부 시간'} actions={<>
      <button ref={trigger} type="button" className="home-active-study" data-action={available ? undefined : 'openStudySubjectSheet'} aria-expanded={available && expanded} aria-controls={id} onClick={() => { if (available) setExpanded(value => !value); }}><span>{studyTimerRunning ? `${activeStudySession?.subject || '공부'} · 상세 기록` : studySubjectSheetOpen ? '공부 준비' : showStudyPanel ? '공부 기록·보상 확인' : '공부 시작'}</span><span aria-hidden="true">{available ? expanded ? '접기 −' : '펼치기 +' : '＋'}</span></button>
      {canComplete || busy ? <button type="button" className="home-study-complete" data-action="stopStudyTimer" disabled={!canComplete || busy}>{busy ? '공부 기록 확인 중…' : timerPhase === 'recoverable-error' ? '완료 다시 확인' : '공부 완료'}</button> : null}
      {showNext ? <div className="home-next-study"><span><small>다음 공부 · {nextItem.subject || '기타'}</small><b>{nextItem.content || '학습 내용 입력'}</b></span><button type="button" data-action="startPlannedStudy" data-study-item-id={nextItem.id}>바로 시작</button></div> : null}
      {!rewardPendingSessionId && !busy ? <button type="button" className="home-study-streak" data-action="openStreakSummary">연속 학습 {aquariumPresentation?.streakDays != null ? `${aquariumPresentation.streakDays}일` : '확인 필요'} ›</button> : null}
    </>} />
    <div ref={body} id={id} className="home-study-body" hidden={!available || !expanded}>
      {studySubjectSheetOpen ? <StudySubjectSheet {...props} /> : available ? <TimerSessionPanel {...props} hideControls /> : null}
      <button type="button" className="btn btn-secondary" onClick={() => { setExpanded(false); trigger.current?.focus({ preventScroll: true }); }}>공부 영역 접기</button>
    </div>
  </div>;
}
