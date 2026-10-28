import React from 'react';
import { AdminReport, CounselorReport } from './ConsultingReportWorkspaces.jsx';
import { downloadConsultingReport, getStudentConsultingReport } from '../report-api.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { RISK_LABELS, formatAnalysisRange } from '../candidate-analysis-model.js';

function CandidateCards({ candidates }) {
  return <div className="consulting-report-candidates">{candidates.map((candidate, index) => <article key={candidate.candidateId || `${candidate.universityName}-${index}`}><span>{({ ga: '가군', na: '나군', da: '다군', other: '기타군' })[candidate.admissionGroup] || candidate.admissionGroup || '모집군 확인'}</span><h3>{candidate.universityName} {candidate.admissionUnitName}</h3><p>{candidate.rationale}</p><small>{candidate.probabilityStatus === 'manual_review' ? '상담사 수동 검토 · 확률 미제공' : `${RISK_LABELS[candidate.riskBand] || '판단 보류'} · ${candidate.probabilityStatus === 'available' ? formatAnalysisRange(candidate.probability, '%') : '확률 미제공'}`}</small></article>)}</div>;
}

function StudentReport({ binding }) {
  const [state, setState] = React.useState({ status: 'loading', report: null, error: '' });
  const [pdfBusy, setPdfBusy] = React.useState(false);
  React.useEffect(() => { const controller = new AbortController(); getStudentConsultingReport(binding, controller.signal).then(result => { if (!controller.signal.aborted) setState(result.ok ? { status: 'ready', report: result.data.report, error: '' } : { status: 'error', report: null, error: result.error }); }); return () => controller.abort(); }, [binding]);
  const pdf = async () => { setPdfBusy(true); const result = await downloadConsultingReport(binding, state.report.reportId); if (result.ok) globalThis.location.assign(result.downloadUrl); else setState(value => ({ ...value, error: result.error })); setPdfBusy(false); };
  if (state.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">보고서를 불러오고 있습니다.</p></main>;
  if (state.status === 'error' || !state.report) return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>{state.status === 'error' ? '보고서를 불러오지 못했습니다' : '보고서를 준비하고 있습니다'}</h1><p className="consulting-v2-status">{state.error || '승인과 공개가 완료되면 이곳에서 확인할 수 있습니다.'}</p><button className="consulting-v2-secondary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>진행 현황으로 돌아가기</button></section></main>;
  const { content } = state.report;
  return <main className="consulting-report"><header><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>← 진행 현황</button><strong>정시 컨설팅 보고서</strong><button type="button" disabled={pdfBusy} onClick={pdf}>{pdfBusy ? 'PDF 생성 중…' : 'PDF 받기'}</button></header><article className="consulting-report-document"><p className="consulting-v2-kicker">STUDYCRACK · 2027 JUNGSI</p><h1>{content.title}</h1><time>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date(state.report.publishedAt))} 공개</time><section><h2>핵심 요약</h2><p>{content.executiveSummary}</p></section><section><h2>성적 판단</h2><p>{content.scoreAssessment}</p></section><section><h2>지원 후보</h2><CandidateCards candidates={content.candidates} /></section><section><h2>지원 전략</h2><p>{content.applicationStrategy}</p></section><section><h2>위험 요소와 유의사항</h2><p>{content.risksAndCautions}</p></section><section><h2>파이널 콜 확인 항목</h2><p>{content.finalCallChecklist}</p></section><button className="consulting-v2-primary consulting-v2-wide" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.finalCall)}>파이널 콜 일정 선택하기</button>{state.error ? <p role="status">{state.error}</p> : null}</article></main>;
}

export function ConsultingReportScreen({ binding }) {
  if (binding.userRole === 'tutor') return <CounselorReport binding={binding} />;
  if (binding.userRole === 'admin') return <AdminReport binding={binding} />;
  return <StudentReport binding={binding} />;
}
