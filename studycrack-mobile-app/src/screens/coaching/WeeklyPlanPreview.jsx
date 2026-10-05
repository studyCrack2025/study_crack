import { buildCoachingWeek } from './presentation.js';
import { getTodayDateKey } from '../../constants/runtime-defaults.js';
import { useContext } from 'react';
import { PlannerStorageContext } from '../../features/planner/PlannerStorageContext.js';

export function WeeklyPlanPreview({ plannerItems = [], detailed = false, locked = false }) {
  const account = useContext(PlannerStorageContext)?.controller?.account;
  const accountView = account?.getView();
  const accountMode = accountView?.mode === 'account';
  const available = !accountMode || accountView.snapshot?.available === true;
  const week = buildCoachingWeek(locked ? [] : accountMode ? account.getItems() : plannerItems, getTodayDateKey());
  return <section className="coaching-week-preview" aria-label="이번 주 내 플래너">
    <header><div><span>MY WEEK</span><h3>이번 주 플래너</h3></div>{!locked ? <button type="button" data-action="goto" data-target="planner">플래너 열기 →</button> : null}</header>
    <p>{locked ? '미리보기' : `${week.start} – ${week.end} · ${accountMode ? '계정 계획' : '기기 계획'}${accountMode && !accountView.verified ? ' · 최신 확인 필요' : ''}`}</p>
    <ol className="coaching-week-days">{week.days.map(day => <li key={day.date} data-active={!locked && available && day.items.length > 0} aria-label={locked ? day.label : !available ? `${day.date} ${day.label}요일 계획 확인 필요` : `${day.date} ${day.label}요일 계획 ${day.items.length}개`}><span>{day.label}</span><b>{locked || !available ? '—' : day.items.length}</b></li>)}</ol>
    {!locked ? <p>{available ? `등록 ${week.total}개 · 계획 ${week.minutes}분` : '계정 계획 확인 필요'}</p> : null}
    {detailed && !locked && available ? <ol className="coaching-week-list">{week.days.map(day => <li key={day.date}><b>{day.label}<small>{day.date.slice(5)}</small></b><div>{day.items.length ? day.items.map((item, index) => <p key={item.id || index}><strong>{item.subject || '기타'}</strong> {item.content || '내용 없음'}<small>{item.minutes}분</small></p>) : <p>등록한 계획 없음</p>}</div></li>)}</ol> : null}
  </section>;
}
