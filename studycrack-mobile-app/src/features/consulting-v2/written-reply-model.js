export const WRITTEN_REPLY_LIMITS = Object.freeze({ messages: 30, characters: 12000, waitMs: 120000 });
const failureMessages = {
  REPLY_DISABLED: '추천 기능이 비활성 상태입니다. 운영 설정을 확인해주세요.',
  REPLY_SECRET_UNAVAILABLE: 'AI 연결 정보를 읽지 못했습니다. 서버 접근 권한을 확인해주세요.',
  REPLY_SECRET_INVALID: 'AI 연결 설정 형식을 확인해야 합니다. 운영 설정을 확인해주세요.',
  REPLY_MODEL_INVALID: '추천 모델 설정을 확인해야 합니다.',
  REPLY_DISPATCH_FAILED: '추천 작업을 시작하지 못했습니다. 서버의 작업 호출 설정을 확인해주세요.',
  REPLY_PROVIDER_RATE_LIMITED: 'AI 서비스의 요청 한도에 도달했습니다. 잠시 후 다시 추천해주세요.',
  REPLY_PROVIDER_UNAVAILABLE: 'AI 서비스에 연결하지 못했습니다. 모델과 서비스 접근 설정을 확인해주세요.',
  REPLY_PROVIDER_NETWORK: 'AI 서비스 연결이 끊겼습니다. 잠시 후 다시 추천해주세요.',
  REPLY_PROVIDER_TIMEOUT: 'AI 응답 시간이 초과됐습니다. 직접 답변을 작성하거나 다시 추천해주세요.',
  REPLY_PROVIDER_REFUSAL: '선택한 대화로 추천을 만들지 못했습니다. 질문 범위를 확인해주세요.',
  REPLY_PROVIDER_INCOMPLETE: 'AI 응답이 완료되지 않았습니다. 다시 추천해주세요.',
  REPLY_PROVIDER_INVALID: 'AI 응답 형식을 확인하지 못했습니다. 다시 추천해주세요.',
  REPLY_OUTPUT_INVALID: '추천답변 검증을 통과하지 못했습니다. 다시 추천해주세요.'
};
export const replyFailureMessage = code => failureMessages[code] || '추천을 만들지 못했습니다. 대화 범위를 확인하고 다시 시도해주세요.';
export function validReplyAvailability(value) {
  return Boolean(value && ['ready', 'running', 'cooldown'].includes(value.reason)
    && Number.isFinite(value.retryAfterMs) && value.retryAfterMs >= 0 && value.retryAfterMs <= 110000
    && (value.reply === null || validReplyJob(value.reply) && ['queued', 'running'].includes(value.reply.status)
      && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value.reply.startMessageId || '') && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value.reply.endMessageId || '')
      && value.reply.startMessageId <= value.reply.endMessageId));
}
export function selectedReplyMessages(messages, range) {
  if (!range?.start || !range?.end) return [];
  const start = messages.findIndex(row => row.messageId === range.start), end = messages.findIndex(row => row.messageId === range.end);
  return start >= 0 && end >= start ? messages.slice(start, end + 1) : [];
}
export function replyRangeIssue(messages) {
  if (!messages.length) return '답변할 대화의 시작과 끝을 선택해주세요.';
  if (messages.length > WRITTEN_REPLY_LIMITS.messages) return '메시지는 최대 30개까지 선택해주세요.';
  if (messages.reduce((sum, row) => sum + (row.body?.length || 0), 0) > WRITTEN_REPLY_LIMITS.characters) return '선택 대화는 12,000자 이내로 줄여주세요.';
  if (!messages.some(row => row.senderRole === 'student' && row.body?.trim())) return '학생의 텍스트 질문을 포함해주세요. 사진 내용은 글로 확인해야 합니다.';
  return '';
}
export function mergeReplyDraft(draft, body, mode) {
  if (typeof body !== 'string' || !body.trim() || !['replace', 'append'].includes(mode)) return null;
  const next = mode === 'append' && draft ? `${draft}\n\n${body}` : body;
  return next.length <= 2000 ? next : null;
}
export function validReplyJob(job, { range, jobId } = {}) {
  if (!job || !/^REPLY_[a-f0-9]{64}$/.test(job.jobId || '') || jobId && job.jobId !== jobId
      || range && (job.startMessageId !== range.start || job.endMessageId !== range.end)
      || !['queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired', 'stale'].includes(job.status)) return false;
  if (job.status !== 'succeeded') return true;
  return Array.isArray(job.drafts) && job.drafts.length === 2 && job.drafts.every((row, index) => row.style === ['core', 'empathic'][index]
    && typeof row.body === 'string' && row.body.length >= 20 && row.body.length <= 900 && Array.isArray(row.sourceRefs) && row.sourceRefs.length > 0
    && row.sourceRefs.every(ref => ref === 'S1' || /^M(?:0[1-9]|[12]\d|30)$/.test(ref)))
    && Array.isArray(job.checks) && job.checks.length <= 3 && job.checks.every(text => typeof text === 'string' && text.length <= 180);
}
