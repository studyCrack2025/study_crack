import { INQUIRY_SUBJECT_GROUPS, INQUIRY_SUBJECTS } from '../constants/options.js';

function displayedScore(value) {
  return value === 0 || value === '0' ? '0' : String(value || '');
}

function FieldError({ field, error }) {
  return error ? <span className="score-field-error" id={`${field}-error`} role="alert">{error}</span> : null;
}

function DirectScoreInput({ error, field, hint, label, max, unit = '점', value }) {
  return (
    <label className="score-direct-field">
      <span className="score-field-line"><span>{label}</span><small>{hint || `${max}점 만점`}</small></span>
      <span className="score-direct-control"><input id={field} className="planner-input score-direct-input" data-field={field} data-score-format="official" data-score-max={max} defaultValue={displayedScore(value)} type="text" inputMode="numeric" pattern="[0-9]*" maxLength="8" autoComplete="off" placeholder={max === 9 ? '1' : '0'} aria-label={label} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${field}-error` : undefined} /><em>{unit}</em></span>
      <FieldError field={field} error={error} />
    </label>
  );
}

function InquiryOptions({ selected = '' }) {
  const saved = String(selected || '').trim();
  return <>
    <option value="">과목 선택</option>
    {saved && !INQUIRY_SUBJECTS.includes(saved) ? <option value={saved}>{saved}</option> : null}
    {INQUIRY_SUBJECT_GROUPS.map(([label, subjects]) => (
      <optgroup key={label} label={label}>
        {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
      </optgroup>
    ))}
  </>;
}

export function OfficialSubjectPanel({ errors = {}, subject = {}, subjectKey, title }) {
  const inquiry = subjectKey.startsWith('inq');
  const field = `v2e-${subjectKey}-${inquiry ? 'subject' : 'type'}`;
  const options = subjectKey === 'korean' ? ['화법과작문', '언어와매체'] : ['확률과통계', '미적분', '기하'];
  return <div className="score-step-panel">
    <div className="score-step-panel-head"><b>{title}</b></div>
    <label className="score-inquiry-field"><span>선택 과목</span><select id={field} className="planner-input" data-field={field} defaultValue={inquiry ? subject.subject : subject.type} aria-invalid={errors[field] ? 'true' : undefined} aria-describedby={errors[field] ? `${field}-error` : undefined}>{inquiry ? <InquiryOptions selected={subject.subject} /> : <><option value="">과목 선택</option>{options.map(option => <option key={option}>{option}</option>)}</>}</select><FieldError field={field} error={errors[field]} /></label>
    <div className="score-direct-grid">{[['std', '표준점수', 200, '점', '성적표 값'], ['pct', '백분위', 100, '', '0~100'], ['grd', '등급', 9, '등급', '1~9등급']].map(([metric, label, max, unit, hint]) => <DirectScoreInput key={metric} field={`v2e-${subjectKey}-${metric}`} label={label} max={max} unit={unit} hint={hint} value={subject[metric]} error={errors[`v2e-${subjectKey}-${metric}`]} />)}</div>
  </div>;
}


export default OfficialSubjectPanel;
