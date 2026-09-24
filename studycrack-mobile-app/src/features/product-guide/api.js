import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { USER_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { parseProductGuide, PRODUCT_GUIDE_VERSION } from './model.js';

async function requestGuide({ apiFetch, userApiUrl, signal, type, data }) {
  const result = await postJson({ apiFetch, url: userApiUrl, signal, payload: { type, data }, fallbackError: '사용법 기록을 저장하지 못했어요. 다시 시도해주세요.' });
  if (!result.ok) return result;
  const guide = parseProductGuide(result.data);
  return guide ? { ...result, data: guide } : apiInvalidResponse(result, '사용법 기록 동기화를 아직 사용할 수 없어요. 안내는 다시 볼 수 있어요.');
}

export function fetchProductGuide(binding, signal) {
  return requestGuide({ ...binding, signal, type: USER_REQUEST_TYPES.GET_PRODUCT_GUIDE, data: { version: PRODUCT_GUIDE_VERSION } });
}

export function saveProductGuide(binding, data, signal) {
  return requestGuide({ ...binding, signal, type: USER_REQUEST_TYPES.SAVE_PRODUCT_GUIDE, data });
}
