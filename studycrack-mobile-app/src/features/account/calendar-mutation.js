import { PERSONAL_EVENT_LIMITS, normalizePersonalEvent } from '../../constants/admission-calendar.js';
import { deleteMobileAdmissionEvent, fetchMobileAdmissionCalendar, upsertMobileAdmissionEvent } from './api.js';

const FIELDS = ['title', 'date', 'endDate', 'category', 'note'];
const calendarEventMatches = (event, draft) => FIELDS.every(key => (event?.[key] || '') === (draft?.[key] || ''));
const locks = new WeakSet();

export async function mutateCalendar(ctx, kind, explicitId = '') {
  const lock = ctx.operationLocksRef?.current || ctx;
  if (locks.has(lock) || ctx.calendarSaving || ctx.calendarSyncStatus === 'loading') return true;
  const browser = globalThis.window;
  const scope = browser?.captureClientSession?.();
  const currentProfile = () => {
    if (scope && !browser.isClientSessionCurrent(scope)) return false;
    const current = ctx.getStudyState?.();
    return current ? current.user?.email === ctx.user?.email && current.userLoadStatus === 'ready' && ctx.hasClientSession?.() === true : !ctx.isCurrentProfile || ctx.isCurrentProfile();
  };
  if (!currentProfile()) return true;
  const recovery = ctx.calendarMutationRecovery;
  const id = explicitId || ctx.calendarEventEditId;
  const confirm = ctx.confirm || globalThis.confirm || (() => false);
  if (!recovery && kind === 'delete' && (!id || !confirm('이 일정을 삭제하시겠어요?'))) return true;
  const normalized = kind === 'save' ? normalizePersonalEvent({ ...ctx.calendarEventDraft, ...(id ? { id } : {}) }) : null;
  if (!recovery && kind === 'save' && !normalized) {
    ctx.setCalendarMutationError('일정 제목과 날짜를 정확히 입력해주세요.');
    return true;
  }
  if (!recovery && kind === 'save' && !id && ctx.personalEvents?.length >= PERSONAL_EVENT_LIMITS.maxEvents) {
    ctx.setCalendarMutationError(`개인 일정은 최대 ${PERSONAL_EVENT_LIMITS.maxEvents}개까지 추가할 수 있어요.`);
    return true;
  }
  if (ctx.hasClientSession?.() !== true || typeof ctx.apiFetch !== 'function' || !ctx.userApiUrl) {
    ctx.setCalendarMutationError('계정 연결을 확인한 뒤 다시 시도해주세요. 입력 내용은 유지돼요.');
    return true;
  }
  if (!recovery && kind === 'save' && !id && ctx.calendarSupportsIdempotency !== true) {
    ctx.setCalendarMutationError('일정 저장 연결 업데이트가 필요해요. 다시 불러온 뒤 시도해주세요.');
    ctx.setCalendarSyncStatus('error');
    return true;
  }
  const requestId = ctx.calendarEventDraft?.clientRequestId || globalThis.crypto?.randomUUID?.();
  if (!recovery && kind === 'save' && !id && !requestId) {
    ctx.setCalendarMutationError('안전한 저장을 준비하지 못했어요. 브라우저를 다시 열어주세요.');
    return true;
  }
  const operation = recovery || { kind, id: id || requestId, event: normalized, isEdit: Boolean(id) };
  if (kind === 'save' && !id && !recovery) ctx.setCalendarEventDraft({ ...ctx.calendarEventDraft, clientRequestId: requestId });
  locks.add(lock);
  ctx.setCalendarSaving(true);
  ctx.setCalendarMutationError('');
  const binding = { apiFetch: ctx.apiFetch, userApiUrl: ctx.userApiUrl };
  const finish = events => {
    ctx.setPersonalEvents(events);
    ctx.setCalendarMutationRecovery(null);
    if (operation.kind === 'save') ctx.setSelectedDate(operation.event.date);
    ctx.setCalendarEventFormOpen(false);
    ctx.setCalendarEventEditId(null);
    ctx.setCalendarEventDraft(null);
  };
  async function recover() {
    const result = await fetchMobileAdmissionCalendar(binding);
    if (!currentProfile()) return 'stale';
    if (!result.ok) return 'unknown';
    ctx.setPersonalEvents(result.data);
    const saved = result.data.find(event => event.id === operation.id);
    if (operation.kind === 'delete' ? !saved : saved && calendarEventMatches(saved, operation.event)) {
      finish(result.data);
      return 'done';
    }
    return 'retry';
  }
  try {
    if (recovery) {
      const outcome = await recover();
      if (outcome !== 'retry') {
        if (outcome === 'unknown') ctx.setCalendarMutationError('저장 결과를 확인하지 못했어요. 연결 후 결과 확인을 눌러주세요.');
        return true;
      }
    }
    if (!currentProfile()) return true;
    const result = operation.kind === 'delete'
      ? await deleteMobileAdmissionEvent({ ...binding, eventId: operation.id })
      : await upsertMobileAdmissionEvent({ ...binding, event: {
        ...operation.event, ...(operation.isEdit ? { id: operation.id } : { id: undefined, clientRequestId: operation.id })
      } });
    if (!currentProfile()) return true;
    if (result.ok) finish(result.data.events);
    else if (!result.status || result.status >= 500 || result.code === 'INVALID_RESPONSE') {
      ctx.setCalendarMutationRecovery(operation);
      const outcome = await recover();
      if (outcome !== 'done' && outcome !== 'stale') ctx.setCalendarMutationError('저장 결과가 아직 확인되지 않았어요. 결과 확인을 눌러주세요.');
    } else {
      ctx.setCalendarMutationRecovery(null);
      ctx.setCalendarMutationError(result.status === 409 ? '다른 기기에서 일정이 바뀌었어요. 다시 불러온 후 확인해주세요.' : result.error || '일정을 반영하지 못했어요.');
      if (result.status === 409 || result.status === 404) ctx.setCalendarSyncStatus('error');
    }
  } finally {
    locks.delete(lock);
    if (currentProfile()) ctx.setCalendarSaving(false);
  }
  return true;
}
