import { renderModal } from './modal.js';
import { renderSheet } from './sheet.js';
import {
  CALENDAR_CATEGORIES,
  PERSONAL_CALENDAR_CATEGORIES,
  getCalendarCategoryMeta
} from '../constants/admission-calendar.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

function renderEventRow(event) {
  const meta = getCalendarCategoryMeta(event.category);
  const editable = event.source === 'personal';
  const attrs = editable
    ? `data-action="openCalendarEventForm" data-event-id="${escapeHtml(event.id)}"`
    : '';
  return `<div class="calendar-event-row ${editable ? 'is-editable' : ''}" ${attrs}>
    <span class="calendar-event-dot" style="background:${meta.color}"></span>
    <div class="calendar-event-main"><b>${escapeHtml(event.title)}</b>${event.note ? `<p>${escapeHtml(event.note)}</p>` : ''}<small>${escapeHtml(meta.label)}${escapeHtml(periodLabel(event))}</small></div>
    ${editable ? '<span class="calendar-event-chev" aria-hidden="true">›</span>' : '<span class="calendar-event-tag">공식</span>'}
  </div>`;
}

function renderMonthCell(cell) {
  if (cell.blank) return '<span class="calendar-cell calendar-cell-blank"></span>';
  const dots = (cell.eventDots || [])
    .map((dot) => `<i style="background:${getCalendarCategoryMeta(dot.category).color}"></i>`)
    .join('');
  const cls = ['calendar-cell'];
  if (cell.isToday) cls.push('is-today');
  if (cell.isSelected) cls.push('is-selected');
  return `<button type="button" class="${cls.join(' ')}" data-action="selectCalendarDate" data-date="${escapeHtml(cell.ymd)}"><i class="calendar-cell-day">${cell.day}</i><span class="calendar-cell-dots">${dots}</span></button>`;
}

function renderEventForm(ctx) {
  const {
    calendarEventFormOpen = false,
    calendarEventEditId = null,
    calendarEventDraft = null,
    calendarSaving = false
  } = ctx;
  if (!calendarEventFormOpen) return '';
  const draft = calendarEventDraft || {};
  const categoryOptions = PERSONAL_CALENDAR_CATEGORIES
    .map((key) => `<option value="${key}" ${draft.category === key ? 'selected' : ''}>${escapeHtml((CALENDAR_CATEGORIES[key] || {}).label || key)}</option>`)
    .join('');
  const body = `<div class="sc-modal-head profile-detail-modal-head"><p class="home-modal-title">${calendarEventEditId ? '일정 수정' : '내 일정 추가'}</p><button type="button" class="sc-overlay-close qna-modal-close" data-action="closeCalendarEventForm" aria-label="닫기">✕</button></div>
    <div class="sc-modal-body calendar-form-fields">
      <label>제목</label>
      <input class="planner-input" data-calendar-field="title" maxlength="60" value="${escapeHtml(draft.title || '')}" placeholder="일정 제목"/>
      <label>날짜</label>
      <input class="planner-input" type="date" data-calendar-field="date" value="${escapeHtml(draft.date || '')}"/>
      <label>종료일 (선택, 기간 일정)</label>
      <input class="planner-input" type="date" data-calendar-field="endDate" value="${escapeHtml(draft.endDate || '')}"/>
      <label>분류</label>
      <select class="planner-input" data-calendar-field="category">${categoryOptions}</select>
      <label>메모 (선택)</label>
      <textarea class="planner-input calendar-form-note" data-calendar-field="note" maxlength="300" placeholder="메모">${escapeHtml(draft.note || '')}</textarea>
    </div>
    <div class="sc-modal-footer support-btns calendar-form-actions">
      ${calendarEventEditId ? `<button type="button" class="btn btn-secondary calendar-delete-btn" data-action="deleteCalendarEvent" data-event-id="${escapeHtml(calendarEventEditId)}" ${calendarSaving ? 'disabled' : ''}>삭제</button>` : ''}
      <button type="button" class="btn btn-secondary" data-action="closeCalendarEventForm" ${calendarSaving ? 'disabled' : ''}>취소</button>
      <button type="button" class="btn btn-primary" data-action="saveCalendarEvent" ${calendarSaving ? 'disabled' : ''}>${calendarSaving ? '저장 중...' : '저장'}</button>
    </div>`;
  return renderModal({
    overlayClass: 'calendar-event-overlay',
    panelClass: 'calendar-event-modal',
    dismissAction: 'closeCalendarEventForm',
    body
  });
}

// 수험 일정 바텀시트(다가오는 일정 + 월간 캘린더 + 선택일 목록 + 내 일정 추가).
export function renderCalendarSheet(ctx = {}) {
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
  if (!calendarSheetOpen) return '';

  const nearestHtml = calendarNearestEvent
    ? `<div class="calendar-nearest"><span class="calendar-nearest-dday">${escapeHtml(calendarNearestDdayLabel)}</span><div class="calendar-nearest-main"><b>${escapeHtml(calendarNearestEvent.title)}</b><p>${escapeHtml(formatDateLabel(calendarNearestEvent.date))} · ${escapeHtml(getCalendarCategoryMeta(calendarNearestEvent.category).label)}</p></div></div>`
    : '<div class="calendar-nearest calendar-nearest-empty"><p>다가오는 일정이 없어요. 아래에서 일정을 추가해보세요.</p></div>';

  const weekdaysHtml = calendarWeekdays.map((w) => `<span>${escapeHtml(w)}</span>`).join('');
  const gridHtml = calendarMonthCells.map(renderMonthCell).join('');
  const selectedListHtml = calendarSelectedEvents.length
    ? calendarSelectedEvents.map(renderEventRow).join('')
    : '<p class="calendar-empty">이 날짜에 등록된 일정이 없어요.</p>';
  const syncHtml = calendarSyncStatus === 'loading'
    ? '<p class="calendar-sync-note">내 일정을 동기화하고 있어요.</p>'
    : calendarSyncStatus === 'error'
      ? '<p class="calendar-sync-note error">내 일정을 불러오지 못했습니다. 잠시 후 다시 열어주세요.</p>'
      : '';
  const addDisabled = calendarSyncStatus === 'loading' ? 'disabled' : '';

  const body = `<div class="sc-sheet-handle notif-sheet-handle" aria-hidden="true"></div>
    <div class="sc-sheet-head notif-sheet-head"><p class="home-modal-title">다가오는 일정</p><button type="button" class="sc-overlay-close qna-modal-close" data-action="closeCalendarSheet" aria-label="닫기">✕</button></div>
    <div class="sc-sheet-body calendar-sheet-scroll">
      ${syncHtml}
      ${nearestHtml}
      <div class="calendar-month-nav"><button type="button" class="calendar-nav-btn" data-action="calendarPrevMonth" aria-label="이전 달">‹</button><b>${escapeHtml(calendarMonthLabel)}</b><button type="button" class="calendar-nav-btn" data-action="calendarNextMonth" aria-label="다음 달">›</button></div>
      <div class="calendar-weekdays">${weekdaysHtml}</div>
      <div class="calendar-grid">${gridHtml}</div>
      <div class="calendar-selected">
        <div class="calendar-selected-head"><b>${escapeHtml(formatDateLabel(calendarSelectedDate))}</b><button type="button" class="btn btn-primary mini" data-action="openCalendarEventForm" ${addDisabled}>+ 내 일정 추가</button></div>
        <div class="calendar-selected-list">${selectedListHtml}</div>
      </div>
    </div>`;

  return renderSheet({ panelClass: 'calendar-sheet', dismissAction: 'closeCalendarSheet', body }) + renderEventForm(ctx);
}
