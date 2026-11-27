import React from 'react';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import { emptyScores, FOREIGN_LANGUAGE_SUBJECTS, prepareCalculatorScores, SUBJECTS } from './calculator-model.js';

function ScoreField({ subject, metric, title, label, value, max, error, choices, onChange }) {
  const id = `jcalc-${subject}-${metric}`;
  const inputProps = { id, value: value ?? '', 'aria-label': `${title} ${label}`, 'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-error` : undefined, onChange: event => onChange(event.currentTarget.value) };
  return <label className="jcalc-field" htmlFor={id}>
    <span>{label}{max && <small>{metric === 'grd' ? '1~9등급' : `0~${max}${metric === 'pct' ? '' : '점'}`}</small>}</span>
    {choices ? <select {...inputProps}>
      <option value="">{metric === 'grd' ? '선택' : '선택해주세요'}</option>{choices.map(choice => <option key={choice} value={choice}>{metric === 'grd' ? `${choice}등급` : choice}</option>)}
    </select> : <input {...inputProps} inputMode="numeric" type="text" pattern="[0-9]*" maxLength="3" autoComplete="off" placeholder={metric === 'pct' ? '백분위' : '점수'} />}
    {error && <span id={`${id}-error`} className="jcalc-error">{error}</span>}
  </label>;
}

export default function CalculatorScoreForm({ scores, errors, changed, confirmed, conversion, onChange, onConfirm, confirmLabel, confirmDisabled = false, onCancel, children }) {
  const validation = prepareCalculatorScores(scores);
  const setField = (subject, metric, value) => onChange({ ...scores, exam: { ...scores.exam, [subject]: { ...scores.exam[subject], [metric]: value } } });
  const field = (subject, title, metric, label, max, choices) => <ScoreField key={metric} subject={subject} metric={metric} title={title} label={label} max={max} choices={choices} value={scores.exam[subject][metric]} error={errors[`${subject}.${metric}`] || (scores.basis === 'raw' && scores.exam[subject][metric] !== '' ? validation.errors[`${subject}.${metric}`] : undefined)} onChange={value => setField(subject, metric, value)} />;
  const grades = Array.from({ length: 9 }, (_, index) => String(index + 1));
  return <section className="jcalc-panel" aria-labelledby="jcalc-score-title">
    <div className="jcalc-section-head"><div><p className="jcalc-eyebrow">01 · 내 성적</p><h2 id="jcalc-score-title">{scores.basis === 'raw' ? '2027학년도 수능 가채점 성적' : '이전에 저장한 성적표 성적'}</h2></div><span className="jcalc-badge">{scores.basis === 'raw' ? '예상 성적' : '기존 입력'}</span></div>
    <form noValidate onSubmit={event => { event.preventDefault(); onConfirm(); }}>
      <CalculatorNote>{scores.basis === 'official' ? '이전에 입력한 성적을 유지하고 있습니다. 가채점 성적으로 새로 입력하려면 아래 버튼을 눌러주세요.' : '국어·수학은 공통과 선택 원점수를 나누어 입력해주세요. 표준점수·백분위·등급은 2027학년도 수능 추정표를 기준으로 자동 계산됩니다.'}</CalculatorNote>
      {scores.basis === 'official' && <CalculatorButton onClick={() => { if (globalThis.confirm('현재 성적 입력을 비우고 가채점 원점수를 입력할까요? 지원 후보는 유지됩니다.')) onChange(emptyScores()); }}>가채점 성적으로 새로 입력</CalculatorButton>}
      {errors.basis && <p className="jcalc-error" role="alert">{errors.basis}</p>}
      <div className="jcalc-subjects">{SUBJECTS.map(([key, title, options, limits]) => <fieldset key={key} className="jcalc-subject"><legend>{title}</legend>
        {field(key, title, limits ? 'opt' : 'name', '선택과목', null, options)}
        <div className="jcalc-metrics" data-split={scores.basis === 'raw' && Boolean(limits) || undefined}>{scores.basis === 'official' ? <>
          {field(key, title, 'std', '표준점수', 200)}{field(key, title, 'pct', '백분위', 100)}{field(key, title, 'grd', '등급', 9, grades)}
        </> : limits ? <>
          {field(key, title, 'common', '공통 원점수', limits[0])}{field(key, title, 'elective', '선택 원점수', limits[1])}
        </> : field(key, title, 'raw', '원점수', 50)}</div>
        {scores.basis === 'raw' && <div className="jcalc-estimate" aria-label={`${title} 예상 성적`} aria-live="polite">
          {limits && <p className="jcalc-raw-total">원점수 합계 <strong>{/^\d+$/.test(String(scores.exam[key].common)) && /^\d+$/.test(String(scores.exam[key].elective)) ? Number(scores.exam[key].common) + Number(scores.exam[key].elective) : '—'}</strong> / 100</p>}
          {conversion?.results[key]?.status === 'converted' ? <><dl className="jcalc-estimate-metrics">{[['standardScore', '예상 표준점수'], ['percentile', '예상 백분위'], ['grade', '예상 등급']].map(([metric, label]) => <div key={metric}><dt>{label}</dt><dd>{conversion.results[key].metrics[metric]}{metric === 'grade' && '등급'}</dd></div>)}</dl><p className="jcalc-estimate-note">{conversion.results[key].scoreboard.estimated ? '2027학년도 수능 추정치' : '2027학년도 수능 변환표 기준'}</p></>
            : <p className="jcalc-estimate-note">{conversion?.results[key]?.status === 'loading' ? '예상 성적 계산 중…' : ['error', 'unavailable'].includes(conversion?.results[key]?.status) ? '예상 성적을 확인하지 못했습니다.' : '과목과 원점수를 입력하면 예상 성적이 표시됩니다.'}
              {['error', 'unavailable'].includes(conversion?.results[key]?.status) && <CalculatorButton text onClick={conversion.retry}>다시 계산</CalculatorButton>}</p>}
        </div>}
      </fieldset>)}</div>
      <div className="jcalc-grades">{[['eng', '영어'], ['hist', '한국사']].map(([key, title]) => <fieldset className="jcalc-subject" key={key}><legend>{title}</legend>{field(key, title, 'grd', '등급', 9, grades)}</fieldset>)}</div>
      <fieldset className="jcalc-subject"><legend>제2외국어·한문 <small>선택 입력</small></legend>
        <div className="jcalc-grades"><label className="jcalc-field"><span>응시 과목</span><select aria-label="제2외국어·한문 응시 과목" value={scores.exam.foreign.name} onChange={event => onChange({ ...scores, exam: { ...scores.exam, foreign: { name: event.currentTarget.value, grd: '' } } })}><option value="">응시하지 않음</option>{FOREIGN_LANGUAGE_SUBJECTS.map(subject => <option key={subject}>{subject}</option>)}</select>{errors['foreign.name'] && <span className="jcalc-error">{errors['foreign.name']}</span>}</label>
          {scores.exam.foreign.name && field('foreign', '제2외국어·한문', 'grd', '등급', 9, grades)}</div>
      </fieldset>
      {Object.keys(errors).length > 0 && <p className="jcalc-error" role="alert">표시된 항목을 확인해주세요. 아직 입력 내용이 확정되지 않았습니다.</p>}
      {children}
      <div className="jcalc-confirm">
        <div className="jcalc-confirm-actions" data-editing={onCancel ? true : undefined}>
          <CalculatorButton primary type="submit" disabled={confirmDisabled || scores.basis === 'raw' && (!validation.ok || (!confirmed || changed) && !conversion?.ready)}>{confirmLabel || (confirmed ? '입력 성적 확인' : '이 성적으로 시작하기')}</CalculatorButton>
          {onCancel && <CalculatorButton onClick={onCancel}>성적 수정 취소</CalculatorButton>}
        </div>
        <CalculatorNote role="status">{confirmed ? changed ? '성적이 바뀌었어요. 입력 성적을 다시 확인해주세요.' : '입력한 성적을 확인했습니다.' : '모든 필수 항목과 예상 성적을 확인한 뒤 시작해주세요.'}</CalculatorNote>
      </div>
    </form>
  </section>;
}
