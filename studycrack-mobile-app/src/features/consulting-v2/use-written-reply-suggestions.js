import React from 'react';
import { createClientMessageId } from './message-model.js';
import { cancelWrittenReply, createWrittenReply, getActiveWrittenReply, getWrittenReply } from './written-reply-api.js';
import { replyFailureMessage, replyRangeIssue, selectedReplyMessages, validReplyJob, WRITTEN_REPLY_LIMITS } from './written-reply-model.js';

const empty = { phase: 'idle', reply: null, error: '' };
const terminal = { failed: '추천을 만들지 못했습니다.', cancelled: '추천 생성을 취소했습니다.', expired: '대기 시간이 끝났습니다. 직접 답변을 작성하거나 다시 추천해주세요.', stale: '상담 상태나 답변에 사용한 자료가 변경됐습니다. 최신 자료로 다시 추천해주세요.' };
const duration = (value, max) => Number.isFinite(value) && value >= 0 && value <= max ? value : 0;

export function useWrittenReplySuggestions(binding, session, messages, enabled) {
  const [range, setRange] = React.useState(null), [selecting, setSelecting] = React.useState(false), [state, setState] = React.useState(empty);
  const [retryUntil, setRetryUntil] = React.useState(0), [retrySeconds, setRetrySeconds] = React.useState(0), [waiting, setWaiting] = React.useState(false);
  const [checkingApply, setCheckingApply] = React.useState(false);
  const active = React.useRef(null), probe = React.useRef(null), live = React.useRef(true), revision = React.useRef(0);
  const applyCheck = React.useRef(null);
  const selected = selectedReplyMessages(messages, range), issue = replyRangeIssue(selected);
  const abortProbe = () => { probe.current?.abort(); probe.current = null; };
  const cancelActive = React.useCallback(() => {
    const job = active.current; active.current = null;
    if (!job) return;
    clearTimeout(job.timer); clearTimeout(job.deadlineTimer); job.controller.abort();
    const ticket = revision.current;
    if (job.jobId) void cancelWrittenReply(binding, { caseId: job.caseId, expectedSessionId: job.sessionId, jobId: job.jobId }).then(result => {
      if (live.current && ticket === revision.current && result.ok) setRetryUntil(Date.now() + duration(result.data.retryAfterMs, 15000));
    });
  }, [binding]);

  function monitor(targetRange) {
    const job = { caseId: session.caseId, sessionId: session.sessionId, range: { ...targetRange }, controller: new AbortController(), started: performance.now(), jobId: null };
    active.current = job; setWaiting(false); setSelecting(false); setState({ phase: 'pending', reply: null, error: '' });
    const current = () => live.current && active.current === job && !job.controller.signal.aborted;
    const finish = (phase, error = '', reply = null) => {
      if (!current()) return;
      clearTimeout(job.timer); clearTimeout(job.deadlineTimer); active.current = null; job.controller.abort();
      setState({ phase, error, reply });
    };
    const deadline = remaining => {
      clearTimeout(job.deadlineTimer);
      const budget = Math.max(1, Math.min(WRITTEN_REPLY_LIMITS.waitMs - (performance.now() - job.started), remaining));
      job.deadlineTimer = setTimeout(() => { if (current()) { cancelActive(); setState({ ...empty, phase: 'error', error: terminal.expired }); } }, budget);
    };
    deadline(WRITTEN_REPLY_LIMITS.waitMs);
    const accept = result => {
      if (!current()) return false;
      if (!result.ok) { finish('error', result.error); return false; }
      const reply = result.data;
      if (!validReplyJob(reply, { range: job.range, jobId: job.jobId })) { finish('error', '추천 응답을 확인하지 못했습니다. 다시 추천해주세요.'); return false; }
      job.jobId = reply.jobId;
      setRetryUntil(Date.now() + duration(reply.retryAfterMs, 15000));
      if (reply.status === 'succeeded') { finish('ready', '', reply); return false; }
      if (terminal[reply.status]) { finish('error', reply.status === 'failed' ? replyFailureMessage(reply.resultCode) : terminal[reply.status]); return false; }
      if (Number.isFinite(reply.remainingMs)) deadline(duration(reply.remainingMs, 110000) + 2000);
      return true;
    };
    const poll = async () => {
      if (!current()) return;
      const result = await getWrittenReply(binding, { caseId: job.caseId, expectedSessionId: job.sessionId, jobId: job.jobId }, job.controller.signal);
      if (!current()) return;
      if (!result.ok && ![401, 403, 404].includes(result.status) && performance.now() - job.started < 110000) { job.timer = setTimeout(poll, 2500); return; }
      if (accept(result)) job.timer = setTimeout(poll, 1500);
    };
    return { job, current, finish, accept, pollLater: () => { job.timer = setTimeout(poll, 1000); } };
  }

  async function checkActive({ expectedRange } = {}) {
    if (!enabled || active.current) return;
    abortProbe(); const controller = new AbortController(), ticket = ++revision.current;
    probe.current = controller; setState({ ...empty, phase: 'checking' });
    const result = await getActiveWrittenReply(binding, { caseId: session.caseId, expectedSessionId: session.sessionId }, controller.signal);
    if (!live.current || ticket !== revision.current || controller.signal.aborted) return;
    probe.current = null;
    if (!result.ok) { setWaiting(false); setState({ ...empty, phase: 'error', error: [400, 404].includes(result.status) ? '' : result.error }); return; }
    const info = result.data;
    setRetryUntil(Date.now() + info.retryAfterMs); setWaiting(info.reason === 'running');
    const job = info.reply;
    if (job && (!expectedRange || job.startMessageId === expectedRange.start && job.endMessageId === expectedRange.end)) {
      const restored = { start: job.startMessageId, end: job.endMessageId };
      setRange(restored);
      const task = monitor(restored);
      if (task.accept({ ok: true, data: job })) task.pollLater();
      return;
    }
    setState({ ...empty, error: info.reason === 'running' ? '진행 중인 추천이 있습니다. 상태를 다시 확인하거나 완료 후 다시 추천해주세요.' : info.lastFailureCode ? replyFailureMessage(info.lastFailureCode) : '' });
  }

  React.useEffect(() => { live.current = true; return () => { live.current = false; revision.current++; abortProbe(); cancelActive(); applyCheck.current?.abort(); }; }, [cancelActive]);
  React.useEffect(() => {
    revision.current++; abortProbe(); cancelActive(); setRange(null); setSelecting(false); setRetryUntil(0); setWaiting(false); setState(empty);
    if (enabled) void checkActive();
  }, [session?.sessionId, session?.replyContextVersion, enabled, cancelActive]);
  React.useEffect(() => {
    let timer;
    const tick = () => { const remaining = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000)); setRetrySeconds(remaining); if (!remaining) clearInterval(timer); };
    tick(); if (retryUntil > Date.now()) timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryUntil]);

  const changeRange = next => { revision.current++; abortProbe(); cancelActive(); setRange(next); setState(empty); };
  const choose = id => { changeRange(!range || range.end ? { start: id, end: null } : id < range.start ? { start: id, end: range.start } : { start: range.start, end: id }); };
  const recent = () => { const question = messages.findLast(row => row.senderRole === 'student' && row.body?.trim()); changeRange(question ? { start: question.messageId, end: question.messageId } : null); setSelecting(false); };
  const generate = async () => {
    if (!enabled || active.current || probe.current || Date.now() < retryUntil) return;
    if (issue) { setState({ ...empty, error: issue }); return; }
    if (navigator.onLine === false) { setState({ ...empty, error: '인터넷 연결을 확인하고 다시 추천해주세요.' }); return; }
    revision.current++;
    const task = monitor(range), job = task.job;
    const data = { caseId: job.caseId, expectedSessionId: job.sessionId, clientRequestId: createClientMessageId(), startMessageId: range.start, endMessageId: range.end };
    const discardLate = result => {
      if (result.ok && /^REPLY_[a-f0-9]{64}$/.test(result.data?.jobId || '')) void cancelWrittenReply(binding, { caseId: job.caseId, expectedSessionId: job.sessionId, jobId: result.data.jobId });
    };
    let result = await createWrittenReply(binding, data);
    if (!task.current()) { discardLate(result); return; }
    if (!result.ok && (!result.status || result.code === 'TIMEOUT')) result = await createWrittenReply(binding, data);
    if (!task.current()) { discardLate(result); return; }
    if (!result.ok && result.code === 'REPLY_BUSY') { task.finish('error', result.error); await checkActive({ expectedRange: job.range }); return; }
    if (task.accept(result)) task.pollLater();
  };
  const cancel = () => { revision.current++; abortProbe(); cancelActive(); setState({ ...empty, error: terminal.cancelled }); };
  const confirmForApply = async body => {
    const reply = state.reply;
    if (!enabled || !reply?.drafts.some(draft => draft.body === body) || applyCheck.current) return false;
    if (!reply.evidence?.units.some(unit => unit.admissionTrackName)) return true;
    const controller = new AbortController(), ticket = revision.current;
    applyCheck.current = controller;
    setCheckingApply(true);
    try {
      const result = await getWrittenReply(binding, { caseId: session.caseId, expectedSessionId: session.sessionId, jobId: reply.jobId }, controller.signal);
      if (!live.current || controller.signal.aborted || ticket !== revision.current) return false;
      if (!result.ok) { setState(previous => ({ ...previous, error: result.error })); return false; }
      const latest = result.data;
      if (!validReplyJob(latest, { range, jobId: reply.jobId }) || latest.status !== 'succeeded' || !latest.drafts.some(draft => draft.body === body)) {
        setState({ ...empty, phase: 'error', error: terminal.stale });
        return false;
      }
      setState(previous => ({ ...previous, error: '' }));
      return true;
    } finally {
      applyCheck.current = null;
      if (live.current) setCheckingApply(false);
    }
  };
  return { ...state, range, selected, issue, selecting, choose, recent, generate, cancel, retrySeconds, confirmForApply, checkingApply,
    canRecheck: waiting || retrySeconds > 0, recheck: () => checkActive({ expectedRange: range?.end ? range : undefined }),
    beginSelection: () => { changeRange(null); setSelecting(true); }, clear: () => { changeRange(null); setSelecting(false); },
    hasNewMessages: Boolean(range?.end && messages.at(-1)?.messageId > range.end) };
}
