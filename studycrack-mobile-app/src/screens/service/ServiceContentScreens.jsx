import { CRACKY_SRC } from '../../constants/assets.js';
import { Modal } from '../../components/Modal.jsx';
import { SecondaryIntro, SecondaryScreenShell, SecondaryState } from '../../components/SecondaryScreen.jsx';

function safeExternalUrl(value) {
  const text = String(value || '').trim();
  return /^https:\/\//i.test(text) ? text : '';
}

function formatReportKeyLabel(key = '') {
  const value = String(key || '').trim();
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return value || 'PRO 리포트';
  return `20${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}주차`;
}

function reportStatusLabel(report = {}) {
  const status = String(report.status || '').toLowerCase();
  if ((status === 'published' || status === 'sent') && report.reportLink) return '다운로드 가능';
  if (status === 'tutor_review') return '튜터 검수 중';
  if (status === 'drafting') return '작성 중';
  return '준비 중';
}

function formatWeekIdLabel(weekId = '') {
  const value = String(weekId || '').trim();
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return value || '주간 점검';
  return `20${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}주차`;
}

function formatQnaDate(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function qnaStatusLabel(status = '') {
  if (String(status).toLowerCase() === 'done') return '답변 완료';
  if (String(status).toLowerCase() === 'read') return '확인 중';
  return '답변 대기';
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" className="icon primary" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>;
}

export function ProRequestModal({ open, proRequestSubmitting = false, proRequestText = '' }) {
  return (
    <Modal open={open} dismissAction="closeProRequestModal" panelClass="pro-request-modal">
      <div className="pro-request-head"><h4>전략 보고서 요청</h4><button type="button" className="pro-request-close" data-action="closeProRequestModal" aria-label="닫기">✕</button></div>
      <div className="pro-request-body"><p>현재 학습 상황이나 고민, 특별히 분석받고 싶은 내용을 적어주세요.</p><p>담당 컨설턴트가 이를 반영하여 <b>최적의 전략</b>을 수립합니다.</p><label>요청 사항 (500자 이내)</label><textarea data-field="proRequestText" defaultValue={proRequestText} maxLength="500" placeholder="예: 6월 모평 대비 수학 기하 과목 집중 전략이 필요합니다. 최근 실전 문제 풀이에서 시간이 부족해 고민입니다." /><div className="pro-request-count">{String(proRequestText).length}/500</div><div className="pro-request-actions"><button type="button" className="cancel" data-action="closeProRequestModal">취소</button><button type="button" className="submit" data-action="submitProRequest" disabled={proRequestSubmitting}>{proRequestSubmitting ? '제출 중' : '요청서 제출하기'}</button></div></div>
    </Modal>
  );
}

export function ProEliteScreen(ctx) {
  const { proReports = [], proReportsStatus = 'idle', proRequestModalOpen = false, proRequestSubmitting = false, proRequestText = '' } = ctx;
  const overlays = <ProRequestModal open={proRequestModalOpen} proRequestSubmitting={proRequestSubmitting} proRequestText={proRequestText} />;
  let reportList = <SecondaryState title="아직 발행된 PRO 리포트가 없어요" description="새 리포트가 준비되면 이곳에 표시됩니다." />;
  if (proReportsStatus === 'idle' || proReportsStatus === 'loading') reportList = <SecondaryState kind="loading" title="PRO 리포트를 불러오는 중이에요" description="잠시만 기다려주세요." />;
  else if (proReportsStatus === 'error') reportList = <SecondaryState kind="error" title="PRO 리포트를 불러오지 못했어요" description="잠시 후 화면을 다시 열어주세요." />;
  else if (proReports.length) reportList = proReports.map((report, index) => {
    const reportLink = safeExternalUrl(report.reportLink);
    const ready = Boolean(reportLink) && ['published', 'sent'].includes(String(report.status || '').toLowerCase());
    return <button type="button" className="pro-elite-item" data-action="downloadProReport" data-pdf-path={ready ? reportLink : ''} data-pdf-name={`studycrack-pro-report-${report.key || 'latest'}.pdf`} key={report.key || `${report.status}-${index}`}><div><b>{formatReportKeyLabel(report.key)} PRO 리포트</b><p>{reportStatusLabel(report)}</p></div><span className="pro-elite-download">{ready ? 'PDF 다운로드' : '준비 중'}</span></button>;
  });
  return (
    <SecondaryScreenShell screen="proElite" title="PRO EXCLUSIVE" overlays={proRequestModalOpen ? overlays : null}>
      <div className="pro-elite-page"><div className="pro-elite-hero"><span className="pro-elite-badge">TOP 1%</span><h3>상위 1%를 위한<br />중장기 집중 맞춤 솔루션</h3><p>발행된 프리미엄 전략 리포트를 확인하세요.</p></div><div className="pro-elite-list">{reportList}</div><div className="pro-elite-request-bottom"><button type="button" className="pro-request-btn" data-action="openProRequestModal"><CheckIcon /><span>전략 리포트 요청하기</span></button></div></div>
    </SecondaryScreenShell>
  );
}

function ReportRows({ reports = [] }) {
  if (!reports.length) return <SecondaryState title="아직 발행된 PRO 리포트가 없어요" description="새 리포트가 준비되면 이곳에 표시됩니다." />;
  return reports.map((report, index) => {
    const reportLink = safeExternalUrl(report.reportLink);
    const ready = Boolean(reportLink) && ['published', 'sent'].includes(String(report.status || '').toLowerCase());
    return (
      <button type="button" className="sc-secondary-row report-row" data-action="downloadProReport" data-pdf-path={ready ? reportLink : ''} data-pdf-name={`studycrack-pro-report-${report.key || 'latest'}.pdf`} key={report.key || `${report.status}-${index}`}>
        <span className="sc-secondary-row-main"><b>{formatReportKeyLabel(report.key)}</b><p>{reportStatusLabel(report)}</p></span>
        <span className="sc-secondary-row-meta">{ready ? <><b>PDF</b><em>다운로드</em></> : <span aria-hidden="true">›</span>}</span>
      </button>
    );
  });
}

export function ReportScreen(ctx) {
  const { proReports = [], proReportsStatus = 'idle', proRequestModalOpen = false, proRequestSubmitting = false, proRequestText = '', tab = 'my' } = ctx;
  const overlays = <ProRequestModal open={proRequestModalOpen} proRequestSubmitting={proRequestSubmitting} proRequestText={proRequestText} />;
  return (
    <SecondaryScreenShell screen="report" title="학습 리포트" overlays={proRequestModalOpen ? overlays : null} tab={tab}>
      <div className="sc-secondary-page report-page">
        <SecondaryIntro eyebrow="PRO REPORT" title="맞춤 전략 리포트" description="발행된 전략 리포트를 확인하고 새 분석을 요청할 수 있어요." aside={<span className="sc-chip">PRO</span>} />
        <section className="sc-secondary-section report-summary"><div className="report-summary-main"><span>발행 리포트</span><b>{proReports.length}개</b><p>{proReports.length ? '최근 발행 이력을 확인해보세요.' : '첫 리포트 발행을 기다리고 있어요.'}</p></div><button type="button" className="btn btn-primary report-sample" data-action="openProRequestModal">새 리포트 요청</button></section>
        <section className="sc-secondary-section report-list"><div className="sc-secondary-section-head"><div><h3>리포트 목록</h3><p>다운로드 가능한 PDF만 바로 열립니다.</p></div></div><div className="sc-secondary-list">{proReportsStatus === 'idle' || proReportsStatus === 'loading' ? <SecondaryState kind="loading" title="PRO 리포트를 불러오는 중이에요" /> : proReportsStatus === 'error' ? <SecondaryState kind="error" title="리포트를 불러오지 못했어요" description="잠시 후 다시 화면을 열어주세요." /> : <ReportRows reports={proReports} />}</div></section>
      </div>
    </SecondaryScreenShell>
  );
}

export function ReportDetailScreen() {
  return (
    <SecondaryScreenShell screen="reportDetail" title="종합 분석 리포트">
      <div className="sc-secondary-page report-detail-page"><SecondaryIntro eyebrow="REPORT DETAIL" title="리포트 상세" description="실제로 발행된 PDF 리포트만 안전하게 제공합니다." /><section className="sc-secondary-section report-detail-card"><div className="sc-secondary-section-head"><div><h3>발행 리포트 선택</h3><p>리포트 목록에서 다운로드 가능한 항목을 선택해주세요.</p></div></div><SecondaryState title="선택된 리포트가 없어요" description="목록으로 돌아가 확인할 리포트를 선택해주세요." /></section></div>
    </SecondaryScreenShell>
  );
}

function QnaComposerModal({ open, qnaDraftContent = '', qnaDraftTitle = '', qnaSubmitting = false }) {
  return (
    <Modal open={open} dismissAction="closeQnaComposer" panelClass="qna-modal">
      <div className="qna-modal-head"><h4>새 질문 작성</h4><button type="button" className="qna-modal-close" data-action="closeQnaComposer" aria-label="닫기">✕</button></div>
      <div className="qna-modal-body"><label>질문 제목</label><input className="planner-input" data-field="qnaDraftTitle" defaultValue={qnaDraftTitle} maxLength="80" placeholder="예: 수학 기출 복습 순서가 고민이에요" /><label>질문 내용</label><textarea className="planner-input qna-textarea" data-field="qnaDraftContent" defaultValue={qnaDraftContent} maxLength="1000" placeholder="현재 상황과 궁금한 점을 구체적으로 적어주세요." /><div className="qna-modal-actions"><button type="button" className="btn btn-secondary" data-action="closeQnaComposer">취소</button><button type="button" className="btn btn-primary" data-action="submitMobileQna" disabled={qnaSubmitting}>{qnaSubmitting ? '등록 중' : '질문 등록'}</button></div></div>
    </Modal>
  );
}

function TutorQnaList({ qnaHistory = [], qnaStatus = 'idle' }) {
  if (qnaStatus === 'idle' || qnaStatus === 'loading') return <SecondaryState kind="loading" title="질문 내역을 불러오는 중이에요" description="잠시만 기다려주세요." />;
  if (qnaStatus === 'error') return <SecondaryState kind="error" title="질문 내역을 불러오지 못했어요" description="잠시 후 화면을 다시 열어주세요." />;
  if (!qnaHistory.length) return <SecondaryState title="아직 남긴 질문이 없어요" description="새 질문을 작성하면 처리 상태와 답변을 확인할 수 있어요." />;
  return qnaHistory.map((item, index) => {
    const done = String(item.status || '').toLowerCase() === 'done';
    const created = formatQnaDate(item.createdAt);
    return <article className="qna-list-row" key={item.qnaId || item.id || `${created}-${index}`}><div className="qna-row-main"><b>{item.title || '제목 없는 질문'}</b><p>{item.content || '질문 내용 없음'}</p>{done && item.answer ? <small>답변: {item.answer}</small> : null}</div><div className="qna-row-side"><em className={done ? 'done' : ''}>{qnaStatusLabel(item.status)}</em>{created ? <span>{created}</span> : null}</div></article>;
  });
}

export function TutorScreen(ctx) {
  const { qnaComposerOpen = false, qnaDraftContent = '', qnaDraftTitle = '', qnaHistory = [], qnaStatus = 'idle', qnaSubmitting = false } = ctx;
  const overlays = <QnaComposerModal open={qnaComposerOpen} qnaDraftContent={qnaDraftContent} qnaDraftTitle={qnaDraftTitle} qnaSubmitting={qnaSubmitting} />;
  return (
    <SecondaryScreenShell screen="tutor" title="SKY튜터 1:1 피드백" overlays={qnaComposerOpen ? overlays : null}>
      <div className="tutor-qna-page"><div className="card qna-intro-card"><p className="sub">텍스트 기반 질의응답</p><h3>학습 고민을 남기면 튜터가 답변해요</h3><button type="button" className="btn btn-primary" data-action="openQnaComposer">새 질문 작성</button></div><div className="qna-list compact"><TutorQnaList qnaHistory={qnaHistory} qnaStatus={qnaStatus} /></div></div>
    </SecondaryScreenShell>
  );
}

export function WeeklyScreen({ crackySrc = CRACKY_SRC, tab = 'my', weeklyReports = [], weeklyReportsStatus = 'idle' }) {
  const latest = weeklyReports[0] || null;
  const isLoading = weeklyReportsStatus === 'idle' || weeklyReportsStatus === 'loading';
  const isError = weeklyReportsStatus === 'error';
  const feedback = latest?.tutorFeedback || {};
  const done = latest?.tutorFeedback?.submitted === true;
  const feedbackItems = !latest
    ? ['학습 코칭 화면에서 이번 주 점검을 제출하면 이곳에 피드백이 표시됩니다.']
    : done
      ? [
        feedback.weeklyPlanner ? `이번 주 플래너: ${feedback.weeklyPlanner}` : '',
        feedback.planReason ? `계획 이유: ${feedback.planReason}` : '',
        feedback.questionAnswer ? `질문 답변: ${feedback.questionAnswer}` : '',
        feedback.tutorComment ? `튜터 총평: ${feedback.tutorComment}` : '',
        feedback.nextWeekTop3 ? `다음 주 TOP3: ${feedback.nextWeekTop3}` : '',
        feedback.planEvaluation ? `플랜 평가: ${feedback.planEvaluation}` : ''
      ].filter(Boolean)
      : ['튜터가 피드백을 최종 제출하면 이곳에 표시됩니다.'];
  return (
    <SecondaryScreenShell screen="weekly" tab={tab}>
      <div className="sc-secondary-page weekly-page mobile-card-stack"><SecondaryIntro eyebrow="WEEKLY COACHING" title="주간 점검" description="제출한 기록과 튜터 피드백을 한눈에 확인하세요." aside={<span className="sc-chip">{isLoading ? '불러오는 중' : isError ? '확인 필요' : done ? '피드백 도착' : latest ? '검토 중' : '시작 전'}</span>} />
        {isLoading ? <SecondaryState kind="loading" title="주간 점검을 불러오는 중이에요" description="잠시만 기다려주세요." /> : isError ? <SecondaryState kind="error" title="주간 점검을 불러오지 못했어요" description="잠시 후 화면을 다시 열어주세요." /> : <>{latest ? <section className="sc-secondary-section weekly-summary"><div><span>점검 주차</span><b>{formatWeekIdLabel(latest.weekId)}</b></div><div><span>담당 튜터</span><b>{latest.tutorName || '튜터 확인 중'}</b></div></section> : null}
        <section className="sc-secondary-section weekly-feedback"><div className="sc-secondary-section-head"><div><h3>{latest ? '주간 요약 피드백' : '주간 점검 기록이 없습니다.'}</h3><p>{done ? '튜터가 정리한 이번 주 피드백입니다.' : '점검을 제출하면 이곳에서 진행 상태를 확인할 수 있어요.'}</p></div></div><div className="weekly-feedback-body"><div className="weekly-feedback-list">{feedbackItems.map((item) => <div className="feedback-item" key={item}><CheckIcon />{item}</div>)}</div><img loading="lazy" decoding="async" src={crackySrc} className="weekly-char crackie" alt="크랙이" /></div></section>
        <button type="button" className="btn btn-primary weekly-next" data-action="goto" data-target={latest ? 'planner' : 'strategy'}>{latest ? '다음 주 계획 세우기' : '학습 코칭으로 이동'}</button></>}
      </div>
    </SecondaryScreenShell>
  );
}
