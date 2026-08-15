import { Modal } from '../../components/Modal.jsx';
import { INQUIRY_SUBJECTS } from '../../constants/options.js';

const SCORE_STEPS = [
  { step: 1, key: 'korean', name: '국어' },
  { step: 2, key: 'math', name: '수학' },
  { step: 3, key: 'english', name: '영어' },
  { step: 4, key: 'history', name: '한국사' },
  { step: 5, key: 'inquiry1', name: '탐구 1' },
  { step: 6, key: 'inquiry2', name: '탐구 2' }
];

function isSubjectSaved(quantitative, key) {
  if (!quantitative) return false;
  if (key === 'korean') return Number(quantitative.kor?.common || 0) + Number(quantitative.kor?.elective || 0) > 0;
  if (key === 'math') return Number(quantitative.math?.common || 0) + Number(quantitative.math?.elective || 0) > 0;
  if (key === 'english') return Number(quantitative.eng?.grd || 0) > 0;
  if (key === 'history') return Number((quantitative.hist || quantitative.history)?.grd || 0) > 0;
  if (key === 'inquiry1') return Boolean(quantitative.inq1?.name) && Number(quantitative.inq1?.raw || 0) > 0;
  if (key === 'inquiry2') return Boolean(quantitative.inq2?.name) && Number(quantitative.inq2?.raw || 0) > 0;
  return false;
}

function displayedScore(value) {
  return value === 0 || value === '0' ? '0' : String(value || '');
}

function RawMetric({ raw }) {
  const entered = String(raw ?? '').trim() !== '';
  return <div className="score-onepage-metric"><span>원점수 {entered ? Number(raw) : '-'}</span><span>표준점수 저장 후 계산</span><span>백분위 저장 후 계산</span></div>;
}

function DirectScoreInput({ field, label, max, value }) {
  const ariaLabel = label.includes('원점수') ? label : `${label} 원점수`;
  return (
    <label className="score-direct-field">
      <span>{label}</span>
      <div className="score-direct-control"><input className="planner-input score-direct-input" data-field={field} data-score-max={max} defaultValue={displayedScore(value)} type="text" inputMode="numeric" pattern="[0-9]*" maxLength="3" autoComplete="off" placeholder="0" aria-label={ariaLabel} /><em>점</em></div>
      <small>0점 또는 2~{max - 2}점, {max}점</small>
    </label>
  );
}

function RawSubjectPanel({ commonField, commonMax, electiveField, electiveMax, options, selectField, subject, title }) {
  const hasCommon = String(subject.common ?? '').trim() !== '';
  const hasElective = String(subject.elective ?? '').trim() !== '';
  const raw = hasCommon && hasElective ? Number(subject.common) + Number(subject.elective) : '';
  return (
    <div className="score-step-panel">
      <div className="score-step-panel-head"><b>{title}</b><span>선택 과목 + 공통/선택 원점수</span></div>
      <label className="score-field-label">선택 과목</label>
      <select className="planner-input" data-field={selectField} defaultValue={subject.type}>{options.map((option) => <option value={option} key={option}>{option}</option>)}</select>
      <label className="score-field-label">원점수</label>
      <div className="score-direct-grid"><DirectScoreInput field={commonField} value={subject.common} max={commonMax} label="공통" /><DirectScoreInput field={electiveField} value={subject.elective} max={electiveMax} label="선택" /></div>
      <p className="score-direct-help">숫자로 직접 입력해 주세요. 문항 배점상 불가능한 1점과 만점보다 1점 낮은 점수는 저장할 수 없어요.</p>
      <RawMetric raw={raw} />
    </div>
  );
}

function GradeSubjectPanel({ field, title, value }) {
  const grade = /^[1-9]$/.test(String(value)) ? String(value) : '';
  return (
    <div className="score-step-panel">
      <div className="score-step-panel-head"><b>{title}</b><span>절대평가 · 등급 입력</span></div>
      <label className="score-grade-field"><span>등급</span><div className="score-grade-control"><input className="score-grade-input" data-field={field} data-score-max="9" defaultValue={grade} type="text" inputMode="numeric" pattern="[1-9]" maxLength="1" autoComplete="off" placeholder="1" aria-label={`${title} 등급`} /><em>등급</em></div><small>1~9등급 중 숫자 하나를 입력해 주세요.</small></label>
      {grade ? <div className="score-step-confirm"><span className="score-step-check">✓</span>{title} {grade}등급으로 입력됐어요</div> : <div className="score-step-warn">1~9 사이의 등급을 입력해 주세요</div>}
    </div>
  );
}

function InquiryOptions({ selected = '' }) {
  const saved = String(selected || '').trim();
  const options = saved && !INQUIRY_SUBJECTS.includes(saved) ? [saved, ...INQUIRY_SUBJECTS] : INQUIRY_SUBJECTS;
  return <><option value="">과목 선택</option>{options.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</>;
}

function InquirySubjectPanel({ inquiry, scoreField, subjectField, title }) {
  return (
    <div className="score-step-panel">
      <div className="score-step-panel-head"><b>{title}</b><span>탐구 과목 + 원점수</span></div>
      <div className="score-inquiry-grid"><label className="score-inquiry-field"><span>탐구 과목</span><select className="planner-input" data-field={subjectField} defaultValue={inquiry.subject}><InquiryOptions selected={inquiry.subject} /></select><small>응시한 선택 과목</small></label><DirectScoreInput field={scoreField} value={inquiry.score} max={50} label="원점수" /></div>
      <p className="score-direct-help">탐구도 1점과 49점처럼 문항 배점상 불가능한 점수는 저장할 수 없어요.</p>
      <RawMetric raw={inquiry.score} />
    </div>
  );
}

function ScoreStepPanel({ state, step }) {
  if (step === 1) return <RawSubjectPanel title="국어" selectField="v2e-korean-type" options={['화법과작문', '언어와매체']} commonField="v2e-korean-common" electiveField="v2e-korean-elective" commonMax={76} electiveMax={24} subject={state.korean || {}} />;
  if (step === 2) return <RawSubjectPanel title="수학" selectField="v2e-math-type" options={['확률과통계', '미적분', '기하']} commonField="v2e-math-common" electiveField="v2e-math-elective" commonMax={74} electiveMax={26} subject={state.math || {}} />;
  if (step === 3) return <GradeSubjectPanel title="영어" field="v2e-english" value={state.english} />;
  if (step === 4) return <GradeSubjectPanel title="한국사" field="v2e-history" value={state.history} />;
  if (step === 5) return <InquirySubjectPanel title="탐구 1" subjectField="v2e-inq1-subject" scoreField="v2e-inq1-score" inquiry={state.inquiry1 || {}} />;
  return <InquirySubjectPanel title="탐구 2" subjectField="v2e-inq2-subject" scoreField="v2e-inq2-score" inquiry={state.inquiry2 || {}} />;
}

export function ScoreEditModal({ scoreEditOpen = false, scoreEditState = {}, scoreEditStep = 1, scoreExamKey = '', scoreSubjectSaving = false, user = {} }) {
  if (!scoreEditOpen) return null;
  const step = Math.min(6, Math.max(1, Number(scoreEditStep || 1)));
  const quantitative = user?.quantitative?.[scoreExamKey] || {};
  const doneCount = SCORE_STEPS.filter((item) => isSubjectSaved(quantitative, item.key)).length;
  const progressPct = Math.round((doneCount / SCORE_STEPS.length) * 100);
  const isLast = step === SCORE_STEPS.length;
  const primaryLabel = scoreSubjectSaving ? '저장 중…' : isLast ? '전체 성적 저장' : '다음';
  return (
    <Modal dismissAction="closeScoreEdit" panelClass="score-edit-modal score-stepper-modal">
      <div className="score-onepage-head"><div><p className="home-modal-title">성적 입력</p><p className="sub">시험 성적을 과목별로 확인하고 마지막 단계에서 한 번에 저장해요.</p></div><button type="button" className="score-onepage-close" data-action="closeScoreEdit">닫기</button></div>
      <div className="score-stepper-progress"><div className="score-stepper-bar"><i style={{ width: `${progressPct}%` }} /></div><span>{doneCount} / {SCORE_STEPS.length} 입력됨</span></div>
      <div className="score-step-rail">{SCORE_STEPS.map((item) => { const active = item.step === step; const done = isSubjectSaved(quantitative, item.key); return <span className={`score-step-dot ${active ? 'active' : ''} ${done ? 'done' : ''}`} aria-current={active ? 'step' : 'false'} key={item.key}>{done && !active ? '✓' : item.name}</span>; })}</div>
      <div className="score-stepper-body"><ScoreStepPanel state={scoreEditState} step={step} /></div>
      <div className="score-stepper-actions"><button type="button" className="btn btn-secondary score-step-nav" data-action="scoreStepPrev" disabled={step === 1}>이전</button><button type="button" className="btn btn-primary score-step-save" data-action="saveScoreSubject" disabled={scoreSubjectSaving}>{primaryLabel}</button></div>
    </Modal>
  );
}
