import { Sheet } from '../../components/Sheet.jsx';

const MARKS = { valid: '✓', recorded: '·', empty: '—', unknown: '?' };

export function StreakSummarySheet({ presentation, open = false }) {
  if (!presentation) return null;
  const { days, streakDays, status, profileStatus, leadingDays, startDate, endDate, unknownDays, stale, streakStale } = presentation;
  const busy = status === 'loading' || profileStatus === 'loading';
  return <Sheet open={open} ariaLabel="연속 학습 기록" dismissAction="closeStreakSummary" panelClass="streak-summary-sheet">
    <header className="streak-summary-head"><div><h1>연속 학습 기록</h1><p>매일의 공부를 돌아봐요</p></div><button type="button" data-action="closeStreakSummary" aria-label="연속 학습 기록 닫기">×</button></header>
    <div className="streak-summary-body">
      <section className="streak-summary-hero" aria-label="연속 학습 요약"><small>{streakStale ? '마지막 확인 기록' : '나의 연속 학습'}</small><strong>{streakDays === null ? '확인 필요' : <>{streakDays}<span>일 연속 학습</span></>}</strong><p>보상 확인된 공부를 기준으로 집계해요.<br />플래너의 완료 표시와는 별도 기록이에요.</p></section>
      <div className="streak-summary-status" role="status"><p>{busy ? '최신 기록을 확인하고 있어요.' : status === 'unavailable' ? '공부 기록을 아직 제공할 수 없어요.' : status === 'error' ? `공부 기록을 불러오지 못했어요.${stale ? ' 마지막 확인 기록을 표시해요.' : ''}` : stale ? '마지막으로 확인한 기간의 기록이에요.' : unknownDays ? `${unknownDays}일의 기록을 확인하지 못했어요.` : '표시된 기간의 공부 기록을 확인했어요.'}</p><button type="button" data-action={busy ? 'noopModal' : 'retryGameResources'} aria-disabled={busy}>기록 다시 확인</button></div>
      <section className="streak-summary-calendar" aria-label="최근 30일 공부 기록"><h2>최근 30일</h2><p>{startDate} ~ {endDate} · 한국 시간</p><div className="streak-summary-week" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}</div><ol className="streak-summary-days">{Array.from({ length: leadingDays }, (_, index) => <li key={`blank-${index}`} aria-hidden="true" />)}{days.map(day => <li key={day.date} data-status={day.status} aria-current={day.today ? 'date' : undefined} aria-label={`${day.date} · ${day.label}${day.minutes === null ? '' : ` · ${day.minutes}분`}`} title={`${day.date} · ${day.label}${day.minutes === null ? '' : ` · ${day.minutes}분`}`}><span>{Number(day.date.slice(8))}</span><small aria-hidden="true">{MARKS[day.status]}</small></li>)}</ol><p className="streak-summary-legend">✓ 연속 학습 인정 · 공부 기록 있음<br />— 확인된 공부 없음　? 확인 필요</p></section>
      <p className="streak-summary-note">보상 확인 전의 공부나 아직 불러오지 못한 날짜는 실제 기록과 다를 수 있어요. 기록이 갱신되면 연속 학습일도 달라질 수 있어요.</p>
    </div>
  </Sheet>;
}
