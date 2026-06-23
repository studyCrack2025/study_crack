import {
  loginWithPassword,
  requestSignupEmailCode,
  requestSignupSmsCode,
  signUpWithEmail,
  verifySignupEmailCode,
  verifySignupSmsCode
} from '../runtime/auth-service.js';
import { getData } from './action-utils.js';

function noop() {}

function prevent(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
}

function reloadAppDefault() {
  if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
    window.location.reload();
  }
}

function getWindow(ctx) {
  return ctx.window || globalThis.window || {};
}

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function query(ctx, selector) {
  return getDocument(ctx)?.querySelector?.(selector) || null;
}

function queryAll(ctx, selector) {
  return Array.from(getDocument(ctx)?.querySelectorAll?.(selector) || []);
}

function getInputValue(ctx, selector) {
  return query(ctx, selector)?.value || '';
}

function getResetEmail(ctx) {
  if (typeof ctx.getResetPasswordEmail === 'function') return ctx.getResetPasswordEmail();
  return ctx.resetPasswordEmail || '';
}

function formatKoreanPhoneForDb(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? `+82${digits.slice(1)}` : `+82${digits}`;
}

function normalizeCognitoPhone(phone) {
  let cleanPhone = String(phone || '').replace(/[^0-9+]/g, '').trim();
  if (cleanPhone.startsWith('010')) cleanPhone = `+82${cleanPhone.substring(1)}`;
  else if (cleanPhone.startsWith('10')) cleanPhone = `+82${cleanPhone}`;
  else if (cleanPhone.startsWith('82')) cleanPhone = `+${cleanPhone}`;
  return cleanPhone;
}

function formatSignupPhoneForDb(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (digits.length === 11) return digits.replace(/(^01[0-9])([0-9]+)([0-9]{4})$/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(^0[0-9]{1,2})([0-9]+)([0-9]{4})$/, '$1-$2-$3');
  return phone;
}

function readSignupFields(ctx) {
  return {
    email: getInputValue(ctx, '[data-field="signupEmail"]').trim(),
    emailCode: getInputValue(ctx, '[data-field="signupEmailCode"]').trim(),
    password: getInputValue(ctx, '[data-field="signupPassword"]'),
    passwordConfirm: getInputValue(ctx, '[data-field="signupPasswordConfirm"]'),
    name: getInputValue(ctx, '[data-field="signupName"]').trim(),
    gender: getInputValue(ctx, '[data-field="signupGender"]'),
    birthdate: getInputValue(ctx, '[data-field="signupBirthdate"]'),
    phoneRaw: getInputValue(ctx, '[data-field="signupPhone"]').trim(),
    phoneCode: getInputValue(ctx, '[data-field="signupPhoneCode"]').trim(),
    referral: getInputValue(ctx, '[data-field="signupReferral"]').trim(),
    referralEtc: getInputValue(ctx, '[data-field="signupReferralEtc"]').trim(),
    promoCode: getInputValue(ctx, '[data-field="signupPromoCode"]').trim()
  };
}

function getSignupTerms(ctx) {
  const required = queryAll(ctx, '[data-signup-term-required]');
  const marketing = query(ctx, '[data-signup-term="marketing"]');
  return {
    allRequired: required.length > 0 && required.every((item) => item.checked),
    marketingAgreed: marketing?.checked === true
  };
}

function readSignupTermValues(ctx) {
  return ['standard', 'service', 'privacy', 'refund', 'marketing'].reduce((acc, key) => {
    acc[key] = query(ctx, `[data-signup-term="${key}"]`)?.checked === true;
    return acc;
  }, {});
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function isValidSignupPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(String(password || ''));
}

function createSocialState(win, provider) {
  const bytes = new Uint8Array(16);
  const cryptoObj = win.crypto || globalThis.crypto;
  cryptoObj?.getRandomValues?.(bytes);
  const nonce = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('') || String(Date.now());
  return `${nonce}|${provider}|mobile`;
}

function getMobileReturnPath(win) {
  const location = win.location || {};
  const path = location.pathname || '/studycrack-mobile.html';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/studycrack-mobile.html';
  return path;
}

function buildSocialAuthUrl(ctx, provider) {
  const win = getWindow(ctx);
  const social = win.CONFIG?.social;
  const clientId = social?.[provider]?.clientId;
  const callbackUrl = social?.callbackUrl;
  if (!clientId || !callbackUrl || !['google', 'naver'].includes(provider)) return '';
  const state = createSocialState(win, provider);
  const storage = win.sessionStorage || globalThis.sessionStorage;
  storage?.setItem?.('socialState', state);
  const returnUrl = getMobileReturnPath(win);
  storage?.setItem?.('socialReturnUrl', returnUrl);
  storage?.setItem?.('socialEntry', 'mobile');
  try {
    win.localStorage?.setItem?.('socialReturnUrl', returnUrl);
    win.localStorage?.setItem?.('socialEntry', 'mobile');
  } catch (_) {}
  storage?.removeItem?.('socialLinkMode');
  if (provider === 'google') {
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account'
    })}`;
  }
  return `https://nid.naver.com/oauth2.0/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    state
  })}`;
}

async function defaultFindEmail({ authApiUrl, fetchImpl = globalThis.fetch, name, phone }) {
  if (!authApiUrl || !fetchImpl) return '';
  const res = await fetchImpl(authApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'find_email', name, phone: formatKoreanPhoneForDb(phone) })
  });
  const data = await res.json();
  return res.ok && data?.success && data?.email ? String(data.email) : '';
}

async function defaultRequestResetCode({ authApiUrl, email, fetchImpl = globalThis.fetch }) {
  if (!authApiUrl || !fetchImpl) throw new Error('AUTH_API_MISSING');
  const res = await fetchImpl(authApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'send_pw_reset_code', email })
  });
  const data = await res.json();
  if (!res.ok || !data?.success) throw new Error(data?.message || 'REQUEST_FAILED');
  return data;
}

async function defaultResetPassword({ authApiUrl, code, email, fetchImpl = globalThis.fetch, newPassword }) {
  if (!authApiUrl || !fetchImpl) throw new Error('AUTH_API_MISSING');
  const res = await fetchImpl(authApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'reset_password', email, code, newPassword })
  });
  const data = await res.json();
  if (!res.ok || !data?.success) throw new Error(data?.message || 'RESET_FAILED');
  return data;
}

export function createAuthHandlers(ctx) {
  const {
    alert = globalThis.alert || noop,
    fetchImpl,
    findEmail = defaultFindEmail,
    loginWithPasswordImpl = loginWithPassword,
    reloadApp = reloadAppDefault,
    requestSignupEmailCodeImpl = requestSignupEmailCode,
    requestSignupSmsCodeImpl = requestSignupSmsCode,
    requestResetCode = defaultRequestResetCode,
    resetPassword = defaultResetPassword,
    signUpWithEmailImpl = signUpWithEmail,
    verifySignupEmailCodeImpl = verifySignupEmailCode,
    verifySignupSmsCodeImpl = verifySignupSmsCode,
    setAuthError = noop,
    setAuthSubmitting = noop,
    setFindEmailModalOpen = noop,
    setFoundEmailMasked = noop,
    setResetPasswordEmail = noop,
    setResetPasswordModalOpen = noop,
    setResetPasswordSending = noop,
    setResetPasswordStep = noop,
    setSignupEmailSending = noop,
    setSignupError = noop,
    setSignupForm = noop,
    setSignupSmsSending = noop,
    setSignupSubmitting = noop,
    setSignupTerms = noop,
    setSignupVerifiedEmail = noop,
    setSignupVerifiedPhone = noop,
    setOpenTermsType = noop
  } = ctx;

  function captureSignupState() {
    const fields = readSignupFields(ctx);
    const termValues = readSignupTermValues(ctx);
    setSignupForm(fields);
    setSignupTerms(termValues);
    return { fields, termValues, terms: getSignupTerms(ctx) };
  }

  return {
    openFindEmailModal({ event }) {
      event?.preventDefault?.();
      setFindEmailModalOpen(true);
      return true;
    },

    closeFindEmailModal({ event }) {
      event?.preventDefault?.();
      setFindEmailModalOpen(false);
      setFoundEmailMasked('');
      return true;
    },

    async findEmailByNamePhone({ event }) {
      event?.preventDefault?.();
      const name = getInputValue(ctx, '[data-find-email-name]').trim();
      const phone = getInputValue(ctx, '[data-field="findEmailPhone"]').replace(/\D+/g, '');
      if (!name || !phone) {
        alert('이름과 전화번호를 입력해주세요.');
        return false;
      }
      let masked = '';
      try {
        masked = await findEmail({ authApiUrl: ctx.authApiUrl, fetchImpl, name, phone });
      } catch (_) {
        masked = '';
      }
      if (!masked) {
        alert('일치하는 이메일을 찾지 못했습니다.');
        setFoundEmailMasked('');
        return false;
      }
      setFoundEmailMasked(masked);
      return true;
    },

    openResetPasswordModal({ event }) {
      event?.preventDefault?.();
      setResetPasswordModalOpen(true);
      return true;
    },

    closeResetPasswordModal({ event }) {
      event?.preventDefault?.();
      setResetPasswordModalOpen(false);
      setResetPasswordStep('request');
      setResetPasswordEmail('');
      setResetPasswordSending(false);
      return true;
    },

    async requestResetPasswordCode({ event }) {
      event?.preventDefault?.();
      const email = getInputValue(ctx, '[data-reset-email]').trim();
      if (!email) {
        alert('이메일을 입력해주세요.');
        return false;
      }
      setResetPasswordSending(true);
      try {
        await requestResetCode({ authApiUrl: ctx.authApiUrl, email, fetchImpl });
        alert('비밀번호 재설정 코드가 이메일로 발송되었습니다.');
        setResetPasswordEmail(email);
        setResetPasswordStep('verify');
        return true;
      } catch (error) {
        alert(error.message || '비밀번호 재설정 코드 요청 중 오류가 발생했습니다.');
        return false;
      } finally {
        setResetPasswordSending(false);
      }
    },

    async submitResetPassword({ event }) {
      event?.preventDefault?.();
      const code = getInputValue(ctx, '[data-reset-code]').trim();
      const newPassword = getInputValue(ctx, '[data-reset-password]');
      const confirmPassword = getInputValue(ctx, '[data-reset-password-confirm]');
      if (!code) {
        alert('인증 코드를 입력해주세요.');
        return false;
      }
      if (newPassword.length < 8) {
        alert('비밀번호는 8자 이상이어야 합니다.');
        return false;
      }
      if (newPassword !== confirmPassword) {
        alert('비밀번호가 일치하지 않습니다.');
        return false;
      }
      try {
        await resetPassword({ authApiUrl: ctx.authApiUrl, code, email: getResetEmail(ctx), fetchImpl, newPassword });
        alert('비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.');
        setResetPasswordModalOpen(false);
        setResetPasswordStep('request');
        setResetPasswordEmail('');
        setResetPasswordSending(false);
        return true;
      } catch (error) {
        alert(error.message || '비밀번호 변경 중 오류가 발생했습니다.');
        return false;
      }
    },

    signupSuccess({ event }) {
      prevent(event);
      setSignupError('현재 화면에서 회원가입을 완료해주세요.');
      return false;
    },

    toggleSignupAllTerms({ actionEl }) {
      const { fields } = captureSignupState();
      const checked = actionEl?.checked === true;
      setSignupForm(fields);
      setSignupTerms({
        standard: checked,
        service: checked,
        privacy: checked,
        refund: checked,
        marketing: checked
      });
      return true;
    },

    toggleSignupTerm({ actionEl }) {
      const { fields, termValues } = captureSignupState();
      const key = actionEl?.getAttribute?.('data-signup-term');
      if (!key) return false;
      setSignupForm(fields);
      setSignupTerms({ ...termValues, [key]: actionEl?.checked === true });
      return true;
    },

    openSignupTermsModal({ actionEl }) {
      captureSignupState();
      setOpenTermsType(actionEl?.getAttribute?.('data-terms-type') || 'standard');
      return true;
    },

    async sendSignupEmailCode({ event }) {
      prevent(event);
      const { fields } = captureSignupState();
      const { email } = fields;
      if (!isValidEmail(email)) {
        setSignupError('이메일 형식을 확인해주세요.');
        return false;
      }
      setSignupError('');
      setSignupVerifiedEmail('');
      setSignupEmailSending(true);
      try {
        await requestSignupEmailCodeImpl({ authApiUrl: ctx.authApiUrl, email, fetchImpl });
        alert('이메일로 인증번호가 발송되었습니다.');
        return true;
      } catch (error) {
        setSignupError(error?.message === 'REQUEST_FAILED' ? '이메일 인증번호 발송에 실패했습니다.' : '이메일 인증번호 발송에 실패했습니다.');
        return false;
      } finally {
        setSignupEmailSending(false);
      }
    },

    async verifySignupEmail({ event }) {
      prevent(event);
      const { fields } = captureSignupState();
      const { email, emailCode } = fields;
      if (!isValidEmail(email) || !emailCode) {
        setSignupError('이메일과 인증번호를 입력해주세요.');
        return false;
      }
      setSignupError('');
      try {
        await verifySignupEmailCodeImpl({ authApiUrl: ctx.authApiUrl, code: emailCode, email, fetchImpl });
        setSignupVerifiedEmail(email);
        alert('이메일 인증이 완료되었습니다.');
        return true;
      } catch (error) {
        setSignupVerifiedEmail('');
        setSignupError('인증번호가 일치하지 않거나 만료되었습니다.');
        return false;
      }
    },

    async sendSignupSmsCode({ event }) {
      prevent(event);
      const { fields } = captureSignupState();
      const phone = normalizeCognitoPhone(fields.phoneRaw);
      if (!phone || !phone.startsWith('+82')) {
        setSignupError('휴대폰 번호 형식을 확인해주세요. 예: 01012345678');
        return false;
      }
      setSignupError('');
      setSignupVerifiedPhone('');
      setSignupSmsSending(true);
      try {
        await requestSignupSmsCodeImpl({ authApiUrl: ctx.authApiUrl, fetchImpl, phone });
        alert('휴대폰으로 인증번호가 발송되었습니다.');
        return true;
      } catch (error) {
        setSignupError('SMS 인증번호 발송에 실패했습니다.');
        return false;
      } finally {
        setSignupSmsSending(false);
      }
    },

    async verifySignupPhone({ event }) {
      prevent(event);
      const { fields } = captureSignupState();
      const phone = normalizeCognitoPhone(fields.phoneRaw);
      if (!phone || !fields.phoneCode) {
        setSignupError('휴대폰 번호와 인증번호를 입력해주세요.');
        return false;
      }
      setSignupError('');
      try {
        await verifySignupSmsCodeImpl({ authApiUrl: ctx.authApiUrl, code: fields.phoneCode, fetchImpl, phone });
        setSignupVerifiedPhone(phone);
        alert('전화번호 인증이 완료되었습니다.');
        return true;
      } catch (error) {
        setSignupVerifiedPhone('');
        setSignupError('인증번호가 일치하지 않거나 만료되었습니다.');
        return false;
      }
    },

    async submitNativeSignup({ event }) {
      prevent(event);
      const { fields, terms } = captureSignupState();
      const phone = normalizeCognitoPhone(fields.phoneRaw);
      const referral = fields.referral === 'etc' ? fields.referralEtc : fields.referral;
      if (!isValidEmail(fields.email)) {
        setSignupError('이메일 형식을 확인해주세요.');
        return false;
      }
      if (ctx.signupVerifiedEmail !== fields.email) {
        setSignupError('이메일 인증을 완료해주세요.');
        return false;
      }
      if (!isValidSignupPassword(fields.password)) {
        setSignupError('비밀번호는 영문 대/소문자, 숫자, 특수문자 포함 8자 이상이어야 합니다.');
        return false;
      }
      if (fields.password !== fields.passwordConfirm) {
        setSignupError('비밀번호가 일치하지 않습니다.');
        return false;
      }
      if (!fields.name || !fields.gender || !fields.birthdate) {
        setSignupError('이름, 성별, 생년월일을 모두 입력해주세요.');
        return false;
      }
      if (!phone || ctx.signupVerifiedPhone !== phone) {
        setSignupError('전화번호 인증을 완료해주세요.');
        return false;
      }
      if (!referral) {
        setSignupError('가입 경로를 선택해주세요.');
        return false;
      }
      if (!terms.allRequired) {
        setSignupError('필수 약관에 모두 동의해주세요.');
        return false;
      }
      setSignupError('');
      setSignupSubmitting(true);
      const profileData = {
        name: fields.name,
        email: fields.email,
        phone: formatSignupPhoneForDb(fields.phoneRaw),
        cognitoPhone: phone,
        promoCode: fields.promoCode,
        referral,
        gender: fields.gender,
        birthdate: fields.birthdate,
        termsAgreed: true,
        marketingAgreed: terms.marketingAgreed
      };
      try {
        const signup = await signUpWithEmailImpl({
          authApiUrl: ctx.authApiUrl,
          email: fields.email,
          fetchImpl,
          password: fields.password,
          profileData
        });
        if (!signup?.ok) {
          setSignupError(signup?.afterAccountCreated
            ? '계정은 생성되었으나 프로필 저장에 실패했습니다. 관리자에게 문의해주세요.'
            : (signup?.error || '회원가입에 실패했습니다.'));
          setSignupSubmitting(false);
          return false;
        }
        const login = await loginWithPasswordImpl({ email: fields.email, password: fields.password });
        if (!login?.ok) {
          alert('가입은 완료되었습니다. 로그인 화면에서 다시 로그인해주세요.');
          setSignupSubmitting(false);
          return true;
        }
        reloadApp();
        return true;
      } catch (error) {
        setSignupError(error?.message || '회원가입 중 오류가 발생했습니다.');
        setSignupSubmitting(false);
        return false;
      }
    },

    async loginSuccess({ event }) {
      prevent(event);
      const email = getInputValue(ctx, '[data-field="loginEmail"]').trim();
      const password = getInputValue(ctx, '[data-login-password]');
      if (!email || !password) {
        setAuthError('이메일과 비밀번호를 입력해주세요.');
        return false;
      }
      setAuthError('');
      setAuthSubmitting(true);
      let result;
      try {
        result = await loginWithPasswordImpl({ email, password });
      } catch (error) {
        result = { ok: false, error: (error && error.message) || '로그인 중 오류가 발생했습니다.' };
      }
      if (!result || !result.ok) {
        setAuthSubmitting(false);
        setAuthError((result && result.error) || '로그인에 실패했습니다.');
        return false;
      }
      reloadApp();
      return true;
    },

    ssoSuccess({ actionEl, event }) {
      prevent(event);
      const provider = getData(actionEl, 'provider');
      const authUrl = buildSocialAuthUrl(ctx, provider);
      if (!authUrl) {
        alert('소셜 로그인 설정을 불러오지 못했습니다.');
        return false;
      }
      getWindow(ctx).location.href = authUrl;
      return true;
    }
  };
}
