import React from 'react';
import { completeCounselorWrittenSession, getCounselorWrittenSession, getStudentWrittenSession, listCounselorWrittenMessages, listCounselorWrittenSessions, listStudentWrittenMessages, saveCounselorSessionNote, sendCounselorWrittenMessage, sendStudentWrittenMessage } from '../written-session-api.js';
import { createClientMessageId, formatWrittenMessageTime, mergeWrittenMessages, nextWrittenPollDelay } from '../message-model.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';

const fullChecklist = { questionsAddressed: false, scoresConfirmed: false, followUpCaptured: false };

function SessionPicker({ sessions, value, onChange }) {
  if (sessions.length <= 1) return null;
  return <label className="consulting-session-picker">상담 선택<select value={value} onChange={event => onChange(event.target.value)}>{sessions.map(session => <option key={session.caseId} value={session.caseId}>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(session.startAt))}</option>)}</select></label>;
}

export function ConsultingWrittenSessionScreen({ binding }) {
  const counselorMode = binding.userRole === 'tutor';
  const [resource, setResource] = React.useState({ status: 'loading', session: null, sessions: [], note: { body: '', revision: 0 } });
  const [caseId, setCaseId] = React.useState(() => new URLSearchParams(globalThis.location?.search || '').get('caseId') || '');
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState('');
  const [feedback, setFeedback] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [checklist, setChecklist] = React.useState(fullChecklist);
  const pendingSend = React.useRef(null);
  const cursor = React.useRef(null);
  const pollRevision = React.useRef(0);

  const loadSession = React.useCallback(async signal => {
    if (!counselorMode) return getStudentWrittenSession(binding, signal);
    const listed = await listCounselorWrittenSessions(binding, signal);
    if (!listed.ok) return listed;
    const sessions = listed.data.sessions || [];
    let selectedCaseId = caseId;
    if (!selectedCaseId) {
      selectedCaseId = sessions.find(item => item.status !== 'completed')?.caseId || sessions[0]?.caseId || '';
      if (!selectedCaseId) return { ok: false, code: 'SESSION_NOT_FOUND', error: '배정된 서면상담이 없습니다.' };
      setCaseId(selectedCaseId);
    }
    const result = await getCounselorWrittenSession(binding, selectedCaseId, signal);
    return result.ok ? { ...result, data: { ...result.data, sessions } } : result;
  }, [binding, caseId, counselorMode]);

  React.useEffect(() => {
    const controller = new AbortController();
    setResource(value => ({ ...value, status: 'loading' }));
    loadSession(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (!result.ok) return setResource(value => ({ ...value, status: 'error', error: result.error }));
      const nextNote = result.data.note || { body: '', revision: 0 };
      setNote(nextNote.body);
      setResource({ status: 'ready', session: result.data.session, sessions: result.data.sessions || [], note: nextNote });
    });
    return () => controller.abort();
  }, [caseId, counselorMode, loadSession]);

  React.useEffect(() => {
    if (resource.status !== 'ready' || !resource.session?.entryAllowed) return undefined;
    const currentPoll = ++pollRevision.current;
    let timer;
    let unchangedCount = 0;
    let stopped = false;
    const poll = async () => {
      if (stopped || currentPoll !== pollRevision.current || globalThis.document?.visibilityState === 'hidden') return;
      const request = counselorMode ? listCounselorWrittenMessages : listStudentWrittenMessages;
      const result = await request(binding, { ...(counselorMode ? { caseId: resource.session.caseId } : {}), afterMessageId: cursor.current, limit: 100 });
      if (!result.ok || stopped || currentPoll !== pollRevision.current) { timer = setTimeout(poll, 5000); return; }
      const incoming = result.data.messages || [];
      setMessages(current => mergeWrittenMessages(current, incoming));
      if (incoming.length) cursor.current = result.data.nextCursor;
      unchangedCount = incoming.length ? 0 : unchangedCount + 1;
      timer = setTimeout(poll, result.data.hasMore ? 0 : nextWrittenPollDelay({ changed: Boolean(incoming.length), unchangedCount }));
    };
    const visibility = () => { if (globalThis.document?.visibilityState === 'visible') { clearTimeout(timer); poll(); } };
    globalThis.document?.addEventListener?.('visibilitychange', visibility);
    poll();
    return () => { stopped = true; clearTimeout(timer); globalThis.document?.removeEventListener?.('visibilitychange', visibility); };
  }, [binding, counselorMode, resource.session?.caseId, resource.session?.entryAllowed, resource.status]);

  const chooseSession = value => {
    cursor.current = null;
    setMessages([]);
    setCaseId(value);
    const url = new URL(globalThis.location.href); url.searchParams.set('caseId', value); globalThis.history.replaceState(null, '', `${url.pathname}${url.search}`);
  };
  const send = async () => {
    const body = draft.trim();
    if (!body || body.length > 2000 || sending) return;
    if (!pendingSend.current || pendingSend.current.body !== body) pendingSend.current = { body, clientMessageId: createClientMessageId() };
    setSending(true); setFeedback('');
    const request = counselorMode ? sendCounselorWrittenMessage : sendStudentWrittenMessage;
    const result = await request(binding, { ...(counselorMode ? { caseId: resource.session.caseId } : {}), ...pendingSend.current });
    if (result.ok) {
      setMessages(current => mergeWrittenMessages(current, [result.data.message]));
      setDraft(''); pendingSend.current = null;
    } else setFeedback(result.error || '메시지를 보내지 못했습니다. 같은 내용으로 다시 시도할 수 있습니다.');
    setSending(false);
  };
  const saveNote = async () => {
    const result = await saveCounselorSessionNote(binding, { caseId: resource.session.caseId, body: note, expectedNoteRevision: resource.note.revision });
    if (result.ok) { setResource(value => ({ ...value, note: { body: note, revision: result.data.revision } })); setFeedback('내부 메모를 저장했습니다.'); }
    else setFeedback(result.error);
  };
  const complete = async () => {
    const result = await completeCounselorWrittenSession(binding, { caseId: resource.session.caseId, checklist });
    if (result.ok) { setFeedback('상담을 완료하고 대화 기록을 고정했습니다.'); setResource(value => ({ ...value, session: { ...value.session, status: 'completed', writable: false, readOnly: true, transcriptHash: result.data.transcriptHash } })); }
    else setFeedback(result.error);
  };

  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">서면상담을 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>서면상담을 열 수 없습니다</h1><p className="consulting-v2-status">{resource.error}</p><button className="consulting-v2-secondary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>돌아가기</button></section></main>;
  const session = resource.session;
  return <main className="consulting-written"><header><button type="button" onClick={() => counselorMode ? globalThis.location.assign('/mypage/tutor') : navigateConsulting(CONSULTING_ROUTES.home)}>← 돌아가기</button><strong>{counselorMode ? '상담사 서면상담' : 'StudyCrack 정시 컨설팅'}</strong><span>{session.readOnly ? '읽기 전용' : session.writable ? '상담 진행 중' : '입장 대기'}</span></header><div className="consulting-written-layout"><section className="consulting-written-chat"><SessionPicker sessions={resource.sessions} value={session.caseId} onChange={chooseSession} /><div className="consulting-written-meta"><h1>실시간 텍스트 상담</h1><p>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' }).format(new Date(session.startAt))} · 30분</p></div>{!session.entryAllowed ? <div className="consulting-written-empty">상담 시작 10분 전부터 입장할 수 있습니다.</div> : <div className="consulting-written-messages" aria-live="polite">{messages.length ? messages.map(message => <article key={message.messageId} data-owner={message.senderRole === (counselorMode ? 'counselor' : 'student') ? 'me' : 'other'}><strong>{message.senderRole === 'student' ? '학생' : '상담사'}</strong><p>{message.body}</p><time>{formatWrittenMessageTime(message.createdAt)}</time></article>) : <div className="consulting-written-empty">아직 작성된 메시지가 없습니다.</div>}</div>}{session.entryAllowed ? <footer><textarea value={draft} maxLength="2000" disabled={!session.writable || sending} onChange={event => setDraft(event.target.value)} placeholder={session.writable ? '궁금한 점을 일반 텍스트로 입력해주세요.' : '현재는 메시지를 작성할 수 없습니다.'}></textarea><div><small>{draft.length}/2000</small><button type="button" disabled={!session.writable || sending || !draft.trim()} onClick={send}>{sending ? '전송 중…' : '전송'}</button></div></footer> : null}{feedback ? <p className="consulting-written-feedback" role="status">{feedback}</p> : null}</section>{counselorMode ? <aside className="consulting-written-tools"><h2>상담사 전용</h2><label>내부 메모<textarea maxLength="4000" value={note} disabled={session.status === 'completed'} onChange={event => setNote(event.target.value)}></textarea></label><button type="button" disabled={session.status === 'completed'} onClick={saveNote}>내부 메모 저장</button><fieldset disabled={session.status === 'completed'}><legend>완료 체크리스트</legend>{[['questionsAddressed', '추가 질문에 답변함'], ['scoresConfirmed', '성적·지원 조건을 확인함'], ['followUpCaptured', '보고서 반영 사항을 정리함']].map(([key, label]) => <label key={key}><input type="checkbox" checked={checklist[key]} onChange={event => setChecklist(value => ({ ...value, [key]: event.target.checked }))} />{label}</label>)}</fieldset><button className="consulting-written-complete" type="button" disabled={session.status === 'completed' || !Object.values(checklist).every(Boolean)} onClick={complete}>상담 완료 및 기록 고정</button>{session.status === 'completed' ? <button type="button" onClick={() => globalThis.location.assign(`${CONSULTING_ROUTES.report}?caseId=${encodeURIComponent(session.caseId)}`)}>보고서 작성으로 이동</button> : null}<p>내부 메모는 학생 화면과 보고서 원문에 노출되지 않습니다.</p></aside> : null}</div></main>;
}
