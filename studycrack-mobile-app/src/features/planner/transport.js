import { postJson } from '../../shared/api/client.js';

export function createPlannerTransport({ owner, apiFetch, gameApiUrl, isActive }) {
  return async (request, { signal, protocol = 1 } = {}) => {
    if (![1, 2].includes(protocol)) return { ok: false, status: 0, code: 'INVALID_REQUEST' };
    if (!isActive() || signal?.aborted) return { ok: false, status: 0, code: 'PLANNER_ACCOUNT_CHANGED' };
    const result = await postJson({ apiFetch, url: gameApiUrl, signal,
      payload: { type: `planner_sync_v${protocol}`, owner, operation: request.type, data: request.data }, fallbackError: '계정 계획을 확인하지 못했어요.' });
    if (!isActive()) return { ok: false, status: 0, code: 'PLANNER_ACCOUNT_CHANGED' };
    if (result.ok && (result.data?.plannerOwner !== owner || result.data?.plannerProtocol !== protocol)) return { ok: false, status: 0, code: 'INVALID_RESPONSE' };
    return result;
  };
}
