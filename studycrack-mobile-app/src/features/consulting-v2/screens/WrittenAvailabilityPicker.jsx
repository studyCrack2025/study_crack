import React from 'react';
import { groupWrittenSlots, writtenCalendarGroups } from '../schedule-model.js';

const dateLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' });
const weekdayLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' });
const dayDate = date => new Date(`${date}T00:00:00+09:00`);
const dayLabel = date => dateLabel.format(dayDate(date));

export function WrittenAvailabilityPicker({ slots, window, selected, setSelected, saving }) {
  const groups = React.useMemo(() => writtenCalendarGroups(slots, window), [slots, window]);
  const [activeDate, setActiveDate] = React.useState(() => groups.find(group => group.slots.some(slot => selected[slot.slotId]))?.date || groups.find(group => group.slots.length)?.date);
  const active = groups.find(group => group.date === activeDate && group.slots.length) || groups.find(group => group.slots.length);
  const headingId = React.useId();
  if (!active) return null;
  const selectedCount = active.slots.filter(slot => selected[slot.slotId]).length;
  const all = selectedCount === active.slots.length;
  const toggleDay = () => setSelected(current => {
    const next = { ...current };
    for (const slot of active.slots) {
      if (all) delete next[slot.slotId];
      else next[slot.slotId] = next[slot.slotId] || 2;
    }
    return next;
  });
  const toggle = slotId => setSelected(current => {
    const next = { ...current };
    if (next[slotId]) delete next[slotId];
    else next[slotId] = 2;
    return next;
  });
  return <div className="consulting-schedule-picker">
    <div className="consulting-schedule-calendar">
      <h2>상담 날짜</h2><p>30분 단위 · 한국시간 기준</p>
      <div className="consulting-schedule-date-grid" role="group" aria-label="상담 날짜">
        {groups.map(group => {
          const count = group.slots.filter(slot => selected[slot.slotId]).length;
          return <button className="consulting-schedule-date" type="button" key={group.date} disabled={saving || !group.slots.length} aria-pressed={active.date === group.date}
            aria-label={`${dayLabel(group.date)}, ${group.slots.length ? `${count}개 선택` : '선택 가능한 시간 없음'}`} data-selected={count > 0} onClick={() => setActiveDate(group.date)}>
            <small>{weekdayLabel.format(dayDate(group.date))}</small><strong>{Number(group.date.slice(-2))}</strong><span>{group.slots.length ? count ? `${count}개` : '·' : '마감'}</span>
          </button>;
        })}
      </div>
      <p className="consulting-schedule-calendar-note">날짜를 바꿔도 고른 시간은 유지돼요.</p>
    </div>
    <section className="consulting-schedule-times" aria-labelledby={headingId}>
      <header><h2 id={headingId}>{dayLabel(active.date)}</h2><span>{selectedCount}/{active.slots.length}개</span></header>
      <label><input type="checkbox" checked={all} disabled={saving} onChange={toggleDay} /> 이 날의 모든 시간 선택</label>
      <div className="consulting-schedule-time-grid">{active.slots.map(slot => <button type="button" key={slot.slotId} disabled={saving}
        aria-pressed={Boolean(selected[slot.slotId])} onClick={() => toggle(slot.slotId)}>{slot.localTime}</button>)}</div>
    </section>
  </div>;
}

export function WrittenAvailabilitySaved({ slots, outsideWindowCount, onEdit, onHome }) {
  const heading = React.useRef(null);
  const groups = groupWrittenSlots(slots);
  React.useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: 'start' });
  }, []);
  return <section className="consulting-schedule-card consulting-schedule-saved">
    <p className="consulting-v2-kicker">서면상담 일정 · 가능 시간 제출 완료</p>
    <span className="consulting-schedule-saved-mark" aria-hidden="true">✓</span>
    <h1 tabIndex={-1} ref={heading}>가능 시간을 전달했어요</h1>
    <p className="consulting-schedule-intro">운영팀이 담당자와 일정을 확인하고 있어요.<br />상담 시간이 확정되면 알림으로 알려드릴게요.</p>
    <div className="consulting-schedule-saved-total"><strong>{groups.length}일 · {slots.length}개 시간</strong><span>아직 예약이 확정된 상태는 아니에요.</span></div>
    {outsideWindowCount > 0 && <p className="consulting-survey-message" role="status">이전에 고른 시간 중 {outsideWindowCount}개가 현재는 선택할 수 없어요. 필요하면 선택을 수정해주세요.</p>}
    <details className="consulting-schedule-saved-details"><summary>선택한 시간 보기</summary><dl>{groups.map(group => <div key={group.date}>
      <dt>{dayLabel(group.date)}</dt><dd>{group.slots.map(slot => slot.localTime).join(' · ')}</dd>
    </div>)}</dl></details>
    <footer><button className="consulting-v2-primary" type="button" onClick={onHome}>진행 현황으로 돌아가기</button>
      <button className="consulting-v2-secondary" type="button" onClick={onEdit}>선택 시간 수정</button></footer>
  </section>;
}
