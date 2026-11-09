import React from 'react';

const statuses = { ready: '검사 완료', linked: '제출됨', quarantined: '검사 중', rejected: '업로드 거절', upload_pending: '업로드 대기' };
const canReadPhoto = file => ['image/jpeg', 'image/png'].includes(file.contentType) && file.size <= 8 * 1024 * 1024;

export function SurveyScoreFiles({ files, onUpload, onRefresh, onDelete, onRead, readDisabled }) {
  const photoMode = typeof onRead === 'function';
  const shownFiles = photoMode ? files.filter(file => ['image/jpeg', 'image/png'].includes(file.contentType)) : files;
  return <div className="consulting-file-panel" data-photo={photoMode || undefined}>
    {photoMode ? <p>평가원 성적표의 표 전체가 수평으로 보이는 JPG·PNG 사진을 올려주세요. 8MB 이하의 사진을 검사한 뒤 읽을 수 있어요.</p> : <><h3>성적표 파일</h3><p>PDF·JPG·PNG, 파일당 10MB 이하. 보안 검사가 끝나면 제출할 수 있습니다.</p></>}
    <input type="file" aria-label={photoMode ? '성적표 사진 첨부' : '성적표 파일'} accept={photoMode ? 'image/jpeg,image/png' : 'application/pdf,image/jpeg,image/png'} onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) onUpload(file);
    }} />
    {shownFiles.length ? <ul>{shownFiles.map(file => <li key={file.fileId}>
      <div><span>{file.displayName}</span><strong data-status={file.status}>{statuses[file.status] || file.status}</strong></div>
      <div className="consulting-score-file-actions">
        {photoMode && file.status === 'ready' && canReadPhoto(file) && <button className="consulting-v2-secondary" disabled={readDisabled} type="button" onClick={() => onRead(file)}>사진 읽기</button>}
        {['upload_pending', 'quarantined', 'rejected', 'ready'].includes(file.status) && <button className="consulting-v2-secondary" type="button" aria-label={`${file.displayName} 삭제`} onClick={() => onDelete(file)}>삭제</button>}
      </div>
    </li>)}</ul> : !photoMode && <p>등록된 파일이 없습니다.</p>}
    {shownFiles.some(file => file.status === 'quarantined') ? <button className="consulting-v2-secondary consulting-survey-refresh" type="button" onClick={onRefresh}>검사 상태 확인</button> : null}
  </div>;
}
