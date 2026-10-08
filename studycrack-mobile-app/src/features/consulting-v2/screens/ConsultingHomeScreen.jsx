import React from 'react';
import { useConsultingHome } from '../use-consulting-home.js';
import { ACTION_LABELS, actionPathForState, formatConsultingDueAt, PROGRESS_LABELS } from '../progress-model.js';
import { navigateConsulting } from '../route-model.js';

export function ConsultingHomeScreen({ binding }) {
  const resource = useConsultingHome(binding);
  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading" role="status">진행 현황을 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>진행 현황을 불러오지 못했습니다</h1><p className="consulting-v2-status">잠시 후 다시 확인해주세요.</p><button className="consulting-v2-primary consulting-v2-wide" type="button" onClick={resource.retry}>다시 시도</button></section></main>;
  if (!resource.data.available) return <main className="consulting-v2-center"><section className="consulting-v2-card"><p className="consulting-v2-kicker">2027 정시 컨설팅</p><h1>등록된 컨설팅이 없습니다</h1><p className="consulting-v2-status">문자로 받은 초대 링크에서 이용 인증을 먼저 완료해주세요.</p><a className="consulting-v2-secondary consulting-v2-wide" href="/2027-jungsi-consulting">서비스 안내 보기</a></section></main>;

  const actionPath = actionPathForState(resource.data.workflowState);
  return <main className="consulting-v2-home"><header className="consulting-v2-home-header"><img src="/assets/images/studycrack_logo_wo_bg.png" alt="StudyCrack" /><span>2027 정시 컨설팅</span></header>
    <section className="consulting-v2-home-hero"><p>나의 컨설팅</p><h1>현재 진행 상황을 확인하세요</h1><p>기초조사부터 파이널 콜까지 필요한 다음 행동을 순서대로 안내합니다.</p></section>
    <section className="consulting-v2-progress" aria-labelledby="progressTitle"><h2 id="progressTitle">전체 진행 단계</h2><ol>{resource.data.progress.map(step => <li key={step.step} data-status={step.status}><span aria-hidden="true"></span><div><strong>{PROGRESS_LABELS[step.step]}</strong><small>{step.status === 'completed' ? '완료' : step.status === 'current' ? '진행 중' : '예정'}</small></div></li>)}</ol></section>
    <section className="consulting-v2-next" aria-labelledby="nextTitle"><p>지금 할 일</p><h2 id="nextTitle">{ACTION_LABELS[resource.data.nextAction] || '모든 컨설팅 과정이 완료되었습니다.'}</h2>{resource.data.nextDueAt ? <p>기한: {formatConsultingDueAt(resource.data.nextDueAt)}</p> : <p>화면 안내에 따라 다음 단계를 진행해주세요.</p>}{actionPath ? <button type="button" onClick={() => navigateConsulting(actionPath)}>다음 단계로 이동</button> : null}</section>
    {resource.data.alerts.length ? <section className="consulting-v2-alerts" aria-label="알림">{resource.data.alerts.map(alert => <p key={alert}>{alert}</p>)}</section> : null}
  </main>;
}
