import { postJson } from '../../shared/api/client.js';
import { parseHomeResponse } from './contracts.js';

export async function preflightConsultingInvite({ applicationId, fetchImpl = globalThis.fetch, publicApiUrl, signal, token, timeoutMs = 15000 } = {}) {
  if (typeof fetchImpl !== 'function' || !publicApiUrl) return { ok: false, code: 'CONFIG_UNAVAILABLE' };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(publicApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
      body: JSON.stringify({ type: 'public_preflight_v2_consulting_invite', data: { applicationId, token } })
    });
    const body = await response.json().catch(() => null);
    if (controller.signal.aborted) return { ok: false, code: timedOut ? 'TIMEOUT' : 'REQUEST_ABORTED' };
    if (!response.ok || body?.success !== true || !body.data) return { ok: false, code: body?.code || 'INVITE_UNAVAILABLE', status: response.status };
    return { ok: true, data: body.data };
  } catch (error) {
    return { ok: false, code: timedOut ? 'TIMEOUT' : error?.name === 'AbortError' ? 'REQUEST_ABORTED' : 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function getConsultingInviteStatus({ apiFetch, applicationId, consultingApiUrl, signal, token } = {}) {
  const result = await postJson({
    apiFetch,
    fallbackError: '초대 정보를 확인하지 못했습니다.',
    url: consultingApiUrl,
    signal,
    payload: { type: 'student_get_v2_consulting_invite_status', data: { applicationId, token } }
  });
  const data = result.data?.data;
  return result.ok && result.data?.success === true && typeof data?.linked === 'boolean'
    ? { ok: true, data }
    : { ok: false, code: result.code, status: result.status };
}

export async function resolveConsultingInvite(options = {}) {
  let signedInStudent = Boolean(options.signedInStudent);
  const cancelled = () => ({ ok: false, code: 'REQUEST_ABORTED', signedInStudent: false });
  try {
    if (options.signal?.aborted) return cancelled();
    if (signedInStudent && typeof options.verifySession === 'function') {
      signedInStudent = await options.verifySession({ preserveTransientErrors: true }) === true && options.hasClientSession?.() === true;
    }
    if (options.signal?.aborted) return cancelled();
    let result;
    if (signedInStudent) {
      result = await getConsultingInviteStatus(options);
      if (options.signal?.aborted) return cancelled();
      if (result.code === 'AUTH_RETRY_REQUIRED') result = await getConsultingInviteStatus(options);
      if (result.status === 401 || result.code === 'AUTH_EXPIRED') signedInStudent = false;
    }
    if (options.signal?.aborted) return cancelled();
    if (!signedInStudent) result = await preflightConsultingInvite(options);
    return { ...result, ...(result.code === 'AUTH_RETRY_REQUIRED' ? { code: 'INVITE_UNAVAILABLE' } : {}), signedInStudent };
  } catch (_error) {
    return options.signal?.aborted ? cancelled() : { ok: false, code: 'INVITE_UNAVAILABLE', signedInStudent: false };
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
