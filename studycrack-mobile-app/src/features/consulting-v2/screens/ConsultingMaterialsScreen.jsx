import React from 'react';
import { getV2SurveyDraft } from '../survey-api.js';
import { navigateConsulting, CONSULTING_ROUTES } from '../route-model.js';
import { SurveySupplementNotes } from './SurveySupplementNotes.jsx';

const dates = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' });
const summary = {
  MATERIAL_REVIEW: { state: '검토 대기', title: '기초조사서가 접수됐어요', guide: '운영팀이 조사서와 성적표를 확인하고 있어요. 확인이 끝나면 서면상담 가능 시간을 선택할 수 있습니다.' },
  SUPPLEMENT_REQUIRED: { state: '보완 요청', title: '추가로 확인할 내용이 있어요', guide: '요청받은 답변만 수정한 뒤 재제출해 주세요. 임시 저장만으로는 운영팀에 전달되지 않아요.' },
  AVAILABILITY_REQUIRED: { state: '검토 완료', title: '기초조사서 확인이 끝났어요', guide: '서면상담에 참여할 수 있는 날짜와 시간을 골라주세요. 제출한 시간에 맞춰 상담 일정을 배정합니다.', action: '서면상담 가능 시간 선택' },
  SCHEDULING: { state: '시간 제출 완료', title: '상담 일정을 맞추고 있어요', guide: '제출한 가능 시간을 바탕으로 상담사 일정을 확인하고 있어요. 확정 전에는 가능 시간을 다시 확인하고 수정할 수 있습니다.', action: '제출한 가능 시간 보기' },
  WRITTEN_SESSION_BOOKED: { state: '일정 확정', title: '서면상담 일정이 확정됐어요', guide: '배정된 상담 날짜와 시간을 확인해 주세요.', action: '확정 일정 보기' }
};

export function ConsultingMaterialsScreen({ binding }) {
  const [resource, setResource] = React.useState({ status: 'loading', data: null });
  const request = React.useRef(null);
  const load = React.useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResource(current => ({ ...current, status: 'loading' }));
    const result = await getV2SurveyDraft(binding, controller.signal);
    if (controller.signal.aborted) return;
    setResource(result.ok ? { status: 'ready', data: result.data } : { status: 'error', data: null });
  }, [binding]);
  React.useEffect(() => {
    load();
    const resume = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', resume);
    return () => {
      request.current?.abort();
      document.removeEventListener('visibilitychange', resume);
    };
  }, [load]);
  if (!resource.data && resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">자료 상태를 확인하고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>자료 상태를 불러오지 못했습니다</h1><button className="consulting-v2-primary consulting-v2-wide" onClick={load}>다시 시도</button></section></main>;
  const { workflowState, serviceHold, submission, supplement, files } = resource.data;
  const held = serviceHold === true;
  const needsSupplement = workflowState === 'SUPPLEMENT_REQUIRED';
  const resubmitted = workflowState === 'MATERIAL_REVIEW' && submission?.supplementAttempt > 0;
  const status = held ? { state: '서비스 보류', title: '서비스가 일시 보류 중이에요', guide: '제출한 답변은 계속 확인할 수 있어요. 운영팀에서 확인을 마치면 다시 진행할 수 있습니다.' }
    : resubmitted ? { state: '보완 재접수', title: '보완 답변이 재접수됐어요', guide: '수정한 답변을 운영팀에 전달했어요. 아래 접수 내역을 확인해 주세요. 같은 내용을 다시 전송할 필요는 없어요.' }
    : Object.hasOwn(summary, workflowState) ? summary[workflowState]
      : submission ? { state: '검토 완료', title: '기초조사서를 확인했어요', guide: '나의 컨설팅에서 지금 진행할 내용을 확인해 주세요.' }
        : { state: '제출 전', title: '기초조사서를 작성해 주세요', guide: '지원 상황과 성적표를 제출하면 운영팀이 확인합니다.' };
  const submittedAt = Date.parse(submission?.submittedAt);
  const fileCount = (files || []).filter(file => submission?.fileIds?.includes(file.fileId)).length;
  const edit = surveyField => navigateConsulting(CONSULTING_ROUTES.survey, { surveyField });

  return <main className="consulting-survey">
    <header><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>← 나의 컨설팅</button></header>
    <section className="consulting-survey-card" aria-labelledby="materials-title" aria-busy={resource.status === 'loading'}>
      <div className="consulting-survey-intro">
        <div>
          <p className="consulting-survey-position">기초조사서 <span>{status.state}</span></p>
          <h1 id="materials-title">{status.title}</h1>
          <p className="consulting-survey-guide">{status.guide}</p>
        </div>
        <img className="consulting-survey-mascot" src="/assets/images/mascots/crack_showresult.png" width="1024" height="776" alt="" decoding="async" />
      </div>
      {submission && <div className="consulting-v2-summary">
        {Number.isFinite(submittedAt) && <p><span>{submission.supplementAttempt > 0 ? '최근 보완 제출' : '제출 시각'}</span><strong>{dates.format(submittedAt)}</strong></p>}
        <p><span>제출한 성적표</span><strong>{fileCount}개</strong></p>
      </div>}
      {needsSupplement && <SurveySupplementNotes reasonText={supplement?.reasonText} fields={supplement?.fields} onEdit={held ? undefined : edit} />}
      {resubmitted && <section className="consulting-survey-notes" aria-label="보완 재제출 접수 내역">
        <p><strong>{submission.supplementAttempt}차 보완 답변 · 운영팀 확인 대기</strong></p>
        {submission.supplementReceipt?.fields?.length > 0 && <ul>{submission.supplementReceipt.fields.map(({ field, label, changed }) =>
          <li key={field}><strong>{label || '보완 요청 항목'}</strong><span>{changed ? '수정한 답변 접수 완료' : '기존 답변으로 접수 · 변경 없음'}</span></li>)}</ul>}
      </section>}
      <div className="consulting-v2-actions">
        {status.action && <button className="consulting-v2-primary" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.schedule)}>{status.action}</button>}
        {(submission || !held) && <button className={status.action ? 'consulting-v2-secondary' : 'consulting-v2-primary'} type="button" onClick={() => edit()}>
          {held ? '제출한 답변 보기' : needsSupplement ? '요청한 항목 보완하기' : submission ? '내 답변 보기·수정' : '기초조사서 작성하기'}
        </button>}
        <button className="consulting-v2-secondary" type="button" disabled={resource.status === 'loading'} onClick={load}>{resource.status === 'loading' ? '상태 확인 중…' : '진행 상태 다시 확인'}</button>
      </div>
    </section>
  </main>;
}
