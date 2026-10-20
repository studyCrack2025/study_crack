import { useEffect, useId, useRef, useState } from 'react';
import { TimerSessionPanel } from './TimerSessionPanel.jsx';
import { StudyOverviewCard } from '../../components/StudyOverviewCard.jsx';
import { DisclosureRegion } from '../../components/DisclosureRegion.jsx';

export function HomeStudyPanel(props) {
  const { studySubjectSheetOpen, studyPanelMode, activeStudySession, showStudyPanel, studyTimerRunning, liveSeconds, studyOverview, timerPhase, rewardPendingSessionId, aquariumPresentation, canUsePersonalPlanner } = props;
  const available = Boolean(showStudyPanel || studyPanelMode === 'timer');
  const [expanded, setExpanded] = useState(available);
  const id = useId();
  const trigger = useRef(null);
  const body = useRef(null);
  const nextItem = canUsePersonalPlanner ? (props.todayPlannerItems || []).find((item) => !item.done) : null;
  const busy = ['starting-session', 'settling-session'].includes(timerPhase);
  const canComplete = Boolean(activeStudySession?.status === 'running') && ['running', 'recoverable-error'].includes(timerPhase);
  const showNext = !available && !props.studyStartBlocked && nextItem;
  const pending = props.studyRecovery?.pending || (rewardPendingSessionId ? [{ sessionId: rewardPendingSessionId, status: 'pending' }] : []);
  const terminal = pending.some(row => row.status === 'terminal');
  useEffect(() => {
    if (!studySubjectSheetOpen && activeStudySession && document.activeElement === document.body && !trigger.current?.closest('[inert]')) trigger.current?.focus({ preventScroll: true });
  }, [studySubjectSheetOpen, activeStudySession?.status]);
  useEffect(() => { if (available) setExpanded(true); }, [available, studyPanelMode, activeStudySession?.sessionId]);
  return <div className="home-study-inline">
    <StudyOverviewCard overview={studyOverview} variant="banner" showDetails={false} hideLiveNotice headlineSeconds={studyTimerRunning ? liveSeconds : undefined} headlineLabel={studyTimerRunning ? `${activeStudySession?.subject || '공부'} · 현재 집중 시간` : '확정 공부 시간'} actions={<>
      <button ref={trigger} type="button" className="home-active-study" data-action={available ? undefined : 'openStudySubjectSheet'} aria-expanded={available ? expanded : undefined} aria-controls={available ? id : undefined} aria-haspopup={available ? undefined : 'dialog'} onClick={() => { if (available) setExpanded(value => !value); }}><span>{studyTimerRunning ? `${activeStudySession?.subject || '공부'} · 상세 기록` : showStudyPanel ? '공부 기록·보상 확인' : '공부 시작'}</span><span aria-hidden="true">{available ? expanded ? '접기 −' : '펼치기 +' : '＋'}</span></button>
      {canComplete || busy ? <button type="button" className="home-study-complete" data-action="stopStudyTimer" disabled={!canComplete || busy}>{busy ? '공부 기록 확인 중…' : timerPhase === 'recoverable-error' ? '완료 다시 확인' : '공부 완료'}</button> : null}
      {available && !props.studyStartBlocked && !studySubjectSheetOpen ? <button type="button" className="home-study-complete" data-action="openStudySubjectSheet">새 공부 시작</button> : null}
      {showNext ? <div className="home-next-study"><span><small>다음 공부 · {nextItem.subject || '기타'}</small><b>{nextItem.content || '학습 내용 입력'}</b></span><button type="button" data-action="startPlannedStudy" data-study-item-id={nextItem.id}>바로 시작</button></div> : null}
      {!rewardPendingSessionId && !busy ? <button type="button" className="home-study-streak" data-action="openStreakSummary">연속 학습 {aquariumPresentation?.streakDays != null ? `${aquariumPresentation.streakDays}일` : '확인 필요'} ›</button> : null}
    </>} />
    {props.rewardRecoveryError || pending.length ? <section className="timer-resume-note" aria-label="보상 복구" role="status"><div><b>보상 확인 {pending.length}건</b><p>{props.rewardRecoveryError || (props.rewardClaimingSessionId ? '보상을 확인 중이에요. 새 공부도 시작할 수 있어요.' : '공부는 저장됐어요. 남은 보상을 다시 확인해주세요.')}</p>{pending.some(row => row.status !== 'terminal') ? <button type="button" className="btn btn-secondary" data-action="retryStudyReward" disabled={Boolean(props.rewardClaimingSessionId)}>보상 다시 확인</button> : null}{terminal ? <><p>서버에서 복구할 수 없는 1건을 목록에서 지워요. 다른 공부 기록은 유지돼요.</p><button type="button" className="btn btn-secondary" data-action="dismissRewardResult" data-dismiss-terminal="true">복구 불가 기록 정리</button></> : null}</div></section> : null}
    <DisclosureRegion open={available && expanded} triggerRef={trigger}><div ref={body} id={id} className="home-study-body">
      {available ? <TimerSessionPanel {...props} hideControls hideRewardRetry /> : null}
      <button type="button" className="btn btn-secondary" onClick={() => { setExpanded(false); trigger.current?.focus({ preventScroll: true }); }}>공부 영역 접기</button>
    </div></DisclosureRegion>
  </div>;
}
