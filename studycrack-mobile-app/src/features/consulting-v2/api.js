import { postJson } from '../../shared/api/client.js';
import { parseHomeResponse } from './contracts.js';

export async function preflightConsultingInvite({ applicationId, fetchImpl = globalThis.fetch, publicApiUrl, signal, token } = {}) {
  if (typeof fetchImpl !== 'function' || !publicApiUrl) return { ok: false, code: 'CONFIG_UNAVAILABLE' };
  try {
    const response = await fetchImpl(publicApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
      body: JSON.stringify({ type: 'public_preflight_v2_consulting_invite', data: { applicationId, token } })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.success !== true || !body.data) return { ok: false, code: body?.code || 'INVITE_UNAVAILABLE', status: response.status };
    return { ok: true, data: body.data };
  } catch (error) {
    return { ok: false, code: error?.name === 'AbortError' ? 'REQUEST_ABORTED' : 'NETWORK_ERROR' };
  }
}

export async function claimConsultingInvite({ apiFetch, applicationId, code, consultingApiUrl, idempotencyKey, signal, token } = {}) {
  const result = await postJson({
    apiFetch,
    fallbackError: '이용 인증을 완료하지 못했습니다.',
    url: consultingApiUrl,
    signal,
    payload: { type: 'student_claim_v2_consulting_invite', data: { applicationId, token, code, idempotencyKey } }
  });
  return result.ok && result.data?.success === true ? { ok: true, data: result.data.data || null } : { ok: false, code: result.data?.code || result.code, status: result.status };
}

export async function getConsultingHome({ apiFetch, consultingApiUrl, signal } = {}) {
  const result = await postJson({ apiFetch, fallbackError: '진행 현황을 불러오지 못했습니다.', url: consultingApiUrl, signal, payload: { type: 'student_get_v2_consulting_home', data: {} } });
  const data = result.ok ? parseHomeResponse(result.data) : null;
  return data ? { ok: true, data } : { ok: false, code: result.data?.code || result.code || 'INVALID_RESPONSE', status: result.status };
}
