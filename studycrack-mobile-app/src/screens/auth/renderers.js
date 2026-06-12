import { renderTermsModal } from '../../components/terms-modal.js';
import { STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';
import { TERMS_CONTENT } from '../../constants/terms.js';

const TRACK_OPTIONS = ['의치한약계열', '자연/공학계열', '상경계열', '어문/사회계열', '예체능', '기타'];
const SIGNUP_SOURCE_OPTIONS = ['인스타그램', '스레드', '오르비', '기타'];

function checked(value) {
  return value ? 'checked' : '';
}

function selected(value, candidate) {
  return value === candidate ? 'selected' : '';
}

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

function renderVerifyBox({ code, field, isVerified, type }) {
  const isEmail = type === 'email';
  return `<div class="verify-box"><p>${isEmail ? '이메일로' : '문자로'} 인증번호를 보냈습니다.${isVerified ? ' ✅ 인증 완료' : ''}</p><div class="verify-row"><input class="input" data-field="${field}" defaultValue="${code}" placeholder="인증코드 6자리" maxlength="6" inputmode="numeric" /><b data-signup-timer="${type}">05:00</b><button type="button" class="input-btn verify-confirm-btn" data-action="${isEmail ? 'confirmSignupEmailCode' : 'confirmSignupPhoneCode'}">확인</button></div><small data-signup-expire="${type}" style="display:none">인증 시간이 만료되었습니다. 재전송해주세요.</small>${isEmail ? '<small>이메일이 오지 않는다면 스팸 메일함을 먼저 확인해주세요.</small><small>그래도 도착하지 않는다면 contact@studycrack.co.kr로 문의 부탁드립니다.</small>' : ''}</div>`;
}

function renderSelectOptions(options, current) {
  return options.map((value) => `<option value="${value}" ${selected(current, value)}>${value}</option>`).join('');
}

function renderTermsCard(ctx) {
  return `<div class="terms-card"><div class="terms-header signup-term-row"><input type="checkbox" data-action="toggleSignupTermsAll" data-field="signupTermsAll" ${checked(ctx.signupTermsAll)}/><span class="signup-term-title">약관 전체 동의</span></div><div class="terms-item signup-term-row"><input type="checkbox" data-action="toggleSignupTermsRequired" data-field="signupTermsStandard" ${checked(ctx.signupTermsRequired)}/><span class="signup-term-title">(필수) 표준이용약관 동의</span><button type="button" class="terms-link signup-term-view" data-action="openTermsModal" data-terms-type="standard">보기</button></div><div class="terms-item signup-term-row"><input type="checkbox" data-action="toggleSignupTermsRequired" data-field="signupTermsService" ${checked(ctx.signupTermsRequired)}/><span class="signup-term-title">(필수) 서비스 이용약관 조항 동의</span><button type="button" class="terms-link signup-term-view" data-action="openTermsModal" data-terms-type="service">보기</button></div><div class="terms-item signup-term-row"><input type="checkbox" data-action="toggleSignupTermsRequired" data-field="signupTermsPrivacy" ${checked(ctx.signupTermsRequired)}/><span class="signup-term-title">(필수) 개인정보 처리방침 동의</span><button type="button" class="terms-link signup-term-view" data-action="openTermsModal" data-terms-type="privacy">보기</button></div><div class="terms-item signup-term-row"><input type="checkbox" data-action="toggleSignupTermsRequired" data-field="signupTermsRefund" ${checked(ctx.signupTermsRequired)}/><span class="signup-term-title">(필수) 환불 규정 동의</span><button type="button" class="terms-link signup-term-view" data-action="openTermsModal" data-terms-type="refund">보기</button></div><div class="terms-item signup-term-row"><input type="checkbox" data-action="toggleSignupTermsMarketing" data-field="signupTermsMarketing" ${checked(ctx.signupTermsMarketing)}/><span class="signup-term-title">(선택) 마케팅 정보 수신 동의</span><button type="button" class="terms-link signup-term-view" data-action="openTermsModal" data-terms-type="marketing">보기</button></div></div>`;
}

export function renderAuthLoginScreen(ctx) {
  const {
    findEmailModalOpen,
    foundEmailMasked,
    layout,
    loginEmail,
    loginPassword,
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
        <p class="sub">내 성적에 맞는 대학별 합격 가능성과 전략을 확인하세요.</p>
        <label class="auth-label">이메일</label>
        <input class="planner-input" data-field="loginEmail" value="${loginEmail}" placeholder="you@example.com" />
        <label class="auth-label">비밀번호</label>
        <input class="planner-input" data-field="loginPassword" value="${loginPassword}" type="password" placeholder="비밀번호 입력" />
        <button class="btn btn-primary auth-submit" data-action="loginSuccess">로그인</button>
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
        <p class="sub">가입한 이름과 연락처를 입력하면 아이디(이메일)를 안내해드려요.</p>
        <label class="auth-label">이름</label>
        <input class="planner-input" placeholder="이름 입력" />
        <label class="auth-label">휴대폰 번호</label>
        <input class="planner-input" placeholder="01012345678" />
        <button class="btn btn-primary auth-submit" data-action="goto" data-target="authLogin">아이디 확인하기</button>
      </div>
    </div>`, false);
}

export function renderAuthFindPwScreen({ appbar, layout }) {
  return layout(appbar('비밀번호 찾기', true) + `<div class="auth-screen">
      <div class="card auth-form-card">
        <p class="sub">가입한 아이디(이메일)로 비밀번호 재설정 링크를 보내드려요.</p>
        <label class="auth-label">아이디(이메일)</label>
        <input class="planner-input" placeholder="you@example.com" />
        <button class="btn btn-primary auth-submit" data-action="goto" data-target="authLogin">재설정 링크 받기</button>
      </div>
    </div>`, false);
}

export function renderAuthSignupScreen(ctx) {
  const {
    appbar,
    layout,
    openTermsType,
    signupBirth,
    signupEmail,
    signupEmailCode,
    signupEmailCodeSent,
    signupEmailSending,
    signupEmailVerified,
    signupGender,
    signupName,
    signupPassword,
    signupPasswordConfirm,
    signupPhone,
    signupPhoneCode,
    signupPhoneCodeSent,
    signupPhoneSending,
    signupPhoneVerified,
    signupPromoCode,
    signupSource,
    signupSubmitEnabled,
    signupTrack,
    studycrackLogoSrc = STUDYCRACK_LOGO_SRC,
    termsContent = TERMS_CONTENT
  } = ctx;

  return layout(appbar('회원가입', true) + `<div class="signup-page"><div class="signup-form-card">
      ${renderLogo(studycrackLogoSrc)}
      <p class="signup-title">회원가입</p>
      <div class="signup-section"><p class="section-title">1 / 3 계정 정보</p><div class="section-divider"></div><label class="auth-label">이메일(아이디)</label><div class="input-row signup-input-row"><input class="input" data-field="signupEmail" defaultValue="${signupEmail}" placeholder="example@email.com" /><button type="button" class="input-btn" data-action="verifySignupEmail">${signupEmailSending ? '전송 중...' : (signupEmailCodeSent ? '재전송' : '인증번호 받기')}</button></div>${signupEmailCodeSent ? renderVerifyBox({ code: signupEmailCode, field: 'signupEmailCode', isVerified: signupEmailVerified, type: 'email' }) : ''}<label class="auth-label">비밀번호</label><input class="input" data-field="signupPassword" defaultValue="${signupPassword}" type="password" placeholder="영문 대/소문자, 숫자, 특수문자 포함 8자 이상" /><small class="signup-pw-guide">영문 대문자, 영문 소문자, 숫자, 특수문자를 모두 포함해 8자 이상 입력해주세요.</small><label class="auth-label">비밀번호 확인</label><input class="input" data-field="signupPasswordConfirm" defaultValue="${signupPasswordConfirm}" type="password" placeholder="비밀번호 재입력" /><p class="pw-match" data-signup-pw-match style="display:none"></p></div>
      <div class="signup-section"><p class="section-title">2 / 3 개인 정보</p><div class="section-divider"></div><label class="auth-label">이름(실명)</label><input class="input" data-field="signupName" defaultValue="${signupName}" placeholder="이름 입력" /><div class="grid-2 signup-personal-grid"><div><label class="auth-label">성별</label><div class="radio-group gender-row"><label class="radio-item"><input type="radio" name="signupGender" data-action="setSignupGender" data-gender="female" ${checked(signupGender === 'female')}/>여성</label><label class="radio-item"><input type="radio" name="signupGender" data-action="setSignupGender" data-gender="male" ${checked(signupGender === 'male')}/>남성</label></div></div><div class="signup-date-field"><label class="auth-label">생년월일</label><input class="input" type="date" data-field="signupBirth" defaultValue="${signupBirth}" placeholder="생년월일 선택" /></div></div><label class="auth-label">전화번호</label><div class="input-row signup-input-row"><input class="input" data-field="signupPhone" defaultValue="${signupPhone}" placeholder="- 없이 입력해주세요" /><button type="button" class="input-btn" data-action="verifySignupPhone">${signupPhoneSending ? '전송 중...' : (signupPhoneCodeSent ? '재전송' : '인증번호 전송')}</button></div>${signupPhoneCodeSent ? renderVerifyBox({ code: signupPhoneCode, field: 'signupPhoneCode', isVerified: signupPhoneVerified, type: 'phone' }) : ''}</div>
      <div class="signup-section"><p class="section-title">3 / 3 세부 정보</p><div class="section-divider"></div><label class="auth-label">희망 계열</label><select class="input" data-field="signupTrack" defaultValue="${signupTrack}"><option value="">선택해주세요</option>${renderSelectOptions(TRACK_OPTIONS, signupTrack)}</select><label class="auth-label">유입 경로</label><select class="input" data-field="signupSource" defaultValue="${signupSource}"><option value="">선택해주세요</option>${renderSelectOptions(SIGNUP_SOURCE_OPTIONS, signupSource)}</select><label class="auth-label">프로모션 코드(선택)</label><input class="input" data-field="signupPromoCode" defaultValue="${signupPromoCode}" placeholder="프로모션 코드 입력" /></div>
      ${renderTermsCard(ctx)}${renderTermsModal(openTermsType, termsContent)}
      <button class="signup-submit signup-submit-btn ${signupSubmitEnabled ? 'active' : 'disabled'}" data-signup-submit data-action="signupSuccess" ${disabled(!signupSubmitEnabled)}>${signupSubmitEnabled ? '회원가입 완료' : '이메일/전화번호 인증을 완료해주세요'}</button>
      <p class="signup-login-link">이미 계정이 있으신가요? <button class="auth-link-btn" data-action="goto" data-target="authLogin">로그인</button></p>
    </div>
    </div>`, false);
}
