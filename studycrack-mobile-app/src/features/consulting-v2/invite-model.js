export const INVITE_KEY = 'sc_jungsi_invite_v1';

export function readConsultingInvite() {
  try {
    const value = JSON.parse(globalThis.sessionStorage?.getItem(INVITE_KEY) || 'null');
    if (value?.version !== 1 || !/^APP_[0-9a-f-]{36}$/i.test(value.applicationId || '') || !/^[A-Za-z0-9_-]{43}$/.test(value.token || '') || !/^claim_[0-9a-f-]{36}$/i.test(value.idempotencyKey || '')) return null;
    return value;
  } catch { return null; }
}

export function retryableInviteFailure({ code, status } = {}) {
  return status >= 500 || status === 429 || ['NETWORK_ERROR', 'TIMEOUT', 'OFFLINE', 'REQUEST_ABORTED', 'CONFIG_UNAVAILABLE', 'INVITE_UNAVAILABLE'].includes(code);
}
