import React from 'react';

const statuses = { ready: '검사 완료', linked: '제출됨', quarantined: '검사 중', rejected: '업로드 거절', upload_pending: '업로드 대기' };
export function SurveyScoreFiles({ files, onUpload, onRefresh, onDelete }) {
  return <div className="consulting-file-panel">
    <h3>수능 성적표 첨부</h3>
    <p>PDF·JPG·PNG, 파일당 10MB 이하. 검사 완료 후 제출할 수 있어요.</p>
    <input type="file" aria-label="성적표 파일" accept="application/pdf,image/jpeg,image/png" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) onUpload(file);
    }} />
    {files.length ? <ul>{files.map(file => <li key={file.fileId}>
      <div><span>{file.displayName}</span><strong data-status={file.status}>{statuses[file.status] || file.status}</strong></div>
      <div className="consulting-score-file-actions">
        {['upload_pending', 'quarantined', 'rejected', 'ready'].includes(file.status) && <button className="consulting-v2-secondary" type="button" aria-label={`${file.displayName} 삭제`} onClick={() => onDelete(file)}>삭제</button>}
      </div>
    </li>)}</ul> : <p>첨부한 성적표가 없어요.</p>}
    {files.some(file => file.status === 'quarantined') && <button className="consulting-v2-secondary consulting-survey-refresh" type="button" onClick={onRefresh}>검사 상태 확인</button>}
  </div>;
}
