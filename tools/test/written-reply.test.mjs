import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedReplyMessages, replyRangeIssue, mergeReplyDraft, validReplyJob, validReplyAvailability, replyFailureMessage, writtenReplyUnavailableReason } from '../../studycrack-mobile-app/src/features/consulting-v2/written-reply-model.js';
import { createWrittenReply, getWrittenReply, cancelWrittenReply, getActiveWrittenReply } from '../../studycrack-mobile-app/src/features/consulting-v2/written-reply-api.js';

const messages = [{ messageId: 'a', senderRole: 'student', body: '질문' }, { messageId: 'b', senderRole: 'counselor', body: '답변' }, { messageId: 'c', senderRole: 'student', body: '추가 질문' }];
test('a visible recommendation panel still requires explicit server permission for an assigned, writable consultation', () => {
  const session = { canManage: true, canSuggestReplies: true, writable: true, status: 'open' };
  assert.equal(writtenReplyUnavailableReason(session, 'connected'), '');
  assert.equal(writtenReplyUnavailableReason(session, 'reconnecting'), '', 'a temporary reconnect must not abandon an active recommendation');
  for (const canSuggestReplies of [undefined, false, 'true']) assert.match(writtenReplyUnavailableReason({ ...session, canSuggestReplies }, 'connected'), /AI 추천 연결/);
  for (const patch of [{ observer: true }, { canManage: false }, { canManage: undefined }]) assert.match(writtenReplyUnavailableReason({ ...session, ...patch }, 'connected'), /배정된 상담 담당자/);
  assert.match(writtenReplyUnavailableReason({ ...session, writable: false }, 'connected'), /상담 진행 시간/);
  assert.match(writtenReplyUnavailableReason({ ...session, serviceHold: true }, 'connected'), /서비스 보류/);
  assert.match(writtenReplyUnavailableReason({ ...session, status: 'completed' }, 'connected'), /완료된 상담/);
  assert.match(writtenReplyUnavailableReason(session, 'denied'), /접근 권한/);
  assert.match(writtenReplyUnavailableReason(session, 'changed'), /상담 일정/);
  assert.match(writtenReplyUnavailableReason(null, 'connecting'), /상담 정보/);
});
test('range includes intervening counselor context without silently expanding on later messages', () => {
  const range = { start: 'a', end: 'b' };
  assert.deepEqual(selectedReplyMessages(messages, range), messages.slice(0, 2));
  assert.deepEqual(selectedReplyMessages([...messages, { messageId: 'd' }], range), messages.slice(0, 2));
  assert.deepEqual(selectedReplyMessages(messages, { start: 'a', end: null }), []);
  assert.deepEqual(selectedReplyMessages(messages, { start: 'b', end: 'a' }), []);
  assert.deepEqual(selectedReplyMessages(messages, { start: 'other', end: 'b' }), []);
});
test('empty, attachment-only, oversize and counselor-only selections require correction', () => {
  for (const selected of [[], [{ senderRole: 'student', body: '' }], [messages[1]], Array(31).fill(messages[0]), [{ senderRole: 'student', body: 'x'.repeat(12001) }]]) assert.ok(replyRangeIssue(selected));
  assert.equal(replyRangeIssue(messages), '');
});
test('explicit append preserves the latest composer verbatim; replace and length boundary require explicit choice', () => {
  assert.equal(mergeReplyDraft('이미 작성한 글\n', '추천답변', 'append'), '이미 작성한 글\n\n\n추천답변');
  assert.equal(mergeReplyDraft('기존 글', '추천답변', 'replace'), '추천답변');
  assert.equal(mergeReplyDraft('x'.repeat(1998), '답변', 'append'), null);
  assert.equal(mergeReplyDraft('기존 글', '', 'replace'), null);
  assert.equal(mergeReplyDraft('기존 글', '추천', 'auto'), null);
});
test('generation, polling and cancellation never invoke a message send endpoint or send browser context', async () => {
  const calls = [], reply = { jobId: `REPLY_${'a'.repeat(64)}`, status: 'queued' };
  const binding = { consultingApiUrl: 'https://example.invalid', apiFetch: async (_, options) => { calls.push(JSON.parse(options.body)); return { ok: true, status: 200, json: async () => ({ success: true, data: { reply } }) }; } };
  const data = { caseId: 'case', expectedSessionId: 'session', startMessageId: 'a', endMessageId: 'b', clientRequestId: 'id' };
  await createWrittenReply(binding, data); await getWrittenReply(binding, { jobId: reply.jobId }); await cancelWrittenReply(binding, { jobId: reply.jobId });
  assert.deepEqual(calls.map(call => call.type), ['counselor_create_written_reply', 'counselor_get_written_reply', 'counselor_cancel_written_reply']); assert.deepEqual(calls[0].data, data);
});
test('another request result or partial drafts cannot be offered for insertion', () => {
  const job = { jobId: `REPLY_${'a'.repeat(64)}`, status: 'succeeded', startMessageId: 'a', endMessageId: 'b', checks: [], drafts: [{ style: 'core', body: '상담자가 검토할 핵심 전달형 답변을 준비했습니다.', sourceRefs: ['M01'] }, { style: 'empathic', body: '학생의 상황과 마음을 고려해서 차근차근 확인해보겠습니다.', sourceRefs: ['M01', 'S1'] }] };
  assert.equal(validReplyJob(job, { range: { start: 'a', end: 'b' }, jobId: job.jobId }), true);
  assert.equal(validReplyJob(job, { range: { start: 'a', end: 'c' } }), false);
  assert.equal(validReplyJob(job, { jobId: `REPLY_${'b'.repeat(64)}` }), false);
  assert.equal(validReplyJob({ ...job, drafts: job.drafts.slice(0, 1) }), false);
});

test('active status is a read-only scoped request, retries one recovered authentication read, and never creates work', async () => {
  const calls = []; let reads = 0;
  const binding = { consultingApiUrl: 'https://example.invalid', apiFetch: async (_, options) => {
    calls.push(JSON.parse(options.body));
    if (++reads === 1) throw Object.assign(new Error('recover read'), { code: 'AUTH_RETRY_REQUIRED', status: 409 });
    return { ok: true, status: 200, json: async () => ({ success: true, data: { reply: null, retryAfterMs: 3000, reason: 'cooldown' } }) };
  } };
  const result = await getActiveWrittenReply(binding, { caseId: 'case', expectedSessionId: 'session' });
  assert.equal(result.ok, true); assert.equal(result.data.retryAfterMs, 3000);
  assert.deepEqual(calls, Array(2).fill({ type: 'counselor_get_active_written_reply', data: { caseId: 'case', expectedSessionId: 'session' } }));
});

test('active response validation accepts bounded waits and real message ranges, not malformed jobs or arbitrary provider errors', () => {
  const reply = { jobId: `REPLY_${'a'.repeat(64)}`, status: 'running', startMessageId: '01K00000000000000000000001', endMessageId: '01K00000000000000000000003' };
  assert.equal(validReplyAvailability({ reply, retryAfterMs: 110000, reason: 'running' }), true);
  assert.equal(validReplyAvailability({ reply: null, retryAfterMs: 0, reason: 'ready' }), true);
  for (const patch of [{ retryAfterMs: -1 }, { retryAfterMs: 120001 }, { retryAfterMs: '1000' }, { reason: 'unknown' }, { reply: { ...reply, startMessageId: 'invalid' } }, { reply: { ...reply, startMessageId: reply.endMessageId, endMessageId: reply.startMessageId } }]) assert.equal(validReplyAvailability({ reply, retryAfterMs: 0, reason: 'running', ...patch }), false);
  assert.match(replyFailureMessage('REPLY_MODEL_INVALID'), /모델 설정/);
  assert.match(replyFailureMessage('REPLY_SECRET_UNAVAILABLE'), /접근 권한/);
  assert.ok(!replyFailureMessage('private provider response').includes('private provider response'));
});
