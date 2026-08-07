import { apiInvalidResponse, apiSuccess, postJson } from '../../shared/api/client.js';
import { USER_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { validateUser } from '../../shared/model/contracts.js';

export async function fetchCurrentUser({ apiFetch, signal, userApiUrl } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: userApiUrl,
    payload: { type: USER_REQUEST_TYPES.GET_CURRENT_USER },
    fallbackError: '사용자 정보를 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  const contract = validateUser(result.data);
  if (!contract.ok) return apiInvalidResponse(result, contract.error);
  return apiSuccess(result.data, { status: result.status });
}
