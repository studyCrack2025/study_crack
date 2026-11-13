import React from 'react';
import { SurveyFieldContext } from './SurveyFieldScope.jsx';
import { supplementAnswer, supplementAnswerText, supplementFieldChanged } from '../survey-supplement-model.js';

export function SurveySupplementEditor({ supplement, snapshot, submission, selectedFileIds, busy, held, saveState, notice,
  renderField, fieldsRef, headingRef, onBack, onSave, onSubmit, onReload }) {
  const notes = supplement.fields;
  const before = submission?.snapshot || {};
  const changed = field => supplementFieldChanged(field, before, snapshot, submission?.fileIds || [], selectedFileIds);
  const changedCount = notes.filter(({ field }) => changed(field)).length;
  const confirmationOnly = notes.every(({ field }) => field.startsWith('consent.'));
  return <main className="consulting-survey">
    <header><button type="button" disabled={busy} onClick={onBack}>← 보완 요청 보기</button>
      <span className="consulting-survey-save-state" data-state={saveState.kind} role="status">{saveState.kind === 'saving' ? '임시 저장 중…' : saveState.kind === 'pending' ? '저장하지 않은 수정' : saveState.kind === 'failed' ? '저장 실패' : '재제출 전'}</span>
    </header>
    <section className="consulting-survey-card" aria-labelledby="survey-title">
      <div className="consulting-survey-intro"><div>
        <p className="consulting-survey-position">기초조사서 보완 <span>요청 {notes.length}개 · 수정 {changedCount}개</span></p>
        <h1 id="survey-title" ref={headingRef} tabIndex={-1}>요청받은 답변만 보완해 주세요</h1>
        <p className="consulting-survey-guide">나머지 답변과 첨부는 그대로 유지돼요. 모두 확인한 뒤 아래에서 재제출하면 운영팀이 수정 내용을 확인할 수 있어요.</p>
      </div></div>
      {supplement.reasonText && <p className="consulting-survey-message">{supplement.reasonText}</p>}
      {notice && <p className="consulting-survey-message" data-tone={notice.error ? 'error' : 'info'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      <fieldset className="consulting-survey-fields" disabled={busy || held} ref={fieldsRef}>
        <legend className="consulting-supplement-legend">보완 요청 항목</legend>
        <div className="consulting-supplement-items">{notes.map(({ field, label, note }, index) =>
          <section className="consulting-supplement-item" key={field} aria-labelledby={`supplement-item-${index}`} data-changed={changed(field)}>
            <div className="consulting-supplement-item-heading"><h2 id={`supplement-item-${index}`}>{label}</h2><span>{changed(field) ? '수정함' : '아직 수정하지 않음'}</span></div>
            <p className="consulting-supplement-request">{note}</p>
            <details className="consulting-supplement-before"><summary>요청 전 답변 보기</summary><p>{field === 'files' ? `첨부 ${submission?.fileIds?.length || 0}개` : supplementAnswerText(supplementAnswer(before, field))}</p></details>
            <SurveyFieldContext.Provider value={[field]}>{renderField(field)}</SurveyFieldContext.Provider>
          </section>)}</div>
      </fieldset>
      {saveState.kind === 'failed' && <div className="consulting-survey-save-error"><p role="alert">{saveState.message}</p>
        {saveState.conflict && <button type="button" className="consulting-v2-secondary" disabled={busy} onClick={onReload}>최신 보완 요청 다시 열기</button>}
      </div>}
      <div className="consulting-supplement-submit-note" role="status">
        {held ? '서비스 보류 중에는 보완 답변을 제출할 수 없어요.' : confirmationOnly ? '동의 내용을 확인한 뒤 재제출해 주세요. 내용이 같으면 운영팀에는 변경 없음으로 표시돼요.' : changedCount === 0 ? '수정한 답변이 아직 없어요. 임시 저장만으로는 운영팀에 재제출되지 않아요.'
          : `${notes.length}개 요청 중 ${changedCount}개를 수정했어요.${changedCount < notes.length ? ' 수정하지 않은 항목은 기존 답변으로 함께 제출돼요.' : ''}`}
      </div>
      <div className="consulting-supplement-actions">
        <button type="button" className="consulting-v2-secondary" disabled={busy || held || saveState.conflict} onClick={onSave}>임시 저장</button>
        <button type="button" className="consulting-v2-primary" disabled={busy || held || saveState.conflict || !changedCount && !confirmationOnly} onClick={onSubmit}>{busy ? '처리 중…' : '보완 답변 재제출'}</button>
      </div>
    </section>
  </main>;
}
