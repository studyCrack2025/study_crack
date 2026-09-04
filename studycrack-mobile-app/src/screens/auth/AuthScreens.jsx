import { STUDYCRACK_SYMBOL_SRC } from '../../constants/assets.js';
import { AppContent, AppFrame } from '../../components/AppFrame.js';
import { Modal } from '../../components/Modal.jsx';
import { TermsModal } from '../../components/TermsModal.jsx';

const AUTH_INPUT_CLASS = 'planner-input sc-input auth-input';

function Logo({ src = STUDYCRACK_SYMBOL_SRC }) {
  return (
    <div className="auth-logo-wrap">
      <img
        src={src}
        className="auth-logo"
        alt="StudyCrack 심볼"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
          const fallback = event.currentTarget.nextElementSibling;
          if (fallback) fallback.style.display = 'block';
        }}
      />
      <span className="auth-logo-fallback">S</span>
    </div>
  );
}

function SocialButtons({ suffix = '로그인' }) {
  return (
    <div className="auth-sso-row">
      <button className="auth-sso-btn google" data-action="ssoSuccess" data-provider="google">
        <img className="auth-sso-icon" src="./assets/images/social-google.svg" alt="" aria-hidden="true" />
        <span>Google로 {suffix}</span>
      </button>
      <button className="auth-sso-btn naver" data-action="ssoSuccess" data-provider="naver">
        <img className="auth-sso-icon" src="./assets/images/social-naver.svg" alt="" aria-hidden="true" />
        <span>Naver로 {suffix}</span>
      </button>
    </div>
  );
}

function FindEmailModal({ foundEmailMasked = '' }) {
  return (
    <Modal ariaLabel="이메일 찾기" dismissAction="closeFindEmailModal" overlayClass="find-email-modal-backdrop" panelClass="find-email-modal auth-recovery-modal">
        <div className="sc-modal-head auth-recovery-head">
          <div className="auth-recovery-copy">
            <span className="auth-recovery-eyebrow">계정 복구</span>
            <h3 id="find-email-title">이메일 찾기</h3>
            <p className="sub">가입 시 등록한 이름과 휴대폰 번호로 계정을 확인합니다.</p>
          </div>
          <button type="button" className="sc-overlay-close close-btn" data-action="closeFindEmailModal" aria-label="닫기">×</button>
        </div>
        <div className="sc-modal-body auth-recovery-body">
          <div className="auth-recovery-fields">
            <input className="planner-input" data-find-email-name placeholder="이름" autoComplete="name" />
            <input className="planner-input" data-field="findEmailPhone" inputMode="numeric" placeholder="휴대폰 번호" autoComplete="tel" />
          </div>
          {foundEmailMasked && <div className="find-email-result"><span>확인된 이메일</span><b>{foundEmailMasked}</b></div>}
        </div>
        <div className="sc-modal-footer"><button type="button" className="btn btn-primary auth-recovery-submit" data-action={foundEmailMasked ? 'closeFindEmailModal' : 'findEmailByNamePhone'}>{foundEmailMasked ? '로그인으로 돌아가기' : '이메일 찾기'}</button></div>
    </Modal>
  );
}

function ResetPasswordModal({ email = '', sending = false, step = 'request' }) {
  const isRequest = step === 'request';
  return (
    <Modal ariaLabel="비밀번호 재설정" dismissAction="closeResetPasswordModal" overlayClass="find-email-modal-backdrop" panelClass="find-email-modal auth-recovery-modal">
        <div className="sc-modal-head auth-recovery-head">
          <div className="auth-recovery-copy">
            <span className="auth-recovery-eyebrow">{isRequest ? '계정 복구' : '인증 코드 확인'}</span>
            <h3 id="reset-password-title">비밀번호 재설정</h3>
            <p className="sub">{isRequest ? '가입하신 이메일 주소로 비밀번호 재설정 코드를 보내드립니다.' : '이메일로 발송된 6자리 코드와 새 비밀번호를 입력해주세요.'}</p>
          </div>
          <button type="button" className="sc-overlay-close close-btn" data-action="closeResetPasswordModal" aria-label="닫기">×</button>
        </div>
        <div className="sc-modal-body auth-recovery-body">
          <div className="auth-recovery-fields">
            {isRequest ? (
              <input className="planner-input" data-reset-email data-email-input type="email" inputMode="email" lang="en" autoCapitalize="none" spellCheck="false" placeholder="가입한 이메일 주소" defaultValue={email} autoComplete="email" />
            ) : (
              <>
                <input className="planner-input" data-reset-code placeholder="인증 코드 6자리" inputMode="numeric" />
                <input className="planner-input" data-reset-password type="password" placeholder="새 비밀번호 (8자 이상)" autoComplete="new-password" />
                <input className="planner-input" data-reset-password-confirm type="password" placeholder="새 비밀번호 확인" autoComplete="new-password" />
              </>
            )}
          </div>
        </div>
        <div className="sc-modal-footer"><button type="button" className="btn btn-primary auth-recovery-submit" data-action={isRequest ? 'requestResetPasswordCode' : 'submitResetPassword'} disabled={sending}>{isRequest ? (sending ? '발송 중...' : '인증 코드 받기') : '비밀번호 변경 완료'}</button></div>
    </Modal>
  );
}

function AuthShell({ children, overlays = null, overlayOpen = Boolean(overlays), screen }) {
  return (
    <AppFrame>
      <AppContent inactive={overlayOpen} lockScroll={overlayOpen} screen={screen}>{children}</AppContent>
      {overlayOpen && overlays ? <div className="app-screen-overlays">{overlays}</div> : null}
    </AppFrame>
  );
}

function AuthDirectRecoveryScreen({ children, description, screen, title }) {
  return (
    <AuthShell screen={screen}>
      <div className="auth-screen">
        <div className="auth-entry-layout auth-direct-recovery">
          <header className="auth-brand-block">
            <Logo />
            <div className="auth-brand-copy"><h1 className="auth-brand-name">StudyCrack</h1><p className="auth-brand-tagline">계정 정보를 안전하게 확인해요.</p></div>
          </header>
          <div className="auth-unified-card auth-form-card">
            <span className="auth-recovery-eyebrow">계정 복구</span>
            <h1>{title}</h1>
            <p className="sub">{description}</p>
            {children}
            <button type="button" className="auth-link-btn auth-direct-back" data-action="goto" data-target="authLogin">로그인 화면으로 돌아가기</button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

export function AuthFindIdScreen(ctx) {
  const { foundEmailMasked = '' } = ctx;
  return (
    <AuthDirectRecoveryScreen screen="authFindId" title="이메일 찾기" description="가입 시 등록한 이름과 휴대폰 번호로 이메일을 확인합니다.">
      <div className="auth-recovery-fields">
        <input className={AUTH_INPUT_CLASS} data-find-email-name placeholder="이름" autoComplete="name" />
        <input className={AUTH_INPUT_CLASS} data-field="findEmailPhone" inputMode="numeric" placeholder="휴대폰 번호" autoComplete="tel" />
      </div>
      {foundEmailMasked ? <div className="find-email-result" role="status"><span>확인된 이메일</span><b>{foundEmailMasked}</b></div> : null}
      <button type="button" className="btn btn-primary auth-submit" data-action={foundEmailMasked ? 'goto' : 'findEmailByNamePhone'} data-target={foundEmailMasked ? 'authLogin' : undefined}>{foundEmailMasked ? '이 이메일로 로그인하기' : '이메일 찾기'}</button>
    </AuthDirectRecoveryScreen>
  );
}

export function AuthFindPwScreen(ctx) {
  const { resetPasswordEmail = '', resetPasswordSending = false, resetPasswordStep = 'request' } = ctx;
  const isRequest = resetPasswordStep === 'request';
  return (
    <AuthDirectRecoveryScreen screen="authFindPw" title="비밀번호 재설정" description={isRequest ? '가입한 이메일로 비밀번호 재설정 코드를 보내드립니다.' : `${resetPasswordEmail}로 받은 코드와 새 비밀번호를 입력해주세요.`}>
      <div className="auth-recovery-fields">
        {isRequest ? <input className={AUTH_INPUT_CLASS} data-reset-email data-email-input type="email" inputMode="email" lang="en" autoCapitalize="none" spellCheck="false" placeholder="가입한 이메일 주소" defaultValue={resetPasswordEmail} autoComplete="email" /> : <>
          <input className={AUTH_INPUT_CLASS} data-reset-code placeholder="인증 코드 6자리" inputMode="numeric" autoComplete="one-time-code" />
          <input className={AUTH_INPUT_CLASS} data-reset-password type="password" placeholder="새 비밀번호 (8자 이상)" autoComplete="new-password" />
          <input className={AUTH_INPUT_CLASS} data-reset-password-confirm type="password" placeholder="새 비밀번호 확인" autoComplete="new-password" />
        </>}
      </div>
      <button type="button" className="btn btn-primary auth-submit" data-action={isRequest ? 'requestResetPasswordCode' : 'submitResetPassword'} disabled={resetPasswordSending}>{isRequest ? (resetPasswordSending ? '발송 중...' : '인증 코드 받기') : '비밀번호 변경 완료'}</button>
    </AuthDirectRecoveryScreen>
  );
}

export function AuthLoginScreen(ctx) {
  const {
    authError = '',
    authSubmitting = false,
    findEmailModalOpen = false,
    foundEmailMasked = '',
    resetPasswordEmail = '',
    resetPasswordModalOpen = false,
    resetPasswordSending = false,
    resetPasswordStep = 'request'
  } = ctx;

  const overlays = <>{findEmailModalOpen && <FindEmailModal foundEmailMasked={foundEmailMasked} />}{resetPasswordModalOpen && <ResetPasswordModal email={resetPasswordEmail} sending={resetPasswordSending} step={resetPasswordStep} />}</>;

  return (
    <AuthShell screen="authLogin" overlayOpen={findEmailModalOpen || resetPasswordModalOpen} overlays={overlays}>
      <div className="auth-screen">
        <div className="auth-entry-layout">
          <header className="auth-brand-block">
            <Logo />
            <div className="auth-brand-copy">
              <h1 className="auth-brand-name">StudyCrack</h1>
              <p className="auth-brand-tagline">합격 전략을 시작해볼까요?</p>
            </div>
          </header>
          <div className="auth-unified-card">
            <div className="auth-form-stack">
              <label className="auth-field sc-field"><span>이메일</span><input id="auth-login-email" className={AUTH_INPUT_CLASS} data-field="loginEmail" data-email-input type="email" inputMode="email" lang="en" autoCapitalize="none" spellCheck="false" autoComplete="username" placeholder="example@studycrack.co.kr" aria-describedby={authError ? 'auth-login-error' : undefined} /></label>
              <label className="auth-field sc-field"><span>비밀번호</span><div className="auth-password-field"><input id="auth-login-password" className={AUTH_INPUT_CLASS} data-login-password type="password" autoComplete="current-password" placeholder="비밀번호를 입력해주세요" aria-describedby={authError ? 'auth-login-error' : undefined} /><button type="button" className="auth-password-toggle" data-action="toggleLoginPasswordVisibility" aria-label="비밀번호 보기">보기</button></div></label>
              {authError && <p id="auth-login-error" className="auth-error sc-field-error" role="alert">{authError}</p>}
              <button className="btn btn-primary auth-submit" data-action="loginSuccess" disabled={authSubmitting}>
                {authSubmitting ? <><span className="auth-button-spinner" aria-hidden="true" />로그인 중...</> : '로그인'}
              </button>
            </div>
            <div className="auth-divider"><span>소셜 계정으로 로그인</span></div>
            <SocialButtons />
            <div className="auth-helper-row">
              <button className="auth-link-btn btn-quiet" data-action="openFindEmailModal">이메일 찾기</button>
              <span aria-hidden="true" />
              <button className="auth-link-btn" data-action="openResetPasswordModal">비밀번호 찾기</button>
            </div>
            <button className="auth-link-btn auth-signup-link" data-action="goto" data-target="authSignup"><span>아직 계정이 없나요?</span><b>회원가입</b><i aria-hidden="true">›</i></button>
          </div>
          <p className="auth-entry-footnote">환산 분석 · 플래너 · 학습 코칭을 한 곳에서</p>
        </div>
      </div>
    </AuthShell>
  );
}

function VerifyStatus({ done, label }) {
  return <span className={`signup-verify-status ${done ? 'done' : ''}`}>{done ? `${label} 완료` : `${label} 필요`}</span>;
}

function TermsLine({ checked = false, label, onToggle, required = false, type }) {
  return (
    <div className="auth-terms-check-row">
      <input type="checkbox" data-signup-term={type} data-signup-term-required={required ? 'true' : undefined} checked={checked} onChange={(event) => onToggle(type, event.currentTarget.checked)} />
      <span>{required ? '(필수)' : '(선택)'} {label}</span>
      <button type="button" className="auth-terms-view" data-action="openSignupTermsModal" data-terms-type={type}>전문보기</button>
    </div>
  );
}

function SignupStep({ ctx, step }) {
  const {
    signupEmailSending = false,
    signupForm = {},
    signupSmsSending = false,
    signupSubmitting = false,
    signupTerms = {},
    signupVerifiedEmail = '',
    signupVerifiedPhone = ''
  } = ctx;
  const emailVerified = Boolean(signupVerifiedEmail);
  const phoneVerified = Boolean(signupVerifiedPhone);
  const allTermsChecked = ['standard', 'service', 'privacy', 'refund', 'marketing'].every((key) => signupTerms[key] === true);
  const toggleTerm = (type, value) => {
    ctx.setSignupError('');
    ctx.setSignupTerms({ ...signupTerms, [type]: value });
  };
  const toggleAllTerms = (value) => {
    ctx.setSignupError('');
    ctx.setSignupTerms({
      standard: value,
      service: value,
      privacy: value,
      refund: value,
      marketing: value
    });
  };

  if (step === 1) {
    return (
      <section className="signup-stage" key="terms">
        <div className="signup-stage-head"><span>1단계</span><h2>서비스 이용에 동의해주세요</h2><p>필수 약관을 확인한 뒤 다음 단계로 이동할 수 있어요.</p></div>
        <div className="signup-section auth-terms-preview native">
          <label className="auth-terms-check-row all"><input type="checkbox" checked={allTermsChecked} onChange={(event) => toggleAllTerms(event.currentTarget.checked)} /><b>약관 전체 동의</b></label>
          <TermsLine checked={signupTerms.standard} label="스터디크랙 이용약관 동의" onToggle={toggleTerm} required type="standard" />
          <TermsLine checked={signupTerms.service} label="서비스 이용약관 조항 동의" onToggle={toggleTerm} required type="service" />
          <TermsLine checked={signupTerms.privacy} label="개인정보 처리방침 동의" onToggle={toggleTerm} required type="privacy" />
          <TermsLine checked={signupTerms.refund} label="환불 규정 동의" onToggle={toggleTerm} required type="refund" />
          <TermsLine checked={signupTerms.marketing} label="마케팅 정보 수신 동의" onToggle={toggleTerm} type="marketing" />
        </div>
      </section>
    );
  }

  if (step === 2) {
    return (
      <section className="signup-stage" key="identity">
        <div className="signup-stage-head"><span>2단계</span><h2>기본 정보와 휴대폰을 확인할게요</h2><p>본인 확인과 서비스 안내에 필요한 정보입니다.</p></div>
        <div className="signup-section">
          <div className="signup-section-head"><p className="section-title">기본 정보</p><VerifyStatus done={phoneVerified} label="전화번호" /></div>
          <input className={AUTH_INPUT_CLASS} data-field="signupName" autoComplete="name" placeholder="이름" defaultValue={signupForm.name} />
          <div className="signup-two-col">
            <select className={AUTH_INPUT_CLASS} data-field="signupGender" defaultValue={signupForm.gender || ''}>
              <option value="">성별</option><option value="male">남성</option><option value="female">여성</option>
            </select>
            <input className={AUTH_INPUT_CLASS} data-field="signupBirthdate" type="date" defaultValue={signupForm.birthdate} />
          </div>
          <input className={AUTH_INPUT_CLASS} data-field="signupPhone" inputMode="numeric" autoComplete="tel" placeholder="휴대폰 번호 (01012345678)" defaultValue={signupForm.phoneRaw} />
          <button type="button" className="btn btn-secondary signup-inline-btn" data-action="sendSignupSmsCode" disabled={signupSmsSending || signupSubmitting}>{signupSmsSending ? '발송 중...' : 'SMS 인증번호 받기'}</button>
          <div className="signup-code-row">
            <input className={AUTH_INPUT_CLASS} data-field="signupPhoneCode" inputMode="numeric" placeholder="인증번호 6자리" defaultValue={signupForm.phoneCode} />
            <button type="button" className="btn btn-secondary signup-code-btn" data-action="verifySignupPhone" disabled={signupSubmitting}>확인</button>
          </div>
        </div>
      </section>
    );
  }

  if (step === 3) {
    return (
      <section className="signup-stage" key="email">
        <div className="signup-stage-head"><span>3단계</span><h2>로그인에 사용할 이메일을 인증해주세요</h2><p>인증번호는 입력한 이메일 주소로 발송됩니다.</p></div>
        <div className="signup-section">
          <div className="signup-section-head"><p className="section-title">이메일 인증</p><VerifyStatus done={emailVerified} label="이메일" /></div>
          <input className={AUTH_INPUT_CLASS} data-field="signupEmail" data-email-input type="email" inputMode="email" lang="en" autoCapitalize="none" spellCheck="false" autoComplete="email" placeholder="이메일" defaultValue={signupForm.email} />
          <button type="button" className="btn btn-secondary signup-inline-btn" data-action="sendSignupEmailCode" disabled={signupEmailSending || signupSubmitting}>{signupEmailSending ? '발송 중...' : '이메일 인증번호 받기'}</button>
          <div className="signup-code-row">
            <input className={AUTH_INPUT_CLASS} data-field="signupEmailCode" inputMode="numeric" placeholder="인증번호 6자리" defaultValue={signupForm.emailCode} />
            <button type="button" className="btn btn-secondary signup-code-btn" data-action="verifySignupEmail" disabled={signupSubmitting}>확인</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="signup-stage" key="account">
      <div className="signup-stage-head"><span>4단계</span><h2>마지막으로 계정 정보를 설정해주세요</h2><p>안전한 비밀번호를 만들면 가입이 완료됩니다.</p></div>
      <div className="signup-section">
        <p className="section-title">비밀번호</p>
        <input className={AUTH_INPUT_CLASS} data-field="signupPassword" type="password" autoComplete="new-password" placeholder="영문 대/소문자, 숫자, 특수문자 포함 8자 이상" defaultValue={signupForm.password} />
        <input className={AUTH_INPUT_CLASS} data-field="signupPasswordConfirm" type="password" autoComplete="new-password" placeholder="비밀번호 확인" defaultValue={signupForm.passwordConfirm} />
      </div>
      <div className="signup-section">
        <p className="section-title">가입 경로</p>
        <select className={AUTH_INPUT_CLASS} data-field="signupReferral" defaultValue={signupForm.referral || '인스타그램'}>
          <option value="인스타그램">인스타그램</option><option value="스레드">스레드</option><option value="오르비">오르비</option><option value="etc">기타</option>
        </select>
        <input className={AUTH_INPUT_CLASS} data-field="signupReferralEtc" placeholder="기타 경로를 입력해주세요" defaultValue={signupForm.referralEtc} />
        <input className={AUTH_INPUT_CLASS} data-field="signupPromoCode" placeholder="프로모션 코드 (선택)" defaultValue={signupForm.promoCode} />
      </div>
    </section>
  );
}

export function AuthSignupScreen(ctx) {
  const {
    openTermsType = '',
    signupError = '',
    signupStep = 1,
    signupSubmitting = false,
  } = ctx;
  const step = Math.min(4, Math.max(1, Number(signupStep) || 1));

  const overlays = openTermsType ? <TermsModal openTermsType={openTermsType} /> : null;

  return (
    <AuthShell screen="authSignup" overlays={overlays}>
      <div className="signup-page">
        <div className="signup-form-card">
          <SignupStep ctx={ctx} step={step} />
          {signupError && <p className="auth-error signup-error" role="alert">{signupError}</p>}
          <div className="signup-stage-actions">
            {step > 1 && <button type="button" className="btn btn-secondary" data-action="previousNativeSignupStep" disabled={signupSubmitting}>이전</button>}
            {step < 4 ? (
              <button type="button" className="btn btn-primary" data-action="nextNativeSignupStep">다음</button>
            ) : (
              <button className="signup-submit signup-submit-btn active" data-action="submitNativeSignup" disabled={signupSubmitting}>{signupSubmitting ? '가입 처리 중...' : '회원가입 완료'}</button>
            )}
          </div>
          <p className="signup-login-link">이미 계정이 있으신가요? <button className="auth-link-btn" data-action="goto" data-target="authLogin">로그인</button></p>
        </div>
      </div>
    </AuthShell>
  );
}
