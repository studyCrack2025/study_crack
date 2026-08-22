import { apiInvalidResponse, apiSuccess, postJson } from '../../shared/api/client.js';
import { USER_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { isRecord } from '../../shared/model/contracts.js';

export async function fetchStudyRanking({ apiFetch, period = 'daily', signal, userApiUrl } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: userApiUrl,
    payload: { type: USER_REQUEST_TYPES.GET_STUDY_RANKING, data: { period } },
    fallbackError: '랭킹을 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  if (!Array.isArray(result.data?.rows) || (result.data?.me !== null && result.data?.me !== undefined && !isRecord(result.data.me))) {
    return apiInvalidResponse(result, '공부 랭킹 응답이 올바르지 않습니다.');
  }
  return apiSuccess({
    rows: Array.isArray(result.data?.rows) ? result.data.rows : [],
    me: result.data?.me || null
  }, { status: result.status });
}
