import React from 'react';
const statuses = { ready: '보안 검사 통과', linked: '제출됨', quarantined: '보안 검사 중', rejected: '보안 검사에서 거절됨', upload_pending: '첨부 확인 대기' };

function ReadResult({ result, retry }) {
  if (!result) return null;
  if (result.kind === 'waiting' || result.kind === 'reading' || result.kind === 'received') {
    return <div className="consulting-score-photo-preview" role="status">
      <strong>{result.kind === 'waiting' ? '성적 판독 대기 중' : '성적표를 읽고 있어요'}</strong>
    </div>;
  }
  if (result.kind !== 'complete') {
    return <div className="consulting-score-photo-preview" data-result="notice">
      <div role="status"><strong>{result.title}</strong><p>{result.message}</p></div>
      {result.retryable && <button className="consulting-v2-secondary" type="button" onClick={retry}>판독 다시 시도</button>}
    </div>;
  }
  return <div className="consulting-score-photo-preview" aria-label="성적 판독 결과">
    <strong role="status">{result.applied ? '성적을 읽고 빈칸에 반영했어요' : '성적표에서 읽은 값'}</strong>
    <dl className="consulting-score-read-rows">{result.rows.map(({ label, values, status }) => <div key={label}>
      <dt>{label}</dt><dd>{values}{status && <span>{status}</span>}</dd>
    </div>)}</dl>
    <p>읽은 값은 성적표와 비교해 주세요. 국어·수학·탐구 원점수는 직접 입력할 수 있어요.</p>
  </div>;
}

export function SurveyScoreFiles({ files, onUpload, onConfirmUpload, scanPaused, retryScan, onDelete, getReadResult, retryRead }) {
  return <div className="consulting-file-panel">
    <h3>수능 성적표 첨부</h3>
    <p>PDF·JPG·PNG, 파일당 10MB 이하. 보안 검사가 끝나면 성적표를 자동으로 읽어요. PDF는 첫 페이지, 사진은 8MB 이하에서 판독할 수 있어요.</p>
    <input type="file" aria-label="성적표 파일" accept="application/pdf,image/jpeg,image/png" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) onUpload(file);
    }} />
    {files.length ? <ul>{files.map(file => <li key={file.fileId}>
      <div><span>{file.displayName}</span><strong data-status={file.status}>{statuses[file.status] || file.status}</strong></div>
      <div className="consulting-score-file-actions">
        {file.status === 'upload_pending' && <button className="consulting-v2-secondary" type="button" onClick={() => onConfirmUpload(file)}>첨부 다시 확인</button>}
        {['upload_pending', 'quarantined', 'rejected', 'ready'].includes(file.status) && <button className="consulting-v2-secondary" type="button" aria-label={`${file.displayName} 삭제`} onClick={() => onDelete(file)}>삭제</button>}
      </div>
      {file.status === 'ready' && <ReadResult result={getReadResult(file)} retry={() => retryRead(file.fileId)} />}
    </li>)}</ul> : <p>첨부한 성적표가 없어요.</p>}
    {scanPaused && <>
      <p role="status">보안 검사 결과를 기다리고 있어요. 잠시 뒤 다시 확인해 주세요.</p>
      <button className="consulting-v2-secondary consulting-survey-refresh" type="button" onClick={retryScan}>보안 검사 다시 확인</button>
    </>}
  </div>;
}
