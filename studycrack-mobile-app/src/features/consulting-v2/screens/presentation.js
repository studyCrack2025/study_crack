export function inviteErrorMessage(code, status = 0, { preflight = false } = {}) {
  if (code === 'INVITE_EXPIRED' || status === 410) return '초대 유효기간이 만료되었습니다. 이미 인증했다면 처음 인증한 학생 계정으로 로그인해주세요. 아직 인증 전이라면 운영팀에 재발급을 요청해주세요.';
  if (code === 'INVITE_LOCKED' || status === 423) return '인증 시도가 잠겼습니다. 15분 후 다시 시도해주세요.';
  if (preflight && code === 'INVITE_ALREADY_CLAIMED') return '이미 인증을 마친 초대입니다. 처음 인증한 학생 계정으로 로그인해주세요.';
  if (!preflight && code === 'INVITE_LINKED_TO_OTHER_ACCOUNT') return '이 초대는 이미 다른 학생 계정에 연결되어 있습니다. 처음 인증한 학생 계정으로 로그인해주세요.';
  if (!preflight && code === 'CONSULTING_ACCOUNT_UNAVAILABLE') return '로그인 계정을 확인할 수 없습니다. 다시 로그인해주세요.';
  if (code === 'CONSULTING_ACCOUNT_ALREADY_LINKED') return '이 학생 계정에는 다른 신청의 컨설팅이 이미 연결되어 있습니다. 이번 신청 학생의 별도 계정으로 로그인해주세요.';
  if (code === 'CONSULTING_ACCOUNT_LINK_INCONSISTENT') return '신청과 학생 계정의 연결을 확인할 수 없습니다. 운영팀에 문의해주세요.';
  if (code === 'INVITE_REQUEST_CONFLICT') return '이전에 사용한 인증 요청입니다. 새로 받은 초대 링크를 다시 열어주세요.';
  if (status === 401 || code === 'AUTH_EXPIRED') return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  if (!preflight && (code === 'FORBIDDEN' || code === 'AUTH_RETRY_REQUIRED')) return '컨설팅을 이용할 학생 계정으로 로그인했는지 확인한 뒤 다시 시도해주세요.';
  return '인증 정보를 확인하지 못했습니다. 받은 링크와 인증코드를 다시 확인해주세요.';
}

export function safeInviteSummary(value) {
  if (!value || typeof value !== 'object') return null;
  const maskedEmail = typeof value.maskedEmail === 'string' && value.maskedEmail.length <= 120 ? value.maskedEmail : '';
  const maskedPhone = typeof value.maskedPhone === 'string' && value.maskedPhone.length <= 40 ? value.maskedPhone : '';
  const expiresAt = typeof value.expiresAt === 'string' && !Number.isNaN(Date.parse(value.expiresAt)) ? value.expiresAt : '';
  return maskedEmail && maskedPhone && expiresAt ? { maskedEmail, maskedPhone, expiresAt } : null;
}
