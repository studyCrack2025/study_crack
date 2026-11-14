import React from 'react';

export default function CalculatorAccess({ resource, onRefresh }) {
  const { status, data, error } = resource;
  const allowed = status === 'ready' && data.access.allowed;
  return <section id="jcalc-access-status" className="jcalc-panel jcalc-access" aria-label="계산기 이용 상태" aria-busy={status === 'loading'}>
    <div className="jcalc-access-head"><div><p className="jcalc-eyebrow">이용 안내</p><h2>{status === 'loading' ? '이용 권한을 확인하고 있습니다.' : status === 'error' ? '이용 상태를 다시 확인해주세요.' : allowed ? data.access.source === 'manager' ? '운영자 이용 권한을 확인했습니다.' : '기존 이용권으로 조회할 수 있습니다.' : '조회에는 Basic 이상 이용권이 필요합니다.'}</h2></div>
      <button className="jcalc-secondary" type="button" disabled={status === 'loading'} onClick={onRefresh}>이용 상태 다시 확인</button></div>
    {status === 'error' ? <p className="jcalc-error" role="alert">{error}</p> : <p className="jcalc-note" role="status">{status === 'loading' ? '입력과 검색은 계속할 수 있습니다. 확인 후 조회 버튼을 이용해주세요.' : allowed ? '성적과 후보를 입력한 뒤 조회할 수 있습니다. 모집단위별 자료·모델 검증 상태에 따라 결과를 안내합니다.' : 'Basic·Starter·Standard·Pro의 기존 이용 권한을 사용합니다. 입력과 후보 탐색은 계속할 수 있습니다.'}</p>}
    {status === 'ready' && <div className="jcalc-access-preparation"><strong>{data.service.state === 'preparing' ? '검수 자료 준비 중' : '모집단위별 검증 상태를 확인해주세요.'}</strong><p>{data.service.state === 'preparing' ? '2027학년도 자료를 검수하고 있습니다. 현재는 계산기 신규 판매를 시작하지 않았으며, 기존 이용 계정은 연결 상태를 조회할 수 있습니다.' : '검수본의 연결 여부와 실제 계산 가능 범위는 다를 수 있습니다. 조회한 모집단위의 결과에서 확인해주세요.'}</p></div>}
    {status === 'ready' && !allowed && <div className="jcalc-access-links"><a href="/mypage">내 이용권 확인</a><a href="/2027-jungsi-consulting#calculator">서비스 안내</a></div>}
  </section>;
}
