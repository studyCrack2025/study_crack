import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { USER_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { validateServerStudySession, validateStudySessionId } from './session-model.js';
import { validateStudySummary } from './summary-model.js';

export async function fetchStudySummary({ apiFetch, signal, userApiUrl } = {}) {
  const response = await postJson({
    apiFetch,
    signal,
    url: userApiUrl,
    payload: { type: USER_REQUEST_TYPES.GET_STUDY_SUMMARY, data: {} },
    fallbackError: '공부 요약을 불러오지 못했습니다.'
  });
  if (!response.ok) return response;
  const contract = validateStudySummary(response.data);
  return contract.ok ? response : apiInvalidResponse(response, contract.error);
}

export async function startServerStudySession({ apiFetch, session, userApiUrl } = {}) {
  const id = validateStudySessionId(session?.sessionId);
  const subject = String(session?.subject || '').trim();
  const activity = String(session?.activity || '').trim();
  if (!id.ok || !subject || !activity) return apiInvalidResponse({}, '시작할 공부 세션 정보가 올바르지 않습니다.');
  const response = await postJson({
    apiFetch,
    url: userApiUrl,
    payload: {
      type: USER_REQUEST_TYPES.START_STUDY_SESSION,
      data: { sessionId: id.value, subject, activity: activity.slice(0, 80), plannerItemId: String(session?.plannerItemId || '') }
    },
    fallbackError: '공부 시작을 기록하지 못했습니다.'
  });
  if (!response.ok) return response;
  const contract = validateServerStudySession(response.data);
  return contract.ok ? response : apiInvalidResponse(response, contract.error);
}

export async function completeServerStudySession({ apiFetch, sessionId, userApiUrl } = {}) {
  const id = validateStudySessionId(sessionId);
  if (!id.ok) return apiInvalidResponse({}, id.error);
  const response = await postJson({
    apiFetch,
    url: userApiUrl,
    payload: { type: USER_REQUEST_TYPES.COMPLETE_STUDY_SESSION, data: { sessionId: id.value } },
    fallbackError: '공부 완료 기록을 저장하지 못했습니다.'
  });
  if (!response.ok) return response;
  const contract = validateServerStudySession(response.data);
  return contract.ok ? response : apiInvalidResponse(response, contract.error);
}
