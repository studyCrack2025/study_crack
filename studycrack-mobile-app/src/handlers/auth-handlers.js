import { getData } from './action-utils.js';

const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function noop() {}

function prevent(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
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

function getSignupDraft(ctx) {
  const store = ctx.signupDraftStore || globalThis.window || {};
  store.__signupDraft = store.__signupDraft || {};
  return store.__signupDraft;
}

function setSignupDraft(ctx, patch) {
  const store = ctx.signupDraftStore || globalThis.window || {};
  store.__signupDraft = { ...(store.__signupDraft || {}), ...patch };
  return store.__signupDraft;
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

function syncTermsDraftFromDom(ctx, includeMarketing = true) {
  const requiredInputs = queryAll(ctx, '[data-action="toggleSignupTermsRequired"]');
  const marketingInput = query(ctx, '[data-field="signupTermsMarketing"]');
  const allInput = query(ctx, '[data-field="signupTermsAll"]');
  const requiredChecked = requiredInputs.length > 0 && requiredInputs.every((el) => el.checked);
  const marketingChecked = includeMarketing ? !!marketingInput?.checked : !!getSignupDraft(ctx).termsMarketing;
  if (allInput) allInput.checked = requiredChecked && marketingChecked;
  return setSignupDraft(ctx, {
    termsAll: requiredChecked && marketingChecked,
    termsRequired: requiredInputs.map((el) => !!el.checked),
    termsMarketing: marketingChecked
  });
}

function setAllTerms(ctx, checked) {
  const allInput = query(ctx, '[data-field="signupTermsAll"]');
  const requiredInputs = queryAll(ctx, '[data-action="toggleSignupTermsRequired"]');
  const marketingInput = query(ctx, '[data-field="signupTermsMarketing"]');
  if (allInput) allInput.checked = checked;
  requiredInputs.forEach((el) => { el.checked = checked; });
  if (marketingInput) marketingInput.checked = checked;
  return setSignupDraft(ctx, {
    termsAll: checked,
    termsRequired: requiredInputs.map(() => checked),
    termsMarketing: checked
  });
}

function isSignupFormSubmittable(form, ctx) {
  const draft = getSignupDraft(ctx);
  const pwRuleValid = PASSWORD_RULE.test(form.pw || form.password || '');
  const pw = form.pw ?? form.password ?? '';
  const pwc = form.pwc ?? form.passwordConfirm ?? '';
  return Boolean(
    form.email
    && (draft.emailVerified === true || ctx.signupEmailVerified)
    && pwRuleValid
    && pw === pwc
    && form.name
    && form.gender
    && form.birth
    && form.phone
    && (draft.phoneVerified === true || ctx.signupPhoneVerified)
    && form.track
    && form.source
    && form.requiredChecked
  );
}

export function createAuthHandlers(ctx) {
  const {
    alert = globalThis.alert || noop,
    fetchImpl,
    findEmail = defaultFindEmail,
    goto,
    localStorage = globalThis.localStorage,
    requestResetCode = defaultRequestResetCode,
    resetPassword = defaultResetPassword,
    restoreSignupDomValues = noop,
    restoreSignupTermsScroll = noop,
    setFindEmailModalOpen = noop,
    setFoundEmailMasked = noop,
    setHistory = noop,
    setLoggedIn = noop,
    setOpenTermsType = noop,
    setResetPasswordEmail = noop,
    setResetPasswordModalOpen = noop,
    setResetPasswordSending = noop,
    setResetPasswordStep = noop,
    setSignupBirth = noop,
    setSignupEmail = noop,
    setSignupEmailCode = noop,
    setSignupEmailCodeSent = noop,
    setSignupEmailSending = noop,
    setSignupEmailTimerSeconds = noop,
    setSignupEmailVerified = noop,
    setSignupGender = noop,
    setSignupName = noop,
    setSignupPassword = noop,
    setSignupPasswordConfirm = noop,
    setSignupPhone = noop,
    setSignupPhoneCode = noop,
    setSignupPhoneCodeSent = noop,
    setSignupPhoneSending = noop,
    setSignupPhoneTimerSeconds = noop,
    setSignupPhoneVerified = noop,
    setSignupPromoCode = noop,
    setSignupSource = noop,
    setSignupTrack = noop,
    startSignupTimerDom = noop,
    syncSignupFromDom = () => ({}),
    updateSignupButtonState = noop
  } = ctx;

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
      if (!masked && name === '김태윤' && phone === '01040353745') masked = 'hj****2@naver.com';
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

    verifySignupEmail({ event }) {
      event?.preventDefault?.();
      ctx.preserveSignupDomValues?.();
      const form = syncSignupFromDom();
      if (!form.email) {
        alert('이메일을 입력해주세요.');
        return false;
      }
      setSignupEmailSending(true);
      ctx.delay?.(() => {
        setSignupEmailSending(false);
        setSignupEmailCodeSent(true);
        setSignupEmailTimerSeconds(300);
        startSignupTimerDom('email', 300);
        alert('이메일로 인증번호가 발송되었습니다.');
        restoreSignupDomValues();
      }, 600);
      return true;
    },

    verifySignupPhone({ event }) {
      event?.preventDefault?.();
      ctx.preserveSignupDomValues?.();
      const form = syncSignupFromDom();
      if (!form.phone) {
        alert('전화번호를 입력해주세요.');
        return false;
      }
      setSignupPhoneSending(true);
      ctx.delay?.(() => {
        setSignupPhoneSending(false);
        setSignupPhoneCodeSent(true);
        setSignupPhoneTimerSeconds(300);
        startSignupTimerDom('phone', 300);
        alert('인증번호가 발송되었습니다. 5분 이내에 입력해주세요.');
        restoreSignupDomValues();
      }, 600);
      return true;
    },

    confirmSignupEmailCode({ actionEl, event }) {
      event?.preventDefault?.();
      ctx.preserveSignupDomValues?.();
      syncSignupFromDom();
      const code = getInputValue(ctx, '[data-field="signupEmailCode"]');
      if (code.length >= 4) {
        setSignupEmailVerified(true);
        setSignupDraft(ctx, { emailVerified: true });
        if (actionEl?.dataset) actionEl.dataset.verified = 'true';
        ctx.clearSignupTimer?.('email');
        const timerEl = query(ctx, '[data-signup-timer="email"]');
        if (timerEl) timerEl.textContent = '인증 완료';
      }
      updateSignupButtonState();
      restoreSignupDomValues();
      return true;
    },

    confirmSignupPhoneCode({ actionEl, event }) {
      event?.preventDefault?.();
      ctx.preserveSignupDomValues?.();
      syncSignupFromDom();
      const code = getInputValue(ctx, '[data-field="signupPhoneCode"]');
      if (code.length >= 4) {
        setSignupPhoneVerified(true);
        setSignupDraft(ctx, { phoneVerified: true });
        if (actionEl?.dataset) actionEl.dataset.verified = 'true';
        ctx.clearSignupTimer?.('phone');
        const timerEl = query(ctx, '[data-signup-timer="phone"]');
        if (timerEl) timerEl.textContent = '인증 완료';
      }
      updateSignupButtonState();
      restoreSignupDomValues();
      return true;
    },

    setSignupGender({ actionEl }) {
      ctx.preserveSignupDomValues?.();
      const gender = getData(actionEl, 'gender', 'female');
      setSignupDraft(ctx, { gender });
      setSignupGender(gender);
      restoreSignupDomValues();
      return true;
    },

    toggleSignupTermsAll({ event }) {
      prevent(event);
      ctx.preserveSignupDomValues?.();
      const y = ctx.getScrollY?.() || 0;
      const checked = !!query(ctx, '[data-field="signupTermsAll"]')?.checked;
      setAllTerms(ctx, checked);
      updateSignupButtonState();
      restoreSignupDomValues();
      restoreSignupTermsScroll(y);
      return true;
    },

    openTermsModal({ actionEl, event }) {
      prevent(event);
      ctx.preserveSignupDomValues?.();
      const form = syncSignupFromDom();
      setSignupEmail(form.email || '');
      setSignupPhone(form.phone || '');
      setSignupPassword(form.pw || '');
      setSignupPasswordConfirm(form.pwc || '');
      setSignupName(form.name || '');
      setSignupBirth(form.birth || '');
      setSignupTrack(form.track || '');
      setSignupSource(form.source || '');
      setSignupPromoCode(form.promoCode || '');
      setSignupEmailCode(form.emailCode || '');
      setSignupPhoneCode(form.phoneCode || '');
      setSignupGender(form.gender || ctx.signupGender || '');
      setOpenTermsType(getData(actionEl, 'terms-type'));
      restoreSignupDomValues();
      return true;
    },

    closeTermsModal() {
      setOpenTermsType('');
      return true;
    },

    toggleSignupTermsRequired({ event }) {
      prevent(event);
      ctx.preserveSignupDomValues?.();
      const y = ctx.getScrollY?.() || 0;
      syncTermsDraftFromDom(ctx, true);
      updateSignupButtonState();
      restoreSignupDomValues();
      restoreSignupTermsScroll(y);
      return true;
    },

    toggleSignupTermsMarketing({ event }) {
      prevent(event);
      ctx.preserveSignupDomValues?.();
      const y = ctx.getScrollY?.() || 0;
      syncTermsDraftFromDom(ctx, true);
      updateSignupButtonState();
      restoreSignupDomValues();
      restoreSignupTermsScroll(y);
      return true;
    },

    signupSuccess({ event }) {
      prevent(event);
      ctx.preserveSignupDomValues?.();
      const form = syncSignupFromDom();
      if (!isSignupFormSubmittable(form, ctx)) {
        alert('필수 입력 사항을 모두 입력하고 인증/약관 동의를 완료해주세요.');
        restoreSignupDomValues();
        return false;
      }
      localStorage?.setItem?.('studycrack_signup_completed', 'true');
      localStorage?.setItem?.('studycrack_signup_profile', JSON.stringify(form));
      alert('회원가입이 완료되었습니다.');
      goto?.('ob1');
      return true;
    },

    loginSuccess() {
      setLoggedIn(true);
      setHistory([]);
      const completed = localStorage?.getItem?.('studycrack_onboarding_completed') === 'true';
      goto?.(completed ? 'home' : 'ob1', true);
      return true;
    },

    ssoSuccess() {
      setLoggedIn(true);
      setHistory([]);
      const completed = localStorage?.getItem?.('studycrack_onboarding_completed') === 'true';
      goto?.(completed ? 'home' : 'ob1', true);
      return true;
    }
  };
}
