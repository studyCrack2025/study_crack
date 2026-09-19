import { buildCoachingWeek } from './presentation.js';
import { TODAY_DATE } from '../../constants/runtime-defaults.js';

export function WeeklyPlanPreview({ plannerItems = [], detailed = false, locked = false }) {
  const week = buildCoachingWeek(plannerItems, TODAY_DATE);
  return <section className="coaching-week-preview" aria-label="이번 주 기기 플래너">
    <header><div><span>MY WEEK</span><h3>이번 주 플래너</h3></div>{!locked ? <button type="button" data-action="goto" data-target="planner">플래너 열기 →</button> : null}</header>
    <p>{locked ? '미리보기 · 구독 후 실제 기록을 확인하세요' : `${week.start} – ${week.end} · 이 기기에 저장된 계획`}</p>
    <ol className="coaching-week-days">{week.days.map(day => <li key={day.date} data-active={!locked && day.items.length > 0} aria-label={locked ? day.label : `${day.date} ${day.label}요일 계획 ${day.items.length}개`}><span>{day.label}</span><b>{locked ? '—' : day.items.length}</b></li>)}</ol>
    <p>{locked ? '요일별 계획과 시간을 한눈에 확인해요.' : `등록 ${week.total}개 · 계획 ${week.minutes}분 · 튜터가 제시한 계획이 아니에요.`}</p>
    {detailed && !locked ? <ol className="coaching-week-list">{week.days.map(day => <li key={day.date}><b>{day.label}<small>{day.date.slice(5)}</small></b><div>{day.items.length ? day.items.map((item, index) => <p key={item.id || index}><strong>{item.subject || '기타'}</strong> {item.content || '내용 없음'}<small>{item.minutes}분</small></p>) : <p>등록한 계획 없음</p>}</div></li>)}</ol> : null}
  </section>;
}
