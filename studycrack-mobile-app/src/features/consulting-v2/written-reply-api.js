import { requestJson } from '../../shared/api/client.js';
import { validReplyAvailability } from './written-reply-model.js';

const errors = {
  REPLY_BUSY: '진행 중인 추천을 기다리거나 잠시 후 다시 시도해주세요.',
  REPLY_DISABLED: '추천답변 기능을 준비 중입니다. 직접 답변을 작성할 수 있습니다.',
  REPLY_SOURCE_CHANGED: '상담 정보가 변경됐습니다. 최신 자료를 확인하고 다시 추천해주세요.',
  REPLY_SESSION_CHANGED: '상담 일정이 변경됐습니다. 상담을 다시 열어주세요.',
  REPLY_NOT_FOUND: '추천 요청을 찾을 수 없습니다. 새로 추천해주세요.',
  INVALID_REPLY_INPUT: '같은 상담의 학생 질문을 포함해 최대 30개, 12,000자까지 선택해주세요.'
};
async function request(binding, type, data, signal) {
  const result = await requestJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, timeoutMs: 10000,
    fallbackError: '추천답변을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
    options: { method: 'POST', body: JSON.stringify({ type, data }), signal } });
  const code = result.data?.code || result.code;
  if (!result.ok || result.data?.success !== true || !result.data.data?.reply) return { ok: false, code, status: result.status, error: errors[code] || result.error || '추천답변을 확인하지 못했습니다.' };
  return { ok: true, data: result.data.data.reply };
}
export const createWrittenReply = (binding, data, signal) => request(binding, 'counselor_create_written_reply', data, signal);
export const getWrittenReply = (binding, data, signal) => request(binding, 'counselor_get_written_reply', data, signal);
export const cancelWrittenReply = (binding, data, signal) => request(binding, 'counselor_cancel_written_reply', data, signal);
export async function getActiveWrittenReply(binding, data, signal) {
  const read = () => requestJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, timeoutMs: 10000,
    fallbackError: '진행 중인 추천을 확인하지 못했습니다. 다시 확인해주세요.',
    options: { method: 'POST', body: JSON.stringify({ type: 'counselor_get_active_written_reply', data }), signal } });
  let result = await read();
  if (!signal?.aborted && result.code === 'AUTH_RETRY_REQUIRED') result = await read();
  if (!result.ok || result.data?.success !== true || !validReplyAvailability(result.data.data)) return { ok: false, code: result.code || 'INVALID_RESPONSE', status: result.status, error: result.error || '진행 중인 추천을 확인하지 못했습니다.' };
  return { ok: true, data: result.data.data };
}
