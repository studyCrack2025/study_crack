import React from 'react';
import { mergeReplyDraft } from '../written-reply-model.js';

const sourceLabel = ref => ref === 'S1' ? '확정 조사서' : `선택 대화 ${Number(ref.slice(1))}`;
export function WrittenReplySuggestions({ suggestion, draft, onSelectRange, onApply, unavailable = '', onReconnect }) {
  const [pending, setPending] = React.useState(null);
  const busy = ['pending', 'checking'].includes(suggestion.phase);
  React.useEffect(() => setPending(null), [suggestion.reply?.jobId, suggestion.phase]);
  const use = body => { if (draft) setPending(body); else onApply(body, 'replace'); };
  const apply = mode => { if (onApply(pending, mode)) setPending(null); };
  return <section className="consulting-reply-panel" aria-label="답변 추천"><h2>답변 추천</h2>
    <p>선택 대화와 확정 조사서를 참고해 두 가지 초안을 만듭니다. 내용을 검토하고 수정한 뒤 전송해주세요.</p>
    {unavailable ? <div role="status"><p>{unavailable}</p><button type="button" onClick={onReconnect}>추천 연결 다시 확인</button></div> : null}
    <div className="consulting-reply-actions"><button type="button" disabled={busy || Boolean(unavailable)} onClick={onSelectRange}>대화 범위 선택</button><button type="button" disabled={busy || Boolean(unavailable)} onClick={suggestion.recent}>최근 학생 질문 선택</button></div>
    <p>{suggestion.selected.length ? `선택한 대화 ${suggestion.selected.length}개 · ${suggestion.selected.reduce((sum, row) => sum + (row.body?.length || 0), 0)}자` : '최대 30개 메시지 · 12,000자'}</p>
    {suggestion.selected.length ? <details className="consulting-reply-preview"><summary>선택 대화 확인</summary><ol>{suggestion.selected.map(row => <li key={row.messageId}><strong>{row.senderRole === 'student' ? '학생' : '상담사'}</strong><p>{row.body || '(사진 메시지)'}</p></li>)}</ol></details> : null}
    {suggestion.hasNewMessages ? <p className="consulting-reply-notice">선택 이후 새 대화 있음 · 최신 질문도 확인해주세요.</p> : null}
    {suggestion.phase === 'pending' ? <div role="status"><p>두 가지 답변을 준비하고 있습니다. 최대 2분 안에 결과나 처리 상태를 알려드려요. 대화 작성은 계속할 수 있습니다.</p><button type="button" onClick={suggestion.cancel}>추천 생성 취소</button></div> : suggestion.phase === 'checking' ? <p role="status">진행 중인 추천 작업을 확인하고 있습니다.</p> : <button type="button" disabled={Boolean(unavailable) || Boolean(suggestion.issue) || suggestion.retrySeconds > 0} onClick={suggestion.generate}>{suggestion.retrySeconds > 0 ? `${suggestion.retrySeconds}초 뒤 추천 가능` : suggestion.reply ? '다시 추천받기' : '추천답변 생성'}</button>}
    {suggestion.canRecheck && !busy ? <button type="button" onClick={suggestion.recheck}>추천 진행 상태 다시 확인</button> : null}
    {suggestion.error ? <p role="status">{suggestion.error}</p> : suggestion.issue ? <p>{suggestion.issue}</p> : null}
    {suggestion.reply?.drafts.map((item, index) => <article className="consulting-reply-card" key={item.style}><h3>{index ? '공감·설명형' : '핵심 전달형'}</h3><p>{item.body}</p><small>참고: {item.sourceRefs.map(sourceLabel).join(', ')}</small><button type="button" disabled={Boolean(unavailable)} onClick={() => use(item.body)}>이 답변을 입력창으로</button></article>)}
    {suggestion.reply?.checks.length ? <div className="consulting-reply-checks"><strong>상담사 확인 사항</strong><ul>{suggestion.reply.checks.map((text, index) => <li key={index}>{text}</li>)}</ul></div> : null}
    {pending ? <div className="consulting-reply-choice" role="group" aria-label="작성 중인 메시지 처리"><strong>작성 중인 메시지가 있습니다.</strong><p>추천답변을 어떻게 가져올까요?</p><button type="button" disabled={mergeReplyDraft(draft, pending, 'append') === null} onClick={() => apply('append')}>뒤에 이어 붙이기</button><button type="button" onClick={() => apply('replace')}>작성 내용 바꾸기</button><button type="button" onClick={() => setPending(null)}>그대로 두기</button>{mergeReplyDraft(draft, pending, 'append') === null ? <p>이어 붙이면 메시지 2,000자를 넘습니다.</p> : null}</div> : null}
    <small>사진과 내부 메모는 추천 자료에 포함되지 않습니다. 추천을 가져와도 메시지는 전송되지 않습니다.</small>
  </section>;
}
