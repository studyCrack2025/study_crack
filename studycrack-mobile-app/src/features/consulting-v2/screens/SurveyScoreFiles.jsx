import React from 'react';
import { photoGradeSuggestions } from '../score-entry-model.js';

const statuses = { ready: '검사 완료', linked: '제출됨', quarantined: '검사 중', rejected: '업로드 거절', upload_pending: '업로드 대기' };
const readablePhoto = file => file.status === 'ready' && ['image/jpeg', 'image/png'].includes(file.contentType) && file.size > 0 && file.size <= 8 * 1024 * 1024;
const photoErrors = {
  SCORE_PHOTO_SCAN_REFERENCE_MISSING: '이전에 올린 사진은 읽을 수 없어요. 사진을 새로 첨부하거나 성적을 직접 입력해 주세요.',
  SCORE_PHOTO_CHANGED: '첨부한 사진을 확인할 수 없어요. 사진을 다시 올려주세요.'
};

export function SurveyScoreFiles({ files, onUpload, onRefresh, onDelete, onReadPhoto, scores, onApplyPhotoGrades }) {
  const [reading, setReading] = React.useState(null);
  const preview = reading && files.some(file => file.fileId === reading.fileId && readablePhoto(file)) ? reading : null;
  const suggestions = preview?.records ? photoGradeSuggestions(scores, preview.records) : [];
  const read = async file => {
    setReading({ fileId: file.fileId, pending: true });
    const result = await onReadPhoto(file);
    const message = Object.hasOwn(photoErrors, result?.code) ? photoErrors[result.code] : result?.error;
    setReading(result?.ok ? { fileId: file.fileId, records: result.data.records || [] }
      : { fileId: file.fileId, error: message || '사진을 읽지 못했어요. 성적을 직접 입력할 수 있어요.' });
  };
  return <div className="consulting-file-panel">
    <h3>수능 성적표 첨부</h3>
    <p>PDF·JPG·PNG, 파일당 10MB 이하. 검사 완료 후 제출할 수 있어요.</p>
    {onReadPhoto && <p>8MB 이하의 JPG·PNG에서 영어·한국사 등급과 제2외국어·한문 과목 및 등급을 읽을 수 있어요.</p>}
    <input type="file" aria-label="성적표 파일" accept="application/pdf,image/jpeg,image/png" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) onUpload(file);
    }} />
    {files.length ? <ul>{files.map(file => <li key={file.fileId}>
      <div><span>{file.displayName}</span><strong data-status={file.status}>{statuses[file.status] || file.status}</strong></div>
      <div className="consulting-score-file-actions">
        {onReadPhoto && readablePhoto(file) && <button className="consulting-v2-secondary" type="button" onClick={() => read(file)}>사진 읽기</button>}
        {['upload_pending', 'quarantined', 'rejected', 'ready'].includes(file.status) && <button className="consulting-v2-secondary" type="button" aria-label={`${file.displayName} 삭제`} onClick={() => onDelete(file)}>삭제</button>}
      </div>
    </li>)}</ul> : <p>첨부한 성적표가 없어요.</p>}
    {files.some(file => file.status === 'quarantined') && <button className="consulting-v2-secondary consulting-survey-refresh" type="button" onClick={onRefresh}>검사 상태 확인</button>}
    {preview?.pending && <p role="status">사진에서 등급을 읽는 중이에요.</p>}
    {preview?.error && <p role="alert">{preview.error}</p>}
    {preview?.records && (suggestions.length ? <div className="consulting-score-photo-preview" aria-label="사진에서 읽은 성적">
      <strong>사진에서 읽은 성적</strong>
      <p>{suggestions.map(({ label, patch }) => `${label} ${patch.grade}등급`).join(' · ')}</p>
      <p>성적표와 비교해 주세요. 이미 입력한 내용은 바뀌지 않아요.</p>
      <button className="consulting-v2-secondary" type="button" onClick={() => {
        onApplyPhotoGrades(preview.records);
        setReading({ fileId: preview.fileId, applied: true });
      }}>빈칸에 반영</button>
    </div> : <p role="status">빈칸에 반영할 등급을 찾지 못했어요. 성적표를 보고 직접 입력할 수 있어요.</p>)}
    {preview?.applied && <p role="status">확인한 성적을 빈칸에 반영했어요.</p>}
  </div>;
}
