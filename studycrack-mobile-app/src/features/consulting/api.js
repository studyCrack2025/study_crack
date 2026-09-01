import { postJson } from '../../shared/api/client.js';
import { CONSULTING_REQUEST_TYPES } from '../../shared/api/request-types.js';

export function fetchConsultingHome({ apiFetch, consultingApiUrl, signal } = {}) {
  return postJson({
    apiFetch,
    fallbackError: '정시 컨설팅 진행 정보를 불러오지 못했습니다.',
    payload: { type: CONSULTING_REQUEST_TYPES.GET_STUDENT_HOME, data: {} },
    signal,
    url: consultingApiUrl
  });
}
