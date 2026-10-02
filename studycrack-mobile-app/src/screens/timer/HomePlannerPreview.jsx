function subjectTone(subject = '') {
  return /국어/.test(subject) ? 'korean' : /수학/.test(subject) ? 'math' : /영어/.test(subject) ? 'english' : /과학|탐구|물리|화학|생명|지구/.test(subject) ? 'science' : 'other';
}

export function HomePlannerPreview(props) {
  const { canUsePersonalPlanner, studyStartBlocked, studyStartBlockReason, todayPlannerItems = [] } = props;
  const remaining = todayPlannerItems.filter((item) => !item.done);
  const preview = remaining.slice(0, 2);
  const completed = todayPlannerItems.filter(item => item.done).length;
  return (
    <section className="timer-v2-plan sc-card">
      <div className="timer-section-head"><div><h2>오늘의 플래너</h2><p>{todayPlannerItems.length ? `남은 공부 ${remaining.length}개` : '아직 등록한 계획이 없어요'}</p></div><button type="button" data-action="goto" data-target="planner" aria-label={`오늘의 플래너 전체 보기 · ${completed}/${todayPlannerItems.length} 완료`}><b className="home-plan-count">{completed}/{todayPlannerItems.length}</b></button></div>
      {studyStartBlocked ? <p className="timer-start-blocked-note" id="timer-study-start-blocked" role="status">{studyStartBlockReason}</p> : null}
      {canUsePersonalPlanner && preview.length ? <>
        <div className="timer-v2-plan-list">{preview.map((item) => <button type="button" data-action="selectStudySubject" data-study-subject={item.subject || '기타'} data-study-activity={item.content || ''} data-study-item-id={item.id} disabled={item.done || studyStartBlocked} aria-describedby={studyStartBlocked ? 'timer-study-start-blocked' : undefined} key={item.id} data-done={item.done === true}><i className="home-plan-check" aria-hidden="true">{item.done ? '✓' : ''}</i><span data-subject-tone={subjectTone(item.subject)}>{item.subject || '기타'}</span><b>{item.content || '학습 계획'}</b><small>{item.done ? '완료' : `${Number(item.minutes) || 0}분`}</small></button>)}</div>
        {remaining.length > 2 ? <p className="home-plan-more">+{remaining.length - 2}개 · 전체 보기에서 확인</p> : null}
      </> : <div className="timer-v2-plan-empty"><p>{todayPlannerItems.length && !remaining.length ? '오늘 계획을 모두 완료했어요. 다음 공부도 함께 준비해볼까요?' : '개인 플래너는 무료예요. 오늘 할 일을 추가해보세요.'}</p><button type="button" data-action="goto" data-target="planner">계획 만들기</button></div>}
    </section>
  );
}
