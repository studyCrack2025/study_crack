import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { GAME_REQUEST_TYPES } from '../../shared/api/request-types.js';
import {
  normalizeGameProfileResponse,
  validateActiveFishResponse,
  validateDrawAcknowledgeResponse,
  validateDrawResponse,
  validateFeedFishResponse,
  validateFishCatalogResponse,
  validateGameProfileResponse,
  validateHabitatResponse,
  validatePendingDrawResponse,
  validateRenameFishResponse,
  validateStarterClaimResponse,
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

export function fetchFishCatalog({ apiFetch, gameApiUrl, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, type: GAME_REQUEST_TYPES.GET_CATALOG,
    fallbackError: '물고기 목록을 불러오지 못했습니다.', validator: validateFishCatalogResponse
  });
}

export function claimStarterFish({ apiFetch, gameApiUrl, speciesId, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, data: { speciesId }, type: GAME_REQUEST_TYPES.CLAIM_STARTER_FISH,
    fallbackError: '첫 물고기를 선택하지 못했습니다.', validator: validateStarterClaimResponse
  });
}

export function feedFish({ apiFetch, fishId, gameApiUrl, requestId, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, data: { fishId, requestId }, type: GAME_REQUEST_TYPES.FEED_FISH,
    fallbackError: '먹이를 주지 못했습니다.', validator: validateFeedFishResponse
  });
}

export function setActiveFish({ apiFetch, fishId = '', gameApiUrl, signal, slot } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, data: { fishId, slot }, type: GAME_REQUEST_TYPES.SET_ACTIVE_FISH,
    fallbackError: '수조 배치를 변경하지 못했습니다.', validator: validateActiveFishResponse
  });
}

export function renameFish({ apiFetch, fishId, gameApiUrl, name, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, data: { fishId, name }, type: GAME_REQUEST_TYPES.RENAME_FISH,
    fallbackError: '물고기 이름을 변경하지 못했습니다.', validator: validateRenameFishResponse
  });
}

export function fetchPendingDraw({ apiFetch, gameApiUrl, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, type: GAME_REQUEST_TYPES.GET_PENDING_DRAW,
    fallbackError: '미확인 뽑기 결과를 불러오지 못했습니다.', validator: validatePendingDrawResponse
  });
}

export function drawFish({ apiFetch, gameApiUrl, requestId, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, data: { requestId }, type: GAME_REQUEST_TYPES.DRAW_FISH,
    fallbackError: '물고기를 뽑지 못했습니다.', validator: validateDrawResponse
  });
}

export function acknowledgeFishDraw({ apiFetch, gameApiUrl, requestId, signal } = {}) {
  return gameRequest({
    apiFetch, gameApiUrl, signal, data: { requestId }, type: GAME_REQUEST_TYPES.ACKNOWLEDGE_DRAW,
    fallbackError: '뽑기 결과를 확인하지 못했습니다.', validator: validateDrawAcknowledgeResponse
  });
}
