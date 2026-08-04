import { normalizePersonalEvent } from '../../constants/admission-calendar.js';
import { apiSuccess, postJson, postUserData } from '../../shared/api/client.js';
import { buildTargetUnivsPayload } from '../analysis/target-model.js';

export function saveTargetUnivs({ apiFetch, targetList, targetSlots, userApiUrl } = {}) {
  return postUserData({
    apiFetch,
    userApiUrl,
    type: 'update_target_univs',
    data: buildTargetUnivsPayload(targetList, new Date().toISOString(), targetSlots)
  });
}

export function saveQuantitative({ apiFetch, quantitative, userApiUrl } = {}) {
  return postUserData({ apiFetch, userApiUrl, type: 'update_quan', data: quantitative || {} });
}

export function saveQualitative({ apiFetch, qualitative, userApiUrl } = {}) {
  return postUserData({ apiFetch, userApiUrl, type: 'update_qual', data: qualitative || {} });
}

export function saveNotificationPreferences({ apiFetch, preferences, userApiUrl } = {}) {
  const notificationPreferences = Object.fromEntries(
    ['planner', 'weekly', 'report', 'billing'].map((key) => [key, preferences?.[key] !== false])
  );
  return postUserData({ apiFetch, userApiUrl, type: 'update_member_info', data: { notificationPreferences } });
}

export async function fetchMobileAdmissionCalendar({ apiFetch, signal, userApiUrl } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: userApiUrl,
    payload: { type: 'get_admission_calendar' },
    fallbackError: '수험 일정을 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  const events = Array.isArray(result.data?.events)
    ? result.data.events.map((event) => normalizePersonalEvent(event)).filter(Boolean)
    : [];
  return apiSuccess(events, { status: result.status });
}

export async function upsertMobileAdmissionEvent({ apiFetch, event, userApiUrl } = {}) {
  const result = await postUserData({ apiFetch, userApiUrl, type: 'upsert_admission_calendar_event', data: event });
  if (!result.ok) return result;
  const events = Array.isArray(result.data?.events)
    ? result.data.events.map((item) => normalizePersonalEvent(item)).filter(Boolean)
    : [];
  const savedEvent = result.data?.event ? normalizePersonalEvent(result.data.event) : null;
  return apiSuccess({ events, event: savedEvent }, { status: result.status });
}

export async function deleteMobileAdmissionEvent({ apiFetch, eventId, userApiUrl } = {}) {
  const result = await postUserData({ apiFetch, userApiUrl, type: 'delete_admission_calendar_event', data: { id: eventId } });
  if (!result.ok) return result;
  const events = Array.isArray(result.data?.events)
    ? result.data.events.map((item) => normalizePersonalEvent(item)).filter(Boolean)
    : [];
  return apiSuccess({ events }, { status: result.status });
}
