import { getData } from './action-utils.js';
import { isValidIsoDate } from '../constants/admission-calendar.js';
import { loadMobileModule } from '../shared/browser/mobile-runtime.js';

export function createCalendarHandlers(ctx = {}) {
  const confirm = ctx.confirm || globalThis.confirm || (() => false);
  const mutate = async (kind, id = '') => {
    let module;
    try {
      module = await loadMobileModule(() => import('../features/account/calendar-mutation.js'));
    } catch {
      if (!ctx.isCurrentProfile || ctx.isCurrentProfile()) ctx.setCalendarMutationError('일정 저장을 준비하지 못했어요. 연결을 확인하고 다시 시도해주세요.');
      return true;
    }
    return module.mutateCalendar(ctx, kind, id);
  };
  return {
    openPlannerCalendar({ actionEl } = {}) {
      const date = getData(actionEl, 'date');
      if (isValidIsoDate(date)) ctx.setSelectedDate(date);
      ctx.goto?.('planner');
      return true;
    },
    retryCalendar() {
      if (!ctx.calendarSaving) ctx.setCalendarSyncStatus('idle');
      return true;
    },
    openCalendarEventForm({ actionEl } = {}) {
      if (ctx.calendarSaving || ctx.calendarMutationRecovery) return true;
      const id = getData(actionEl, 'event-id');
      const existing = (ctx.personalEvents || []).find(event => event.id === id);
      if (id && !existing) return true;
      if (!id && ctx.calendarEventDraft && !ctx.calendarEventEditId) {
        ctx.setCalendarEventFormOpen(true);
        return true;
      }
      if (ctx.calendarEventDraft && !confirm('작성 중인 내용을 바꾸시겠어요?')) return true;
      ctx.setCalendarEventEditId(existing?.id || null);
      ctx.setCalendarEventDraft(existing ? { ...existing, detailsOpen: Boolean(existing.endDate || existing.note || existing.category !== 'personal') } : {
        title: '', date: ctx.selectedPlannerDateKey || ctx.calendarToday, endDate: '', category: 'personal', note: ''
      });
      ctx.setCalendarMutationError('');
      ctx.setCalendarEventFormOpen(true);
      return true;
    },
    closeCalendarEventForm() {
      if (!ctx.calendarSaving && !ctx.calendarMutationRecovery) ctx.setCalendarEventFormOpen(false);
      return true;
    },
    async saveCalendarEvent() {
      return mutate('save');
    },
    async deleteCalendarEvent({ actionEl } = {}) {
      return mutate('delete', getData(actionEl, 'event-id'));
    }
  };
}
