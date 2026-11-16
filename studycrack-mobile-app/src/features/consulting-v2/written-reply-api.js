import { requestJson } from '../../shared/api/client.js';

async function request(binding, type, data, signal) {
  const result = await requestJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, timeoutMs: 10000,
    fallbackError: '추천답변을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
    options: { method: 'POST', body: JSON.stringify({ type, data }), signal } });
  if (!result.ok || result.data?.success !== true || !result.data.data?.reply) return { ok: false, code: result.data?.code || result.code, status: result.status, error: result.error || '추천답변을 확인하지 못했습니다.' };
  return { ok: true, data: result.data.data.reply };
}
export const createWrittenReply = (binding, data, signal) => request(binding, 'counselor_create_written_reply', data, signal);
export const getWrittenReply = (binding, data, signal) => request(binding, 'counselor_get_written_reply', data, signal);
export const cancelWrittenReply = (binding, data, signal) => request(binding, 'counselor_cancel_written_reply', data, signal);
