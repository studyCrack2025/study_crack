import React from 'react';
import { INQUIRY_SUBJECT_GROUPS } from '../../../constants/options.js';
import { scoreChoiceLabel } from '../../analysis/score-model.js';
import { applyScoreConversions, clearConvertedScores, EMPTY_SCORE_METRICS, labelScoreRows, photoGradeSuggestions, scoreConversionBatch } from '../score-entry-model.js';
import { convertV2SurveyScores } from '../survey-api.js';
import { FOREIGN_LANGUAGE_SUBJECTS, inquirySubject, isGradeOnlyArea, SPLIT_SCORE_LIMITS, splitRawTotal } from '../survey-model.js';
import { SurveyScoreFiles } from './SurveyScoreFiles.jsx';

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

function ScoreCard({ row, label, change }) {
  if (isGradeOnlyArea(row.area)) {
    const foreign = row.area === 'foreign_language';
    return <fieldset className="consulting-score-card">
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
  return <fieldset className="consulting-score-card">
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
  </fieldset>;
}

export function ConsultingSurveyScores({ value, update, binding, fileActions, actionBusy, previousExamScores }) {
  const batch = actionBusy ? null : scoreConversionBatch(value);
  const batchKey = batch && JSON.stringify(batch);
  React.useEffect(() => {
    if (!batchKey) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      const { examYear, examType, entries } = JSON.parse(batchKey);
      const response = await convertV2SurveyScores(binding, { examYear, examType, records: entries.map(entry => entry.input) });
      const results = response.data?.results;
      if (!active || !response.ok || !Array.isArray(results) || results.length !== entries.length) return;
      update(current => {
        if (JSON.stringify(scoreConversionBatch(current)) !== batchKey) return null;
        const records = applyScoreConversions(current.records, entries, results);
        return records ? { records } : null;
      });
    }, 650);
    return () => { active = false; clearTimeout(timer); };
  }, [batchKey, binding, update]);

  const labels = labelScoreRows(value.records);
  const changeRow = (index, patch) => update(current => ({
    records: current.records.map((row, position) => position === index ? { ...row, ...patch } : row)
  }));
  const applyPhotoGrades = photo => update(current => {
    const suggestions = photoGradeSuggestions(current.records, photo);
    if (!suggestions.length) return null;
    const patches = new Map(suggestions.map(({ area, patch }) => [area, patch]));
    return { records: current.records.map(row => patches.has(row.area) ? { ...row, ...patches.get(row.area) } : row) };
  });
  return <div className="consulting-score-entry">
    <div className="consulting-score-exam"><span>입력 대상</span><strong>2027학년도 수능</strong></div>
    {previousExamScores && <p className="consulting-score-note" role="status">이번 수능에 응시한 성적을 입력해 주세요. 이전에 다른 시험으로 저장한 점수는 가져오지 않았어요.</p>}
    <SurveyScoreFiles {...fileActions} scores={value.records} onApplyPhotoGrades={applyPhotoGrades} />
    <div className="consulting-score-tools">
      <div className="consulting-score-subhead"><h2>과목별 성적</h2><span className="consulting-score-pill">선택 입력</span></div>
      <p className="consulting-score-note">국어·수학·탐구는 원점수, 영어·한국사는 등급을 적어주세요. 제2외국어·한문은 응시했다면 과목과 등급을 선택해 주세요.</p>
    </div>
    <div className="consulting-score-list">{value.records.map((row, index) =>
      <ScoreCard key={labels[index]} row={row} label={labels[index]} change={patch => changeRow(index, patch)} />
    )}</div>
  </div>;
}
