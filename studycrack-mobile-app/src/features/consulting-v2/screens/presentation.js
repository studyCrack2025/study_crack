export function inviteErrorMessage(code, status = 0, { preflight = false } = {}) {
  if (code === 'INVITE_EXPIRED' || status === 410) return '초대 유효기간이 만료되었습니다. 운영팀에 재발급을 요청해주세요.';
  if (code === 'INVITE_LOCKED' || status === 423) return '인증 시도가 잠겼습니다. 15분 후 다시 시도해주세요.';
  if (!preflight && code === 'IDENTITY_MISMATCH') return '로그인한 계정의 이메일이 신청 이메일과 다릅니다. 신청 이메일과 같은 계정으로 로그인해주세요.';
  if (!preflight && code === 'CONSULTING_ACCOUNT_UNAVAILABLE') return '로그인 계정을 확인할 수 없습니다. 다시 로그인해주세요.';
  if (status === 401 || code === 'AUTH_EXPIRED') return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  return '인증 정보를 확인하지 못했습니다. 받은 링크와 인증코드를 다시 확인해주세요.';
}

export function safeInviteSummary(value) {
  if (!value || typeof value !== 'object') return null;
  const maskedEmail = typeof value.maskedEmail === 'string' && value.maskedEmail.length <= 120 ? value.maskedEmail : '';
  const maskedPhone = typeof value.maskedPhone === 'string' && value.maskedPhone.length <= 40 ? value.maskedPhone : '';
  const expiresAt = typeof value.expiresAt === 'string' && !Number.isNaN(Date.parse(value.expiresAt)) ? value.expiresAt : '';
  return maskedEmail && maskedPhone && expiresAt ? { maskedEmail, maskedPhone, expiresAt } : null;
}
