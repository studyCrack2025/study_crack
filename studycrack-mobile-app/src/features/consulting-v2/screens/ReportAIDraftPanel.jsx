import React from 'react';
import { applyReportAIDraft, getReportAIDraft, queueReportAIDraft } from '../report-api.js';
import { formatAnalysisNumber, formatAnalysisRange } from '../candidate-analysis-model.js';

const statusText = { pending: '생성 대기 중입니다. 완성되면 이 화면에 표시됩니다.', processing: 'AI 초안을 생성하고 있습니다.', completed: '검토할 초안이 준비되었습니다.', applied: '검토한 초안을 편집기에 적용했습니다. 내용을 수정한 뒤 검수를 요청해주세요.', failed: 'AI 초안을 만들지 못했습니다. 다시 생성하거나 수동으로 작성할 수 있습니다.', stale: '성적·분석·상담 기록 또는 초안이 변경되었습니다. 최신 내용으로 다시 생성해주세요.' };
export function ReportAIDraftPanel({ binding, caseId, revision, dirty, operation, beginOperation, endOperation, onApplied }) {
  const [state, setState] = React.useState({ data: null, error: '' });
  const [contexts, setContexts] = React.useState([]);
  const [reason, setReason] = React.useState('');
  const [reviewReason, setReviewReason] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const controller = React.useRef(null);
  const loadVersion = React.useRef(0);
  const pendingRequest = React.useRef(null);
  const resultIdentity = React.useRef('');
  const mounted = React.useRef(false);
  const load = async () => {
    const version = ++loadVersion.current;
    const result = await getReportAIDraft(binding, caseId, controller.current?.signal);
    if (!mounted.current || version !== loadVersion.current) return null;
    if (!result.ok || !result.data || !Array.isArray(result.data.contextOptions) || !['caseRevision', 'analysisRevision', 'draftRevision'].every(key => Number.isSafeInteger(result.data[key]))) {
      setState({ data: null, error: result.error || 'AI 초안 상태를 다시 확인해주세요.' }); setConfirmed(false); return null;
    }
    const identity = JSON.stringify([result.data.job?.jobId, result.data.job?.status, result.data.content]);
    if (identity !== resultIdentity.current) { resultIdentity.current = identity; setConfirmed(false); setReviewReason(''); }
    setState({ data: result.data, error: '' });
    return result.data;
  };
  React.useEffect(() => {
    mounted.current = true; controller.current = new AbortController(); load();
    return () => { mounted.current = false; ++loadVersion.current; controller.current.abort(); };
  }, [binding, caseId, revision]);
  React.useEffect(() => {
    if (!['pending', 'processing'].includes(state.data?.job?.status) || operation) return undefined;
    const tick = () => { if (!document.hidden) load(); };
    const timer = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [state.data?.job?.status, operation, binding, caseId]);
  const refresh = async () => { if (!beginOperation('reportAIRefresh')) return; try { await load(); } finally { endOperation(); } };
  const perform = async kind => {
    if (operation || dirty || !state.data || !beginOperation('reportAI')) return;
    try {
      let result;
      if (kind === 'generate') {
        const signature = JSON.stringify([contexts, reason]);
        if (!pendingRequest.current || pendingRequest.current.signature !== signature) {
          const fresh = await load(); if (!fresh?.canGenerate) return;
          pendingRequest.current = { signature, data: { caseId, expectedCaseRevision: fresh.caseRevision, expectedAnalysisRevision: fresh.analysisRevision, expectedDraftRevision: fresh.draftRevision, idempotencyKey: globalThis.crypto.randomUUID(), contextCodes: contexts, reason: reason.trim() } };
        }
        result = await queueReportAIDraft(binding, pendingRequest.current.data, controller.current.signal);
      } else {
        if (!confirmed || !reviewReason.trim() || !state.data.content || !globalThis.confirm('현재 저장된 초안을 검토한 AI 초안으로 교체할까요? 적용 후에도 수정할 수 있습니다.')) return;
        result = await applyReportAIDraft(binding, { caseId, jobId: state.data.job.jobId, expectedCaseRevision: state.data.caseRevision, expectedDraftRevision: state.data.draftRevision, reviewed: true, reason: reviewReason.trim() }, controller.current.signal);
      }
      if (!mounted.current) return;
      if (!result.ok) {
        if (result.status === 409) { pendingRequest.current = null; setConfirmed(false); await load(); }
        setState(value => ({ ...value, error: result.status === 409 ? '기준이 변경되었습니다. 최신 내용으로 다시 확인해주세요.' : `${result.error} 같은 조건으로 다시 누르면 기존 요청을 확인합니다.` })); return;
      }
      pendingRequest.current = null;
      if (kind === 'apply') await onApplied();
      if (mounted.current) await load();
    } finally { endOperation(); }
  };
  const data = state.data, content = data?.content;
  const running = ['pending', 'processing'].includes(data?.job?.status);
  return <section className="consulting-report-workbench consulting-analysis consulting-report-ai" aria-busy={Boolean(operation === 'reportAI')}><div className="consulting-report-workbench-head"><h2>AI 보고서 초안</h2><button type="button" className="consulting-v2-secondary" disabled={Boolean(operation)} onClick={refresh}>AI 초안 새로고침</button></div>
    <p>승인된 분석과 상담에서 확인한 항목으로 초안을 구성합니다. 전체 내용을 검토하고 편집기에 적용한 뒤 수정·검수를 요청해주세요.</p>
    {!data ? <p role="status">{state.error || 'AI 초안 상태를 불러오고 있습니다.'}</p> : <>
      {!data.canGenerate ? <p>승인된 최신 분석과 완료된 상담이 필요하며, 보고서 수정 단계에서 생성할 수 있습니다.</p> : null}
      {dirty ? <p role="status">보고서 수정 내용을 먼저 저장해주세요.</p> : null}
      <fieldset disabled={Boolean(operation) || !data.canGenerate || running || dirty}><legend>상담에서 확인한 항목</legend>{data.contextOptions.map(item => <label key={item.code} className="consulting-analysis-check"><input type="checkbox" checked={contexts.includes(item.code)} onChange={event => setContexts(current => event.target.checked ? item.code === 'NO_EXTRA_CONSTRAINT' ? [item.code] : [...current.filter(code => code !== 'NO_EXTRA_CONSTRAINT'), item.code] : current.filter(code => code !== item.code))} />{item.label}</label>)}<label>AI 초안 생성 사유<textarea maxLength="1000" value={reason} onChange={event => setReason(event.target.value)} /></label><button type="button" className="consulting-v2-primary" disabled={!contexts.length || !reason.trim()} onClick={() => perform('generate')}>{operation === 'reportAI' ? '요청 중…' : 'AI 초안 생성 요청'}</button></fieldset>
      {data.job ? <p role="status">{data.job.lastErrorCode === 'AI_DISABLED' ? 'AI 생성이 비활성화되어 대기 중입니다. 수동 작성은 계속할 수 있습니다.' : statusText[data.job.status] || '초안 상태를 다시 확인해주세요.'}</p> : null}
      {content ? <div className="consulting-report-ai-preview"><h3>{content.title}</h3>{[['executiveSummary', '핵심 요약'], ['scoreAssessment', '성적 판단']].map(([key, label]) => <section key={key}><h4>{label}</h4><p>{content[key]}</p></section>)}{content.candidates.map((c, i) => <section key={c.candidateId || i}><h4>{c.universityName} · {c.admissionUnitName}</h4><p>{c.rationale}</p><p>환산점수 {formatAnalysisNumber(c.convertedScore)} · 예상컷 {formatAnalysisRange(c.expectedCutoff)} · 합격 가능성 {c.probabilityStatus === 'available' ? formatAnalysisRange(c.probability, '%') : '미제공'}</p></section>)}{[['applicationStrategy', '지원 전략'], ['risksAndCautions', '위험 요소와 유의사항'], ['finalCallChecklist', '파이널 콜 확인 항목']].map(([key, label]) => <section key={key}><h4>{label}</h4><p>{content[key]}</p></section>)}<fieldset disabled={Boolean(operation) || dirty}><label className="consulting-analysis-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />초안 전체와 후보·수치·상담 반영 내용을 확인했습니다.</label><label>AI 초안 검토 사유<textarea maxLength="1000" value={reviewReason} onChange={event => setReviewReason(event.target.value)} /></label><button type="button" className="consulting-v2-primary" disabled={!confirmed || !reviewReason.trim()} onClick={() => perform('apply')}>검토한 초안을 편집기에 적용</button></fieldset></div> : null}
      {state.error ? <p className="consulting-analysis-alert" role="status">{state.error}</p> : null}
    </>}
  </section>;
}
