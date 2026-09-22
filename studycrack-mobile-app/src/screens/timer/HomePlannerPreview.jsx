function subjectTone(subject = '') {
  return /국어/.test(subject) ? 'korean' : /수학/.test(subject) ? 'math' : /영어/.test(subject) ? 'english' : /과학|탐구|물리|화학|생명|지구/.test(subject) ? 'science' : 'other';
}

export function HomePlannerPreview({ canAccessBasic, studyStartBlocked, studyStartBlockReason, todayPlannerItems, showStudyPanel, studyTimerRunning }) {
  const preview = todayPlannerItems.slice(0, 4);
  const nextItem = todayPlannerItems.find((item) => !item.done);
  const completed = todayPlannerItems.filter(item => item.done).length;
  const percent = todayPlannerItems.length ? Math.round(completed / todayPlannerItems.length * 100) : 0;
  return (
    <section className="timer-v2-plan sc-card">
      <div className="timer-section-head"><div><h2>오늘의 플래너</h2><p>{todayPlannerItems.length ? `오늘 해야 할 공부 ${todayPlannerItems.length}개` : '아직 등록한 계획이 없어요'}</p></div><button type="button" data-action="goto" data-target="planner" aria-label={`오늘의 플래너 전체 보기 · ${completed}/${todayPlannerItems.length} 완료`}><b className="home-plan-count">{completed}/{todayPlannerItems.length}</b></button></div>
      {canAccessBasic && todayPlannerItems.length ? <div className="home-plan-progress"><span role="progressbar" aria-label="오늘 공부 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${percent}%` }} /></span><b>오늘 공부 {percent}% 완료</b></div> : null}
      {studyStartBlocked ? <p className="timer-start-blocked-note" id="timer-study-start-blocked" role="status">{studyStartBlockReason}</p> : null}
      {canAccessBasic && preview.length ? <>
        <div className="timer-v2-plan-list">{preview.map((item) => <button type="button" data-action="selectStudySubject" data-study-subject={item.subject || '기타'} data-study-activity={item.content || ''} data-study-item-id={item.id} disabled={item.done || studyStartBlocked} aria-describedby={studyStartBlocked ? 'timer-study-start-blocked' : undefined} key={item.id} data-done={item.done === true}><i className="home-plan-check" aria-hidden="true">{item.done ? '✓' : ''}</i><span data-subject-tone={subjectTone(item.subject)}>{item.subject || '기타'}</span><b>{item.content || '학습 계획'}</b><small>{item.done ? '완료' : `${Number(item.minutes) || 0}분`}</small></button>)}</div>
        {todayPlannerItems.length > 4 ? <p className="home-plan-more">+{todayPlannerItems.length - 4}개 · 전체 보기에서 확인</p> : null}
        <button type="button" className="timer-v2-plan-primary" data-action={nextItem ? 'selectStudySubject' : 'goto'} data-target={nextItem ? undefined : 'planner'} data-study-subject={nextItem?.subject || undefined} data-study-activity={nextItem?.content || undefined} data-study-item-id={nextItem?.id || undefined} disabled={Boolean(nextItem) && studyStartBlocked} aria-describedby={nextItem && studyStartBlocked ? 'timer-study-start-blocked' : undefined}>{nextItem ? `먼저 ${nextItem.subject || '다음 공부'}부터 시작하기` : '오늘 계획을 모두 완료했어요'}</button>
      </> : <div className="timer-v2-plan-empty"><p>{canAccessBasic ? '플래너에서 오늘 할 일을 추가하면 바로 타이머로 시작할 수 있어요.' : 'Basic 이상에서 일일 계획과 타이머를 연결할 수 있어요.'}</p><button type="button" data-action="goto" data-target="planner">계획 만들기</button></div>}
      <button type="button" className="home-active-study" data-action={showStudyPanel ? 'openStudyPanel' : 'openStudySubjectSheet'}><span>{showStudyPanel ? studyTimerRunning ? '공부 기록 중 · 타이머 열기' : '공부 기록·보상 확인' : '공부 시작'}</span><span aria-hidden="true">›</span></button>
    </section>
  );
}
