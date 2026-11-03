import React from 'react';
import { ConsultingBrand } from '../ConsultingBrand.jsx';
import { useConsultingHome } from '../use-consulting-home.js';
import { ACTION_LABELS, actionPathForState, formatConsultingDueAt, PROGRESS_LABELS } from '../progress-model.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';

function HomeFrame({ children }) {
  return <main className="consulting-v2-home"><header className="consulting-v2-home-header"><ConsultingBrand /><a className="consulting-v2-home-guide-link" href={CONSULTING_ROUTES.landing}>서비스 안내 <span aria-hidden="true">↗</span></a></header>{children}<footer className="consulting-v2-home-footer">StudyCrack · 선택에 근거를 더하는 정시 컨설팅</footer></main>;
}

export function ConsultingHomeScreen({ binding }) {
  const resource = useConsultingHome(binding);
  if (resource.status === 'loading') return <HomeFrame><section className="consulting-v2-home-empty" aria-busy="true"><p className="consulting-v2-kicker">나의 컨설팅</p><h1>진행 현황을 확인하고 있어요</h1><p role="status">잠시만 기다려주세요.</p></section></HomeFrame>;
  if (resource.status === 'error') return <HomeFrame><section className="consulting-v2-home-empty"><p className="consulting-v2-kicker">나의 컨설팅</p><h1>진행 현황을 불러오지 못했습니다</h1><p role="alert">연결 상태를 확인하고 다시 시도해주세요.</p><button className="consulting-v2-primary" type="button" onClick={resource.retry}>다시 시도</button></section></HomeFrame>;
  if (!resource.data.available) return <HomeFrame><section className="consulting-v2-home-empty"><p className="consulting-v2-kicker">이용 인증 안내</p><h1>등록된 컨설팅이 없습니다</h1><p>알림톡·문자로 받은 초대 링크에서<br />이메일 인증코드로 이용 인증을 완료해주세요.</p><a className="consulting-v2-primary" href={CONSULTING_ROUTES.landing}>서비스 안내 보기</a></section></HomeFrame>;
  const held = resource.data.serviceHold === true;
  const completed = resource.data.workflowState === 'SERVICE_COMPLETED';
  const actionPath = held ? null : actionPathForState(resource.data.workflowState);
  const currentStep = resource.data.progress.find(step => step.status === 'current');
  const completedSteps = resource.data.progress.filter(step => step.status === 'completed').length;
  return <HomeFrame>
    <section className="consulting-v2-home-hero"><p>나의 지원 전략</p><h1>나의 정시 컨설팅</h1><p>기초조사부터 마지막 선택까지,<br />지금 필요한 다음 단계를 확인하세요.</p></section>
    <section className="consulting-v2-next" aria-labelledby="nextTitle" data-held={held || undefined}>
      <div className="consulting-v2-next-label"><p>{completed ? '컨설팅 완료' : '지금 할 일'}</p><span>{held ? '운영자 확인 중' : completed ? '전체 과정 완료' : PROGRESS_LABELS[currentStep?.step] || '진행 안내'}</span></div>
      <h2 id="nextTitle">{held ? '서비스가 일시 보류되었습니다.' : completed ? '모든 컨설팅 과정이 완료되었습니다.' : ACTION_LABELS[resource.data.nextAction] || '현재 진행 상태를 확인해주세요.'}</h2>
      <p>{held ? '운영자 확인 후 재개됩니다. 보류 중에는 입력·변경과 자동 처리가 진행되지 않습니다.' : completed ? '함께 정리한 지원 전략과 공개 보고서를 다시 확인할 수 있습니다.' : '안내에 따라 진행하면 다음 과정으로 이어집니다.'}</p>
      {resource.data.nextDueAt ? <p className="consulting-v2-next-due">기한 <strong>{formatConsultingDueAt(resource.data.nextDueAt)}</strong></p> : null}
      {actionPath ? <button type="button" onClick={() => navigateConsulting(actionPath)}>다음 단계로 이동 <span aria-hidden="true">→</span></button> : null}
    </section>
    {resource.data.workflowState === 'SERVICE_COMPLETED' ? <div className="consulting-v2-actions"><button className="consulting-v2-secondary" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.report)}>공개 보고서 보기</button><button className="consulting-v2-secondary" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.finalCall)}>통화 완료 확인</button></div> : null}
    <section className="consulting-v2-progress" aria-labelledby="progressTitle"><div className="consulting-v2-progress-heading"><h2 id="progressTitle">전체 진행 단계</h2><p><strong>{completedSteps}</strong> / {resource.data.progress.length} 단계 완료</p></div><ol>{resource.data.progress.map((step, index) => <li key={step.step} data-status={step.status} aria-current={step.status === 'current' ? 'step' : undefined}><span aria-hidden="true">{step.status === 'completed' ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{PROGRESS_LABELS[step.step]}</strong><small>{step.status === 'completed' ? '완료' : step.status === 'current' ? held ? '일시 보류' : '진행 중' : '예정'}</small></div></li>)}</ol></section>
    {resource.data.alerts.length ? <section className="consulting-v2-alerts" aria-label="알림">{resource.data.alerts.map(alert => <p key={alert}>{alert}</p>)}</section> : null}
    <section className="consulting-v2-home-help" aria-label="이용 안내"><a href="https://pf.kakao.com/_wxjxcgn" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><span><strong>진행 중 궁금한 점이 있나요?</strong><small>스터디크랙 공식 카카오톡 채널</small></span><span aria-hidden="true">↗</span></a><a href={CONSULTING_ROUTES.landing}><span><strong>컨설팅 과정을 다시 살펴보세요</strong><small>서비스 구성과 이용 안내</small></span><span aria-hidden="true">↗</span></a></section>
  </HomeFrame>;
}
