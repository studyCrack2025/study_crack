import { AnimatedDetails } from '../../components/AnimatedDetails.jsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getCalendarCategoryMeta, PERSONAL_CALENDAR_CATEGORIES, eventMarksDateInGrid } from '../../constants/admission-calendar.js';
import { calendarSwipeDirection } from './calendar-gesture.js';
import { plannerCalendarPeriod, shiftedPlannerDate } from './calendar-navigation.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dateLabel = date => date ? `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일` : '선택한 날';

function CalendarCell({ cell }) {
  if (cell.blank) return <span className="calendar-cell-blank" aria-hidden="true" />;
  return <button type="button" className={`calendar-cell ${cell.isToday ? 'is-today' : ''} ${cell.isSelected ? 'is-selected' : ''}`} data-action="selectPlannerDate" data-planner-date={cell.ymd} aria-pressed={cell.isSelected} aria-label={`${cell.ymd} · 일정 ${cell.eventCount || 0}개`}>
    <i className="calendar-cell-day">{cell.day}</i>
    <span className="calendar-cell-dots" aria-hidden="true">{cell.eventDots?.map((dot, index) => <i key={index} style={{ background: getCalendarCategoryMeta(dot.category).color }} />)}</span>
  </button>;
}

function CalendarEventRow({ event }) {
  const editable = event.source === 'personal';
  const Tag = editable ? 'button' : 'div';
  const category = getCalendarCategoryMeta(event.category);
  return <Tag className={`calendar-event-row ${editable ? 'is-editable' : ''}`} {...(editable ? { type: 'button', 'data-action': 'openCalendarEventForm', 'data-event-id': event.id, 'aria-label': `${event.title} 수정` } : {})}>
    <i className="calendar-event-dot" style={{ background: category.color }} aria-hidden="true" />
    <div className="calendar-event-main"><b>{event.title}</b><small>{category.label} · {dateLabel(event.date)}{event.endDate && event.endDate !== event.date ? ` — ${dateLabel(event.endDate)}` : ''}</small>{event.note ? <span className="calendar-event-note">{event.note}</span> : null}</div>
    <span className="calendar-event-tag">{editable ? '수정 ›' : '공식'}</span>
  </Tag>;
}

function CalendarEventForm(ctx) {
  const panel = useRef(null);
  const previousOpen = useRef(false);
  useLayoutEffect(() => {
    if (previousOpen.current && !ctx.calendarEventFormOpen && (document.activeElement === document.body || panel.current?.contains(document.activeElement))) ctx.formOrigin.current?.focus({ preventScroll: true });
    previousOpen.current = Boolean(ctx.calendarEventFormOpen);
  }, [ctx.calendarEventFormOpen, ctx.formOrigin]);
  const draft = ctx.calendarEventDraft || {};
  const busy = Boolean(ctx.calendarSaving || ctx.calendarMutationRecovery);
  const field = name => ({ value: draft[name] || '', disabled: busy, 'data-calendar-field': name, onChange: event => ctx.setCalendarEventDraft(prev => ({ ...prev, [name]: event.target.value, clientRequestId: undefined })) });
  return <div ref={panel} id="calendar-event-form" className="calendar-form-reveal" data-open={Boolean(ctx.calendarEventFormOpen)} aria-hidden={!ctx.calendarEventFormOpen} inert={!ctx.calendarEventFormOpen ? '' : undefined}><div className="calendar-form-reveal-inner"><section className="calendar-inline-form" aria-label={ctx.calendarEventEditId ? '내 일정 수정' : '내 일정 추가'} aria-busy={ctx.calendarSaving}>
    <div className="calendar-form-head"><h4>{ctx.calendarEventEditId ? '내 일정 수정' : '내 일정 추가'}</h4><button type="button" className="calendar-nav-btn" data-action="closeCalendarEventForm" disabled={busy} aria-label="일정 입력 접기">×</button></div>
    <div className="calendar-form-fields">
      <label htmlFor="calendar-event-title">일정 제목</label><input id="calendar-event-title" className="planner-input calendar-form-title" maxLength={60} placeholder="예: 면접 준비" {...field('title')} />
      <label htmlFor="calendar-event-date">시작일</label><input id="calendar-event-date" className="planner-input" type="date" {...field('date')} />
      <AnimatedDetails className="calendar-form-details" open={Boolean(draft.detailsOpen)} onToggle={event => { const open = event.currentTarget.open; if (open !== Boolean(draft.detailsOpen)) ctx.setCalendarEventDraft(prev => ({ ...prev, detailsOpen: open })); }}>
        <summary>추가 정보 (선택)</summary>
        <div className="calendar-form-fields"><label htmlFor="calendar-event-end">종료일 (선택)</label><input id="calendar-event-end" className="planner-input" type="date" min={draft.date || undefined} {...field('endDate')} />
          <label htmlFor="calendar-event-category">분류</label><select id="calendar-event-category" className="planner-input" {...field('category')}>{PERSONAL_CALENDAR_CATEGORIES.map(key => <option key={key} value={key}>{getCalendarCategoryMeta(key).label}</option>)}</select>
          <label htmlFor="calendar-event-note">메모</label><textarea id="calendar-event-note" className="planner-input calendar-form-note" maxLength={300} placeholder="준비물이나 장소를 적어두세요" {...field('note')} /></div>
      </AnimatedDetails>
    </div>
    {ctx.calendarMutationError ? <p className="calendar-form-error" role="alert">{ctx.calendarMutationError}</p> : null}
    <div className="calendar-form-actions">
      {ctx.calendarEventEditId && !ctx.calendarMutationRecovery ? <button type="button" className="btn calendar-delete-btn" data-action="deleteCalendarEvent" disabled={ctx.calendarSaving}>삭제</button> : null}
      <button type="button" className="btn btn-primary" data-action="saveCalendarEvent" disabled={ctx.calendarSaving || ctx.calendarSyncStatus === 'loading'}>{ctx.calendarSaving ? '확인 중…' : ctx.calendarMutationRecovery ? '결과 확인' : '저장'}</button>
    </div>
  </section></div></div>;
}

function AdmissionCalendarView(ctx) {
  const activeMode = ctx.plannerCalendarMode === 'month' ? 'month' : 'week';
  const selected = ctx.selectedPlannerDateKey;
  const [expandedDate, setExpandedDate] = useState(null);
  const events = ctx.calendarSelectedEvents || [];
  const gesture = useRef(null);
  const formOrigin = useRef(null);
  const options = useRef(null);
  useEffect(() => {
    const closeOutside = event => { if (options.current?.open && !options.current.contains(event.target)) options.current.open = false; };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  const suppressClickUntil = useRef(0);
  const cells = activeMode === 'month' ? ctx.calendarMonthCells || [] : (ctx.plannerWeekDates || []).map(row => {
    const events = (ctx.calendarEvents || []).filter(event => eventMarksDateInGrid(event, row.date));
    return { ymd: row.date, day: row.day, isToday: row.date === ctx.todayDate, isSelected: row.date === selected, eventCount: events.length, eventDots: events.slice(0, 3) };
  });
  const closeOptions = () => { if (options.current) { options.current.open = false; options.current.querySelector('summary')?.focus({ preventScroll: true }); } };
  const onPointerDown = event => {
    if (!event.isPrimary || activeMode !== 'week' || (event.pointerType === 'mouse' && event.button !== 0)) { gesture.current = null; return; }
    suppressClickUntil.current = 0;
    gesture.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };
  const onPointerMove = event => {
    if (calendarSwipeDirection(gesture.current, { x: event.clientX, y: event.clientY, pointerId: event.pointerId })) event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerUp = event => {
    const direction = calendarSwipeDirection(gesture.current, { x: event.clientX, y: event.clientY, pointerId: event.pointerId });
    gesture.current = null;
    if (!direction || activeMode !== 'week') return;
    suppressClickUntil.current = performance.now() + 400;
    const move = () => ctx.setSelectedDate?.(shiftedPlannerDate(selected, direction, 'week', ctx.todayDate));
    (ctx.preserveY || (task => task()))(move);
  };
  return <section className="planner-calendar-section" aria-label="일정 달력" onClickCapture={event => { const origin = event.target.closest('[data-action="openCalendarEventForm"]'); if (origin) formOrigin.current = origin; }}>
    <div className="card planner-calendar-card">
      <div className="calendar-heading"><b className="calendar-period" aria-live="polite">{activeMode === 'month' ? ctx.calendarMonthLabel : plannerCalendarPeriod(ctx.plannerWeekDates)}</b><button type="button" className="btn planner-admission-trigger" data-action={ctx.calendarEventFormOpen ? 'closeCalendarEventForm' : 'openCalendarEventForm'} disabled={Boolean(ctx.calendarSaving || ctx.calendarMutationRecovery)} aria-label={ctx.calendarEventFormOpen ? '- 내 일정 접기' : '+ 내 일정 추가'} aria-controls="calendar-event-form" aria-expanded={Boolean(ctx.calendarEventFormOpen)}>{ctx.calendarEventFormOpen ? '－ 일정' : '＋ 일정'}</button><details ref={options} className="calendar-options" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeOptions(); } }}><summary aria-label="달력 더보기">···</summary><div className="calendar-options-body" role="group" aria-label="달력 추가 옵션" onClick={event => { if (event.target.closest('button')) closeOptions(); }}><button type="button" data-action="setPlannerCalendarMode" data-planner-calendar-mode={activeMode === 'week' ? 'month' : 'week'}>{activeMode === 'week' ? '월 달력 보기' : '주간으로'}</button><button type="button" data-action="plannerCalendarToday">오늘로</button><button type="button" data-action="plannerCalendarPrevWeek">{activeMode === 'month' ? '이전 달' : '이전 주'}</button><button type="button" data-action="plannerCalendarNextWeek">{activeMode === 'month' ? '다음 달' : '다음 주'}</button>{ctx.onOpenStorage ? <button type="button" onClick={ctx.onOpenStorage}>계획 보관 설정</button> : null}</div></details></div>
      <div className="calendar-swipe-area" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }} onClickCapture={event => { if (performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}>
        <div className="calendar-weekdays">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map(cell => <CalendarCell key={cell.key || cell.ymd} cell={cell} />)}</div>
      </div>
      {ctx.calendarSyncStatus === 'loading' ? <p className="calendar-sync-note" role="status">내 일정을 동기화하고 있어요.</p> : null}
      {ctx.calendarSyncStatus === 'error' ? <div className="calendar-sync-note error" role="alert"><span>내 일정을 불러오지 못했어요.</span><button type="button" data-action="retryCalendar">다시 불러오기</button></div> : null}
      <div className="calendar-selected" aria-label="선택한 날의 일정"><b>{dateLabel(selected)} 일정</b><div className="calendar-event-list">{events.length ? (expandedDate === selected ? events : events.slice(0, 3)).map(event => <CalendarEventRow key={event.id} event={event} />) : <p className="calendar-empty">등록된 일정이 없어요</p>}</div>{events.length > 3 ? <button type="button" className="btn btn-secondary" aria-expanded={expandedDate === selected} onClick={() => setExpandedDate(expandedDate === selected ? null : selected)}>{expandedDate === selected ? '일정 접기' : `일정 ${events.length}개 모두 보기`}</button> : null}</div>
      <CalendarEventForm {...ctx} formOrigin={formOrigin} />
      {!ctx.calendarEventFormOpen && ctx.calendarEventDraft ? <button type="button" className="btn btn-secondary" data-action="openCalendarEventForm" aria-controls="calendar-event-form" aria-expanded={false}>작성하던 일정 이어쓰기</button> : null}
    </div>
  </section>;
}

export function AdmissionCalendar(ctx) { return <AdmissionCalendarView {...ctx} />; }
