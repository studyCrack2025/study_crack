import React from 'react';
import { FOREIGN_LANGUAGE_SUBJECTS, SUBJECTS } from './calculator-model.js';

function ScoreField({ subject, metric, title, label, value, max, error, choices, onChange }) {
  const id = `jcalc-${subject}-${metric}`;
  return <label className="jcalc-field" htmlFor={id}>
    <span>{label}{max && <small>{metric === 'grd' ? '1~9등급' : `0~${max}${metric === 'pct' ? '' : '점'}`}</small>}</span>
    {choices ? <select id={id} aria-label={`${title} ${label}`} value={value ?? ''} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={event => onChange(event.currentTarget.value)}>
      <option value="">{metric === 'grd' ? '선택' : '선택해주세요'}</option>{choices.map(choice => <option key={choice} value={choice}>{metric === 'grd' ? `${choice}등급` : choice}</option>)}
    </select> : <input id={id} aria-label={`${title} ${label}`} inputMode="numeric" type="text" pattern="[0-9]*" maxLength="3" autoComplete="off" placeholder={metric === 'pct' ? '백분위' : '점수'} value={value ?? ''} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={event => onChange(event.currentTarget.value)} />}
    {error && <span id={`${id}-error`} className="jcalc-error">{error}</span>}
  </label>;
}

export default function CalculatorScoreForm({ scores, errors, changed, confirmed, onChange, onConfirm }) {
  const setField = (subject, metric, value) => onChange({ ...scores, exam: { ...scores.exam, [subject]: { ...scores.exam[subject], [metric]: value } } });
  const field = (subject, title, metric, label, max, choices) => <ScoreField key={metric} subject={subject} metric={metric} title={title} label={label} max={max} choices={choices} value={scores.exam[subject][metric]} error={errors[`${subject}.${metric}`]} onChange={value => setField(subject, metric, value)} />;
  const grades = Array.from({ length: 9 }, (_, index) => String(index + 1));
  return <section className="jcalc-panel" aria-labelledby="jcalc-score-title">
    <div className="jcalc-section-head"><div><p className="jcalc-eyebrow">01 · 내 성적</p><h2 id="jcalc-score-title">2027학년도 수능 성적</h2></div><span className="jcalc-badge">학년도 고정</span></div>
    <form noValidate onSubmit={event => { event.preventDefault(); onConfirm(); }}>
      <fieldset className="jcalc-basis"><legend>어떤 성적을 입력하시나요?</legend>{[['official', '성적표 기준'], ['raw', '가채점 원점수']].map(([value, label]) => <label key={value}><input type="radio" name="jcalc-score-basis" value={value} checked={scores.basis === value} onChange={() => onChange({ ...scores, basis: value })} /><span>{label}</span></label>)}</fieldset>
      <p className="jcalc-note">{scores.basis === 'official' ? '성적표에 적힌 표준점수·백분위·등급을 그대로 입력해주세요.' : '국어·수학은 공통과 선택 점수를 나누어 적어주세요. 검증된 2027 수능 변환 자료가 연결되기 전에는 표준점수·백분위를 추정하지 않습니다.'}</p>
      {errors.basis && <p className="jcalc-error" role="alert">{errors.basis}</p>}
      <div className="jcalc-subjects">{SUBJECTS.map(([key, title, options, limits]) => <fieldset key={key} className="jcalc-subject"><legend>{title}</legend>
        {field(key, title, limits ? 'opt' : 'name', '선택과목', null, options)}
        <div className="jcalc-metrics">{scores.basis === 'official' ? <>
          {field(key, title, 'std', '표준점수', 200)}{field(key, title, 'pct', '백분위', 100)}{field(key, title, 'grd', '등급', 9, grades)}
        </> : limits ? <>
          {field(key, title, 'common', '공통 원점수', limits[0])}{field(key, title, 'elective', '선택 원점수', limits[1])}
        </> : field(key, title, 'raw', '원점수', 50)}</div>
      </fieldset>)}</div>
      <div className="jcalc-grades">{[['eng', '영어'], ['hist', '한국사']].map(([key, title]) => <fieldset className="jcalc-subject" key={key}><legend>{title}</legend>{field(key, title, 'grd', '등급', 9, grades)}</fieldset>)}</div>
      <fieldset className="jcalc-subject"><legend>제2외국어·한문 <small>선택 입력</small></legend>
        <div className="jcalc-grades"><label className="jcalc-field"><span>응시 과목</span><select aria-label="제2외국어·한문 응시 과목" value={scores.exam.foreign.name} onChange={event => onChange({ ...scores, exam: { ...scores.exam, foreign: { name: event.currentTarget.value, grd: '' } } })}><option value="">응시하지 않음</option>{FOREIGN_LANGUAGE_SUBJECTS.map(subject => <option key={subject}>{subject}</option>)}</select>{errors['foreign.name'] && <span className="jcalc-error">{errors['foreign.name']}</span>}</label>
          {scores.exam.foreign.name && field('foreign', '제2외국어·한문', 'grd', '등급', 9, grades)}</div>
      </fieldset>
      {Object.keys(errors).length > 0 && <p className="jcalc-error" role="alert">표시된 항목을 확인해주세요. 아직 입력 내용이 확정되지 않았습니다.</p>}
      <div className="jcalc-confirm"><button className="jcalc-primary" type="submit">입력 성적 확인</button><p className="jcalc-note" role="status">{confirmed ? changed ? '성적이 바뀌었어요. 입력 성적을 다시 확인해주세요.' : '입력한 성적을 확인했습니다.' : '모든 필수 항목을 입력한 뒤 확인해주세요.'}</p></div>
    </form>
  </section>;
}
