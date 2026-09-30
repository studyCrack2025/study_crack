function duration(seconds = 0) {
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), Math.floor(seconds % 60)].map(value => String(value).padStart(2, '0')).join(':');
}

export function PlannerStudyStatus({ overview, isToday }) {
  if (!overview) return null;
  const { confirmed, live } = overview;
  return <div className="planner-study-status" role="status">
    {isToday ? <span>{overview.timeGoal.datesMatch ? '오늘' : confirmed.date || '날짜 확인 필요'} 실제 공부 <b>{confirmed.fresh ? duration(confirmed.seconds) : '확인 필요'}</b></span> : null}
    {live.status !== 'idle' ? <span>{live.status === 'running' ? '진행 중 · 아직 미확정' : '공부 기록 확인 중'} <b>{duration(live.seconds)}</b></span> : null}
    {!confirmed.fresh ? <span>{confirmed.status === 'loading' ? '완료한 공부 기록을 확인하고 있어요.' : '최신 공부 기록을 확인해주세요.'}{confirmed.status === 'error' ? <button type="button" data-action="retryStudySummary">다시 확인</button> : null}</span> : null}
  </div>;
}
