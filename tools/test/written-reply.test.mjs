import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedReplyMessages, replyRangeIssue, mergeReplyDraft, validReplyJob } from '../../studycrack-mobile-app/src/features/consulting-v2/written-reply-model.js';
import { createWrittenReply, getWrittenReply, cancelWrittenReply } from '../../studycrack-mobile-app/src/features/consulting-v2/written-reply-api.js';

const messages = [{ messageId: 'a', senderRole: 'student', body: '질문' }, { messageId: 'b', senderRole: 'counselor', body: '답변' }, { messageId: 'c', senderRole: 'student', body: '추가 질문' }];
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
