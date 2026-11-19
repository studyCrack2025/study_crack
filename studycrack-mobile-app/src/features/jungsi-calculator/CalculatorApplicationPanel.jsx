import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { calculatorApplicationLabels, getCalculatorApplications, linkCalculatorApplication, previewCalculatorApplication, readCalculatorReceipt } from './calculator-application-api.js';

const formatDate = value => value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '확인 필요';
function ApplicationCard({ application }) {
  const opening = Date.now() < Date.parse(application.openingAt);
  return <article aria-label="연결된 계산기 신청">
    <h3>{calculatorApplicationLabels[application.state]}</h3>
    <p className="jcalc-note">접수번호 · {application.applicationId}<br />신청 금액 · {application.amount === 25000 ? '25,000원' : '운영팀 확인 필요'}<br />이용 기한 · {formatDate(application.accessEndsAt)} (한국시간)</p>
    {application.state === 'pending_payment' && <p>입금 후 운영팀 확인을 기다려주세요. 계좌 정보는 신청했던 화면의 ‘신청 내역 확인’에서 확인할 수 있습니다.</p>}
    {application.state === 'pending_payment' && application.paymentDueAt && <p className="jcalc-note">결제 마감 · {formatDate(application.paymentDueAt)} (한국시간){Date.now() >= Date.parse(application.paymentDueAt) ? ' · 기한이 지났습니다. 추가 입금 전 운영팀에 문의해주세요.' : ''}</p>}
    {application.state === 'activation_required' && <p>문자로 받은 이용 링크를 열고 이메일의 10자리 인증코드로 이용 인증을 완료해주세요.</p>}
    {application.state === 'active' && <p>{opening ? '이용권이 확인되었습니다. 합격 계산기는 11월 28일 공개 예정이며, 공개 전에도 성적과 지원 후보를 입력할 수 있습니다.' : '이 계정에 계산기 이용권이 연결되었습니다.'}</p>}
    {['held', 'input_review', 'check_required', 'revoked'].includes(application.state) && <p>운영팀에 신청번호를 알려주시고 현재 상태를 확인해주세요. 신청 상태 연결만으로 이용권이 활성화되지는 않습니다.</p>}
    {application.state === 'rejected' && <p>신청 처리 내역은 운영팀에 문의해주세요. 추가로 입금하지 마세요.</p>}
  </article>;
}
export default function CalculatorApplicationPanel() {
  const binding = React.useMemo(() => getMobileApiBinding('consulting', 'consultingApiUrl'), []);
  const [resource, setResource] = React.useState({ status: 'loading', home: null, preview: null, credentials: null, previewError: false });
  const [confirmed, setConfirmed] = React.useState(false), [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState('');
  const pending = React.useRef(null), sequence = React.useRef(0);
  const refresh = React.useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(), current = ++sequence.current; pending.current = controller;
    setConfirmed(false); setMessage(''); setBusy(false); setResource({ status: 'loading', home: null, preview: null, credentials: null, previewError: false });
    let credentials = null; try { credentials = readCalculatorReceipt(); } catch {}
    const [home, preview] = await Promise.all([getCalculatorApplications(binding, controller.signal), credentials ? previewCalculatorApplication(binding, credentials, controller.signal) : null]);
    if (controller.signal.aborted || current !== sequence.current) return;
    setResource({ status: home.ok ? 'ready' : 'error', home: home.ok ? home.data : null, preview: preview?.ok ? preview.data : null, credentials, previewError: Boolean(preview && !preview.ok) });
    pending.current = null;
  }, [binding]);
  React.useEffect(() => {
    refresh();
    const clear = () => { sequence.current++; pending.current?.abort(); setResource({ status: 'ended', home: null, preview: null, credentials: null }); setConfirmed(false); setBusy(false); setMessage(''); };
    globalThis.addEventListener('studycrack:session-ended', clear);
    return () => { sequence.current++; pending.current?.abort(); globalThis.removeEventListener('studycrack:session-ended', clear); };
  }, [refresh]);
  const connect = async () => {
    if (!confirmed || busy || !resource.preview || resource.preview.linked || !resource.credentials || resource.status !== 'ready') return;
    if (!globalThis.confirm('현재 로그인한 학생 계정' + (resource.preview.accountEmailMask ? ' (' + resource.preview.accountEmailMask + ')' : '') + '에 이 계산기 신청 상태를 연결할까요?\n접수번호: ' + resource.preview.application.applicationId + '\n이용권 활성화는 입금 확인과 이용 인증 후 진행됩니다.')) return;
    const controller = new AbortController(), current = ++sequence.current; pending.current = controller; setBusy(true); setMessage('');
    const result = await linkCalculatorApplication(binding, resource.credentials, resource.preview, controller.signal);
    if (controller.signal.aborted || current !== sequence.current) return;
    if (result.ok) { pending.current = null; await refresh(); if (!controller.signal.aborted && current + 1 === sequence.current) setMessage('신청 상태를 연결했습니다. 다른 기기에서도 이 학생 계정으로 확인할 수 있습니다.'); }
    else { setConfirmed(false); setResource(previous => ({ ...previous, preview: null, credentials: null })); setMessage('연결 결과를 확인하지 못했습니다. 자동 재전송하지 않습니다. 신청 상태를 다시 확인해주세요.'); }
    if (current === sequence.current) { pending.current = null; setBusy(false); }
  };
  if (resource.status === 'ended') return null;
  return <section className="jcalc-panel jcalc-application" aria-label="나의 계산기 신청" aria-busy={resource.status === 'loading' || busy}>
    <div className="jcalc-access-head"><div><p className="jcalc-eyebrow">신청 현황</p><h2>나의 계산기 신청</h2></div><button className="jcalc-secondary" type="button" onClick={refresh} disabled={busy || resource.status === 'loading'}>신청 상태 다시 확인</button></div>
    {resource.status === 'loading' ? <p className="jcalc-note" role="status">신청과 이용 인증 상태를 확인하고 있습니다.</p> : resource.status === 'error' ? <p className="jcalc-error" role="alert">신청 상태를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p> : <>
      {resource.home.items.map(item => <ApplicationCard key={item.applicationId} application={item} />)}
      {!resource.home.items.length && <p className="jcalc-note">이 계정에 연결된 계산기 신청이 없습니다. 신청한 브라우저에서 로그인해 신청 상태를 연결하거나, 입금 확인 후 받은 이용 링크로 인증해주세요.</p>}
      {(resource.home.hasMore || resource.home.needsReview) && <p className="jcalc-note">이 목록에서 확인되지 않은 신청이 있습니다. 운영팀에 신청번호를 알려주세요.</p>}
      {resource.preview && !resource.preview.linked && <div className="jcalc-release-note"><h3>방금 신청한 계산기 상태를 연결할까요?</h3><p className="jcalc-note">접수번호 · {resource.preview.application.applicationId}<br />현재 로그인 계정 · {resource.preview.accountEmailMask || '학생 계정'}<br />신청 상태만 연결하며, 계산기 이용권은 입금 확인과 이용 인증 후 활성화됩니다.</p><label className="jcalc-note"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> 계산기를 이용할 학생 본인의 로그인 계정임을 확인했습니다</label><button className="jcalc-primary" type="button" disabled={busy || !confirmed} onClick={connect}>{busy ? '신청 연결 중…' : '이 계정에 신청 상태 연결'}</button></div>}
      {resource.previewError && <p className="jcalc-note">이 브라우저의 접수 정보를 연결하지 못했습니다. 신청했던 계정을 확인하거나 운영팀에 문의해주세요. 기존에 연결한 신청은 위에서 확인할 수 있습니다.</p>}
    </>}
    {message && <p role="status" className="jcalc-note">{message}</p>}
  </section>;
}
