import React from 'react';
import { AdminReport, CounselorReport } from './ConsultingReportWorkspaces.jsx';
import { downloadConsultingReport, getStudentConsultingReport } from '../report-api.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { CandidateCards } from './ReportCandidateCards.jsx';
import { ReportAmendmentHistory } from './ReportAmendmentHistory.jsx';
import { useFinalCallResource } from '../use-final-call-resource.js';


function StudentReport({ binding }) {
  const loader = React.useCallback(signal => getStudentConsultingReport(binding, signal), [binding]);
  const resource = useFinalCallResource(loader), [viewOriginal, setViewOriginal] = React.useState(false);
  const state = { status: resource.status, report: viewOriginal && resource.data?.originalReport ? resource.data.originalReport : resource.data?.report, error: resource.message };
  const pdf = () => resource.run(signal => downloadConsultingReport(binding, state.report.reportId, state.report.amendmentVersion || 0, signal), { reload: false, onSuccess: data => globalThis.location.assign(data.downloadUrl) });
  if (state.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">보고서를 불러오고 있습니다.</p></main>;
  if (state.status === 'error' || !state.report) return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>{state.status === 'error' ? '보고서를 불러오지 못했습니다' : '보고서를 준비하고 있습니다'}</h1><p className="consulting-v2-status">{state.error || '승인과 공개가 완료되면 이곳에서 확인할 수 있습니다.'}</p><button className="consulting-v2-secondary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>진행 현황으로 돌아가기</button></section></main>;
  const { content } = state.report;
  return <main className="consulting-report"><header><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>← 진행 현황</button><strong>정시 컨설팅 보고서</strong><button type="button" disabled={resource.busy} onClick={pdf}>{resource.busy ? 'PDF 생성 중…' : 'PDF 받기'}</button></header><article className="consulting-report-document"><p className="consulting-v2-kicker">STUDYCRACK · 2027 JUNGSI</p><h1>{content.title}</h1><time>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date(state.report.publishedAt))} 공개</time>{resource.data?.originalReport ? <section><h2>{viewOriginal ? '최초 원본' : `정정 ${state.report.amendmentVersion}차 반영본`}</h2><p>{viewOriginal ? '이 원본 이후 공개된 정정본이 있습니다. 최신 판단은 정정본을 확인해주세요.' : '오류 정정 내용을 반영했습니다. 원본과 변경 전후 이력은 계속 확인할 수 있습니다.'}</p><button type="button" className="consulting-v2-secondary" disabled={resource.busy} onClick={() => setViewOriginal(value => !value)}>{viewOriginal ? '최신 정정본 보기' : '최초 원본 보기'}</button></section> : null}<ReportAmendmentHistory items={resource.data?.amendments} /><section><h2>핵심 요약</h2><p>{content.executiveSummary}</p></section><section><h2>성적 판단</h2><p>{content.scoreAssessment}</p></section><section><h2>지원 후보</h2><CandidateCards candidates={content.candidates} /></section><section><h2>지원 전략</h2><p>{content.applicationStrategy}</p></section><section><h2>위험 요소와 유의사항</h2><p>{content.risksAndCautions}</p></section><section><h2>파이널 콜 확인 항목</h2><p>{content.finalCallChecklist}</p></section><button className="consulting-v2-primary consulting-v2-wide" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.finalCall)}>파이널 콜 일정·완료 확인</button>{state.error ? <p role="status">{state.error}</p> : null}</article></main>;
}

export function ConsultingReportScreen({ binding }) {
  if (binding.userRole === 'tutor') return <CounselorReport binding={binding} />;
  if (binding.userRole === 'admin') return <AdminReport binding={binding} />;
  return <StudentReport binding={binding} />;
}
