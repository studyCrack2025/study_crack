import React from 'react';
import { safeWrittenPhotoUrl, writtenPhotoRequest } from '../written-photo-api.js';

export function WrittenChatPhoto({ binding, caseId, file }) {
  const [image, setImage] = React.useState({ url: null, error: '' });
  const [attempt, setAttempt] = React.useState(0);
  const retried = React.useRef(false), dialog = React.useRef(null);
  React.useEffect(() => {
    const controller = new AbortController();
    setImage({ url: null, error: '' });
    writtenPhotoRequest(binding, 'url', { caseId, fileId: file.fileId }, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const url = result.ok && safeWrittenPhotoUrl(result.data.url, { caseId, fileId: file.fileId });
      setImage(url ? { url, error: '' } : { url: null, error: result.error || '사진을 열지 못했어요.' });
    }).catch(() => { if (!controller.signal.aborted) setImage({ url: null, error: '사진을 열지 못했어요.' }); });
    return () => controller.abort();
  }, [binding, caseId, file.fileId, attempt]);
  const failed = () => {
    if (!retried.current) { retried.current = true; setAttempt(value => value + 1); }
    else setImage({ url: null, error: '사진 주소가 만료되었거나 연결이 끊겼어요.' });
  };
  return <figure className="consulting-chat-photo">
    {image.url ? <button type="button" className="consulting-chat-photo-open" onClick={() => dialog.current?.showModal()} aria-label={`${file.displayName || '상담 사진'} 크게 보기`}><img src={image.url} alt={file.displayName || '상담 사진'} loading="lazy" referrerPolicy="no-referrer" onError={failed} /></button> : <div className="consulting-chat-photo-placeholder">{image.error || '사진을 불러오는 중…'}{image.error ? <button type="button" onClick={() => { retried.current = false; setAttempt(value => value + 1); }}>사진 다시 보기</button> : null}</div>}
    <figcaption>{file.displayName || '상담 사진'}</figcaption>
    <dialog ref={dialog} className="consulting-chat-photo-dialog" onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }}>
      <button type="button" onClick={() => dialog.current.close()} aria-label="사진 닫기">닫기</button>
      {image.url ? <img src={image.url} alt={file.displayName || '상담 사진'} referrerPolicy="no-referrer" onError={failed} /> : <p>{image.error}</p>}
    </dialog>
  </figure>;
}
