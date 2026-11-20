import React from 'react';
import { INQUIRY_SUBJECT_GROUPS } from '../../../constants/options.js';
import { scoreChoiceLabel } from '../../analysis/score-model.js';
import { applyScoreConversions, clearConvertedScores, EMPTY_SCORE_METRICS, labelScoreRows, scoreConversionBatch, scoreConversionLabel } from '../score-entry-model.js';
import { convertV2SurveyScores } from '../survey-api.js';
import { FOREIGN_LANGUAGE_SUBJECTS, inquirySubject, isGradeOnlyArea, SPLIT_SCORE_LIMITS, splitRawTotal } from '../survey-model.js';
import { SurveyFieldContext, SurveyFieldScope } from './SurveyFieldScope.jsx';

const optionGroups = {
  korean: [['', ['화법과작문', '언어와매체']]],
  math: [['', ['확률과통계', '미적분', '기하']]],
  inquiry: INQUIRY_SUBJECT_GROUPS
};
const customOption = '__custom__';

function Field({ label, children }) {
  return <label className="consulting-survey-field"><span>{label}</span>{children}</label>;
}

function NumberField({ label, max, value, onChange }) {
  return <Field label={label}><input type="number" inputMode="numeric" min="0" max={max} placeholder={`0–${max}`} value={value ?? ''} onChange={event => {
    const { value: text, valueAsNumber: number } = event.currentTarget;
    if (text === '') onChange(null);
    else if (Number.isInteger(number) && number >= 0 && number <= max) onChange(number);
  }} /></Field>;
}

function ChoiceField({ row, label, change }) {
  const inquiry = row.area === 'inquiry';
  const field = inquiry ? 'subject' : 'selection';
  const value = inquiry ? inquirySubject(row) : row.selection || '';
  const groups = optionGroups[row.area];
  const normalized = scoreChoiceLabel(value);
  const known = groups.some(([, choices]) => choices.includes(normalized));
  const [custom, setCustom] = React.useState(false);
  const showCustom = Boolean(value && !known) || (!value && custom);
  const changeChoice = next => {
    if (next === value) return;
    change({
      [field]: next || (inquiry ? label : ''),
      ...clearConvertedScores(row),
      ...(value ? EMPTY_SCORE_METRICS : {})
    });
  };
  return <>
    <Field label={inquiry ? '탐구 과목' : '선택과목'}><select value={showCustom ? customOption : normalized} onChange={event => {
      const next = event.currentTarget.value;
      setCustom(next === customOption);
      changeChoice(next === customOption ? '' : next);
    }}>
      <option value="">선택해 주세요</option>
      {groups.map(([name, choices]) => name ? <optgroup key={name} label={name}>{choices.map(choice => <option key={choice}>{choice}</option>)}</optgroup> : choices.map(choice => <option key={choice}>{choice}</option>))}
      {inquiry && <option value={customOption}>기타 과목 직접 입력</option>}
      {!inquiry && showCustom && <option value={customOption}>{value}</option>}
    </select></Field>
    {inquiry && showCustom && <Field label="과목명 직접 입력"><input maxLength="40" value={value} onChange={event => changeChoice(event.currentTarget.value)} /></Field>}
  </>;
}

function ScoreCard({ row, label, field, change, lookup, pending }) {
  if (isGradeOnlyArea(row.area)) {
    const foreign = row.area === 'foreign_language';
    return <fieldset className="consulting-score-card" data-survey-field={field}>
      <legend>{label}</legend>
      {foreign && <Field label="응시 과목 (선택)"><select value={row.subject} onChange={event => change({ subject: event.currentTarget.value, grade: null })}>
        <option value="">선택하지 않음</option>
        {FOREIGN_LANGUAGE_SUBJECTS.map(subject => <option key={subject}>{subject}</option>)}
      </select></Field>}
      {(!foreign || row.subject) && <Field label="등급"><select value={row.grade ?? ''} onChange={event => change({ grade: event.currentTarget.value ? Number(event.currentTarget.value) : null })}>
        <option value="">선택해 주세요</option>
        {Array.from({ length: 9 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}등급</option>)}
      </select></Field>}
    </fieldset>;
  }
  const split = SPLIT_SCORE_LIMITS[row.area];
  const total = splitRawTotal(row.commonRawScore, row.electiveRawScore);
  const legacyTotal = row.commonRawScore == null && row.electiveRawScore == null && row.rawScore != null;
  const setSplit = (commonRawScore, electiveRawScore) => change({
    ...clearConvertedScores(row),
    rawScore: splitRawTotal(commonRawScore, electiveRawScore),
    commonRawScore,
    electiveRawScore
  });
  return <fieldset className="consulting-score-card" data-survey-field={field}>
    <legend>{label}</legend>
    {optionGroups[row.area] && <ChoiceField row={row} label={label} change={change} />}
    {split ? <>
      <div className="consulting-score-fields">
        <NumberField label="공통 원점수" max={split[0]} value={row.commonRawScore} onChange={value => setSplit(value, row.electiveRawScore)} />
        <NumberField label="선택 원점수" max={split[1]} value={row.electiveRawScore} onChange={value => setSplit(row.commonRawScore, value)} />
      </div>
      <p className="consulting-score-total">원점수 합계 <strong>{total == null ? '—' : `${total}점`}</strong></p>
      {legacyTotal && <p className="consulting-score-note">이전에 저장한 총점은 {row.rawScore}점이에요. 공통·선택 점수를 입력하면 새 합계로 저장해요.</p>}
    </> : <NumberField label="원점수" max={50} value={row.rawScore} onChange={rawScore => change({ ...clearConvertedScores(row), rawScore })} />}
    <div className="consulting-score-results">{[['standardScore', '표준점수'], ['percentile', '백분위'], ['grade', '등급']].map(([metric, title]) =>
      <Field key={metric} label={title}><input type="text" readOnly value={row[metric] ?? '—'} /></Field>
    )}</div>
    {row.percentile != null && row.grade != null ? <p className="consulting-score-note" role="status">
      {scoreConversionLabel(row) || '원점수 자동환산'}
    </p> : <p className="consulting-score-note" role="status">{pending ? '성적을 자동으로 환산하고 있어요.'
      : lookup?.status === 'board_unavailable' ? '원점수 환산 자료를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.'
        : lookup?.status && lookup.status !== 'converted' ? '해당 원점수 조합을 확인할 수 없어요. 과목과 공통·선택 점수를 확인해 주세요.'
          : '과목과 원점수를 입력하면 표준점수·백분위·등급이 자동으로 표시돼요.'}</p>}
    {row.conversionExamType === 'csat_estimate' && <p className="consulting-score-note">임시 추정치로, 실제 성적표와 다를 수 있어요.</p>}
  </fieldset>;
}

export function ConsultingSurveyScores({ value, update, binding, actionBusy, previousExamScores, autoConvertRaw = true }) {
  const scope = React.useContext(SurveyFieldContext);
  const [lookup, setLookup] = React.useState(null);
  const [retry, setRetry] = React.useState(0);
  const [editedFields, setEditedFields] = React.useState([]);
  const batch = actionBusy ? null : scoreConversionBatch(value, scope, autoConvertRaw, editedFields);
  const batchKey = batch && JSON.stringify(batch);
  React.useEffect(() => {
    if (!batchKey) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      setLookup({ key: batchKey, phase: 'pending' });
      const { examYear, examType, entries } = JSON.parse(batchKey);
      const response = await convertV2SurveyScores(binding, { examYear, examType, records: entries.map(entry => entry.input) });
      const results = response.data?.results;
      if (!active) return;
      if (!response.ok || !Array.isArray(results) || results.length !== entries.length) { setLookup({ key: batchKey, phase: 'error' }); return; }
      setLookup({ key: batchKey, phase: 'done', results });
      update(current => {
        if (JSON.stringify(scoreConversionBatch(current, scope, autoConvertRaw, editedFields)) !== batchKey) return null;
        const records = applyScoreConversions(current.records, entries, results);
        return records ? { records } : null;
      });
    }, 650);
    return () => { active = false; clearTimeout(timer); };
  }, [batchKey, binding, update, scope, autoConvertRaw, editedFields, retry]);

  const labels = labelScoreRows(value.records);
  let inquiryNumber = 0;
  const changeRow = (index, patch, field) => {
    setEditedFields(current => current.includes(field) ? current : [...current, field]);
    update(current => ({ records: current.records.map((row, position) => position === index ? { ...row, ...patch } : row) }));
  };
  return <div className="consulting-score-entry">
    <div className="consulting-score-exam"><span>입력 대상</span><strong>2027학년도 수능</strong></div>
    {previousExamScores && <p className="consulting-score-note" role="status">이번 수능에 응시한 성적을 입력해 주세요. 이전에 다른 시험으로 저장한 점수는 가져오지 않았어요.</p>}
    {!scope && <div className="consulting-score-tools">
      <div className="consulting-score-subhead"><h2>과목별 성적</h2><span className="consulting-score-pill">선택 입력</span></div>
      <p className="consulting-score-note">국어·수학·탐구는 원점수만 입력하면 표준점수·백분위·등급이 자동으로 표시돼요. 영어·한국사는 등급, 제2외국어·한문은 응시했다면 과목과 등급을 선택해 주세요.</p>
    </div>}
    {lookup?.key === batchKey && (lookup.phase === 'error' || lookup.results?.some(result => result.status !== 'converted')) && <div className="consulting-score-lookup" role="status"><p className="consulting-score-note">성적 환산을 완료하지 못했어요. 입력한 원점수는 유지됩니다.</p><button type="button" onClick={() => setRetry(value => value + 1)}>다시 확인</button></div>}
    <div className="consulting-score-list">{value.records.map((row, index) => {
      const field = `scores.${row.area === 'inquiry' ? `inquiry${++inquiryNumber}` : row.area}`;
      const position = batch?.entries.findIndex(entry => entry.index === index) ?? -1;
      const currentLookup = lookup?.key === batchKey && position >= 0;
      return <SurveyFieldScope key={labels[index]} field={field}><ScoreCard row={row} label={labels[index]} field={field} change={patch => changeRow(index, patch, field)}
        lookup={currentLookup ? lookup.results?.[position] : null} pending={currentLookup && lookup.phase === 'pending'} /></SurveyFieldScope>;
    })}</div>
  </div>;
}
