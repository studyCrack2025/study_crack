import React from 'react';
import { listCounselorWrittenSessions } from '../written-session-api.js';
import { approveAdminReport, getAdminReportReview, getCounselorReportDraft } from '../report-api.js';
import { CandidateAnalysisPanel } from './CandidateAnalysisPanel.jsx';
import { CounselorReportEditor } from './CounselorReportEditor.jsx';
import { formatAnalysisNumber, formatAnalysisRange } from '../candidate-analysis-model.js';

function useOperation() {
  const [operation, setOperation] = React.useState('');
  const pending = React.useRef('');
  const beginOperation = React.useCallback(kind => { if (pending.current) return false; pending.current = kind; setOperation(kind); return true; }, []);
  const endOperation = React.useCallback(() => { pending.current = ''; setOperation(''); }, []);
  return { operation, beginOperation, endOperation };
}

function CounselorWorkspace({ binding, caseId }) {
  const [state, setState] = React.useState({ status: 'loading', data: null, error: '' });
  const [epoch, setEpoch] = React.useState(0);
  const [snapshot, setSnapshot] = React.useState(null);
  const [linkRequest, setLinkRequest] = React.useState(null);
  const dirty = React.useRef(false);
  const active = React.useRef(null);
  const lock = useOperation();
  const load = React.useCallback(async () => {
    const signal = active.current.signal;
    const result = await getCounselorReportDraft(binding, caseId, signal);
    if (signal.aborted) return;
    setState(result.ok ? { status: 'ready', data: result.data, error: '' } : { status: 'error', data: null, error: result.error });
    if (result.ok) { setEpoch(n => n + 1); setLinkRequest(null); dirty.current = false; }
  }, [binding, caseId]);
  React.useEffect(() => { active.current = new AbortController(); load(); return () => active.current.abort(); }, [load]);
  const beforeRun = value => !(dirty.current || value.analysis) || globalThis.confirm('다시 분석하면 기존 분석 승인이 해제되고 보고서를 다시 확인해야 합니다. 저장하지 않은 보고서 수정은 사라질 수 있습니다. 계속하시겠습니까?');
  const refresh = async () => {
    if (lock.operation || (dirty.current && !globalThis.confirm('저장하지 않은 보고서 수정을 버리고 다시 불러올까요?')) || !lock.beginOperation('refresh')) return;
    try { await load(); } finally { lock.endOperation(); }
  };
  return <><CandidateAnalysisPanel binding={binding} caseId={caseId} {...lock} beforeRun={beforeRun} onRun={load} onSnapshot={setSnapshot} onLink={state.status === 'ready' && ['WRITTEN_SESSION_COMPLETED', 'REPORT_GENERATING'].includes(state.data.workflowState) ? analysis => {
    if (globalThis.confirm('보고서의 지원 후보를 승인된 분석 후보로 교체하시겠습니까?')) setLinkRequest({ ...analysis });
  } : undefined} />
  <div className="consulting-analysis-refresh"><button type="button" className="consulting-v2-secondary" disabled={Boolean(lock.operation)} onClick={refresh}>보고서 다시 불러오기</button></div>
  {state.status === 'ready' ? <CounselorReportEditor key={epoch} binding={binding} caseId={caseId} initial={state.data.draft} transcriptHash={state.data.transcriptHash} workflowState={state.data.workflowState} snapshot={snapshot} linkRequest={linkRequest} {...lock} onDirty={value => { dirty.current = value; }} onSubmitted={() => setState(value => ({ ...value, data: { ...value.data, workflowState: 'REPORT_REVIEW' } }))} /> : <section className="consulting-report-workbench"><h1>보고서 작성</h1><p role="status">{state.error || '보고서를 불러오고 있습니다.'}</p></section>}</>;
}

export function CounselorReport({ binding }) {
  const queryCaseId = new URLSearchParams(globalThis.location?.search || '').get('caseId') || '';
  const [state, setState] = React.useState({ status: 'loading', sessions: [], error: '' });
  const [caseId, setCaseId] = React.useState(queryCaseId);
  React.useEffect(() => {
    const controller = new AbortController();
    listCounselorWrittenSessions(binding, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const sessions = (result.data?.sessions || []).filter(item => item.status === 'completed');
      setState({ status: result.ok ? 'ready' : 'error', sessions, error: result.error || '' });
      if (!caseId && sessions[0]) setCaseId(sessions[0].caseId);
    });
    return () => controller.abort();
  }, [binding]);
  return <main className="consulting-report"><header><button type="button" onClick={() => globalThis.location.assign('/mypage/tutor')}>← 상담사 페이지</button><strong>정시 분석·보고서</strong><select aria-label="학생 케이스 선택" value={caseId} onChange={event => { if (globalThis.confirm('다른 학생으로 이동하시겠습니까? 저장하지 않은 내용은 사라집니다.')) setCaseId(event.target.value); }}><option value="" disabled>학생 선택</option>{queryCaseId && !state.sessions.some(item => item.caseId === queryCaseId) ? <option value={queryCaseId}>선택한 케이스</option> : null}{state.sessions.map(item => <option key={item.caseId} value={item.caseId}>{item.caseId.slice(-8)}</option>)}</select></header>
    {caseId ? <CounselorWorkspace key={caseId} binding={binding} caseId={caseId} /> : <section className="consulting-report-workbench"><h1>분석할 상담을 선택해주세요</h1><p role="status">{state.status === 'loading' ? '완료된 상담을 불러오는 중입니다.' : state.error || '완료된 서면상담이 없습니다.'}</p></section>}</main>;
}

export function AdminReport({ binding }) {
  const caseId = new URLSearchParams(globalThis.location?.search || '').get('caseId') || '';
  const [state, setState] = React.useState({ status: 'loading', data: null, error: '' });
  const [snapshot, setSnapshot] = React.useState(null);
  const [releaseAt, setReleaseAt] = React.useState('');
  const [approved, setApproved] = React.useState(false);
  const lock = useOperation();
  const active = React.useRef(null);
  const load = React.useCallback(async () => {
    const signal = active.current.signal;
    const result = await getAdminReportReview(binding, caseId, signal);
    if (!signal.aborted) { setState(result.ok ? { status: 'ready', data: result.data, error: '' } : { status: 'error', data: null, error: result.error }); setApproved(false); }
  }, [binding, caseId]);
  React.useEffect(() => { active.current = new AbortController(); if (caseId) load(); return () => active.current.abort(); }, [load, caseId]);
  const stale = Boolean(state.data?.draft?.analysisStale || (state.data?.draft?.analysisResultId && (!snapshot || snapshot.analysis?.stale || snapshot.analysis?.status !== 'approved' || snapshot.analysis?.analysisResultId !== state.data.draft.analysisResultId)));
  const approve = async () => {
    if (!releaseAt || approved || stale || lock.operation || !globalThis.confirm('이 보고서를 승인하고 선택한 시각에 공개하도록 예약할까요?') || !lock.beginOperation('publish')) return;
    try {
      const date = new Date(releaseAt);
      if (Number.isNaN(date.getTime())) { setState(value => ({ ...value, error: '공개 시각을 확인해주세요.' })); return; }
      const result = await approveAdminReport(binding, { caseId, releaseAt: date.toISOString() });
      if (active.current.signal.aborted) return;
      if (result.ok) setApproved(true);
      setState(value => ({ ...value, error: result.ok ? '승인 완료 · 선택한 시각에 공개 예정입니다.' : `${result.error} 보고서와 분석을 다시 불러와 확인해주세요.` }));
    } finally { lock.endOperation(); }
  };
  const content = state.data?.draft?.content;
  return <main className="consulting-report"><header><button type="button" onClick={() => globalThis.location.assign('/admin_index.html')}>← 관리자</button><strong>정시 분석·보고서 검수</strong></header>
    {caseId ? <CandidateAnalysisPanel key={caseId} binding={binding} caseId={caseId} {...lock} beforeRun={value => !value.analysis || globalThis.confirm('기존 분석 승인을 해제하고 보고서를 다시 검토하도록 변경할까요?')} onRun={load} onSnapshot={setSnapshot} /> : null}
    <article className="consulting-report-document"><h1>{content?.title || '보고서 검수'}</h1>{!caseId ? <p>관리자 정시 컨설팅 메뉴에서 케이스를 선택해주세요.</p> : state.status === 'loading' ? <p>보고서를 불러오고 있습니다.</p> : !content ? <p>{state.error || '상담사가 보고서 검수를 요청하면 이곳에서 확인할 수 있습니다.'}</p> : <><section><h2>핵심 요약</h2><p>{content.executiveSummary}</p></section><section><h2>성적 판단</h2><p>{content.scoreAssessment}</p></section><div className="consulting-report-candidates">{content.candidates.map((item, index) => <article key={item.candidateId || index}><h3>{item.universityName} · {item.admissionUnitName}</h3><p>{item.rationale}</p><p>환산점수 {formatAnalysisNumber(item.convertedScore)} · 예상컷 {formatAnalysisRange(item.expectedCutoff)} · 합격 가능성 {item.probabilityStatus === 'available' ? formatAnalysisRange(item.probability, '%') : '미제공'}</p></article>)}</div>{[['applicationStrategy', '지원 전략'], ['risksAndCautions', '위험 요소와 유의사항'], ['finalCallChecklist', '파이널 콜 확인 항목']].map(([key, label]) => <section key={key}><h2>{label}</h2><p>{content[key]}</p></section>)}{stale ? <p className="consulting-analysis-alert">연결된 분석을 다시 확인·승인하고 보고서 검수를 요청해야 합니다.</p> : null}<label className="consulting-report-release">공개 시각 (기기 현지 시각)<input type="datetime-local" disabled={approved || Boolean(lock.operation)} value={releaseAt} onChange={event => setReleaseAt(event.target.value)} /></label><button className="consulting-v2-primary consulting-v2-wide" type="button" disabled={approved || stale || Boolean(lock.operation) || !releaseAt || state.data.workflowState !== 'REPORT_REVIEW'} onClick={approve}>{approved ? '승인 완료' : lock.operation === 'publish' ? '승인 중…' : '승인하고 공개 예약'}</button></>}{state.error && content ? <p role="status">{state.error}</p> : null}</article></main>;
}
