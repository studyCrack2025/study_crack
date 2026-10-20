import React from 'react';
import { claimConsultingInvite, preflightConsultingInvite } from '../api.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { inviteErrorMessage, safeInviteSummary } from './presentation.js';

const INVITE_KEY = 'sc_jungsi_invite_v1';

function readInvite() {
  try {
    const value = JSON.parse(globalThis.sessionStorage?.getItem(INVITE_KEY) || 'null');
    if (value?.version !== 1 || !/^APP_[0-9a-f-]{36}$/i.test(value.applicationId || '') || !/^[A-Za-z0-9_-]{43}$/.test(value.token || '') || !/^claim_[0-9a-f-]{36}$/i.test(value.idempotencyKey || '')) return null;
    return value;
  } catch { return null; }
}

export function ConsultingStartScreen({ binding, hasSession }) {
  const [invite, setInvite] = React.useState(readInvite);
  const [summary, setSummary] = React.useState(null);
  const [status, setStatus] = React.useState(invite ? '초대 정보를 확인하고 있습니다.' : '유효한 초대 정보를 찾을 수 없습니다. 문자로 받은 링크를 다시 열어주세요.');
  const [tone, setTone] = React.useState(invite ? '' : 'error');
  const [code, setCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!invite) return undefined;
    const controller = new AbortController();
    preflightConsultingInvite({ ...binding, ...invite, signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (!result.ok) {
        if (result.status === 409 && hasSession) {
          setStatus('이미 처리된 초대인지 로그인 계정으로 확인해주세요.');
          return;
        }
        setTone('error');
        setStatus(inviteErrorMessage(result.code, result.status));
        return;
      }
      const safeSummary = safeInviteSummary(result.data);
      if (!safeSummary) {
        setTone('error');
        setStatus('초대 정보를 확인할 수 없습니다. 받은 링크를 다시 열어주세요.');
        return;
      }
      setSummary(safeSummary);
      setStatus(hasSession ? '이메일로 받은 인증코드를 입력해주세요.' : '신청 시 입력한 연락처와 같은 계정으로 로그인해주세요.');
    });
    return () => controller.abort();
  }, [binding.fetchImpl, binding.publicApiUrl, hasSession, invite]);

  const clearInvite = () => {
    globalThis.sessionStorage?.removeItem(INVITE_KEY);
    setInvite(null);
    setSummary(null);
    setTone('');
    setStatus('이 브라우저에서 초대 정보를 지웠습니다. 다시 시작하려면 받은 문자 링크를 열어주세요.');
  };

  const submit = async event => {
    event.preventDefault();
    if (!invite || !/^\d{10}$/.test(code.trim())) {
      setTone('error');
      setStatus('이메일로 받은 10자리 인증코드를 확인해주세요.');
      return;
    }
    setSubmitting(true);
    const result = await claimConsultingInvite({ ...binding, ...invite, code: code.trim() });
    setSubmitting(false);
    if (!result.ok) {
      setTone('error');
      setStatus(inviteErrorMessage(result.code, result.status));
      return;
    }
    globalThis.sessionStorage?.removeItem(INVITE_KEY);
    navigateConsulting(CONSULTING_ROUTES.home, { replace: true });
  };

  return <main className="consulting-v2-center"><section className="consulting-v2-card" aria-labelledby="consultingStartTitle">
    <img className="consulting-v2-logo" src="/assets/images/studycrack_logo_wo_bg.png" alt="StudyCrack" />
    <p className="consulting-v2-kicker">2027 정시 컨설팅</p>
    <h1 id="consultingStartTitle">컨설팅 이용 인증</h1>
    <p className="consulting-v2-status" data-tone={tone || undefined} role="status">{status}</p>
    {summary ? <div className="consulting-v2-summary">
      <p><span>등록 이메일</span><strong>{summary.maskedEmail}</strong></p>
      <p><span>등록 전화번호</span><strong>{summary.maskedPhone}</strong></p>
      <p><span>인증 기한</span><strong>{new Date(summary.expiresAt).toLocaleString('ko-KR')}</strong></p>
    </div> : null}
    {invite && !hasSession ? <div className="consulting-v2-actions">
      <a className="consulting-v2-primary" href={`/login?returnUrl=${encodeURIComponent(CONSULTING_ROUTES.start)}`}>로그인</a>
      <a className="consulting-v2-secondary" href={`/signup?returnUrl=${encodeURIComponent(CONSULTING_ROUTES.start)}`}>회원가입</a>
    </div> : null}
    {invite && hasSession ? <form className="consulting-v2-form" onSubmit={submit}>
      <label htmlFor="consultingInviteCode">이메일로 받은 10자리 인증코드</label>
      <input id="consultingInviteCode" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{10}" maxLength="10" required />
      <button type="submit" disabled={submitting}>{submitting ? '확인 중…' : '유료회원 인증하고 시작하기'}</button>
    </form> : null}
    {hasSession && !invite ? <button className="consulting-v2-primary consulting-v2-wide" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>내 진행 현황 보기</button> : null}
    <button className="consulting-v2-link" type="button" onClick={clearInvite}>이 초대 정보 지우기</button>
  </section></main>;
}
