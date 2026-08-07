import { normalizePersonalEvent } from '../../constants/admission-calendar.js';
import { apiInvalidResponse, apiSuccess, postJson, postUserData } from '../../shared/api/client.js';
import { USER_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { buildTargetUnivsPayload } from '../analysis/target-model.js';

export function saveTargetUnivs({ apiFetch, targetList, targetSlots, userApiUrl } = {}) {
  return postUserData({
    apiFetch,
    userApiUrl,
    type: USER_REQUEST_TYPES.UPDATE_TARGET_UNIVERSITIES,
    data: buildTargetUnivsPayload(targetList, new Date().toISOString(), targetSlots)
  });
}

export function saveQuantitative({ apiFetch, quantitative, userApiUrl } = {}) {
  return postUserData({ apiFetch, userApiUrl, type: USER_REQUEST_TYPES.UPDATE_QUANTITATIVE, data: quantitative || {} });
}

export function saveQualitative({ apiFetch, qualitative, userApiUrl } = {}) {
  return postUserData({ apiFetch, userApiUrl, type: USER_REQUEST_TYPES.UPDATE_QUALITATIVE, data: qualitative || {} });
}

export function saveNotificationPreferences({ apiFetch, preferences, userApiUrl } = {}) {
  const notificationPreferences = Object.fromEntries(
    ['planner', 'weekly', 'report', 'billing'].map((key) => [key, preferences?.[key] !== false])
  );
  return postUserData({ apiFetch, userApiUrl, type: USER_REQUEST_TYPES.UPDATE_MEMBER_INFO, data: { notificationPreferences } });
}

export async function fetchMobileAdmissionCalendar({ apiFetch, signal, userApiUrl } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: userApiUrl,
    payload: { type: USER_REQUEST_TYPES.GET_ADMISSION_CALENDAR },
    fallbackError: '수험 일정을 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  if (!Array.isArray(result.data?.events)) return apiInvalidResponse(result, '수험 일정 응답이 올바르지 않습니다.');
  const events = result.data.events.map((event) => normalizePersonalEvent(event)).filter(Boolean);
  return apiSuccess(events, { status: result.status });
}

export async function upsertMobileAdmissionEvent({ apiFetch, event, userApiUrl } = {}) {
  const result = await postUserData({ apiFetch, userApiUrl, type: USER_REQUEST_TYPES.UPSERT_ADMISSION_EVENT, data: event });
  if (!result.ok) return result;
  if (!Array.isArray(result.data?.events)) return apiInvalidResponse(result, '저장된 수험 일정 응답이 올바르지 않습니다.');
  const events = result.data.events.map((item) => normalizePersonalEvent(item)).filter(Boolean);
  const savedEvent = result.data?.event ? normalizePersonalEvent(result.data.event) : null;
  return apiSuccess({ events, event: savedEvent }, { status: result.status });
}

export async function deleteMobileAdmissionEvent({ apiFetch, eventId, userApiUrl } = {}) {
  const result = await postUserData({ apiFetch, userApiUrl, type: USER_REQUEST_TYPES.DELETE_ADMISSION_EVENT, data: { id: eventId } });
  if (!result.ok) return result;
  if (!Array.isArray(result.data?.events)) return apiInvalidResponse(result, '삭제 후 수험 일정 응답이 올바르지 않습니다.');
  const events = result.data.events.map((item) => normalizePersonalEvent(item)).filter(Boolean);
  return apiSuccess({ events }, { status: result.status });
}
