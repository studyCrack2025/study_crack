import React from 'react';

export default function CalculatorAccess({ resource, onRefresh }) {
  const { status, data, error } = resource;
  const allowed = status === 'ready' && data.access.allowed;
  const openingSoon = allowed && Date.now() < Date.parse('2026-11-28T00:00:00+09:00');
  return <section id="jcalc-access-status" className="jcalc-panel jcalc-access" aria-label="계산기 이용 상태" aria-busy={status === 'loading'}>
    {openingSoon && <div className="jcalc-opening-notice" role="note" aria-label="합격 계산기 공개 일정"><strong>합격 계산기는 <time dateTime="2026-11-28">11월 28일</time> 공개 예정입니다.</strong><p>이용권이 확인되었습니다. 공개 전에도 성적과 지원 후보를 미리 입력할 수 있습니다.</p></div>}
    <div className="jcalc-access-head"><div><p className="jcalc-eyebrow">이용 안내</p><h2>{status === 'loading' ? '이용 권한을 확인하고 있습니다.' : status === 'error' ? '이용 상태를 다시 확인해주세요.' : allowed ? data.access.source === 'manager' ? '운영자 이용 권한을 확인했습니다.' : data.access.source === 'purchase' ? '합격 계산기 이용권을 확인했습니다.' : '합격 계산기 이용권을 확인했습니다.' : '입금 승인과 이용 인증이 필요합니다.'}</h2></div>
      <button className="jcalc-secondary" type="button" disabled={status === 'loading'} onClick={onRefresh}>이용 상태 다시 확인</button></div>
    {status === 'error' ? <p className="jcalc-error" role="alert">{error}</p> : <p className="jcalc-note" role="status">{status === 'loading' ? '확인이 끝나면 성적 입력과 지원 후보를 이용할 수 있습니다.' : allowed ? '성적과 후보를 입력한 뒤 조회할 수 있습니다. 모집단위별 자료·모델 검증 상태에 따라 결과를 안내합니다.' : '계산기를 신청하고 입금 승인을 받은 뒤 알림톡·문자 링크에서 이메일의 10자리 인증코드를 입력해주세요.'}</p>}
    {status === 'ready' && <div className="jcalc-access-preparation"><strong>{data.service.state === 'preparing' ? '검수 자료 준비 중' : '모집단위별 검증 상태를 확인해주세요.'}</strong><p>{data.service.state === 'preparing' ? '2027학년도 자료를 검수하고 있습니다. 신규 신청 가능 여부는 서비스 신청 화면에서 확인할 수 있습니다.' : '검수본의 연결 여부와 실제 계산 가능 범위는 다를 수 있습니다. 조회한 모집단위의 결과에서 확인해주세요.'}</p></div>}
    {status === 'ready' && !allowed && <div className="jcalc-access-links"><a href="/mypage">내 이용권 확인</a><a href="/2027-jungsi-consulting#calculator">계산기 신청 안내</a></div>}
  </section>;
}
