import React from 'react';
import { approveCandidateAnalysis, getCandidateAnalysis, runCandidateAnalysis } from '../candidate-analysis-api.js';
import { ANALYSIS_REASON_LABELS, CONFIDENCE_LABELS, RISK_LABELS, buildCandidateRunRequest, canApproveAnalysis, canLinkAnalysis, defaultAnalysisOptions, formatAnalysisNumber, formatAnalysisRange, isCandidateSnapshot, validateAnalysisOptions } from '../candidate-analysis-model.js';

function Choices({ label, choices, value, onChange }) {
  return <label>{label}<select multiple size={Math.min(5, Math.max(2, choices.length))} value={value} onChange={event => onChange([...event.target.selectedOptions].map(option => option.value))}>{choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>여러 항목을 선택할 수 있습니다. 선택하지 않으면 제한하지 않습니다.</small></label>;
}

const WARNING_LABELS = { ACTIVE_DATA_RELEASE_NOT_FOUND: '대학 기준 자료가 아직 준비되지 않았습니다.', PROBABILITY_CALIBRATION_GATE_FAILED: '확률 검증 기준을 충족하지 않아 숫자 확률을 제공하지 않습니다.', DISPLAY_FILTER_REDUCED_CANDIDATES: '확률 표시 범위 때문에 후보 수가 줄었습니다.', MUST_INCLUDE_INELIGIBLE: '필수 후보 중 지원 조건에 맞지 않는 후보가 있습니다.' };
const REASON_LABELS = { PREFERENCE_MATCH: '희망 조건과 일치', MUST_INCLUDE_SELECTED: '상담사가 필수 후보로 지정', RISK_TARGET_SELECTED: '희망 위험 구간에 맞춰 선정', OPTIMIZER_SCORE_SELECTED: '점수와 희망 조건을 종합해 선정', DIVERSITY_RELAXED_SELECTED: '후보 수를 확보하기 위해 분산 조건을 조정', EXCLUDED_BY_REQUEST: '상담사가 제외 후보로 지정', ELIGIBILITY_NOT_SATISFIED: '지원 자격을 충족하지 않음', CONVERSION_NOT_AVAILABLE: '환산점수 계산 불가', PROBABILITY_OUTSIDE_DISPLAY_FILTER: '선택한 확률 표시 범위 밖', PROBABILITY_FILTER_NOT_EVALUABLE: '확률이 없어 표시 범위를 판단할 수 없음', MANUAL_REVIEW_REQUIRED: '상담사 추가 검토 필요', CANONICAL_CONTEXT_MISSING: '기준 자료의 연결 정보 부족', CANDIDATE_DATA_NOT_AVAILABLE: '후보 기준 자료 부족' };
const reasonLabel = code => REASON_LABELS[code] || '세부 기준 추가 검토 필요';

export function AnalysisResults({ analysis, catalog }) {
  if (!analysis) return <p>아직 실행한 분석이 없습니다. 선호와 후보 구성을 확인하고 첫 분석을 실행해주세요.</p>;
  const result = analysis.result;
  return <div className="consulting-analysis-results"><p role="status">{analysis.stale ? '다시 분석해야 하는 결과' : analysis.status === 'approved' ? '검토 승인 완료' : '검토 대기'} · {result.candidates.length}개 후보</p>
    {analysis.staleReasons?.map(code => <p key={code} className="consulting-analysis-alert">{ANALYSIS_REASON_LABELS[code] || '분석 기준이 변경되어 다시 확인해야 합니다.'}</p>)}
    {(result.warnings || []).map((warning, i) => <p key={`${warning.code}-${i}`} className="consulting-analysis-alert">{WARNING_LABELS[warning.code] || '일부 후보나 기준 자료에 추가 검토가 필요합니다.'}</p>)}
    <div className="consulting-analysis-candidates">{result.candidates.map(candidate => <article key={candidate.admissionUnitId}><h3>{candidate.universityName || '대학명 확인 필요'} · {candidate.admissionUnitName || '모집단위 확인 필요'}</h3><p>{({ ga: '가군', na: '나군', da: '다군', other: '기타군' })[candidate.admissionGroup] || '모집군 확인'} · {RISK_LABELS[candidate.riskBand] || '판단 보류'}</p><dl><div><dt>환산점수</dt><dd>{formatAnalysisNumber(candidate.convertedScore)}</dd></div><div><dt>예상컷과 범위</dt><dd>{formatAnalysisRange(candidate.expectedCutoff)}</dd></div><div><dt>합격 가능성과 범위</dt><dd>{candidate.probabilityStatus === 'available' ? formatAnalysisRange(candidate.probability, '%') : '확률 미제공'}</dd></div><div><dt>신뢰도</dt><dd>{CONFIDENCE_LABELS[candidate.confidence] || '평가 불가'}</dd></div></dl><details><summary>환산 과정과 선정 근거</summary>{(candidate.conversionTrace || []).map((step, index) => <p key={`${step.stepId}-${index}`}>{index + 1}단계 · {({ select: '과목 선택', lookup: '변환표 적용', multiply: '비율 반영', add: '합산', subtract: '차감', bonus: '가산', penalty: '감점', round: '반올림' })[step.operation] || '계산'}: {formatAnalysisNumber(step.output)}</p>)}<p>선정 근거: {(candidate.reasonCodes || []).map(reasonLabel).join(' · ') || '등록된 근거 확인 필요'}</p></details></article>)}</div>
    <details><summary>원점수 · 제외 후보 · 분석 기준</summary><h3>검수 성적</h3>{(analysis.input?.scoreSnapshot?.records || []).map((score, index) => <p key={index}>{score.subject} {score.selection || ''} · 표준점수 {formatAnalysisNumber(score.standardScore)} · 백분위 {formatAnalysisNumber(score.percentile)} · {formatAnalysisNumber(score.grade)}등급</p>)}<h3>제외 후보 {result.excluded?.length || 0}개</h3>{(result.excluded || []).map((item, index) => <p key={index}>{catalog?.units.find(unit => unit.id === item.admissionUnitId)?.label || '기준 목록에서 확인할 수 없는 후보'} · {(item.reasonCodes || []).map(reasonLabel).join(' · ')}</p>)}<h3>분석 기준</h3>{Object.entries(result.versions || {}).map(([key, value]) => <p key={key}>{({ dataReleaseId: '대학 자료', modelVersion: '확률 모델', formulaVersion: '환산 기준', eligibilityRuleVersion: '지원 자격', optimizerVersion: '후보 구성' })[key] || '기준'}: {value || '미설정'}</p>)}</details></div>;
}

export function CandidateAnalysisPanel({ binding, caseId, operation, beginOperation, endOperation, beforeRun, onRun, onSnapshot, onLink }) {
  const [state, setState] = React.useState({ status: 'loading', snapshot: null, error: '' });
  const [form, setForm] = React.useState(() => defaultAnalysisOptions());
  const [reason, setReason] = React.useState('');
  const [approvalReason, setApprovalReason] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  const pendingRun = React.useRef(null);
  const controller = React.useRef(null);
  const loadRevision = React.useRef(0);
  const mounted = React.useRef(false);
  const callbacks = React.useRef({ onSnapshot }); callbacks.current = { onSnapshot };
  const load = async ({ resetForm = false } = {}) => {
    const revision = ++loadRevision.current;
    const result = await getCandidateAnalysis(binding, caseId, controller.current?.signal);
    if (!mounted.current || revision !== loadRevision.current) return null;
    if (!result.ok) { setState(value => ({ ...value, status: 'error', error: result.error })); callbacks.current.onSnapshot(null); return null; }
    if (!isCandidateSnapshot(result.data)) { setState({ status: 'error', snapshot: null, error: '분석 화면에 필요한 정보를 확인할 수 없습니다. 운영자에게 문의해주세요.' }); callbacks.current.onSnapshot(null); return null; }
    setState({ status: 'ready', snapshot: result.data, error: '' }); callbacks.current.onSnapshot(result.data);
    if (resetForm) setForm(defaultAnalysisOptions(result.data.analysis?.input));
    return result.data;
  };
  React.useEffect(() => {
    mounted.current = true; controller.current = new AbortController(); setState({ status: 'loading', snapshot: null, error: '' }); pendingRun.current = null;
    load({ resetForm: true });
    return () => { mounted.current = false; ++loadRevision.current; controller.current.abort(); };
  }, [binding, caseId, retry]);
  const p = form.preferences; const o = form.options;
  const setPreference = (key, value) => setForm(current => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  const setOption = (key, value) => setForm(current => ({ ...current, options: { ...current.options, [key]: value } }));
  const perform = async kind => {
    if (!state.snapshot || operation || (kind === 'run' && !beforeRun(state.snapshot)) || !beginOperation(kind)) return;
    setState(value => ({ ...value, error: '' }));
    try {
      let result;
      if (kind === 'run') {
        const signature = JSON.stringify({ form, reason });
        if (!pendingRun.current || pendingRun.current.signature !== signature) {
          const fresh = await getCandidateAnalysis(binding, caseId, controller.current.signal);
          if (!fresh.ok || !isCandidateSnapshot(fresh.data)) throw new Error('현재 분석 기준을 다시 불러오지 못했습니다. 다시 확인해주세요.');
          const data = buildCandidateRunRequest({ caseId, snapshot: fresh.data, form, reason, idempotencyKey: globalThis.crypto.randomUUID() });
          pendingRun.current = { signature, data };
        }
        result = await runCandidateAnalysis(binding, pendingRun.current.data, controller.current.signal);
      } else {
        const a = state.snapshot.analysis;
        const fresh = await getCandidateAnalysis(binding, caseId, controller.current.signal);
        if (!fresh.ok || !isCandidateSnapshot(fresh.data) || !canApproveAnalysis(fresh.data) || fresh.data.analysis.analysisResultId !== a.analysisResultId || fresh.data.analysis.resultDigest !== a.resultDigest) {
          setConfirmed(false); await load(); throw new Error('검토한 분석이 변경되었습니다. 최신 결과를 다시 검토해주세요.');
        }
        result = await approveCandidateAnalysis(binding, { caseId, analysisResultId: a.analysisResultId, expectedCaseRevision: fresh.data.caseRevision, expectedAnalysisRevision: fresh.data.analysisRevision, resultDigest: a.resultDigest, reason: approvalReason.trim() }, controller.current.signal);
      }
      if (!mounted.current) return;
      if (!result.ok) {
        if (result.status === 409) { pendingRun.current = null; callbacks.current.onSnapshot(null); setConfirmed(false); await load(); }
        setState(value => ({ ...value, error: result.status === 409 ? '다른 화면이나 기준 자료가 변경되었습니다. 다시 불러온 결과를 확인해주세요.' : `${result.error} 같은 입력으로 다시 누르면 기존 요청을 확인합니다.` }));
        return;
      }
      pendingRun.current = null; setConfirmed(false); setApprovalReason('');
      await load({ resetForm: true });
      if (kind === 'run' && mounted.current) await onRun();
    } catch (error) { if (mounted.current) setState(value => ({ ...value, error: error.message || '분석 요청을 준비하지 못했습니다.' })); }
    finally { endOperation(); }
  };
  if (state.status !== 'ready') return <section className="consulting-report-workbench consulting-analysis"><h2>후보 분석</h2><p role="status">{state.status === 'loading' ? '분석 기준을 불러오고 있습니다.' : state.error}</p>{state.status === 'error' ? <button type="button" className="consulting-v2-secondary" disabled={Boolean(operation)} onClick={() => setRetry(n => n + 1)}>분석 다시 불러오기</button> : null}</section>;
  const { workspace, analysis } = state.snapshot;
  const runnable = workspace.canRun && workspace.sourceReady && workspace.catalog.units.length > 0 && ['WRITTEN_SESSION_COMPLETED', 'REPORT_GENERATING', 'REPORT_REVIEW'].includes(workspace.workflowState);
  const invalid = validateAnalysisOptions(form, workspace.catalog);
  return <section className="consulting-report-workbench consulting-analysis" aria-busy={Boolean(operation)}><div className="consulting-report-workbench-head"><div><p className="consulting-v2-kicker">상담사 · 관리자</p><h2>후보 분석과 검토</h2></div><button type="button" className="consulting-v2-secondary" disabled={Boolean(operation)} onClick={() => setRetry(n => n + 1)}>분석 새로고침</button></div>
    <p>검수된 성적으로 후보를 계산합니다. 수치는 수정할 수 없으며 검토 승인 후 보고서에 연결합니다.</p><p>조사서 희망: {[...workspace.surveyPreferences.desiredRegions, ...workspace.surveyPreferences.desiredMajors, ...workspace.surveyPreferences.desiredTracks].join(' · ') || '별도 희망 없음'}</p>
    {!workspace.sourceReady ? <p className="consulting-analysis-alert">성적과 조사서 검수를 먼저 완료해주세요.</p> : null}{!workspace.catalog.units.length ? <p className="consulting-analysis-alert">사용할 대학 기준 자료가 없습니다. 자료 등록 후 다시 불러와주세요.</p> : null}
    {!workspace.canRun ? <p>분석 실행 권한이 없습니다. 검토 권한이 있으면 아래 결과를 확인·승인할 수 있습니다.</p> : null}
    <fieldset disabled={Boolean(operation) || !runnable}><legend>선호와 후보 구성</legend><div className="consulting-analysis-grid"><Choices label="희망 지역" choices={workspace.catalog.regions} value={p.regions} onChange={value => setPreference('regions', value)} /><Choices label="희망 계열" choices={workspace.catalog.tracks} value={p.tracks} onChange={value => setPreference('tracks', value)} /><label>전체 후보 수<input type="number" min="3" max="10" value={o.candidateCount} onChange={event => { const count = Number(event.target.value); const third = Math.floor(count / 3); setForm(current => ({ ...current, options: { ...current.options, candidateCount: count, targetBandMix: { stable: third, match: count - 2 * third, reach: third } } })); }} /></label><label>지원 성향<select value={p.riskTolerance} onChange={event => setPreference('riskTolerance', event.target.value)}><option value="safe">안정 우선</option><option value="balanced">균형</option><option value="challenge">도전 우선</option></select></label></div>
    <details><summary>후보 구성 상세 설정</summary><div className="consulting-analysis-grid">{Object.keys(o.targetBandMix).map(key => <label key={key}>{RISK_LABELS[key]} 후보 수<input type="number" min="0" max="10" value={o.targetBandMix[key]} onChange={event => setOption('targetBandMix', { ...o.targetBandMix, [key]: Number(event.target.value) })} /></label>)}{[['minProbability', '표시할 최소 확률 (%)'], ['maxProbability', '표시할 최대 확률 (%)']].map(([key, label]) => <label key={key}>{label}<input type="number" min="0" max="100" value={o[key] ?? ''} onChange={event => setOption(key, event.target.value === '' ? null : Number(event.target.value))} /></label>)}<Choices label="반드시 포함할 후보" choices={workspace.catalog.units} value={p.mustInclude} onChange={value => setPreference('mustInclude', value)} /><Choices label="제외할 후보" choices={workspace.catalog.units} value={p.exclude} onChange={value => setPreference('exclude', value)} /></div><p>확률 범위는 표시할 후보만 제한합니다. 계산된 확률 자체는 바뀌지 않습니다.</p></details><label>분석 실행 사유<textarea maxLength="1000" value={reason} onChange={event => setReason(event.target.value)} placeholder="상담에서 확인한 선호와 후보 구성 사유를 기록하세요." /></label>{invalid ? <p role="status">{invalid}</p> : null}<button type="button" className="consulting-v2-primary" disabled={!runnable || Boolean(operation) || Boolean(invalid) || !reason.trim()} onClick={() => perform('run')}>{operation === 'run' ? '분석 중…' : analysis ? '후보 다시 분석' : '후보 분석 실행'}</button></fieldset>
    <AnalysisResults analysis={analysis} catalog={workspace.catalog} />{analysis ? <div className="consulting-analysis-approval"><label>분석 승인 사유<textarea maxLength="1000" disabled={Boolean(operation) || !canApproveAnalysis(state.snapshot)} value={approvalReason} onChange={event => setApprovalReason(event.target.value)} /></label><label className="consulting-analysis-check"><input type="checkbox" checked={confirmed} disabled={Boolean(operation) || !canApproveAnalysis(state.snapshot)} onChange={event => setConfirmed(event.target.checked)} />점수·예상컷·확률 범위·제외 후보와 유의사항을 검토했습니다.</label><button type="button" className="consulting-v2-primary" disabled={Boolean(operation) || !canApproveAnalysis(state.snapshot) || !approvalReason.trim() || !confirmed} onClick={() => perform('approve')}>{operation === 'approve' ? '승인 중…' : '분석 검토 승인'}</button>{onLink ? <button type="button" className="consulting-v2-secondary" disabled={Boolean(operation) || !canLinkAnalysis(state.snapshot)} onClick={() => onLink(analysis)}>승인한 후보를 보고서에 연결</button> : null}</div> : null}
    {state.error ? <p className="consulting-analysis-alert" role="status">{state.error}</p> : null}</section>;
}
