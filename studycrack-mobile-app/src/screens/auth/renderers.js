import { STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';

function disabled(value) {
  return value ? 'disabled' : '';
}

function renderLogo(logoSrc = STUDYCRACK_LOGO_SRC) {
  return `<div class="auth-logo-wrap compact signup-logo"><img src="${logoSrc}" class="auth-logo" alt="StudyCrack Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="auth-logo-fallback">StudyCrack</span></div>`;
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
        <p class="sub">웹 로그인으로 안전하게 인증한 뒤 모바일 화면으로 돌아옵니다.</p>
        <button class="btn btn-primary auth-submit" data-action="loginSuccess">StudyCrack 로그인</button>
        <div class="auth-divider"><span>또는</span></div>
        <div class="auth-sso-row">
          <button class="auth-sso-btn kakao" data-action="ssoSuccess">카카오 계정으로 로그인</button>
          <button class="auth-sso-btn apple" data-action="ssoSuccess">Apple로 로그인</button>
        </div>
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
    studycrackLogoSrc = STUDYCRACK_LOGO_SRC
  } = ctx;

  return layout(appbar('회원가입', true) + `<div class="signup-page"><div class="signup-form-card">
      ${renderLogo(studycrackLogoSrc)}
      <p class="signup-title">회원가입</p>
      <div class="signup-section"><p class="section-title">웹 회원가입으로 계속</p><div class="section-divider"></div><p class="sub">약관 동의, 전화번호 인증, 소셜 회원가입은 StudyCrack 웹 가입 화면에서 진행됩니다.</p><p class="sub">가입을 마치면 같은 계정으로 모바일 화면을 사용할 수 있습니다.</p></div>
      <button class="signup-submit signup-submit-btn active" data-action="signupSuccess">StudyCrack 회원가입</button>
      <p class="signup-login-link">이미 계정이 있으신가요? <button class="auth-link-btn" data-action="loginSuccess">로그인</button></p>
    </div>
    </div>`, false);
}
