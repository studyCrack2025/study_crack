import React from 'react';
import { createClientMessageId } from './message-model.js';
import { cancelWrittenReply, createWrittenReply, getWrittenReply } from './written-reply-api.js';
import { replyRangeIssue, selectedReplyMessages, validReplyJob, WRITTEN_REPLY_LIMITS } from './written-reply-model.js';

const empty = { phase: 'idle', reply: null, error: '' };
const terminal = { failed: '추천을 만들지 못했습니다. 대화 범위를 확인하고 다시 시도해주세요.', cancelled: '추천 생성을 취소했습니다.', expired: '대기 시간이 끝났습니다. 직접 답변을 작성하거나 다시 추천해주세요.', stale: '기초조사서나 상담 상태가 변경됐습니다. 최신 자료를 확인하고 다시 추천해주세요.' };
export function useWrittenReplySuggestions(binding, session, messages, enabled) {
  const [range, setRange] = React.useState(null), [selecting, setSelecting] = React.useState(false), [state, setState] = React.useState(empty);
  const active = React.useRef(null), live = React.useRef(true);
  const selected = selectedReplyMessages(messages, range), issue = replyRangeIssue(selected);
  const cancelActive = React.useCallback(() => {
    const job = active.current; active.current = null;
    if (!job) return;
    clearTimeout(job.timer); clearTimeout(job.deadlineTimer); job.controller.abort();
    if (job.jobId) void cancelWrittenReply(binding, { caseId: job.caseId, expectedSessionId: job.sessionId, jobId: job.jobId });
  }, [binding]);
  React.useEffect(() => { live.current = true; return () => { live.current = false; cancelActive(); }; }, [cancelActive]);
  React.useEffect(() => {
    cancelActive(); setRange(null); setSelecting(false); setState(empty);
  }, [session?.sessionId, session?.replyContextVersion, enabled, cancelActive]);
  const changeRange = next => { cancelActive(); setRange(next); setState(empty); };
  const choose = id => { changeRange(!range || range.end ? { start: id, end: null } : id < range.start ? { start: id, end: range.start } : { start: range.start, end: id }); };
  const recent = () => { const question = messages.findLast(row => row.senderRole === 'student' && row.body?.trim()); changeRange(question ? { start: question.messageId, end: question.messageId } : null); setSelecting(false); };
  const generate = async () => {
    if (!enabled || active.current) return;
    if (issue) { setState({ ...empty, error: issue }); return; }
    if (navigator.onLine === false) { setState({ ...empty, error: '인터넷 연결을 확인하고 다시 추천해주세요.' }); return; }
    const job = { caseId: session.caseId, sessionId: session.sessionId, range: { ...range }, controller: new AbortController(), started: performance.now(), jobId: null };
    active.current = job; setSelecting(false); setState({ phase: 'pending', reply: null, error: '' });
    const current = () => live.current && active.current === job && !job.controller.signal.aborted;
    const finish = (phase, error = '', reply = null) => {
      if (!current()) return;
      clearTimeout(job.timer); clearTimeout(job.deadlineTimer); active.current = null; job.controller.abort();
      setState({ phase, error, reply });
    };
    job.deadlineTimer = setTimeout(() => {
      if (!current()) return;
      cancelActive(); setState({ ...empty, phase: 'error', error: terminal.expired });
    }, WRITTEN_REPLY_LIMITS.waitMs);
    const accept = result => {
      if (!current()) return false;
      if (!result.ok) { finish('error', result.error); return false; }
      const reply = result.data;
      if (!validReplyJob(reply, { range: job.range, jobId: job.jobId })) { finish('error', '추천 응답을 확인하지 못했습니다. 다시 추천해주세요.'); return false; }
      job.jobId = reply.jobId;
      if (reply.status === 'succeeded') { finish('ready', '', reply); return false; }
      if (terminal[reply.status]) { finish('error', terminal[reply.status]); return false; }
      return true;
    };
    const poll = async () => {
      if (!current()) return;
      const result = await getWrittenReply(binding, { caseId: job.caseId, expectedSessionId: job.sessionId, jobId: job.jobId }, job.controller.signal);
      if (!current()) return;
      if (!result.ok && ![401, 403, 404].includes(result.status) && performance.now() - job.started < 110000) { job.timer = setTimeout(poll, 2500); return; }
      if (accept(result)) job.timer = setTimeout(poll, 1500);
    };
    const data = { caseId: job.caseId, expectedSessionId: job.sessionId, clientRequestId: createClientMessageId(), startMessageId: range.start, endMessageId: range.end };
    const discardLate = result => {
      if (result.ok && /^REPLY_[a-f0-9]{64}$/.test(result.data?.jobId || '')) void cancelWrittenReply(binding, { caseId: job.caseId, expectedSessionId: job.sessionId, jobId: result.data.jobId });
    };
    // 생성 응답이 늦게 도착해도 취소한 초안을 다시 표시하지 않습니다.
    let result = await createWrittenReply(binding, data);
    if (!current()) { discardLate(result); return; }
    if (!result.ok && (!result.status || result.code === 'TIMEOUT')) result = await createWrittenReply(binding, data);
    if (!current()) { discardLate(result); return; }
    if (accept(result)) job.timer = setTimeout(poll, 1000);
  };
  const cancel = () => { cancelActive(); setState({ ...empty, error: terminal.cancelled }); };
  return { ...state, range, selected, issue, selecting, choose, recent, generate, cancel,
    beginSelection: () => { changeRange(null); setSelecting(true); },
    clear: () => { changeRange(null); setSelecting(false); },
    hasNewMessages: Boolean(range?.end && messages.at(-1)?.messageId > range.end) };
}
