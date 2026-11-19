import React from 'react';
const statuses = { ready: '보안 검사 통과', linked: '제출됨', quarantined: '보안 검사 중', rejected: '보안 검사에서 거절됨', upload_pending: '첨부 확인 대기' };

export function SurveyScoreFiles({ files, onUpload, onConfirmUpload, scanPaused, retryScan, onDelete, readOnly = false, excludedFileIds = [], onIncludeLinked }) {
  const input = React.useRef(null);
  const attachedCount = files.filter(file => ['quarantined', 'ready', 'linked'].includes(file.status) && !excludedFileIds.includes(file.fileId)).length;
  const summary = attachedCount ? `${attachedCount}개 첨부됨` : files.length ? '아래에서 파일 상태를 확인해 주세요.' : '첨부된 파일이 없어요.';
  return <section className="consulting-file-panel" aria-labelledby="survey-score-files-title" data-survey-field="files">
    <h3 id="survey-score-files-title">수능 성적표 첨부</h3>
    <p>{readOnly ? '기존에 제출한 성적표가 연결되어 있어요.' : 'PDF·JPG·PNG, 파일당 10MB 이하. 보안 검사를 통과한 파일을 제출할 수 있어요.'}</p>
    {!readOnly && <input ref={input} type="file" hidden aria-label="성적표 파일" accept="application/pdf,image/jpeg,image/png" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) onUpload(file);
    }} />}
    <div className="consulting-score-file-actions">
      {!readOnly && <button className="consulting-v2-secondary" type="button" onClick={() => input.current?.click()}>{files.length ? '파일 추가' : '파일 선택'}</button>}
      <span className="consulting-score-note" role="status">{summary}</span>
    </div>
    {files.length > 0 && <ul>{files.map(file => <li key={file.fileId}>
      <div><span>{file.displayName}</span><strong data-status={file.status}>{statuses[file.status] || file.status}</strong></div>
      <div className="consulting-score-file-actions">
        {!readOnly && onIncludeLinked && file.status === 'linked' && <label className="consulting-survey-check">
          <input type="checkbox" checked={!excludedFileIds.includes(file.fileId)} aria-label={`${file.displayName} 보완 제출에 포함`} onChange={event => onIncludeLinked(file.fileId, event.target.checked)} /> 이번 제출에 포함
        </label>}
        {!readOnly && file.status === 'upload_pending' && <button className="consulting-v2-secondary" type="button" onClick={() => onConfirmUpload(file)}>첨부 다시 확인</button>}
        {!readOnly && ['upload_pending', 'quarantined', 'rejected', 'ready'].includes(file.status) && <button className="consulting-v2-secondary" type="button" aria-label={`${file.displayName} 삭제`} onClick={() => onDelete(file)}>삭제</button>}
      </div>
    </li>)}</ul>}
    {scanPaused && <>
      <p role="status">보안 검사 결과를 기다리고 있어요. 잠시 뒤 다시 확인해 주세요.</p>
      <button className="consulting-v2-secondary consulting-survey-refresh" type="button" onClick={retryScan}>보안 검사 다시 확인</button>
    </>}
  </section>;
}
