import React from 'react';
import { saveCounselorReportDraft, submitCounselorReportReview } from '../report-api.js';
import { canLinkAnalysis, candidatesForReport, formatAnalysisNumber, formatAnalysisRange } from '../candidate-analysis-model.js';

const blankCandidate = () => ({ universityName: '', admissionUnitName: '', admissionGroup: '', riskBand: 'manual_review', rationale: '' });
const blankContent = () => ({ title: '2027 정시 지원 전략 보고서', executiveSummary: '', scoreAssessment: '', candidates: [blankCandidate()], applicationStrategy: '', risksAndCautions: '', finalCallChecklist: '' });

export function CounselorReportEditor({ binding, caseId, initial, transcriptHash, workflowState, snapshot, linkRequest, operation, beginOperation, endOperation, onDirty, onSubmitted }) {
  const [content, setContent] = React.useState(initial?.content || blankContent());
  const [linkedId, setLinkedId] = React.useState(initial?.analysisResultId || null);
  const [draftRevision, setDraftRevision] = React.useState(Number(initial?.draftRevision || 0));
  const [fallback, setFallback] = React.useState(initial?.analysisFallback || { status: 'manual_review', reason: '' });
  const [feedback, setFeedback] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [editRevision, setEditRevision] = React.useState(0);
  const [autosavePaused, setAutosavePaused] = React.useState(false);
  const savedRevision = React.useRef(0);
  const editable = !submitted && !['review', 'approved'].includes(initial?.status) && ['WRITTEN_SESSION_COMPLETED', 'REPORT_GENERATING'].includes(workflowState);
  const linkedBlocked = Boolean(linkedId && (!canLinkAnalysis(snapshot) || snapshot.analysis.analysisResultId !== linkedId));
  const touch = () => { setEditRevision(value => value + 1); setAutosavePaused(false); onDirty(true); };
  const field = (key, value) => { setContent(current => ({ ...current, [key]: value })); touch(); };
  const candidate = (index, key, value) => { setContent(current => ({ ...current, candidates: current.candidates.map((item, i) => i === index ? { ...item, [key]: value } : item) })); touch(); };
  React.useEffect(() => {
    if (!linkRequest) return;
    setLinkedId(linkRequest.analysisResultId);
    setContent(current => ({ ...current, candidates: candidatesForReport(linkRequest, current.candidates) }));
    touch(); setFeedback('승인된 후보를 연결했습니다. 후보별 근거를 작성하고 저장해주세요.');
  }, [linkRequest]);
  const complete = [content.title, content.executiveSummary, content.scoreAssessment, content.applicationStrategy, content.risksAndCautions, content.finalCallChecklist, ...(linkedId ? [] : [fallback.reason])].every(value => String(value || '').trim())
    && content.candidates.every(item => [item.universityName, item.admissionUnitName, item.admissionGroup, item.rationale].every(value => String(value || '').trim()));
  const persist = async submit => {
    if (!editable || linkedBlocked || operation || !beginOperation('report')) return;
    const savingRevision = editRevision;
    setFeedback('');
    try {
      const candidates = content.candidates.map(item => linkedId ? { candidateId: item.candidateId, rationale: item.rationale } : { universityName: item.universityName, admissionUnitName: item.admissionUnitName, admissionGroup: item.admissionGroup, riskBand: item.riskBand, rationale: item.rationale });
      const result = await saveCounselorReportDraft(binding, { caseId, expectedDraftRevision: draftRevision, transcriptHash, ...(linkedId ? { analysisResultId: linkedId } : { analysisFallback: fallback }), content: { ...content, candidates } });
      if (!result.ok) { setAutosavePaused(true); setFeedback(`${result.error} 저장 상태를 다시 불러와 확인해주세요.`); return; }
      savedRevision.current = savingRevision; setDraftRevision(result.data.draftRevision); onDirty(false);
      if (submit) {
        const review = await submitCounselorReportReview(binding, caseId);
        if (review.ok) { setSubmitted(true); onSubmitted(); } else setAutosavePaused(true);
        setFeedback(review.ok ? '관리자 검수를 요청했습니다.' : review.error);
      } else setFeedback('초안을 저장했습니다.');
    } finally { endOperation(); }
  };
  React.useEffect(() => {
    if (!editable || linkedBlocked || operation || autosavePaused || editRevision === savedRevision.current) return undefined;
    const timer = setTimeout(() => { persist(false); }, 1500);
    return () => clearTimeout(timer);
  }, [editRevision, operation, editable, linkedBlocked, autosavePaused]);
  const switchManual = () => {
    if (!globalThis.confirm('분석 연결을 해제하고 숫자 없는 수동 검토로 전환하시겠습니까?')) return;
    setLinkedId(null); setFallback({ status: 'manual_review', reason: '' });
    field('candidates', content.candidates.map(item => ({ universityName: item.universityName, admissionUnitName: item.admissionUnitName, admissionGroup: item.admissionGroup, riskBand: 'manual_review', rationale: item.rationale })));
  };
  return <section className="consulting-report-workbench"><div className="consulting-report-workbench-head"><div><p className="consulting-v2-kicker">상담사 전용</p><h1>보고서 작성</h1></div><span>{submitted || initial?.status === 'review' ? '검수 중' : initial?.status === 'approved' ? '승인 완료' : `초안 v${draftRevision}`}</span></div>
    {initial?.aiReview ? <p>상담사가 검토한 AI 초안을 바탕으로 작성한 보고서입니다.</p> : null}
    {initial?.publicationHoldReasonCode ? <p className="consulting-analysis-alert" role="status">예약 공개가 보류되었습니다. 최신 성적·상담 내용과 분석을 확인하고 다시 검수를 요청해주세요.</p> : null}
    {linkedId ? <p role="status">{linkedBlocked ? '연결된 분석을 사용할 수 없습니다. 최신 결과를 다시 확인·승인하고 연결해주세요.' : '승인된 분석 연결됨 · 점수와 확률은 분석 결과를 사용합니다.'}</p> : <p>수동 검토 중 · 환산점수·예상컷·확률은 제공하지 않습니다.</p>}
    {linkedId && editable ? <button type="button" className="consulting-v2-secondary" disabled={Boolean(operation)} onClick={switchManual}>수동 검토로 전환</button> : null}
    <fieldset disabled={!editable || Boolean(operation)}><label>제목<input aria-label="제목" maxLength="120" value={content.title} onChange={event => field('title', event.target.value)} /></label>
    {[['executiveSummary', '핵심 요약', 3000], ['scoreAssessment', '성적 판단', 4000]].map(([key, label, max]) => <label key={key}>{label}<textarea aria-label={label} maxLength={max} value={content[key]} onChange={event => field(key, event.target.value)} /></label>)}
    <div className="consulting-report-editor-candidates"><h2>지원 후보</h2>{content.candidates.map((item, index) => <article key={item.candidateId || index}><div><input aria-label={`후보 ${index + 1} 대학`} placeholder="대학" maxLength="120" readOnly={Boolean(linkedId)} value={item.universityName} onChange={event => candidate(index, 'universityName', event.target.value)} /><input aria-label={`후보 ${index + 1} 모집단위`} placeholder="모집단위" maxLength="160" readOnly={Boolean(linkedId)} value={item.admissionUnitName} onChange={event => candidate(index, 'admissionUnitName', event.target.value)} /><input aria-label={`후보 ${index + 1} 모집군`} placeholder="가/나/다군" maxLength="20" readOnly={Boolean(linkedId)} value={linkedId ? ({ ga: '가군', na: '나군', da: '다군', other: '기타군' })[item.admissionGroup] || item.admissionGroup : item.admissionGroup} onChange={event => candidate(index, 'admissionGroup', event.target.value)} /></div>{linkedId ? <p>환산점수 {formatAnalysisNumber(item.convertedScore)} · 예상컷 {formatAnalysisRange(item.expectedCutoff)} · 합격 가능성 {item.probabilityStatus === 'available' ? formatAnalysisRange(item.probability, '%') : '미제공'}</p> : null}<textarea aria-label={`후보 ${index + 1} 근거`} placeholder="추천 근거" maxLength="1000" value={item.rationale} onChange={event => candidate(index, 'rationale', event.target.value)} /></article>)}{!linkedId ? <div className="consulting-report-row-actions"><button type="button" disabled={content.candidates.length >= 10} onClick={() => field('candidates', [...content.candidates, blankCandidate()])}>후보 추가</button><button type="button" disabled={content.candidates.length <= 1} onClick={() => field('candidates', content.candidates.slice(0, -1))}>마지막 후보 삭제</button></div> : null}</div>
    {[['applicationStrategy', '지원 전략', 5000], ['risksAndCautions', '위험 요소와 유의사항', 3000], ['finalCallChecklist', '파이널 콜 확인 항목', 2000]].map(([key, label, max]) => <label key={key}>{label}<textarea aria-label={label} maxLength={max} value={content[key]} onChange={event => field(key, event.target.value)} /></label>)}
    {!linkedId ? <label>수동 검토 사유<textarea aria-label="수동 검토 사유" maxLength="1000" value={fallback.reason} onChange={event => { setFallback(current => ({ ...current, reason: event.target.value })); touch(); }} /></label> : null}</fieldset>
    {editable ? <div className="consulting-report-actions"><button type="button" disabled={Boolean(operation) || linkedBlocked} onClick={() => persist(false)}>초안 저장</button><button type="button" disabled={Boolean(operation) || linkedBlocked || !complete} onClick={() => persist(true)}>저장 후 검수 요청</button></div> : null}{feedback ? <p role="status">{feedback}</p> : null}</section>;
}
