import React from 'react';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';

export function FinalCallFrame({ resource, children, binding }) {
  return <main className="consulting-report consulting-analysis"><header><button type="button" onClick={() => binding?.userRole === 'admin' ? globalThis.location.assign('/admin') : binding?.userRole === 'tutor' ? globalThis.location.assign('/mypage/tutor') : navigateConsulting(CONSULTING_ROUTES.home)}>← {binding?.userRole === 'admin' ? '관리자' : binding?.userRole === 'tutor' ? '상담사 페이지' : '진행 현황'}</button><strong>파이널 콜</strong><button type="button" disabled={resource.busy} onClick={resource.reload}>새로 불러오기</button></header><section className="consulting-report-workbench"><h1>파이널 콜</h1>{resource.status === 'loading' ? <p role="status">일정을 불러오고 있습니다.</p> : resource.status === 'error' ? <p role="alert">일정을 불러오지 못했습니다. 로그인과 이용 단계를 확인하고 다시 불러와주세요.</p> : children}{resource.message ? <p className="consulting-survey-message" role="status">{resource.message}</p> : null}</section></main>;
}

