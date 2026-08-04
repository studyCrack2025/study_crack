import { apiSuccess, postJson, postUserData } from '../../shared/api/client.js';

export function saveStudySession({ apiFetch, session, userApiUrl } = {}) {
  return postUserData({ apiFetch, userApiUrl, type: 'record_study_session', data: session || {} });
}

export async function fetchStudyRanking({ apiFetch, period = 'daily', userApiUrl } = {}) {
  const result = await postJson({
    apiFetch,
    url: userApiUrl,
    payload: { type: 'get_study_ranking', data: { period } },
    fallbackError: '랭킹을 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  return apiSuccess({
    rows: Array.isArray(result.data?.rows) ? result.data.rows : [],
    me: result.data?.me || null
  }, { status: result.status });
}
