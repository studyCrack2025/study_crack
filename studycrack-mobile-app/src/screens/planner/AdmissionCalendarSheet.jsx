import {
  CALENDAR_CATEGORIES,
  PERSONAL_CALENDAR_CATEGORIES,
  getCalendarCategoryMeta
} from '../../constants/admission-calendar.js';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLabel(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

function periodLabel(event) {
  if (!event?.endDate || event.endDate === event.date) return '';
  return ` · ${event.date} ~ ${event.endDate}`;
}

function CalendarEventRow({ event }) {
  const meta = getCalendarCategoryMeta(event.category);
  const editable = event.source === 'personal';
  return (
    <div
      className={`calendar-event-row ${editable ? 'is-editable' : ''}`}
      data-action={editable ? 'openCalendarEventForm' : undefined}
      data-event-id={editable ? event.id : undefined}
    >
      <span className="calendar-event-dot" style={{ background: meta.color }} />
      <div className="calendar-event-main">
        <b>{event.title}</b>
        {event.note ? <p>{event.note}</p> : null}
        <small>{meta.label}{periodLabel(event)}</small>
      </div>
      {editable ? <span className="calendar-event-chev" aria-hidden="true">›</span> : <span className="calendar-event-tag">공식</span>}
    </div>
  );
}

function CalendarMonthCell({ cell }) {
  if (cell.blank) return <span className="calendar-cell calendar-cell-blank" />;
  const dots = (cell.eventDots || []).map((dot, idx) => (
    <i key={idx} style={{ background: getCalendarCategoryMeta(dot.category).color }} />
  ));
  const cls = ['calendar-cell'];
  if (cell.isToday) cls.push('is-today');
  if (cell.isSelected) cls.push('is-selected');
  return (
    <button type="button" className={cls.join(' ')} data-action="selectCalendarDate" data-date={cell.ymd}>
      <i className="calendar-cell-day">{cell.day}</i>
      <span className="calendar-cell-dots">{dots}</span>
    </button>
  );
}

function CalendarEventForm(ctx) {
  const {
    calendarEventFormOpen = false,
    calendarEventEditId = null,
    calendarEventDraft = null,
    calendarSaving = false
  } = ctx;
  if (!calendarEventFormOpen) return null;
  const draft = calendarEventDraft || {};
  return (
    <div className="sc-overlay sc-overlay--modal home-modal-overlay calendar-event-overlay" data-action="closeCalendarEventForm">
      <div className="sc-modal home-modal calendar-event-modal" data-action="noopModal" role="dialog" aria-modal="true">
        <div className="sc-modal-head calendar-form-head">
          <div>
            <span>내 일정</span>
            <p className="sc-modal-padded-title">{calendarEventEditId ? '내 일정 수정' : '내 일정 추가'}</p>
          </div>
          <button type="button" className="sc-overlay-close qna-modal-close" data-action="closeCalendarEventForm" aria-label="닫기">✕</button>
        </div>
        <div className="sc-modal-body calendar-form-fields">
          <label>일정 제목</label>
          <input className="planner-input calendar-form-title" data-calendar-field="title" maxLength="60" defaultValue={draft.title || ''} placeholder="예: 수시 원서 접수 마감" />
          <div className="calendar-form-date-grid">
            <div>
              <label>시작일</label>
              <input className="planner-input" type="date" data-calendar-field="date" defaultValue={draft.date || ''} />
            </div>
            <div>
              <label>종료일</label>
              <input className="planner-input" type="date" data-calendar-field="endDate" defaultValue={draft.endDate || ''} />
            </div>
          </div>
          <label>분류</label>
          <select className="planner-input calendar-form-select" data-calendar-field="category" defaultValue={draft.category || 'personal'}>
            {PERSONAL_CALENDAR_CATEGORIES.map((key) => (
              <option value={key} key={key}>{(CALENDAR_CATEGORIES[key] || {}).label || key}</option>
            ))}
          </select>
          <label>메모</label>
          <textarea className="planner-input calendar-form-note" data-calendar-field="note" maxLength="300" defaultValue={draft.note || ''} placeholder="준비물, 장소, 확인할 내용을 적어두세요." />
        </div>
        <div className="sc-modal-footer support-btns calendar-form-actions">
          {calendarEventEditId ? (
            <button type="button" className="btn btn-secondary calendar-delete-btn" data-action="deleteCalendarEvent" data-event-id={calendarEventEditId} disabled={calendarSaving}>삭제</button>
          ) : null}
          <button type="button" className="btn btn-secondary" data-action="closeCalendarEventForm" disabled={calendarSaving}>취소</button>
          <button type="button" className="btn btn-primary" data-action="saveCalendarEvent" disabled={calendarSaving}>{calendarSaving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

function CalendarSheet(ctx) {
  const {
    calendarSheetOpen = false,
    calendarMonthLabel = '',
    calendarMonthCells = [],
    calendarWeekdays = WEEKDAYS,
    calendarNearestEvent = null,
    calendarNearestDdayLabel = '',
    calendarSelectedDate = '',
    calendarSelectedEvents = [],
    calendarSyncStatus = 'idle'
  } = ctx;
  if (!calendarSheetOpen) return <>{CalendarEventForm(ctx)}</>;
  const addDisabled = calendarSyncStatus === 'loading';
  return (
    <>
      <div className="sc-overlay sc-overlay--sheet planner-sheet-overlay calendar-sheet-overlay" data-action="closeCalendarSheet">
        <div className="sc-sheet planner-sheet calendar-sheet" data-action="noopModal" role="dialog" aria-modal="true">
          <div className="sc-sheet-handle notif-sheet-handle" aria-hidden="true" />
          <div className="sc-sheet-head notif-sheet-head calendar-sheet-head">
            <div>
              <span>입시 캘린더</span>
              <p className="sc-modal-padded-title">수험 일정</p>
            </div>
            <button type="button" className="sc-overlay-close qna-modal-close" data-action="closeCalendarSheet" aria-label="닫기">✕</button>
          </div>
          <div className="sc-sheet-body calendar-sheet-scroll">
            {calendarSyncStatus === 'loading' ? <p className="calendar-sync-note">내 일정을 동기화하고 있어요.</p> : null}
            {calendarSyncStatus === 'error' ? <p className="calendar-sync-note error">내 일정을 불러오지 못했습니다. 잠시 후 다시 열어주세요.</p> : null}
            {calendarNearestEvent ? (
              <div className="calendar-nearest">
                <span className="calendar-nearest-dday">{calendarNearestDdayLabel}</span>
                <div className="calendar-nearest-main">
                  <b>{calendarNearestEvent.title}</b>
                  <p>{formatDateLabel(calendarNearestEvent.date)} · {getCalendarCategoryMeta(calendarNearestEvent.category).label}</p>
                </div>
              </div>
            ) : (
              <div className="calendar-nearest calendar-nearest-empty"><p>다가오는 일정이 없어요. 아래에서 일정을 추가해보세요.</p></div>
            )}
            <div className="calendar-month-nav">
              <button type="button" className="calendar-nav-btn" data-action="calendarPrevMonth" aria-label="이전 달">‹</button>
              <b>{calendarMonthLabel}</b>
              <button type="button" className="calendar-nav-btn" data-action="calendarNextMonth" aria-label="다음 달">›</button>
            </div>
            <div className="calendar-weekdays">{calendarWeekdays.map((w) => <span key={w}>{w}</span>)}</div>
            <div className="calendar-grid">{calendarMonthCells.map((cell) => <CalendarMonthCell cell={cell} key={cell.key || cell.ymd} />)}</div>
            <div className="calendar-selected">
              <div className="calendar-selected-head">
                <b>{formatDateLabel(calendarSelectedDate)}</b>
                <button type="button" className="btn btn-primary mini" data-action="openCalendarEventForm" disabled={addDisabled}>+ 내 일정 추가</button>
              </div>
              <div className="calendar-selected-list">
                {calendarSelectedEvents.length
                  ? calendarSelectedEvents.map((event) => <CalendarEventRow event={event} key={event.id} />)
                  : <p className="calendar-empty">이 날짜에 등록된 일정이 없어요.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
      {CalendarEventForm(ctx)}
    </>
  );

}
export { CalendarSheet as AdmissionCalendarSheet };
