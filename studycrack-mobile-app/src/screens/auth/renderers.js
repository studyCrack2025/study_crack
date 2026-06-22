import { STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';
import { renderTermsModal } from '../../components/terms-modal.js';

function disabled(value) {
  return value ? 'disabled' : '';
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLogo(logoSrc = STUDYCRACK_LOGO_SRC) {
  return `<div class="auth-logo-wrap compact signup-logo"><img src="${logoSrc}" class="auth-logo" alt="StudyCrack Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="auth-logo-fallback">StudyCrack</span></div>`;
}

function renderSocialAuthButtons(action = 'ssoSuccess', suffix = '로그인') {
  return `<div class="auth-sso-row"><button class="auth-sso-btn google" data-action="${action}" data-provider="google"><span class="auth-sso-icon">G</span><span>Google로 ${suffix}</span></button><button class="auth-sso-btn naver" data-action="${action}" data-provider="naver"><span class="auth-sso-icon">N</span><span>Naver로 ${suffix}</span></button></div>`;
}

function renderSignupVerifyStatus(done, label) {
  return `<span class="signup-verify-status ${done ? 'done' : ''}">${done ? `${label} 완료` : `${label} 필요`}</span>`;
}

function renderTermsLine({ checked = false, label, required = false, type }) {
  return `<div class="auth-terms-check-row"><input type="checkbox" data-action="toggleSignupTerm" data-signup-term="${type}" ${required ? 'data-signup-term-required="true"' : ''} ${checked ? 'checked' : ''}/><span>${required ? '(필수)' : '(선택)'} ${label}</span><button type="button" class="auth-terms-view" data-action="openSignupTermsModal" data-terms-type="${type}">보기</button></div>`;
}

function selected(current, value) {
  return current === value ? 'selected' : '';
}

function checked(value) {
  return value ? 'checked' : '';
}

function renderFindEmailModal({ findEmailModalOpen, foundEmailMasked }) {
  if (!findEmailModalOpen) return '';
  return `<div class="find-email-modal-backdrop" data-action="closeFindEmailModal"><div class="find-email-modal" data-action="noopModal"><button type="button" class="close-btn" data-action="closeFindEmailModal">×</button><h3>이메일 찾기</h3><p class="sub">가입 시 등록한 이름과 전화번호를 입력해주세요.</p><input class="planner-input" data-find-email-name placeholder="이름" /><input class="planner-input" data-field="findEmailPhone" inputmode="numeric" placeholder="전화번호 (숫자만 입력)" /><button type="button" class="btn btn-primary" data-action="findEmailByNamePhone">이메일 찾기</button>${foundEmailMasked ? `<div class="find-email-result">회원님의 이메일은<br/><b>${foundEmailMasked}</b> 입니다.</div>` : ''}</div></div>`;
}

function renderResetPasswordModal({ resetPasswordEmail, resetPasswordModalOpen, resetPasswordSending, resetPasswordStep }) {
  if (!resetPasswordModalOpen) return '';
  const isRequest = resetPasswordStep === 'request';
  const body = isRequest
    ? `<input class="planner-input" data-reset-email placeholder="가입한 이메일 주소" defaultValue="${resetPasswordEmail}" />`
    : '<input class="planner-input" data-reset-code placeholder="인증 코드 6자리" /><input class="planner-input" data-reset-password type="password" placeholder="새 비밀번호 (8자 이상)" /><input class="planner-input" data-reset-password-confirm type="password" placeholder="새 비밀번호 확인" />';
  const action = isRequest ? 'requestResetPasswordCode' : 'submitResetPassword';
  const label = isRequest ? (resetPasswordSending ? '발송 중...' : '인증 코드 받기') : '비밀번호 변경 완료';

  return `<div class="find-email-modal-backdrop" data-action="closeResetPasswordModal"><div class="find-email-modal" data-action="noopModal"><button type="button" class="close-btn" data-action="closeResetPasswordModal">×</button><h3>비밀번호 재설정</h3><p class="sub">${isRequest ? '가입하신 이메일 주소를 입력하시면 비밀번호 재설정 코드를 보내드립니다.' : '이메일로 발송된 6자리 코드와 새 비밀번호를 입력해주세요.'}</p>${body}<button type="button" class="btn btn-primary" data-action="${action}" ${disabled(resetPasswordSending)}>${label}</button></div></div>`;
}

export function renderAuthLoginScreen(ctx) {
  const {
    authError = '',
    authSubmitting = false,
    findEmailModalOpen,
    foundEmailMasked,
    layout,
    resetPasswordEmail,
    resetPasswordModalOpen,
    resetPasswordSending,
    resetPasswordStep,
    studycrackLogoSrc = STUDYCRACK_LOGO_SRC
  } = ctx;

  return layout(`<div class="auth-screen">
      <div class="card auth-unified-card">
        ${renderLogo(studycrackLogoSrc)}
        <h1>StudyCrack</h1>
        <p class="auth-title">합격 전략을 시작해볼까요?</p>
        <input class="planner-input auth-input" data-field="loginEmail" type="email" inputmode="email" autocomplete="username" placeholder="이메일" />
        <input class="planner-input auth-input" data-login-password type="password" autocomplete="current-password" placeholder="비밀번호" />
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ''}
        <button class="btn btn-primary auth-submit" data-action="loginSuccess" ${disabled(authSubmitting)}>${authSubmitting ? '로그인 중...' : '로그인'}</button>
        <div class="auth-divider"><span>또는 소셜 계정으로 로그인</span></div>
        ${renderSocialAuthButtons('ssoSuccess', '로그인')}
        <div class="auth-helper-row">
          <button class="auth-link-btn" data-action="openFindEmailModal">이메일 찾기</button>
          <span>|</span>
          <button class="auth-link-btn" data-action="openResetPasswordModal">비밀번호 찾기</button>
        </div>
        <button class="auth-link-btn" data-action="goto" data-target="authSignup">아직 계정이 없나요? 회원가입</button>
      </div>
      ${renderFindEmailModal({ findEmailModalOpen, foundEmailMasked })}
      ${renderResetPasswordModal({ resetPasswordEmail, resetPasswordModalOpen, resetPasswordSending, resetPasswordStep })}
      </div>
    </div>`, false);
}

export function renderAuthFindIdScreen({ appbar, layout }) {
  return layout(appbar('아이디 찾기', true) + `<div class="auth-screen">
      <div class="card auth-form-card">
        <p class="auth-title">이메일 찾기</p>
        <p class="sub">로그인 화면의 이메일 찾기 창에서 가입 정보를 확인할 수 있습니다.</p>
        <button class="btn btn-primary auth-submit" data-action="goto" data-target="authLogin">로그인 화면으로 이동</button>
      </div>
    </div>`, false);
}

export function renderAuthFindPwScreen({ appbar, layout }) {
  return layout(appbar('비밀번호 찾기', true) + `<div class="auth-screen">
      <div class="card auth-form-card">
        <p class="auth-title">비밀번호 재설정</p>
        <p class="sub">로그인 화면의 비밀번호 찾기 창에서 인증 코드를 받아 재설정할 수 있습니다.</p>
        <button class="btn btn-primary auth-submit" data-action="goto" data-target="authLogin">로그인 화면으로 이동</button>
      </div>
    </div>`, false);
}

export function renderAuthSignupScreen(ctx) {
  const {
    appbar,
    layout,
    openTermsType,
    signupEmailSending = false,
    signupError = '',
    signupSmsSending = false,
    signupSubmitting = false,
    signupForm = {},
    signupTerms = {},
    signupVerifiedEmail = '',
    signupVerifiedPhone = '',
    studycrackLogoSrc = STUDYCRACK_LOGO_SRC
  } = ctx;
  const emailVerified = Boolean(signupVerifiedEmail);
  const phoneVerified = Boolean(signupVerifiedPhone);
  const allTermsChecked = ['standard', 'service', 'privacy', 'refund', 'marketing'].every((key) => signupTerms[key] === true);

  return layout(appbar('회원가입', true) + `<div class="signup-page"><div class="signup-form-card">
      ${renderLogo(studycrackLogoSrc)}
      <p class="signup-title">회원가입</p>
      <div class="signup-section auth-signup-social"><p class="section-title">소셜 계정으로 시작하기</p><div class="section-divider"></div>${renderSocialAuthButtons('ssoSuccess', '시작하기')}<p class="auth-web-note slim">가입되지 않은 계정은 약관 동의 후 바로 시작합니다.</p></div>
      <div class="auth-divider"><span>또는 이메일로 직접 가입하기</span></div>
      <div class="signup-section auth-native-section">
        <div class="signup-section-head"><p class="section-title">계정 인증</p>${renderSignupVerifyStatus(emailVerified, '이메일')}</div>
        <input class="planner-input auth-input" data-field="signupEmail" type="email" inputmode="email" autocomplete="email" placeholder="이메일" value="${escapeHtml(signupForm.email)}" />
        <button type="button" class="btn btn-secondary signup-inline-btn" data-action="sendSignupEmailCode" ${disabled(signupEmailSending || signupSubmitting)}>${signupEmailSending ? '발송 중...' : '이메일 인증번호 받기'}</button>
        <div class="signup-code-row"><input class="planner-input auth-input" data-field="signupEmailCode" inputmode="numeric" placeholder="인증번호 6자리" value="${escapeHtml(signupForm.emailCode)}" /><button type="button" class="btn btn-secondary signup-code-btn" data-action="verifySignupEmail" ${disabled(signupSubmitting)}>확인</button></div>
      </div>
      <div class="signup-section auth-native-section">
        <p class="section-title">기본 정보</p>
        <input class="planner-input auth-input" data-field="signupPassword" type="password" autocomplete="new-password" placeholder="비밀번호 (영문 대/소문자, 숫자, 특수문자 포함)" value="${escapeHtml(signupForm.password)}" />
        <input class="planner-input auth-input" data-field="signupPasswordConfirm" type="password" autocomplete="new-password" placeholder="비밀번호 확인" value="${escapeHtml(signupForm.passwordConfirm)}" />
        <input class="planner-input auth-input" data-field="signupName" autocomplete="name" placeholder="이름" value="${escapeHtml(signupForm.name)}" />
        <div class="signup-two-col"><select class="planner-input auth-input" data-field="signupGender"><option value="">성별</option><option value="male" ${selected(signupForm.gender, 'male')}>남성</option><option value="female" ${selected(signupForm.gender, 'female')}>여성</option></select><input class="planner-input auth-input" data-field="signupBirthdate" type="date" value="${escapeHtml(signupForm.birthdate)}" /></div>
      </div>
      <div class="signup-section auth-native-section">
        <div class="signup-section-head"><p class="section-title">전화번호 인증</p>${renderSignupVerifyStatus(phoneVerified, '전화번호')}</div>
        <input class="planner-input auth-input" data-field="signupPhone" inputmode="numeric" autocomplete="tel" placeholder="휴대폰 번호 (01012345678)" value="${escapeHtml(signupForm.phoneRaw)}" />
        <button type="button" class="btn btn-secondary signup-inline-btn" data-action="sendSignupSmsCode" ${disabled(signupSmsSending || signupSubmitting)}>${signupSmsSending ? '발송 중...' : 'SMS 인증번호 받기'}</button>
        <div class="signup-code-row"><input class="planner-input auth-input" data-field="signupPhoneCode" inputmode="numeric" placeholder="인증번호 6자리" value="${escapeHtml(signupForm.phoneCode)}" /><button type="button" class="btn btn-secondary signup-code-btn" data-action="verifySignupPhone" ${disabled(signupSubmitting)}>확인</button></div>
      </div>
      <div class="signup-section auth-native-section">
        <p class="section-title">가입 경로</p>
        <select class="planner-input auth-input" data-field="signupReferral"><option value="인스타그램" ${selected(signupForm.referral || '인스타그램', '인스타그램')}>인스타그램</option><option value="스레드" ${selected(signupForm.referral, '스레드')}>스레드</option><option value="오르비" ${selected(signupForm.referral, '오르비')}>오르비</option><option value="etc" ${selected(signupForm.referral, 'etc')}>기타</option></select>
        <input class="planner-input auth-input" data-field="signupReferralEtc" placeholder="기타 경로를 입력해주세요" value="${escapeHtml(signupForm.referralEtc)}" />
        <input class="planner-input auth-input" data-field="signupPromoCode" placeholder="프로모션 코드 (선택)" value="${escapeHtml(signupForm.promoCode)}" />
      </div>
      <div class="signup-section auth-terms-preview native">
        <label class="auth-terms-check-row all"><input type="checkbox" data-action="toggleSignupAllTerms" ${checked(allTermsChecked)}/><b>약관 전체 동의</b></label>
        ${renderTermsLine({ checked: signupTerms.standard, label: '스터디크랙 이용약관 동의', required: true, type: 'standard' })}
        ${renderTermsLine({ checked: signupTerms.service, label: '서비스 이용약관 조항 동의', required: true, type: 'service' })}
        ${renderTermsLine({ checked: signupTerms.privacy, label: '개인정보 처리방침 동의', required: true, type: 'privacy' })}
        ${renderTermsLine({ checked: signupTerms.refund, label: '환불 규정 동의', required: true, type: 'refund' })}
        ${renderTermsLine({ checked: signupTerms.marketing, label: '마케팅 정보 수신 동의', type: 'marketing' })}
      </div>
      ${signupError ? `<p class="auth-error signup-error">${escapeHtml(signupError)}</p>` : ''}
      <button class="signup-submit signup-submit-btn active" data-action="submitNativeSignup" ${disabled(signupSubmitting)}>${signupSubmitting ? '가입 처리 중...' : '회원가입 완료'}</button>
      <p class="signup-login-link">이미 계정이 있으신가요? <button class="auth-link-btn" data-action="goto" data-target="authLogin">로그인</button></p>
    </div>
    ${renderTermsModal(openTermsType)}</div>`, false);
}
