import React from 'react';

const expiry = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function CalculatorAccess({ resource, onRefresh }) {
  const { status, data, error } = resource;
  if (status === 'ready' && !data.access.allowed) return null;
  if (status === 'ready') return <section id="jcalc-access-status" className="jcalc-access jcalc-entitlement" aria-label="계산기 이용 상태">
    <p role="status">{data.access.source === 'manager' ? '운영자 미리 보기' : <><time dateTime={data.entitlement.accessEndsAt}>{expiry(data.entitlement.accessEndsAt)}</time>까지 이용 가능 <span>(한국시간)</span></>}</p>
    {data.service.calculationMode === 'development_preview' && data.access.source === 'purchase' && <span className="jcalc-badge">DEV 테스트</span>}
    {!data.service.calculationEnabled && <p className="jcalc-note" role="note" aria-label="합격 계산기 공개 일정">계산 결과는 정식 공개 후 이용할 수 있습니다. 성적과 지원 후보는 미리 입력하고 저장할 수 있습니다.</p>}
  </section>;
  return <section id="jcalc-access-status" className="jcalc-panel jcalc-access" aria-label="계산기 이용 상태" aria-busy={status === 'loading'}>
    {status === 'loading' ? <p className="jcalc-note" role="status">이용 정보를 확인하고 있습니다.</p> : <>
      <h2>이용 정보를 확인하지 못했습니다.</h2><p className="jcalc-error" role="alert">{error}</p>
      <button className="jcalc-secondary" type="button" onClick={onRefresh}>다시 시도</button>
    </>}
  </section>;
}
