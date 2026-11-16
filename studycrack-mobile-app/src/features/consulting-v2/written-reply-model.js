export const WRITTEN_REPLY_LIMITS = Object.freeze({ messages: 30, characters: 12000, waitMs: 120000 });
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
