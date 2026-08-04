import { apiSuccess, postJson } from '../../shared/api/client.js';

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
    payload: { type: 'student_get_notifications' },
    fallbackError: '알림을 불러오지 못했습니다.'
  });
  return result.ok ? apiSuccess(normalizeNotifications(result.data), { status: result.status }) : result;
}

export function markMobileNotificationsRead({ apiFetch, notiApiUrl, notiId = 'all' } = {}) {
  return postJson({
    apiFetch,
    url: notiApiUrl,
    payload: { type: 'student_read_notification', data: { notiId } },
    fallbackError: '알림 읽음 처리에 실패했습니다.'
  });
}
