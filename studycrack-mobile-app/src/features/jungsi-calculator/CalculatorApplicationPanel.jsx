import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { calculatorApplicationLabels, getCalculatorApplications, previewCalculatorApplication, readCalculatorReceipt } from './calculator-application-api.js';

const formatDate = value => value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '확인 필요';
function ApplicationCard({ application }) {
  return <article aria-label="나의 계산기 신청 상태"><h3>{calculatorApplicationLabels[application.state]}</h3>
    <p className="jcalc-note">신청 금액 · {application.amount === 25000 ? '25,000원' : '운영팀 확인 필요'}<br />이용 기한 · {formatDate(application.accessEndsAt)} (한국시간)</p>
    {application.state === 'pending_payment' && <p>입금 후 운영팀 확인을 기다려주세요. 승인되면 알림톡·문자로 이용 링크, 이메일로 10자리 인증코드를 보내드립니다.</p>}
    {application.state === 'pending_payment' && application.paymentDueAt && <p className="jcalc-note">결제 마감 · {formatDate(application.paymentDueAt)} (한국시간){Date.now() >= Date.parse(application.paymentDueAt) ? ' · 기한이 지났습니다. 추가 입금 전 운영팀에 문의해주세요.' : ''}</p>}
    {application.state === 'activation_required' && <p>알림톡·문자로 받은 이용 링크를 열고 학생 본인 계정으로 로그인한 뒤 이메일의 10자리 인증코드를 입력해주세요.</p>}
    {application.state === 'active' && <p>입금 승인과 이용 인증을 완료했습니다. 이 학생 계정으로 계산기를 이용할 수 있습니다.</p>}
    {['held', 'input_review', 'check_required', 'revoked'].includes(application.state) && <p>현재 신청 상태는 운영팀에 확인해주세요. 별도의 신청 상태 연결 없이, 승인 후 받은 이용 링크에서 인증하면 됩니다.</p>}
    {application.state === 'expired' && <p>계산기 이용 기간이 종료됐습니다.</p>}
    {application.state === 'rejected' && <p>신청 처리 내역은 운영팀에 문의해주세요. 추가로 입금하지 마세요.</p>}
  </article>;
}
export default function CalculatorApplicationPanel({ onLoaded, accessDenied = false, onRetry }) {
  const binding = React.useMemo(() => getMobileApiBinding('consulting', 'consultingApiUrl'), []);
  const [resource, setResource] = React.useState({ status: 'loading', home: null, receipt: null });
  const pending = React.useRef(null), sequence = React.useRef(0);
  const refresh = React.useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(), current = ++sequence.current; pending.current = controller;
    onLoaded?.(null); setResource({ status: 'loading', home: null, receipt: null });
    let credentials = null; try { credentials = readCalculatorReceipt(); } catch {}
    const [home, receipt] = await Promise.all([getCalculatorApplications(binding, controller.signal), credentials ? previewCalculatorApplication(binding, credentials, controller.signal) : null]);
    if (controller.signal.aborted || current !== sequence.current) return;
    setResource({ status: home.ok ? 'ready' : 'error', home: home.ok ? home.data : null, receipt: receipt?.ok ? receipt.data.application : null });
    pending.current = null; onLoaded?.(home.ok ? home.data : null);
  }, [binding, onLoaded]);
  React.useEffect(() => {
    refresh();
    const clear = () => { sequence.current++; pending.current?.abort(); onLoaded?.(null); setResource({ status: 'ended', home: null, receipt: null }); };
    globalThis.addEventListener('studycrack:session-ended', clear);
    return () => { sequence.current++; pending.current?.abort(); globalThis.removeEventListener('studycrack:session-ended', clear); };
  }, [refresh]);
  if (resource.status === 'ended') return null;
  const items = [...(resource.home?.items || [])];
  if (resource.receipt && !items.some(item => item.applicationId === resource.receipt.applicationId)) items.push(resource.receipt);
  if (accessDenied && items.some(item => item.accessActive)) return <section className="jcalc-panel jcalc-application" aria-label="계산기 이용 정보 확인">
    <h2>이용 정보를 확인하지 못했습니다.</h2><p className="jcalc-error" role="alert">인증된 이용권과 계산기 연결 상태를 확인하지 못했습니다. 다시 시도하거나 이용 문의로 연락해주세요.</p>
    <button className="jcalc-secondary" type="button" onClick={onRetry}>다시 시도</button>
  </section>;
  return <section className="jcalc-panel jcalc-application" aria-label="나의 계산기 신청" aria-busy={resource.status === 'loading'}>
    <div className="jcalc-access-head"><div><p className="jcalc-eyebrow">신청 현황</p><h2>나의 계산기 신청</h2></div><button className="jcalc-secondary" type="button" onClick={refresh} disabled={resource.status === 'loading'}>신청 상태 다시 확인</button></div>
    {resource.status === 'loading' ? <p className="jcalc-note" role="status">신청과 이용 인증 상태를 확인하고 있습니다.</p> : resource.status === 'error' ? <p className="jcalc-error" role="alert">신청 상태를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p> : <>
      {items.map(item => <ApplicationCard key={item.applicationId} application={item} />)}
      {!items.length && <p className="jcalc-note">이 계정에 인증된 계산기 이용권이 없습니다. 신청 후 입금 승인을 기다려주세요. 승인 후 받은 알림톡·문자 링크에서 이메일의 10자리 코드로 이용 인증을 완료하면 됩니다.</p>}
      {(resource.home.hasMore || resource.home.needsReview) && <p className="jcalc-note">확인이 필요한 신청이 있습니다. 운영팀에 문의해주세요.</p>}
    </>}
  </section>;
}
