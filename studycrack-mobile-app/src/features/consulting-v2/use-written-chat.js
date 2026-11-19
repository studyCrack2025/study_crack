import React from 'react';
import { getBrowser } from '../../shared/browser/mobile-runtime.js';
import { getCounselorWrittenSession, getStudentWrittenSession, listCounselorWrittenMessages, listStudentWrittenMessages, markWrittenRead, sendCounselorWrittenMessage, sendStudentWrittenMessage } from './written-session-api.js';
import { createClientMessageId, mergeWrittenMessages, nextWrittenPollDelay } from './message-model.js';

const denied = result => [401, 403, 404].includes(result.status);
const foreground = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
const recordDuration = (name, started) => {
  try { performance.clearMeasures(name); performance.measure(name, { start: started, end: performance.now() }); } catch { /* Timing never blocks messages. */ }
};

export function useWrittenChat(binding, caseId, manager) {
  const browser = getBrowser();
  const [resource, setResource] = React.useState({ status: 'loading', session: null, note: { body: '', revision: 0 } });
  const [messages, setMessages] = React.useState([]), [outbox, setOutbox] = React.useState([]);
  const [connection, setConnection] = React.useState('connecting');
  const sessionRef = React.useRef(null), messagesRef = React.useRef([]), pendingSend = React.useRef(new Map());
  const live = React.useRef(false), refreshRef = React.useRef(() => {}), readThrough = React.useRef(''), readJob = React.useRef(null);
  const merge = React.useCallback(incoming => {
    const next = mergeWrittenMessages(messagesRef.current, incoming);
    if (next !== messagesRef.current) { messagesRef.current = next; setMessages(next); }
    const received = new Set(incoming.map(item => item.clientMessageId));
    if (received.size) setOutbox(value => { const remaining = value.filter(item => !received.has(item.clientMessageId)); return remaining.length === value.length ? value : remaining; });
  }, []);

  React.useEffect(() => {
    live.current = true;
    let timer, controller, running = false, repeat = false, stopped = false, fatal = false, changedSession = false, failures = 0, unchangedCount = 0, cursor = null;
    const sessionRequest = signal => manager ? getCounselorWrittenSession(binding, caseId, signal) : getStudentWrittenSession(binding, signal);
    const acceptSession = (session, note) => {
      if (sessionRef.current?.sessionId && session.sessionId !== sessionRef.current.sessionId) {
        stopped = true; fatal = true; changedSession = true; setConnection('changed');
        setResource(value => ({ ...value, session: { ...value.session, writable: false, readOnly: true } }));
        throw Object.assign(new Error('Session changed'), { sessionChanged: true });
      }
      sessionRef.current = session;
      setResource(value => ({ status: 'ready', session, note: note || value.note }));
    };
    const schedule = delay => { clearTimeout(timer); if (!stopped) timer = setTimeout(poll, delay); };
    async function poll() {
      if (stopped || !live.current) return;
      if (!foreground()) { setConnection(navigator.onLine === false ? 'offline' : 'paused'); return; }
      if (running) { repeat = true; return; }
      running = true; controller = new AbortController();
      const started = performance.now();
      let delay = 10000;
      try {
        let result;
        const session = sessionRef.current;
        if (!session || !session.entryAllowed || session.readOnly && session.status !== 'completed') {
          result = await sessionRequest(controller.signal);
          if (controller.signal.aborted) return;
          if (result.ok) acceptSession(result.data.session, result.data.note);
        }
        if (!result || result.ok) {
          const current = sessionRef.current;
          if (current?.entryAllowed) {
            const request = manager ? listCounselorWrittenMessages : listStudentWrittenMessages;
            result = await request(binding, { ...(manager ? { caseId } : {}), afterMessageId: cursor, limit: 100 }, controller.signal);
            if (controller.signal.aborted) return;
            if (result.ok) {
              const incoming = result.data.messages || [];
              merge(incoming);
              if (incoming.length) cursor = result.data.nextCursor || incoming.at(-1).messageId;
              if (result.data.session) acceptSession(result.data.session);
              unchangedCount = incoming.length ? 0 : unchangedCount + 1;
              delay = result.data.hasMore ? 0 : nextWrittenPollDelay({ changed: Boolean(incoming.length), unchangedCount, writable: sessionRef.current.writable, preparing: sessionRef.current.canCompose === true });
              if (!result.data.hasMore && sessionRef.current.status === 'completed') stopped = true;
              else if (sessionRef.current.readOnly) delay = 30000;
            }
          } else if (current) {
            const remaining = Date.parse(current.startAt) - 600000 - Date.parse(current.serverTime || new Date().toISOString());
            delay = Math.max(1000, Math.min(10000, remaining > 0 ? remaining + 100 : 1000));
          }
        }
        if (result && !result.ok) {
          if (result.code === 'SESSION_ENTRY_NOT_OPEN' || result.code === 'MESSAGE_SESSION_CHANGED') {
            const updated = await sessionRequest(controller.signal);
            if (!controller.signal.aborted && updated.ok) acceptSession(updated.data.session, updated.data.note);
          }
          failures++;
          setConnection(denied(result) ? 'denied' : 'reconnecting');
          setResource(value => ({ ...value, status: value.session ? 'ready' : 'error', error: result.error }));
          if (denied(result)) { stopped = true; fatal = true; }
          delay = Math.min(30000, 2000 * 2 ** Math.min(failures, 4));
        } else { failures = 0; setConnection('connected'); }
      } catch (error) {
        if (!controller.signal.aborted && !error.sessionChanged) { failures++; setConnection('reconnecting'); setResource(value => value.session ? value : { ...value, status: 'error', error: '상담 연결을 확인하지 못했어요. 다시 연결해주세요.' }); delay = Math.min(30000, 2000 * 2 ** Math.min(failures, 4)); }
      } finally {
        recordDuration('consulting-chat-poll', started);
        running = false;
        if (live.current && (!controller.signal.aborted || repeat && foreground())) { schedule(repeat ? 0 : delay); repeat = false; }
      }
    }
    const resume = () => { if (fatal) return; if (foreground()) { clearTimeout(timer); void poll(); } else { clearTimeout(timer); controller?.abort(); setConnection(navigator.onLine === false ? 'offline' : 'paused'); } };
    refreshRef.current = () => { if (changedSession) return browser.location.reload(); stopped = false; fatal = false; clearTimeout(timer); void poll(); };
    document.addEventListener('visibilitychange', resume); browser.addEventListener('online', resume); browser.addEventListener('offline', resume);
    void poll();
    return () => {
      live.current = false; stopped = true; clearTimeout(timer); controller?.abort(); readJob.current?.abort(); pendingSend.current.forEach(job => job.abort());
      document.removeEventListener('visibilitychange', resume); browser.removeEventListener('online', resume); browser.removeEventListener('offline', resume);
    };
  }, [binding, caseId, manager, merge]);

  const attempt = async item => {
    if (pendingSend.current.has(item.clientMessageId)) return;
    const controller = new AbortController(); pendingSend.current.set(item.clientMessageId, controller);
    const started = performance.now();
    setOutbox(value => value.map(row => row.clientMessageId === item.clientMessageId ? { ...row, status: 'sending', error: '' } : row));
    try {
      const request = manager ? sendCounselorWrittenMessage : sendStudentWrittenMessage;
      const result = await request(binding, { ...(manager ? { caseId } : {}), body: item.body, clientMessageId: item.clientMessageId, expectedSessionId: item.sessionId, ...(item.attachments.length ? { attachmentIds: item.attachments.map(file => file.fileId) } : {}) }, controller.signal);
      if (!live.current || controller.signal.aborted) return;
      if (result.ok) { merge([result.data.message]); refreshRef.current(); }
      else setOutbox(value => value.map(row => row.clientMessageId === item.clientMessageId ? { ...row, status: 'failed', error: result.error } : row));
    } catch {
      if (live.current && !controller.signal.aborted) setOutbox(value => value.map(row => row.clientMessageId === item.clientMessageId ? { ...row, status: 'failed', error: '연결을 확인하고 다시 보내주세요.' } : row));
    } finally { recordDuration('consulting-chat-send', started); pendingSend.current.delete(item.clientMessageId); }
  };
  const send = (body, attachments = []) => {
    if (!sessionRef.current?.writable || connection === 'denied' || body.length > 2000 || !body.trim() && !attachments.length) return false;
    const item = { body: body.trim(), attachments, sessionId: sessionRef.current.sessionId, clientMessageId: createClientMessageId(), createdAt: new Date().toISOString(), senderRole: manager ? 'counselor' : 'student', status: 'sending' };
    setOutbox(value => [...value, item]); void attempt(item); return true;
  };
  const markRead = async throughMessageId => {
    if (!live.current || !foreground() || sessionRef.current?.observer || sessionRef.current?.serviceHold || !throughMessageId || readThrough.current >= throughMessageId || readJob.current) return;
    const controller = new AbortController(); readJob.current = controller;
    try {
      const result = await markWrittenRead(binding, { ...(manager ? { caseId } : {}), throughMessageId }, manager, controller.signal);
      if (result.ok && result.data.marked && !controller.signal.aborted) readThrough.current = throughMessageId;
    } catch { /* 읽음 실패는 대화 전송을 막지 않습니다. */ }
    finally { readJob.current = null; }
  };
  return { resource, messages, outbox, connection, send, retry: attempt, discard: item => setOutbox(value => value.filter(row => row.clientMessageId !== item.clientMessageId)), markRead, refresh: () => refreshRef.current() };
}
