import { PLAN_META } from '../../constants/plans.js';

export function PlanComparison({ selected = '', selectable = false }) {
  return <section className="service-plan-comparison" aria-label="플랜 비교"><h3>나에게 맞는 플랜</h3><p>현재 판매 가격 · 결제 화면에서 최종 확인</p><div>{Object.entries(PLAN_META).map(([plan, meta]) => {
    const Tag = selectable ? 'button' : 'article';
    const props = selectable ? { type: 'button', 'data-action': 'selectPlan', 'data-plan': plan, 'aria-pressed': selected === plan } : {};
    return <Tag className="service-plan-card" data-selected={selectable && selected === plan} key={plan} {...props}><header><b>{plan.toUpperCase()}</b><strong>{meta.payPrice}</strong></header><p>{meta.billingNote}</p><p>{meta.complete}</p></Tag>;
  })}</div>{!selectable ? <button type="button" className="btn btn-secondary" data-action="goto" data-target="proIntro">플랜별 기능 자세히 보기</button> : null}</section>;
}
