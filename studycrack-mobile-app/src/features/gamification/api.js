import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { GAME_REQUEST_TYPES } from '../../shared/api/request-types.js';
import {
  normalizeGameProfileResponse,
  validateGameProfileResponse,
  validateHabitatResponse,
  validateStudyRewardResponse
} from './model.js';

async function gameRequest({ apiFetch, data = {}, fallbackError, gameApiUrl, signal, type, validator } = {}) {
  const response = await postJson({ apiFetch, signal, url: gameApiUrl, payload: { type, data }, fallbackError });
  if (!response.ok) return response;
  const contract = validator(response.data);
  return contract.ok ? response : apiInvalidResponse(response, contract.error);
}

export async function fetchGameProfile({ apiFetch, gameApiUrl, signal } = {}) {
  const response = await gameRequest({
    apiFetch, gameApiUrl, signal, type: GAME_REQUEST_TYPES.GET_PROFILE,
    fallbackError: '수조 상태를 불러오지 못했습니다.', validator: validateGameProfileResponse
  });
  return response.ok ? { ...response, data: normalizeGameProfileResponse(response.data) } : response;
}

export function fetchStudyHabitat({ apiFetch, days = 30, gameApiUrl, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, data: { days }, type: GAME_REQUEST_TYPES.GET_HABITAT,
    fallbackError: '공부 서식지를 불러오지 못했습니다.', validator: validateHabitatResponse
  });
}

export function claimStudyReward({ apiFetch, gameApiUrl, sessionId, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, data: { sessionId }, type: GAME_REQUEST_TYPES.CLAIM_STUDY_REWARD,
    fallbackError: '공부 보상을 확인하지 못했습니다.', validator: validateStudyRewardResponse
  });
}

