import React from 'react';
import { INQUIRY_SUBJECT_GROUPS } from '../../../constants/options.js';
import { scoreChoiceLabel } from '../../analysis/score-model.js';
import { applyScoreConversions, canConvertExam, clearConvertedScores, EMPTY_SCORE_METRICS, hasReportMetrics, isAbsoluteScore, labelScoreRows, photoScorePatches, rawScoreMax, scoreConversionBatch, SCORE_METRICS, splitLimits } from '../score-entry-model.js';
import { convertV2SurveyScores, readV2ScorePhoto } from '../survey-api.js';
import { SurveyScoreFiles } from './SurveyScoreFiles.jsx';

const optionGroups = {
  korean: [['', ['화법과작문', '언어와매체']]],
  math: [['', ['확률과통계', '미적분', '기하']]],
  inquiry: INQUIRY_SUBJECT_GROUPS
};
const customOption = '__custom__';
const examTypes = [['csat', '수능'], ['june_mock', '6월 모의평가'], ['september_mock', '9월 모의평가'], ['other', '기타']];
const scoreNotes = {
  subject_required: '선택과목을 고르면 환산할 수 있어요.',
  split_required: '같은 총점에서도 결과가 달라질 수 있어요. 공통·선택 원점수를 입력해 주세요.',
  invalid_split: '공통·선택 점수의 합이 원점수와 같은지 확인해 주세요.',
  board_unavailable: '이 시험의 원점수 환산 자료가 없습니다. 성적표 수치를 직접 입력해 주세요.',
  score_unavailable: '환산표에 맞는 점수가 없습니다. 성적표 수치를 직접 입력해 주세요.'
};

function Field({ label, children }) {
  return <label className="consulting-survey-field"><span>{label}</span>{children}</label>;
}

function NumberField({ label, min = 0, max, value, onChange }) {
  return <Field label={label}><input type="number" inputMode="numeric" min={min} max={max} placeholder="–" value={value ?? ''} onChange={event => {
    const { value: text, valueAsNumber: number } = event.currentTarget;
    if (text === '') onChange(null);
    else if (Number.isInteger(number) && number >= min && number <= max) onChange(number);
  }} /></Field>;
}

function ChoiceField({ row, label, change }) {
  const field = row.area === 'inquiry' ? 'subject' : 'selection';
  const value = row[field] === label ? '' : row[field] || '';
  const groups = optionGroups[row.area];
  const normalized = scoreChoiceLabel(value);
  const known = groups.some(([, choices]) => choices.includes(normalized));
  const [custom, setCustom] = React.useState(false);
  const showCustom = Boolean(value && !known) || (!value && custom);
  const changeChoice = next => {
    if (next === value) return;
    change(value ? { [field]: next, ...EMPTY_SCORE_METRICS, rawScore: null, commonRawScore: null, electiveRawScore: null, convertedFromRaw: undefined, confirmed: false } : { [field]: next, confirmed: false });
  };
  return <>
    <Field label={row.area === 'inquiry' ? '탐구 과목' : '선택과목'}><select value={showCustom ? customOption : normalized} onChange={event => {
      const next = event.target.value;
      setCustom(next === customOption);
      changeChoice(next === customOption ? '' : next);
    }}>
      <option value="">선택해 주세요</option>
      {groups.map(([name, choices]) => name ? <optgroup key={name} label={name}>{choices.map(choice => <option key={choice}>{choice}</option>)}</optgroup> : choices.map(choice => <option key={choice}>{choice}</option>))}
      <option value={customOption}>기타 과목 직접 입력</option>
    </select></Field>
    {showCustom && <Field label="과목명 직접 입력"><input maxLength="40" value={value} onChange={event => changeChoice(event.target.value)} /></Field>}
  </>;
}

function ScoreCard({ row, label, rawMode, change, status, showSplit }) {
  const split = splitLimits[row.area];
  const setRaw = rawScore => change({ ...clearConvertedScores(row), rawScore, commonRawScore: null, electiveRawScore: null });
  const metrics = isAbsoluteScore(row.area) ? SCORE_METRICS.slice(-1) : SCORE_METRICS;
  return <fieldset className="consulting-score-card">
    <legend>{label}{row.area === 'korean_history' && <span>선택 입력</span>}</legend>
    {(optionGroups[row.area] || rawMode) && <div className="consulting-score-fields">
      {optionGroups[row.area] && <ChoiceField row={row} label={label} change={change} />}
      {rawMode && <NumberField label="원점수" max={rawScoreMax(row.area)} value={row.rawScore} onChange={setRaw} />}
    </div>}
    {rawMode && split && showSplit && <div className="consulting-score-fields">
      <NumberField label="공통 원점수" max={split[0]} value={row.commonRawScore} onChange={value => change({ ...clearConvertedScores(row), commonRawScore: value })} />
      <NumberField label="선택 원점수" max={split[1]} value={row.electiveRawScore} onChange={value => change({ ...clearConvertedScores(row), electiveRawScore: value })} />
    </div>}
    {rawMode && status && scoreNotes[status] && <p className="consulting-score-note">{scoreNotes[status]}</p>}
    <div className="consulting-score-metrics" data-absolute={isAbsoluteScore(row.area) || undefined}>
      {metrics.map(([key, name, min, max]) => <NumberField key={key} label={name} min={min} max={max} value={row[key]} onChange={value => change({ [key]: value, convertedFromRaw: undefined, confirmed: false })} />)}
    </div>
    <div className="consulting-score-card-end">
      <label className="consulting-survey-check"><input type="checkbox" checked={row.confirmed} disabled={row.grade == null} onChange={event => change({ confirmed: event.target.checked })} />성적표와 확인</label>
      {row.convertedFromRaw && <span className="consulting-score-pill">원점수 환산</span>}
    </div>
  </fieldset>;
}

function PhotoInput({ binding, caseId, value, update, fileActions }) {
  const [reading, setReading] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [notice, setNotice] = React.useState('');
  const request = React.useRef(null);
  React.useEffect(() => () => { request.current = null; }, []);
  const basis = `${value.examType}:${value.examYear}`;
  const currentPreview = preview?.basis === basis && fileActions.files.some(file => file.fileId === preview.fileId && file.status === 'ready') ? preview : null;
  const patches = currentPreview ? photoScorePatches(currentPreview.records, value.records) : [];
  const read = async file => {
    if (request.current || !canConvertExam(value)) return;
    const run = {};
    request.current = run;
    setReading(true);
    setNotice('');
    setPreview(null);
    const result = await readV2ScorePhoto(binding, { caseId, fileId: file.fileId });
    if (request.current !== run) return;
    request.current = null;
    setReading(false);
    if (!result.ok) return setNotice(result.error);
    const records = Array.isArray(result.data.records) ? result.data.records : [];
    if (!records.length) return setNotice('읽을 수 있는 수치가 없어요. 더 선명한 사진을 쓰거나 직접 입력해 주세요.');
    setPreview({ basis, fileId: file.fileId, records, skipped: [] });
  };
  const apply = () => {
    const selected = patches.filter(({ index }) => !currentPreview.skipped.includes(index));
    update(current => ({ records: current.records.map((row, index) => {
      const patch = selected.find(item => item.index === index)?.patch;
      return patch ? { ...row, ...patch } : row;
    }) }));
    setNotice(`${selected.length}과목의 수치를 반영했어요. 성적표와 맞는지 확인해 주세요.`);
    setPreview(null);
  };
  return <details className="consulting-score-photo">
    <summary><span aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 4h8l2 3h3v13H3V7h3z" /><circle cx="12" cy="13" r="3.5" /></svg></span><span><strong>사진에서 성적 읽기</strong><small>성적표를 올리고 읽어낸 값을 확인해 주세요.</small></span></summary>
    <div className="consulting-score-photo-body">
      {!canConvertExam(value) && <p className="consulting-score-note">먼저 해당 수능 또는 6·9월 모의평가와 응시 연도를 선택해 주세요.</p>}
      <SurveyScoreFiles {...fileActions} onRead={read} readDisabled={reading || !canConvertExam(value)} />
      {reading && <p className="consulting-score-note" role="status">사진의 성적표를 읽고 있어요.</p>}
      {notice && <p className="consulting-score-note" role="status">{notice}</p>}
      {patches.length > 0 && <div className="consulting-score-preview">
        <strong>사진에서 읽은 성적</strong>
        <p>시험과 수치를 성적표에서 확인하고, 반영할 과목을 선택해 주세요. 표시된 수치가 입력값에 반영됩니다.</p>
        {patches.map(({ index, label, choice, metrics }) => <label key={index} className="consulting-survey-check">
          <input type="checkbox" checked={!currentPreview.skipped.includes(index)} onChange={event => {
            const checked = event.currentTarget.checked;
            setPreview(previous => ({ ...previous, skipped: checked ? previous.skipped.filter(item => item !== index) : [...previous.skipped, index] }));
          }} />
          <span><strong>{label}{choice ? ` · ${choice}` : ''}</strong><small>{SCORE_METRICS.filter(([key]) => metrics[key] != null).map(([key, name]) => `${name} ${metrics[key]}`).join(' · ')}</small></span>
        </label>)}
        <button className="consulting-v2-primary" type="button" disabled={patches.every(({ index }) => currentPreview.skipped.includes(index))} onClick={apply}>선택한 성적 반영</button>
      </div>}
    </div>
  </details>;
}

export function ConsultingSurveyScores({ value, update, binding, caseId, fileActions, actionBusy }) {
  const [mode, setMode] = React.useState(() => value.records.some(row => row.rawScore != null) || !value.records.some(hasReportMetrics) ? 'raw' : 'report');
  const [lookup, setLookup] = React.useState(null);
  const [retry, setRetry] = React.useState(0);
  const rawMode = mode === 'raw';
  const batch = rawMode && !actionBusy ? scoreConversionBatch(value) : null;
  const batchKey = batch && JSON.stringify(batch);
  React.useEffect(() => {
    if (!batchKey) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      const { examYear, examType, entries } = JSON.parse(batchKey);
      setLookup(previous => ({ key: batchKey, loading: true, rows: previous?.rows }));
      const response = await convertV2SurveyScores(binding, { examYear, examType, records: entries.map(entry => entry.input) });
      if (!active) return;
      const results = response.data?.results;
      if (!response.ok || !Array.isArray(results) || results.length !== entries.length) {
        setLookup({ key: batchKey, error: response.error || '자동 환산을 잠시 이용할 수 없습니다.' });
        return;
      }
      setLookup({ key: batchKey, rows: Object.fromEntries(entries.map(({ index, input }, order) => [index, { ...input, status: results[order]?.status }])) });
      update(current => {
        if (JSON.stringify(scoreConversionBatch(current)) !== batchKey) return null;
        const records = applyScoreConversions(current.records, entries, results);
        return records ? { records } : null;
      });
    }, 650);
    return () => { active = false; clearTimeout(timer); };
  }, [batchKey, binding, retry, update]);

  const labels = labelScoreRows(value.records);
  const confirmed = value.records.filter(row => row.confirmed && row.grade != null).length;
  const changeBasis = patch => update(current => ({ ...patch, records: current.examType ? current.records.map(clearConvertedScores) : current.records }));
  const changeRow = (index, patch) => update(current => ({ records: current.records.map((row, position) => position === index ? { ...row, ...patch } : row) }));
  return <div className="consulting-score-entry">
    <div className="consulting-score-tools">
      <h2>어떤 시험을 봤나요?</h2>
      <div className="consulting-score-fields">
        <Field label="시험 종류"><select value={value.examType} onChange={event => changeBasis({ examType: event.target.value })}><option value="">선택해 주세요</option>{examTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="응시 연도"><select value={value.examYear ?? ''} onChange={event => changeBasis({ examYear: Number(event.target.value) })}><option value="" disabled>선택해 주세요</option>{[2025, 2026, 2027].map(year => <option key={year} value={year}>{year}년{value.examType === 'csat' ? ` · ${year + 1}학년도` : ''}</option>)}</select></Field>
      </div>
    </div>
    <PhotoInput key={`${value.examType}:${value.examYear}`} binding={binding} caseId={caseId} value={value} update={update} fileActions={fileActions} />
    <div className="consulting-score-tools">
      <div className="consulting-score-subhead"><h2>과목별 성적</h2><span className="consulting-score-pill">{confirmed}/{value.records.length}과목 확인</span></div>
      <div className="consulting-score-mode" role="group" aria-label="성적 입력 방식">
        <button type="button" aria-pressed={rawMode} onClick={() => setMode('raw')}>원점수로 입력</button>
        <button type="button" aria-pressed={!rawMode} onClick={() => setMode('report')}>성적표 수치 직접 입력</button>
      </div>
      <p className="consulting-score-note">{rawMode ? '시험과 과목을 고르고 원점수를 입력하면, 환산 자료가 있는 과목의 수치를 채워드려요.' : '성적표에 적힌 수치를 입력하고, 과목별로 성적표와 확인을 눌러주세요.'}</p>
      {rawMode && value.examType && !canConvertExam(value) && <p className="consulting-score-note">이 시험은 자동 환산이 제공되지 않습니다. 성적표 수치를 입력해 주세요.</p>}
      {batchKey && lookup?.key === batchKey && lookup.loading && <p className="consulting-score-note" role="status">원점수를 환산하고 있어요.</p>}
      {batchKey && lookup?.key === batchKey && lookup.error && <div className="consulting-score-lookup"><p className="consulting-score-note" role="status">{lookup.error}</p><button type="button" className="consulting-v2-secondary" onClick={() => setRetry(value => value + 1)}>다시 환산</button></div>}
    </div>
    <div className="consulting-score-list">{value.records.map((row, index) => {
      const previous = lookup?.rows?.[index];
      const sameRaw = previous && previous.rawScore === row.rawScore && previous.subject === row.subject && previous.selection === row.selection;
      const status = sameRaw && lookup?.key === batchKey && !lookup.loading ? previous.status : '';
      const showSplit = row.commonRawScore != null || row.electiveRawScore != null || (sameRaw && previous.status === 'split_required');
      return <ScoreCard key={`${row.area}-${index}`} row={row} label={labels[index]} rawMode={rawMode} change={patch => changeRow(index, patch)} status={status} showSplit={showSplit} />;
    })}</div>
  </div>;
}
