import { useEffect, useRef } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { INQUIRY_SUBJECTS, SEPTEMBER_SCORE_ESTIMATE_NOTICE } from '../../constants/options.js';

const SCORE_STEPS = ['국어', '수학', '영어', '한국사', '탐구 1', '탐구 2'];

function displayedScore(value) {
  return value === 0 || value === '0' ? '0' : String(value || '');
}

function FieldError({ field, error }) {
  return error ? <span className="score-field-error" id={`${field}-error`} role="alert">{error}</span> : null;
}

function DirectScoreInput({ error, field, label, max, value }) {
  return (
    <label className="score-direct-field">
      <span className="score-field-line"><span>{label}</span><small>{max}점 만점</small></span>
      <span className="score-direct-control"><input id={field} className="planner-input score-direct-input" data-field={field} data-score-max={max} defaultValue={displayedScore(value)} type="text" inputMode="numeric" pattern="[0-9]*" maxLength="3" autoComplete="off" placeholder="0" aria-label={label} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${field}-error` : undefined} /><em>점</em></span>
      <FieldError field={field} error={error} />
    </label>
  );
}

function RawSubjectPanel({ commonField, commonMax, electiveField, electiveMax, errors, options, selectField, subject, title }) {
  return (
    <div className="score-step-panel">
      <div className="score-step-panel-head"><b>{title}</b></div>
      <label className="score-inquiry-field"><span>선택 과목</span><select id={selectField} className="planner-input" data-field={selectField} defaultValue={subject.type} aria-invalid={errors[selectField] ? 'true' : undefined} aria-describedby={errors[selectField] ? `${selectField}-error` : undefined}>{options.map((option) => <option value={option} key={option}>{option}</option>)}</select><FieldError field={selectField} error={errors[selectField]} /></label>
      <div className="score-direct-grid"><DirectScoreInput field={commonField} value={subject.common} max={commonMax} label="공통 원점수" error={errors[commonField]} /><DirectScoreInput field={electiveField} value={subject.elective} max={electiveMax} label="선택 원점수" error={errors[electiveField]} /></div>
    </div>
  );
}

function GradeSubjectPanel({ error, field, title, value }) {
  const grade = /^[1-9]$/.test(String(value)) ? String(value) : '';
  return (
    <div className="score-step-panel">
      <div className="score-step-panel-head"><b>{title}</b></div>
      <label className="score-grade-field"><span className="score-field-line"><span>등급</span><small>1~9등급</small></span><span className="score-grade-control"><input id={field} className="score-grade-input" data-field={field} data-score-max="9" defaultValue={grade} type="text" inputMode="numeric" pattern="[1-9]" maxLength="1" autoComplete="off" placeholder="1" aria-label={`${title} 등급`} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${field}-error` : undefined} /><em>등급</em></span><FieldError field={field} error={error} /></label>
    </div>
  );
}

function InquiryOptions({ selected = '' }) {
  const saved = String(selected || '').trim();
  const options = saved && !INQUIRY_SUBJECTS.includes(saved) ? [saved, ...INQUIRY_SUBJECTS] : INQUIRY_SUBJECTS;
  return <><option value="">과목 선택</option>{options.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</>;
}

function InquirySubjectPanel({ errors, inquiry, scoreField, subjectField, title }) {
  return (
    <div className="score-step-panel">
      <div className="score-step-panel-head"><b>{title}</b></div>
      <div className="score-inquiry-grid"><label className="score-inquiry-field"><span>탐구 과목</span><select id={subjectField} className="planner-input" data-field={subjectField} defaultValue={inquiry.subject} aria-invalid={errors[subjectField] ? 'true' : undefined} aria-describedby={errors[subjectField] ? `${subjectField}-error` : undefined}><InquiryOptions selected={inquiry.subject} /></select><FieldError field={subjectField} error={errors[subjectField]} /></label><DirectScoreInput field={scoreField} value={inquiry.score} max={50} label="원점수" error={errors[scoreField]} /></div>
    </div>
  );
}

function ScoreStepPanel({ errors, state, step }) {
  if (step === 1) return <RawSubjectPanel title="국어" selectField="v2e-korean-type" options={['화법과작문', '언어와매체']} commonField="v2e-korean-common" electiveField="v2e-korean-elective" commonMax={76} electiveMax={24} subject={state.korean || {}} errors={errors} />;
  if (step === 2) return <RawSubjectPanel title="수학" selectField="v2e-math-type" options={['확률과통계', '미적분', '기하']} commonField="v2e-math-common" electiveField="v2e-math-elective" commonMax={74} electiveMax={26} subject={state.math || {}} errors={errors} />;
  if (step === 3) return <GradeSubjectPanel title="영어" field="v2e-english" value={state.english} error={errors['v2e-english']} />;
  if (step === 4) return <GradeSubjectPanel title="한국사" field="v2e-history" value={state.history} error={errors['v2e-history']} />;
  if (step === 5) return <InquirySubjectPanel title="탐구 1" subjectField="v2e-inq1-subject" scoreField="v2e-inq1-score" inquiry={state.inquiry1 || {}} errors={errors} />;
  return <InquirySubjectPanel title="탐구 2" subjectField="v2e-inq2-subject" scoreField="v2e-inq2-score" inquiry={state.inquiry2 || {}} errors={errors} />;
}

export function ScoreEditModal({ scoreEditOpen = false, scoreEditState = {}, scoreEditStep = 1, scoreEditErrors = {}, scoreEditSaveError = '', scoreExamKey = '', scoreExamType = '', scoreSubjectSaving = false }) {
  const bodyRef = useRef(null);
  const step = Math.min(6, Math.max(1, Number(scoreEditStep || 1)));
  useEffect(() => {
    if (!scoreEditOpen) return;
    const firstField = Object.keys(scoreEditErrors)[0];
    const input = firstField ? bodyRef.current?.querySelector(`[data-field="${firstField}"]`) : null;
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: 'nearest' });
  }, [scoreEditOpen, scoreEditErrors, step]);
  if (!scoreEditOpen) return null;
  const isLast = step === SCORE_STEPS.length;
  const primaryLabel = scoreSubjectSaving ? '저장 중…' : isLast ? '전체 성적 저장' : '다음';
  return (
    <Modal dismissAction="closeScoreEdit" ariaLabel="성적 수정" panelClass="score-edit-modal score-stepper-modal">
      <div className="score-onepage-head"><div><p className="sc-modal-padded-title">성적 입력</p><p className="sub">{scoreExamType || '시험 성적'}</p></div><button type="button" className="score-onepage-close" data-action="closeScoreEdit">닫기</button></div>
      <div className="score-stepper-progress"><span>{SCORE_STEPS[step - 1]} <b>{step} / {SCORE_STEPS.length}</b></span><div className="score-stepper-bar" role="progressbar" aria-label="성적 입력 단계" aria-valuemin={1} aria-valuemax={6} aria-valuenow={step}><i style={{ width: `${Math.round(step / SCORE_STEPS.length * 100)}%` }} /></div></div>
      <div className="score-stepper-body" ref={bodyRef}>{scoreExamKey === 'sep' ? <p className="score-edit-estimate-notice" role="status">{SEPTEMBER_SCORE_ESTIMATE_NOTICE}</p> : null}<ScoreStepPanel key={step} state={scoreEditState} step={step} errors={scoreEditErrors} /></div>
      <div className="score-stepper-actions">{scoreEditSaveError ? <p className="score-save-error" role="alert">{scoreEditSaveError}</p> : null}<div className="score-stepper-buttons"><button type="button" className="btn btn-secondary score-step-nav" data-action="scoreStepPrev" disabled={step === 1 || scoreSubjectSaving}>이전</button><button type="button" className="btn btn-primary score-step-save" data-action="saveScoreSubject" disabled={scoreSubjectSaving}>{primaryLabel}</button></div></div>
    </Modal>
  );
}
