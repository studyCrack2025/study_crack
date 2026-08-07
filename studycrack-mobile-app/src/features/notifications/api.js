import { apiInvalidResponse, apiSuccess, postJson } from '../../shared/api/client.js';
import { NOTIFICATION_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { validateModelList, validateNotification } from '../../shared/model/contracts.js';

export function normalizeNotifications(payload) {
  const list = Array.isArray(payload?.notifications) ? payload.notifications : (Array.isArray(payload) ? payload : []);
  return list.filter((item) => item && (item.notiId || item.id)).map((item) => ({
    notiId: String(item.notiId || item.id || ''),
    title: item.title || '알림',
    body: item.body || item.message || '',
    type: item.type || '',
    isRead: item.isRead === true,
    createdAt: item.createdAt || ''
  }));
}

export async function fetchMobileNotifications({ apiFetch, notiApiUrl, signal } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: notiApiUrl,
    payload: { type: NOTIFICATION_REQUEST_TYPES.GET_STUDENT_NOTIFICATIONS },
    fallbackError: '알림을 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  const list = Array.isArray(result.data?.notifications) ? result.data.notifications : (Array.isArray(result.data) ? result.data : null);
  const contract = validateModelList(list, validateNotification, '알림 목록');
  if (!contract.ok) return apiInvalidResponse(result, contract.error);
  return apiSuccess(normalizeNotifications(list), { status: result.status });
}

export function markMobileNotificationsRead({ apiFetch, notiApiUrl, notiId = 'all' } = {}) {
  return postJson({
    apiFetch,
    url: notiApiUrl,
    payload: { type: NOTIFICATION_REQUEST_TYPES.READ_STUDENT_NOTIFICATION, data: { notiId } },
    fallbackError: '알림 읽음 처리에 실패했습니다.'
  });
}
