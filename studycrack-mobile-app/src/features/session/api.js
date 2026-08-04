import { apiFailure, apiSuccess, postJson } from '../../shared/api/client.js';

export async function fetchCurrentUser({ apiFetch, signal, userApiUrl } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: userApiUrl,
    payload: { type: 'get_user_analysis' },
    fallbackError: '사용자 정보를 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  if (!result.data || typeof result.data !== 'object') {
    return apiFailure('사용자 정보 응답이 올바르지 않습니다.', { status: result.status });
  }
  return apiSuccess(result.data, { status: result.status });
}
