import React from 'react';
import { ConsultingBrand } from '../ConsultingBrand.jsx';
import { claimConsultingInvite, getConsultingInviteStatus, preflightConsultingInvite } from '../api.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { inviteErrorMessage, safeInviteSummary } from './presentation.js';
import { INVITE_KEY, readConsultingInvite, retryableInviteFailure } from '../invite-model.js';

function openConsultingHome() {
  globalThis.sessionStorage?.removeItem(INVITE_KEY);
  navigateConsulting(CONSULTING_ROUTES.home, { replace: true });
}

export function ConsultingStartScreen({ binding, hasSession }) {
  const [invite, setInvite] = React.useState(readConsultingInvite);
  const [summary, setSummary] = React.useState(null);
  const [status, setStatus] = React.useState(invite ? '초대 정보를 확인하고 있습니다.' : '유효한 초대 정보를 찾을 수 없습니다. 문자로 받은 링크를 다시 열어주세요.');
  const [tone, setTone] = React.useState(invite ? '' : 'error');
  const [code, setCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [canClaim, setCanClaim] = React.useState(false);
  const [linkedInvite, setLinkedInvite] = React.useState(false);
  const [accountConflict, setAccountConflict] = React.useState(false);
  const [checking, setChecking] = React.useState(Boolean(invite));
  const [retryable, setRetryable] = React.useState(false);
  const [checkRevision, setCheckRevision] = React.useState(0);
  const claimRequest = React.useRef(null);
  const staffSession = hasSession && (binding.userRole === 'admin' || binding.userRole === 'tutor');
  const showCodeForm = invite && hasSession && !staffSession && canClaim && !checking;
  const readyMessage = staffSession
    ? '관리자 또는 상담사 계정으로 로그인되어 있습니다. 시크릿 창에서 받은 링크를 열고 컨설팅을 이용할 학생 계정으로 로그인해주세요.'
    : hasSession ? '신청 이메일로 받은 인증코드를 입력해주세요. 현재 로그인한 학생 계정에 컨설팅이 연결됩니다.' : '컨설팅을 이용할 학생 계정으로 로그인하거나 회원가입해주세요.';

  React.useEffect(() => {
    claimRequest.current?.abort();
    claimRequest.current = null;
    setSubmitting(false);
    setCode('');
    setCanClaim(false);
    setLinkedInvite(false);
    setAccountConflict(false);
    setRetryable(false);
    setSummary(null);
    if (!invite) { setChecking(false); return undefined; }
    setChecking(true);
    setTone('');
    setStatus('초대 정보를 확인하고 있습니다.');
    const controller = new AbortController();
    const signedInStudent = hasSession && !staffSession;
    const checkInvite = signedInStudent ? getConsultingInviteStatus : preflightConsultingInvite;
    checkInvite({ ...binding, ...invite, signal: controller.signal }).then(result => {
      if (controller.signal.aborted || (signedInStudent && !binding.hasClientSession())) return;
      setChecking(false);
      if (!result.ok) {
        if (retryableInviteFailure(result)) {
          setRetryable(true);
          setTone('');
          setStatus('초대 정보를 아직 불러오지 못했어요. 연결 상태를 확인한 뒤 다시 확인해주세요. 인증코드가 잘못된 것은 아닙니다.');
          return;
        }
        const usedLink = !signedInStudent && result.code === 'INVITE_ALREADY_CLAIMED';
        setAccountConflict(result.code === 'CONSULTING_ACCOUNT_ALREADY_LINKED');
        setLinkedInvite(usedLink || result.code === 'INVITE_LINKED_TO_OTHER_ACCOUNT');
        setTone(usedLink ? '' : 'error');
        setStatus(usedLink && staffSession ? readyMessage : inviteErrorMessage(result.code, result.status, { preflight: !signedInStudent }));
        return;
      }
      if (signedInStudent && result.data.linked) {
        openConsultingHome();
        return;
      }
      const safeSummary = safeInviteSummary(result.data);
      if (!safeSummary) {
        setTone('error');
        setStatus('초대 정보를 확인할 수 없습니다. 받은 링크를 다시 열어주세요.');
        return;
      }
      setSummary(safeSummary);
      setTone('');
      setCanClaim(true);
      setStatus(readyMessage);
    });
    return () => { controller.abort(); claimRequest.current?.abort(); claimRequest.current = null; };
  }, [binding, hasSession, invite, readyMessage, staffSession, checkRevision]);

  const clearInvite = () => {
    globalThis.sessionStorage?.removeItem(INVITE_KEY);
    setInvite(null);
    setSummary(null);
    setCode('');
    setCanClaim(false);
    setLinkedInvite(false);
    setAccountConflict(false);
    setRetryable(false);
    setChecking(false);
    setTone('');
    setStatus('이 브라우저에서 초대 정보를 지웠습니다. 다시 시작하려면 받은 문자 링크를 열어주세요.');
  };

  const submit = async event => {
    event.preventDefault();
    if (claimRequest.current || !showCodeForm) return;
    if (!/^\d{10}$/.test(code.trim())) {
      setTone('error');
      setStatus('이메일로 받은 10자리 인증코드를 확인해주세요.');
      return;
    }
    const controller = new AbortController();
    claimRequest.current = controller;
    setTone('');
    setStatus('인증코드를 확인하고 있습니다.');
    setSubmitting(true);
    const result = await claimConsultingInvite({ ...binding, ...invite, code: code.trim(), signal: controller.signal });
    if (controller.signal.aborted || claimRequest.current !== controller) return;
    claimRequest.current = null;
    setSubmitting(false);
    if (!result.ok) {
      if (result.code === 'CONSULTING_ACCOUNT_ALREADY_LINKED') {
        setAccountConflict(true);
        setCanClaim(false);
        setCode('');
      }
      if (result.code === 'INVITE_LINKED_TO_OTHER_ACCOUNT') {
        setLinkedInvite(true);
        setCanClaim(false);
        setCode('');
        setSummary(null);
      }
      setTone(retryableInviteFailure(result) ? '' : 'error');
      setStatus(retryableInviteFailure(result) ? '인증 결과를 아직 확인하지 못했어요. 연결 상태를 확인한 뒤 다시 눌러주세요. 같은 요청으로 확인하며 자동 제출하지 않아요.' : inviteErrorMessage(result.code, result.status));
      return;
    }
    openConsultingHome();
  };

  return <main className="consulting-v2-center"><section className="consulting-v2-card" aria-labelledby="consultingStartTitle" aria-busy={checking || submitting}>
    <ConsultingBrand />
    <p className="consulting-v2-kicker">초대받은 계정으로 시작하기</p>
    <h1 id="consultingStartTitle">컨설팅 이용 인증</h1>
    <p className="consulting-v2-status" data-tone={tone || undefined} role="status">{status}</p>
    {checking ? <p className="consulting-v2-status">신청 정보와 이용 상태를 불러오고 있어요. 잠시만 기다려주세요.</p> : null}
    {retryable ? <button type="button" className="consulting-v2-secondary consulting-v2-wide" disabled={checking} onClick={() => setCheckRevision(value => value + 1)}>초대 정보 다시 확인</button> : null}
    {summary ? <div className="consulting-v2-summary">
      <p><span>신청 이메일</span><strong>{summary.maskedEmail}</strong></p>
      <p><span>신청 전화번호</span><strong>{summary.maskedPhone}</strong></p>
      <p><span>인증 기한</span><strong>{new Date(summary.expiresAt).toLocaleString('ko-KR')}</strong></p>
    </div> : null}
    {invite && (!hasSession || ((linkedInvite || accountConflict) && !staffSession)) ? <div className="consulting-v2-actions">
      <a className="consulting-v2-primary" href={`/login?returnUrl=${encodeURIComponent(CONSULTING_ROUTES.start)}`}>{hasSession ? '다른 학생 계정으로 로그인' : '로그인'}</a>
      {!linkedInvite ? <a className="consulting-v2-secondary" href={`/signup?returnUrl=${encodeURIComponent(CONSULTING_ROUTES.start)}`}>회원가입</a> : null}
    </div> : null}
    {showCodeForm ? <form className="consulting-v2-form" onSubmit={submit}>
      <p className="consulting-v2-status">학생 한 명당 별도의 로그인 계정이 필요합니다. 형제자매도 각자의 계정을 사용해주세요. 신청 연락 이메일은 함께 사용해도 됩니다.</p>
      <label htmlFor="consultingInviteCode">이메일로 받은 10자리 인증코드</label>
      <input id="consultingInviteCode" value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 10)); if (!submitting) { setTone(''); setStatus(readyMessage); } }} disabled={submitting} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{10}" maxLength="10" required />
      <button type="submit" disabled={submitting}>{submitting ? '확인 중…' : '유료회원 인증하고 시작하기'}</button>
    </form> : null}
    {accountConflict ? <div className="consulting-v2-form"><p className="consulting-v2-status">현재 계정에서 로그아웃한 뒤 이번 신청 학생의 계정으로 로그인해주세요. 새 신청은 아직 연결되지 않았고 기존 조사서도 변경되지 않았습니다.</p>
      <button className="consulting-v2-secondary" type="button" onClick={() => { if (globalThis.confirm('새 신청을 연결하지 않고, 이 계정에 이전에 연결한 컨설팅으로 이동할까요?')) openConsultingHome(); }}>이전에 연결한 내 컨설팅 보기</button>
    </div> : null}
    {hasSession && !staffSession && !invite ? <button className="consulting-v2-primary consulting-v2-wide" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>내 진행 현황 보기</button> : null}
    <button className="consulting-v2-link" type="button" onClick={clearInvite}>이 초대 정보 지우기</button>
  </section></main>;
}
