import { postUserData } from '../../shared/api/client.js';
import { USER_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { buildTargetUnivsPayload } from '../analysis/target-model.js';

export async function saveTargetUnivs({ apiFetch, targetList, targetSlots, userApiUrl } = {}) {
  let remaining = null;
  const readLimit = (message) => {
    const match = String(message || '').match(/^남은 변경 횟수\((\d+)회\)가 부족합니다\.$/);
    if (match && Number.isSafeInteger(Number(match[1]))) remaining = Number(match[1]);
  };
  const result = await postUserData({
    apiFetch: typeof apiFetch === 'function' ? async (...args) => {
      let response;
      try { response = await apiFetch(...args); }
      catch (error) {
        if (error?.status === 400) readLimit(error.message);
        return { ok: false, status: Number(error?.status || 0), json: async () => ({ code: error?.code || (error?.name === 'AbortError' ? 'REQUEST_ABORTED' : '') }) };
      }
      if (response?.status !== 400) return response;
      const body = await response.json().catch(() => null);
      readLimit(body?.error);
      return { ok: response.ok, status: response.status, json: async () => body };
    } : apiFetch,
    userApiUrl,
    type: USER_REQUEST_TYPES.UPDATE_TARGET_UNIVERSITIES,
    data: buildTargetUnivsPayload(targetList, new Date().toISOString(), targetSlots)
  });
  return !result.ok && remaining !== null
    ? { ...result, code: 'TARGET_CHANGE_LIMIT', error: `남은 대학 변경 횟수가 ${remaining}회예요. 현재 대학을 유지하거나 요금제를 확인해주세요.`, data: { remainCount: remaining } }
    : result;
}
