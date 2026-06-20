function noop() {}

function prevent(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
}

function redirectToWebAuth(path) {
  if (typeof window === 'undefined' || !window.location) return;
  const here = (window.location.pathname || '/') + (window.location.search || '');
  window.location.href = `${path}?returnUrl=${encodeURIComponent(here)}`;
}

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function query(ctx, selector) {
  return getDocument(ctx)?.querySelector?.(selector) || null;
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
    requestResetCode = defaultRequestResetCode,
    resetPassword = defaultResetPassword,
    setFindEmailModalOpen = noop,
    setFoundEmailMasked = noop,
    setResetPasswordEmail = noop,
    setResetPasswordModalOpen = noop,
    setResetPasswordSending = noop,
    setResetPasswordStep = noop
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
      redirectToWebAuth('/signup');
      return true;
    },

    loginSuccess() {
      redirectToWebAuth('/login');
      return true;
    },

    ssoSuccess() {
      redirectToWebAuth('/login');
      return true;
    }
  };
}
