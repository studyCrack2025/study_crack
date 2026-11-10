import React from 'react';
import { ConsultingBrand } from '../ConsultingBrand.jsx';
import { useConsultingHome } from '../use-consulting-home.js';
import { actionPathForState, formatConsultingDueAt, HOME_GUIDANCE } from '../progress-model.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';

function HomeFrame({ children }) {
  return <main className="consulting-v2-home"><header className="consulting-v2-home-header"><ConsultingBrand /><a className="consulting-v2-home-guide-link" href={CONSULTING_ROUTES.landing}>서비스 안내 <span aria-hidden="true">↗</span></a></header>{children}<footer className="consulting-v2-home-footer">StudyCrack · 선택에 근거를 더하는 정시 컨설팅</footer></main>;
}

export function ConsultingHomeScreen({ binding }) {
  const resource = useConsultingHome(binding);
  if (resource.status === 'loading') return <HomeFrame><section className="consulting-v2-home-empty" aria-busy="true"><p className="consulting-v2-kicker">나의 컨설팅</p><h1>진행 현황을 확인하고 있어요</h1><p role="status">잠시만 기다려주세요.</p></section></HomeFrame>;
  if (resource.status === 'error') return <HomeFrame><section className="consulting-v2-home-empty"><p className="consulting-v2-kicker">나의 컨설팅</p><h1>진행 현황을 불러오지 못했습니다</h1><p role="alert">연결 상태를 확인하고 다시 시도해주세요.</p><button className="consulting-v2-primary" type="button" onClick={resource.retry}>다시 시도</button></section></HomeFrame>;
  if (!resource.data.available) return <HomeFrame><section className="consulting-v2-home-empty"><p className="consulting-v2-kicker">이용 인증 안내</p><h1>등록된 컨설팅이 없습니다</h1><p>알림톡·문자로 받은 초대 링크에서<br />이메일 인증코드로 이용 인증을 완료해주세요.</p><a className="consulting-v2-primary" href={CONSULTING_ROUTES.landing}>서비스 안내 보기</a></section></HomeFrame>;
  const { alerts, nextAction, nextDueAt, serviceHold, workflowState } = resource.data;
  const held = serviceHold === true;
  const completed = workflowState === 'SERVICE_COMPLETED';
  const actionPath = held ? '' : actionPathForState(workflowState);
  const current = Object.hasOwn(HOME_GUIDANCE, nextAction) ? HOME_GUIDANCE[nextAction] : null;
  const guidance = held
    ? { title: '서비스가 일시 보류되었습니다.', description: '입력과 처리가 잠시 멈춰 있어요. 운영팀에서 확인을 마치면 진행을 재개합니다.' }
    : completed
      ? { title: '모든 컨설팅 과정이 완료되었습니다.', description: '함께 정리한 지원 전략과 공개 보고서를 다시 확인할 수 있어요.' }
      : current || { title: '진행 상황을 확인해주세요.', description: '상담 준비나 제출 자료의 현재 상태를 확인할 수 있어요.', button: '내 진행 내용 보기' };
  const due = held || completed ? '' : formatConsultingDueAt(nextDueAt);
  return <HomeFrame>
    <section className="consulting-v2-home-hero">
      <p>2027학년도 정시</p>
      <h1>나의 정시 컨설팅</h1>
      <p>성적과 희망 조건을 바탕으로 나에게 맞는 지원 전략을 정리합니다.</p>
    </section>
    <section className="consulting-v2-next" aria-labelledby="nextTitle" data-held={held || undefined}>
      <div className="consulting-v2-next-copy">
        <p className="consulting-v2-next-label">{held ? '운영팀 확인 중' : completed ? '컨설팅 완료' : '크랙이의 안내'}</p>
        <h2 id="nextTitle">{guidance.title}</h2>
        <p className="consulting-v2-next-description">{guidance.description}</p>
        {due ? <p className="consulting-v2-next-due"><span>기한</span> <strong>{due}</strong></p> : null}
      </div>
      {!held ? <div className="consulting-v2-next-art" aria-hidden="true">
        <img src="/assets/images/mascots/crack_hi.png" width="1024" height="776" alt="" decoding="async" />
      </div> : null}
      {actionPath ? <div className="consulting-v2-next-actions">
        <button className="consulting-v2-primary" type="button" onClick={() => navigateConsulting(actionPath)}>{guidance.button}<span aria-hidden="true">→</span></button>
      </div> : null}
      {completed && !held ? <div className="consulting-v2-next-actions">
        <button className="consulting-v2-primary" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.report)}>공개 보고서 보기<span aria-hidden="true">→</span></button>
        <button className="consulting-v2-secondary" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.finalCall)}>통화 완료 확인</button>
      </div> : null}
    </section>
    {alerts.length ? <section className="consulting-v2-alerts" aria-label="알림">{alerts.map(alert => <p key={alert}>{alert}</p>)}</section> : null}
    {!['ONBOARDING', 'SURVEY_DRAFT'].includes(workflowState) && <section className="consulting-v2-home-help" aria-label="내 기초조사서">
      <a href={CONSULTING_ROUTES.survey} onClick={event => { event.preventDefault(); navigateConsulting(CONSULTING_ROUTES.survey); }}><span><strong>내 답변 보기</strong><small>제출한 기초조사서를 확인할 수 있어요.</small></span><span aria-hidden="true">→</span></a>
    </section>}
    <section className="consulting-v2-home-help" aria-label="이용 안내">
      <a href="https://pf.kakao.com/_wxjxcgn" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><span><strong>진행 중 궁금한 점이 있나요?</strong><small>스터디크랙 공식 카카오톡 채널</small></span><span aria-hidden="true">↗</span></a>
    </section>
  </HomeFrame>;
}
