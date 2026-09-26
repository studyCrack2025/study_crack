import { Sheet } from '../../components/Sheet.jsx';
import { useLayoutEffect } from 'react';
import { MySummaryContent } from './MySummaryContent.jsx';
import { MyMenuList } from './MyMenuList.jsx';

export function MySummarySheet({ drawerOpen = false, myPresentation, returnSnapshot }) {
  useLayoutEffect(() => {
    if (!drawerOpen || !returnSnapshot) return;
    const body = document.querySelector('.my-summary-body');
    const button = Array.from(body?.querySelectorAll('[data-action]') || []).find(el => returnSnapshot.target ? el.dataset.target === returnSnapshot.target : el.dataset.action === returnSnapshot.action);
    button?.focus({ preventScroll: true });
    if (body) body.scrollTop = returnSnapshot.scroll || 0;
  }, [drawerOpen, returnSnapshot]);
  return <Sheet open={drawerOpen} dismissAction="closeDrawer" variant="drawer" overlayClass="my-summary-overlay" panelClass="my-summary-sheet" ariaLabel="프로필 메뉴"><header className="my-summary-head"><div><h1>마이</h1><p>내 학습 정보와 계정 설정</p></div><button type="button" data-action="closeDrawer" aria-label="프로필 메뉴 닫기">×</button></header><div className="my-summary-body"><MySummaryContent presentation={myPresentation} showIdentity navigationAction="drawerGoto" /><button type="button" className="my-summary-full" data-action="drawerGoto" data-target="my">마이페이지 전체 보기 <span aria-hidden="true">›</span></button><MyMenuList navigationAction="drawerGoto" compact /></div><footer className="my-summary-footer"><button type="button" className="btn btn-secondary" data-action="openLogoutModal">로그아웃</button></footer></Sheet>;
}
