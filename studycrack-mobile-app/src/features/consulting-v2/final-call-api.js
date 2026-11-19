import { postJson } from '../../shared/api/client.js';

export async function finalCallRequest(binding, type, data = {}, signal) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, payload: { type, data }, signal, fallbackError: '파이널 콜 요청을 처리하지 못했습니다.' });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || '상태가 변경되었을 수 있습니다. 새로 불러와 확인해주세요.', code: result.data?.code || result.code };
  return { ok: true, data: result.data.data };
}

export function finalRequestKey(previous, data) {
  const payload = JSON.stringify(data);
  if (previous.current?.payload !== payload) previous.current = { payload, key: globalThis.crypto.randomUUID() };
  return { ...data, idempotencyKey: previous.current.key };
}

export function validateFinalSelection(selected) {
  const entries = Object.entries(selected);
  if (entries.length < 3 || entries.length > 20) return { error: '가능 시간은 3개 이상 20개 이하로 선택해주세요.' };
  if (new Set(entries.map(([id]) => id.slice(4, 12))).size < 2) return { error: '최소 2일에 나누어 선택해주세요.' };
  return { selectedSlots: entries.map(([slotId, priority]) => ({ slotId, priority: Number(priority) })) };
}

export function finalSessionTime(session) {
  if (!session?.startAt || !Number.isFinite(Date.parse(session.startAt))) return '일정 미정';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(session.startAt));
}
