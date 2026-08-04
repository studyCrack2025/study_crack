import { getData } from './action-utils.js';
import { PERSONAL_EVENT_LIMITS, normalizePersonalEvent } from '../constants/admission-calendar.js';
import { deleteMobileAdmissionEvent, upsertMobileAdmissionEvent } from '../features/account/api.js';

function noop() {}

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function fieldValue(ctx, name) {
  const doc = getDocument(ctx);
  const el = doc?.querySelector?.(`[data-calendar-field="${name}"]`);
  return el ? el.value : '';
}

// 월 앵커(YYYY-MM-01)를 delta개월 이동.
function shiftMonthAnchor(anchor, delta) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(anchor || '') ? anchor : null;
  const year = base ? Number(base.slice(0, 4)) : new Date().getFullYear();
  const month = base ? Number(base.slice(5, 7)) - 1 : new Date().getMonth();
  const d = new Date(year, month + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function createCalendarHandlers(ctx = {}) {
  const {
    alert = globalThis.alert || noop,
    confirm = globalThis.confirm || (() => true),
    preserveScrollAfterStateChange = (fn) => fn?.(),
    setCalendarSheetOpen = noop,
    setCalendarSelectedDate = noop,
    setCalendarMonthAnchor = noop,
    setCalendarEventFormOpen = noop,
    setCalendarEventEditId = noop,
    setCalendarEventDraft = noop,
    setCalendarSaving = noop,
    setPersonalEvents = noop
  } = ctx;

  function usesServerCalendar() {
    return typeof ctx.apiFetch === 'function' &&
      Boolean(ctx.userApiUrl) &&
      typeof ctx.hasClientSession === 'function' &&
      ctx.hasClientSession();
  }

  return {
    openCalendarSheet() {
      setCalendarSheetOpen(true);
      return true;
    },

    closeCalendarSheet({ actionEl, isOverlaySelfClick }) {
      if (!isOverlaySelfClick && actionEl?.classList?.contains?.('planner-sheet-overlay')) return false;
      setCalendarEventFormOpen(false);
      setCalendarSheetOpen(false);
      return true;
    },

    selectCalendarDate({ actionEl }) {
      const date = getData(actionEl, 'date');
      if (date) preserveScrollAfterStateChange(() => setCalendarSelectedDate(date));
      return true;
    },

    calendarPrevMonth() {
      setCalendarMonthAnchor((prev) => shiftMonthAnchor(prev, -1));
      return true;
    },

    calendarNextMonth() {
      setCalendarMonthAnchor((prev) => shiftMonthAnchor(prev, 1));
      return true;
    },

    openCalendarEventForm({ actionEl }) {
      const eventId = getData(actionEl, 'event-id');
      const existing = eventId
        ? (ctx.personalEvents || []).find((e) => e.id === eventId)
        : null;
      const draft = existing
        ? { title: existing.title, date: existing.date, endDate: existing.endDate || '', category: existing.category, note: existing.note || '' }
        : { title: '', date: ctx.calendarSelectedDate || ctx.calendarToday || '', endDate: '', category: 'personal', note: '' };
      setCalendarEventEditId(existing ? existing.id : null);
      setCalendarEventDraft(draft);
      setCalendarEventFormOpen(true);
      return true;
    },

    closeCalendarEventForm() {
      setCalendarEventFormOpen(false);
      setCalendarEventEditId(null);
      setCalendarEventDraft(null);
      return true;
    },

    async saveCalendarEvent() {
      if (ctx.calendarSaving || ctx.calendarSyncStatus === 'loading') return true;
      const editId = ctx.calendarEventEditId || null;
      const draft = {
        id: editId || undefined,
        title: fieldValue(ctx, 'title'),
        date: fieldValue(ctx, 'date'),
        endDate: fieldValue(ctx, 'endDate'),
        category: fieldValue(ctx, 'category'),
        note: fieldValue(ctx, 'note')
      };
      // 수정이면 createdAt 보존.
      if (editId) {
        const prevEvent = (ctx.personalEvents || []).find((e) => e.id === editId);
        if (prevEvent) draft.createdAt = prevEvent.createdAt;
      }
      const normalized = normalizePersonalEvent(draft);
      if (!normalized) {
        alert('일정 제목과 날짜를 정확히 입력해주세요.');
        return true;
      }
      const current = Array.isArray(ctx.personalEvents) ? ctx.personalEvents : [];
      if (!editId && current.length >= PERSONAL_EVENT_LIMITS.maxEvents) {
        alert(`개인 일정은 최대 ${PERSONAL_EVENT_LIMITS.maxEvents}개까지 추가할 수 있어요.`);
        return true;
      }
      if (usesServerCalendar()) {
        setCalendarSaving(true);
        const payload = {
          ...normalized,
          ...(editId ? { id: editId } : {})
        };
        if (!editId) {
          delete payload.id;
          delete payload.createdAt;
          delete payload.updatedAt;
          delete payload.source;
        }
        const result = await upsertMobileAdmissionEvent({
          apiFetch: ctx.apiFetch,
          userApiUrl: ctx.userApiUrl,
          event: payload
        });
        setCalendarSaving(false);
        if (!result.ok) {
          if (result.code === 'AUTH_EXPIRED') {
            ctx.expireMobileSessionSilently?.();
            return true;
          }
          alert(result.error || '일정을 저장하지 못했습니다.');
          return true;
        }
        setPersonalEvents(result.data?.events || []);
      } else {
        const next = editId
          ? current.map((e) => (e.id === editId ? normalized : e))
          : current.concat(normalized);
        setPersonalEvents(next);
      }
      setCalendarSelectedDate(normalized.date);
      setCalendarEventFormOpen(false);
      setCalendarEventEditId(null);
      setCalendarEventDraft(null);
      return true;
    },

    async deleteCalendarEvent({ actionEl }) {
      if (ctx.calendarSaving || ctx.calendarSyncStatus === 'loading') return true;
      const eventId = getData(actionEl, 'event-id') || ctx.calendarEventEditId;
      if (!eventId) return true;
      if (!confirm('이 일정을 삭제하시겠어요?')) return true;
      if (usesServerCalendar()) {
        setCalendarSaving(true);
        const result = await deleteMobileAdmissionEvent({
          apiFetch: ctx.apiFetch,
          userApiUrl: ctx.userApiUrl,
          eventId
        });
        setCalendarSaving(false);
        if (!result.ok) {
          if (result.code === 'AUTH_EXPIRED') {
            ctx.expireMobileSessionSilently?.();
            return true;
          }
          alert(result.error || '일정을 삭제하지 못했습니다.');
          return true;
        }
        setPersonalEvents(result.data?.events || []);
      } else {
        const next = (ctx.personalEvents || []).filter((e) => e.id !== eventId);
        setPersonalEvents(next);
      }
      setCalendarEventFormOpen(false);
      setCalendarEventEditId(null);
      setCalendarEventDraft(null);
      return true;
    }
  };
}
