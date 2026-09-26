import { defaultFormatMinutesLabel } from '../screens/timer/presentation.js';

function duration(seconds) {
  if (seconds === null || seconds === undefined) return '확인 필요';
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
  return `${hours}:${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function StudyOverviewCard({ overview, variant = 'card', compact = false, recordsOnly = false, showDetails = true }) {
  if (!overview) return null;
  const { planner, confirmed, live, timeGoal } = overview;
  const hasPlans = planner.status === 'ready' && planner.total > 0;
  const stale = confirmed.seconds !== null && !confirmed.fresh;
  const canCollapse = compact && confirmed.fresh && planner.status === 'ready' && timeGoal.datesMatch && live.status === 'idle';
  const Details = canCollapse ? 'details' : 'div';
  const banner = variant === 'banner';
  return (
    <section className="sc-study-overview" data-variant={banner ? 'banner' : variant === 'inline' ? 'inline' : 'card'} aria-label="학습 현황 요약">
      {!banner && variant !== 'inline' ? <header><span>STUDY RECORD</span><h2>오늘의 학습 기록</h2></header> : null}
      {!recordsOnly ? <div className={banner ? 'sc-study-banner' : undefined}>
      {banner ? <div className="sc-study-headline"><small>오늘의 학습 진행</small><b>{confirmed.fresh ? duration(confirmed.seconds) : '기록 확인 필요'}</b><small>확정 공부 시간</small></div> : null}
      <div className="sc-study-plan-progress"><span role="progressbar" aria-label="과제 완료율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hasPlans ? planner.percent : undefined} aria-valuetext={hasPlans ? undefined : planner.status === 'ready' ? '등록한 계획 없음' : '계획 확인 필요'}><i style={{ width: `${planner.percent || 0}%` }} /></span><b>{planner.total === null ? '확인 필요' : `${planner.completed}/${planner.total}`}</b><small>{hasPlans ? `과제 ${planner.percent}% 완료` : planner.status === 'ready' ? '계획을 추가하면 완료율을 확인할 수 있어요' : '계획 날짜를 확인해주세요'}{planner.minutes !== null ? ` · 계획 ${defaultFormatMinutesLabel(planner.minutes)}` : ''}</small></div>
      </div> : null}
      {showDetails ? <Details className="sc-study-details">
      {canCollapse ? <summary>{recordsOnly ? `${confirmed.date} · ` : ''}확정 공부 {duration(confirmed.seconds)} · 상세 기록</summary> : null}
      <dl className="sc-study-metrics"><div><dt>{confirmed.date && confirmed.date !== planner.date ? `${confirmed.date} 확정 공부` : '오늘 확정 공부'}</dt><dd>{duration(confirmed.seconds)}</dd></div><div><dt>확정 시간 / 계획 시간</dt><dd>{timeGoal.percent === null ? '산정 전' : `${timeGoal.percent}%`}</dd></div>{live.status !== 'idle' ? <div><dt>{live.status === 'running' ? '진행 중 · 아직 미확정' : '공부 기록 확인 중'}</dt><dd data-study-base-seconds={live.status === 'running' ? 0 : undefined}>{duration(live.seconds)}</dd></div> : null}</dl>
      <p className="sc-study-source">계획 {planner.date || '날짜 확인 필요'} · 기기 기준<br />공부 {confirmed.date || '날짜 확인 필요'} · 한국 시간 기준</p>
      </Details> : live.status !== 'idle' ? <p className="sc-study-notice">{live.status === 'running' ? '진행 중 · 아직 미확정' : '공부 기록 확인 중'} <b data-study-base-seconds={live.status === 'running' ? 0 : undefined}>{duration(live.seconds)}</b></p> : null}
      {!timeGoal.datesMatch && confirmed.date ? <p className="sc-study-notice">기록 날짜가 달라 시간 달성률은 계산하지 않아요.</p> : null}
      {stale || !confirmed.fresh ? <div className="sc-study-notice" role="status"><span>{stale ? '마지막 확인 기록이에요. 최신 상태를 다시 확인해주세요.' : confirmed.status === 'loading' ? '완료한 공부 기록을 불러오고 있어요.' : confirmed.status === 'unavailable' ? '공부 기록을 아직 제공할 수 없어요.' : '완료한 공부 기록을 확인해주세요.'}</span>{confirmed.status === 'error' ? <button type="button" data-action="retryStudySummary">다시 확인</button> : null}</div> : null}
    </section>
  );
}
