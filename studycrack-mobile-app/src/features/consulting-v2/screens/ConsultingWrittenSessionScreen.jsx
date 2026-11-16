import React from 'react';
import { getBrowser } from '../../../shared/browser/mobile-runtime.js';
import { completeCounselorWrittenSession, listCounselorWrittenSessions, saveCounselorSessionNote } from '../written-session-api.js';
import { formatWrittenMessageTime } from '../message-model.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { useWrittenChat } from '../use-written-chat.js';
import { useWrittenPhotos } from '../use-written-photos.js';
import { WrittenChatPhoto } from '../components/WrittenChatPhoto.jsx';
import { WrittenPreparation, WRITTEN_CHECKLIST } from '../components/WrittenChatTools.jsx';

const dateLabel = value => { const date = new Date(value); return Number.isFinite(+date) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) : ''; };
const connectionLabels = { connecting: '연결 중', connected: '연결됨', paused: '연결 일시 중지', offline: '인터넷 연결을 확인해주세요', reconnecting: '다시 연결하는 중', denied: '접근 권한 확인 필요', changed: '상담 일정 변경됨' };

function ChatRoom({ binding, caseId, manager, sessions, onChoose }) {
  const browser = getBrowser();
  const chat = useWrittenChat(binding, caseId, manager);
  const { resource, messages, outbox, connection } = chat, session = resource.session;
  const photos = useWrittenPhotos(binding, session?.caseId || caseId);
  const [draft, setDraft] = React.useState(''), [feedback, setFeedback] = React.useState(''), [tab, setTab] = React.useState('chat');
  const [note, setNote] = React.useState(null), [savedNote, setSavedNote] = React.useState(null), [noteRevision, setNoteRevision] = React.useState(0);
  const [checklist, setChecklist] = React.useState({ questionsAddressed: false, scoresConfirmed: false, followUpCaptured: false });
  const [working, setWorking] = React.useState(false), [newCount, setNewCount] = React.useState(0);
  const scroll = React.useRef(null), room = React.useRef(null), picker = React.useRef(null), bottom = React.useRef(true), seen = React.useRef(new Set());
  const unsaved = Boolean(draft || photos.items.length || outbox.length || note !== null && note !== savedNote);
  const latestRead = React.useRef(() => {});
  latestRead.current = () => { if (bottom.current && (!manager || tab === 'chat' || innerWidth > 760)) void chat.markRead(messages.at(-1)?.messageId); };
  React.useEffect(() => {
    if (note === null && resource.status === 'ready') { setNote(resource.note.body); setSavedNote(resource.note.body); setNoteRevision(resource.note.revision); }
  }, [resource, note]);
  React.useEffect(() => {
    const unload = event => { if (unsaved) { event.preventDefault(); event.returnValue = ''; } };
    browser.addEventListener('beforeunload', unload);
    return () => browser.removeEventListener('beforeunload', unload);
  }, [unsaved]);
  React.useEffect(() => {
    const viewport = browser.visualViewport;
    const resize = () => { room.current?.style.setProperty('--consulting-chat-height', `${viewport?.height || innerHeight}px`); if (bottom.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); };
    viewport?.addEventListener('resize', resize); resize();
    return () => viewport?.removeEventListener('resize', resize);
  }, [resource.status]);
  React.useLayoutEffect(() => {
    const incoming = messages.filter(item => !seen.current.has(item.messageId));
    messages.forEach(item => seen.current.add(item.messageId));
    if (bottom.current) { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); setNewCount(0); latestRead.current(); }
    else setNewCount(value => value + incoming.length);
  }, [messages, outbox, tab]);
  React.useEffect(() => {
    if (!scroll.current || !globalThis.ResizeObserver) return;
    const observer = new ResizeObserver(() => { if (bottom.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); });
    for (const child of scroll.current.children) observer.observe(child);
    return () => observer.disconnect();
  }, [messages, outbox]);
  React.useEffect(() => {
    const read = () => latestRead.current(); document.addEventListener('visibilitychange', read); browser.addEventListener('focus', read);
    return () => { document.removeEventListener('visibilitychange', read); browser.removeEventListener('focus', read); };
  }, []);
  const leave = action => { if (!unsaved || browser.confirm('전송하거나 저장하지 않은 내용이 있어요. 이 화면을 나갈까요?')) action(); };
  const send = () => {
    if (!session?.writable || photos.busy || !draft.trim() && !photos.items.length) return;
    const attachments = photos.items.map(item => ({ ...item.metadata, fileId: item.fileId }));
    bottom.current = true;
    if (chat.send(draft, attachments)) { photos.take(); setDraft(''); setFeedback(''); }
  };
  const saveNote = async () => {
    if (working) return; setWorking(true); setFeedback('');
    const body = note.trim();
    const result = await saveCounselorSessionNote(binding, { caseId: session.caseId, body, expectedNoteRevision: noteRevision });
    if (result.ok) { setNote(body); setSavedNote(body); setNoteRevision(result.data.revision); setFeedback('내부 메모를 저장했습니다.'); }
    else setFeedback(result.error);
    setWorking(false);
  };
  const complete = async () => {
    if (unsaved || working) return; setWorking(true);
    const result = await completeCounselorWrittenSession(binding, { caseId: session.caseId, checklist });
    setFeedback(result.ok ? '상담을 완료하고 대화 기록을 고정했습니다.' : result.error);
    if (result.ok) chat.refresh(); setWorking(false);
  };
  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">서면상담을 불러오고 있습니다.</p></main>;
  if (!session) return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>서면상담 연결 확인</h1><p role="status">{resource.error}</p><button type="button" onClick={chat.refresh}>다시 연결</button><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>돌아가기</button></section></main>;
  const canWrite = session.writable && connection !== 'denied', canManage = session.canManage === true;
  const serverTime = Date.parse(session.serverTime || new Date().toISOString());
  const finished = session.status === 'completed';
  return <main ref={room} className="consulting-written" data-manager={manager} data-tab={tab}>
    <header><button type="button" onClick={() => leave(() => manager ? browser.location.assign(binding.userRole === 'admin' ? '/admin#consulting' : '/mypage/tutor') : navigateConsulting(CONSULTING_ROUTES.home))}>← 돌아가기</button><strong>StudyCrack 정시 컨설팅</strong><span className="consulting-chat-connection" data-state={connection} role="status">{connectionLabels[connection]}</span></header>
    {manager ? <div className="consulting-chat-switcher">{sessions.length > 1 ? <label className="consulting-session-picker">상담 선택<select value={caseId} onChange={event => leave(() => onChoose(event.target.value))}>{!sessions.some(row => row.caseId === caseId) ? <option value={caseId}>검수 중인 상담</option> : null}{sessions.map(row => <option key={row.caseId} value={row.caseId}>{dateLabel(row.startAt)}</option>)}</select></label> : null}<nav className="consulting-chat-tabs" aria-label="상담 화면"><button type="button" aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>대화</button><button type="button" aria-pressed={tab === 'preparation'} onClick={() => setTab('preparation')}>자료</button><button type="button" aria-pressed={tab === 'notes'} onClick={() => setTab('notes')}>메모</button></nav></div> : null}
    <div className="consulting-written-layout"><section className="consulting-written-chat">
      <div className="consulting-written-meta"><h1>서면상담</h1><p>{dateLabel(session.startAt)} ~ {formatWrittenMessageTime(session.endAt)} · 한국시간</p><span>{finished ? '상담 완료 · 기록 보관' : session.observer ? '운영진 검수 · 읽기 전용' : session.serviceHold ? '서비스 보류 · 읽기 전용' : session.readOnly ? '상담 종료 · 읽기 전용' : canWrite ? '상담 진행 중' : '시작 시각에 대화가 열립니다'}</span></div>
      {['denied', 'reconnecting', 'offline', 'changed'].includes(connection) ? <div className="consulting-written-feedback">{connection === 'changed' ? '상담 일정이 변경됐어요. 미전송 내용을 확인하고 변경된 상담을 다시 열어주세요.' : connection === 'denied' ? '접근 권한을 확인한 뒤 다시 연결해주세요.' : '연결을 복구하면 마지막 대화부터 불러와요.'}<button type="button" onClick={() => leave(chat.refresh)}>다시 연결</button></div> : null}
      {!session.entryAllowed ? <div className="consulting-written-empty"><strong>상담을 준비하고 있어요</strong><p>{dateLabel(session.entryAt || new Date(Date.parse(session.startAt) - 600000))}부터 입장할 수 있어요.</p><p>궁금한 점과 함께 살펴볼 사진을 준비해주세요. 시간이 되면 이 화면이 자동으로 열립니다.</p></div> : <div ref={scroll} className="consulting-written-messages" role="log" aria-label="상담 대화" aria-live="polite" onScroll={() => { const node = scroll.current; bottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 72; if (bottom.current) { setNewCount(0); latestRead.current(); } }}>
        {!messages.length && !outbox.length ? <div className="consulting-written-empty">{canWrite ? '궁금한 점을 보내주세요. 텍스트와 사진으로 함께 살펴볼게요.' : '아직 작성된 메시지가 없습니다.'}</div> : null}
        {messages.map(message => <article key={message.messageId} data-owner={message.senderRole === (manager ? 'counselor' : 'student') && !session.observer ? 'me' : 'other'}><strong>{message.senderRole === 'student' ? '학생' : '상담사'}</strong>{message.body ? <p>{message.body}</p> : null}{message.attachments?.map(file => <WrittenChatPhoto key={file.fileId} binding={binding} caseId={session.caseId} file={file} />)}<time>{formatWrittenMessageTime(message.createdAt)}{message.senderRole === (manager ? 'counselor' : 'student') ? ` · ${session.otherReadThroughId >= message.messageId ? '읽음' : '전송됨'}` : ''}</time></article>)}
        {outbox.map(item => <article key={item.clientMessageId} data-owner="me" data-delivery={item.status}><strong>내 메시지</strong>{item.body ? <p>{item.body}</p> : null}{item.attachments.map(file => <WrittenChatPhoto key={file.fileId} binding={binding} caseId={session.caseId} file={file} />)}<small>{item.status === 'sending' ? '전송 중…' : item.error || '전송하지 못했어요.'}</small>{item.status === 'failed' ? <div><button type="button" disabled={!canWrite} onClick={() => chat.retry(item)}>다시 보내기</button><button type="button" onClick={() => chat.discard(item)}>미전송 표시 지우기</button></div> : null}</article>)}
      </div>}
      {newCount ? <button className="consulting-chat-new" type="button" onClick={() => { bottom.current = true; scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); setNewCount(0); latestRead.current(); }}>새 메시지 {newCount}개 ↓</button> : null}
      {session.entryAllowed ? <footer><label className="consulting-chat-input-label" htmlFor="written-message">상담 메시지</label><textarea id="written-message" value={draft} maxLength="2000" disabled={!canWrite} onChange={event => setDraft(event.target.value)} placeholder={canWrite ? '궁금한 점을 입력해주세요. 줄바꿈으로 이어서 쓸 수 있어요.' : '현재는 메시지를 작성할 수 없습니다.'} />
        {photos.items.length ? <ul className="consulting-chat-uploads">{photos.items.map(item => <li key={item.key}><img src={item.preview} alt="선택한 사진 미리보기" /><div><strong>{item.file.name}</strong><span>{({ uploading: '업로드 중…', checking: '보안 확인 중…', ready: '전송 가능', failed: '확인 필요' })[item.phase]}</span>{item.error ? <p role="status">{item.error}</p> : null}<div>{item.phase === 'failed' ? <button type="button" disabled={!canWrite} onClick={() => photos.retry(item)}>{item.paused ? '계속 확인' : '첨부 다시 시도'}</button> : null}<button type="button" onClick={() => photos.remove(item)}>첨부 취소</button></div></div></li>)}</ul> : null}
        {photos.notice ? <p role="status">{photos.notice}</p> : null}<input ref={picker} type="file" accept="image/jpeg,image/png" multiple hidden aria-label="상담 사진 선택" onChange={event => { photos.add(event.target.files); event.target.value = ''; }} />
        <div className="consulting-chat-compose-actions"><button type="button" className="consulting-chat-attach" disabled={!canWrite || photos.items.length >= 3} onClick={() => picker.current.click()}>＋ 사진</button><small>{draft.length}/2000</small><button type="button" disabled={!canWrite || photos.busy || !draft.trim() && !photos.items.length} onClick={send}>전송</button></div><p className="consulting-chat-privacy">JPEG·PNG 3장까지 · 사진의 수험번호 등 불필요한 개인정보는 가려주세요.</p>
      </footer> : null}
      {feedback ? <p className="consulting-written-feedback" role="status">{feedback}</p> : null}
      {finished && !manager ? <div className="consulting-chat-finished"><strong>상담을 마쳤어요</strong><p>이 대화는 언제든 다시 볼 수 있어요. 확인한 내용을 바탕으로 보고서를 준비하겠습니다.</p><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>진행 현황 보기</button></div> : null}
    </section>
    {manager ? <aside className="consulting-written-tools"><section className="consulting-chat-materials"><h2>상담 자료</h2><WrittenPreparation binding={binding} caseId={session.caseId} /></section><section className="consulting-chat-notes"><h2>상담사 전용</h2>{session.observer ? <p>담당자가 작성한 메모를 확인하는 검수 화면입니다.</p> : null}<label>내부 메모<textarea maxLength="4000" value={note || ''} disabled={!canManage || session.serviceHold || finished || working} onChange={event => setNote(event.target.value)} /></label><button type="button" disabled={!canManage || session.serviceHold || finished || working || note === savedNote} onClick={saveNote}>내부 메모 저장</button><fieldset disabled={!canManage || session.serviceHold || finished || working}><legend>완료 체크리스트</legend>{WRITTEN_CHECKLIST.map(([key, label]) => <label key={key}><input type="checkbox" checked={checklist[key]} onChange={event => setChecklist(value => ({ ...value, [key]: event.target.checked }))} />{label}</label>)}</fieldset><button className="consulting-written-complete" type="button" disabled={!canManage || session.serviceHold || finished || working || unsaved || serverTime < Date.parse(session.endAt) || !Object.values(checklist).every(Boolean)} onClick={complete}>상담 완료 및 기록 고정</button><p>종료 시각 이후, 미전송 메시지·사진과 메모를 정리한 뒤 완료해주세요.</p><p>내부 메모는 학생과 보고서 본문에 노출되지 않습니다.</p>{finished ? <a className="consulting-chat-report-link" href={binding.userRole === 'admin' ? `/admin#consulting?case=${encodeURIComponent(session.caseId)}&tab=report` : `${CONSULTING_ROUTES.report}?caseId=${encodeURIComponent(session.caseId)}`}>보고서 반영 내용 정리하기 →</a> : null}</section>{feedback ? <p className="consulting-written-feedback" role="status">{feedback}</p> : null}</aside> : null}</div>
  </main>;
}

export function ConsultingWrittenSessionScreen({ binding }) {
  const browser = getBrowser();
  const manager = ['tutor', 'admin'].includes(binding.userRole);
  const [selected, setSelected] = React.useState(() => new URLSearchParams(browser?.location?.search || '').get('caseId') || '');
  const [sessions, setSessions] = React.useState([]), [loading, setLoading] = React.useState(manager), [error, setError] = React.useState('');
  React.useEffect(() => {
    if (!manager) return;
    const controller = new AbortController();
    listCounselorWrittenSessions(binding, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const items = result.ok ? result.data.sessions || [] : [];
      setSessions(items); setSelected(value => value || items.find(row => row.status !== 'completed')?.caseId || items[0]?.caseId || '');
      setError(result.ok ? '배정된 서면상담이 없습니다.' : result.error); setLoading(false);
    });
    return () => controller.abort();
  }, [binding, manager]);
  const choose = value => { setSelected(value); const url = new URL(browser.location.href); url.searchParams.set('caseId', value); browser.history.replaceState(null, '', `${url.pathname}${url.search}`); };
  if (loading) return <main className="consulting-v2-center"><p>배정된 상담을 불러오고 있어요.</p></main>;
  if (manager && !selected) return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>서면상담</h1><p>{error}</p><a href={binding.userRole === 'admin' ? '/admin#consulting' : '/mypage/tutor'}>돌아가기</a></section></main>;
  return <ChatRoom key={selected || 'student'} binding={binding} caseId={selected} manager={manager} sessions={sessions} onChoose={choose} />;
}
