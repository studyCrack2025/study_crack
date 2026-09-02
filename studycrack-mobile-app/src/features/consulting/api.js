import { postJson } from '../../shared/api/client.js';
import { CONSULTING_FILE_REQUEST_TYPES, CONSULTING_REQUEST_TYPES, PAYMENT_REQUEST_TYPES } from '../../shared/api/request-types.js';

export function fetchConsultingHome({ apiFetch, consultingApiUrl, signal } = {}) {
  return postJson({
    apiFetch,
    fallbackError: '정시 컨설팅 진행 정보를 불러오지 못했습니다.',
    payload: { type: CONSULTING_REQUEST_TYPES.GET_STUDENT_HOME, data: {} },
    signal,
    url: consultingApiUrl
  });
}

export function prepareConsultingPurchase({ apiFetch, consultingApiUrl, idempotencyKey, productCode } = {}) {
  return postJson({
    apiFetch,
    fallbackError: '정시 컨설팅 구매 예약을 만들지 못했습니다.',
    payload: { type: CONSULTING_REQUEST_TYPES.PREPARE_PURCHASE, data: { idempotencyKey, productCode } },
    url: consultingApiUrl
  });
}

export function createConsultingPaymentIntent({ apiFetch, idempotencyKey, paymentApiUrl, purchaseReservationId } = {}) {
  return postJson({
    apiFetch,
    fallbackError: '결제 정보를 만들지 못했습니다.',
    payload: { type: PAYMENT_REQUEST_TYPES.CREATE_INTENT, data: { idempotencyKey, purchaseKind: 'consulting', purchaseReservationId } },
    url: paymentApiUrl
  });
}

export function fetchConsultingPaymentStatus({ apiFetch, paymentApiUrl, paymentIntentId, signal } = {}) {
  return postJson({
    apiFetch,
    fallbackError: '결제 상태를 확인하지 못했습니다.',
    payload: { type: PAYMENT_REQUEST_TYPES.GET_STATUS, data: { paymentIntentId } },
    signal,
    url: paymentApiUrl
  });
}

export function fetchConsultingSurveySchema({ apiFetch, caseId, consultingApiUrl, signal } = {}) {
  return postJson({ apiFetch, fallbackError: '조사서 항목을 불러오지 못했습니다.', payload: { type: CONSULTING_REQUEST_TYPES.GET_SURVEY_SCHEMA, data: { caseId } }, signal, url: consultingApiUrl });
}

export function fetchConsultingSurveyDraft({ apiFetch, caseId, consultingApiUrl, signal } = {}) {
  return postJson({ apiFetch, fallbackError: '저장된 조사서를 불러오지 못했습니다.', payload: { type: CONSULTING_REQUEST_TYPES.GET_SURVEY_DRAFT, data: { caseId } }, signal, url: consultingApiUrl });
}

export function saveConsultingSurveyDraft({ apiFetch, caseId, consultingApiUrl, expectedDraftRevision, snapshot } = {}) {
  return postJson({ apiFetch, fallbackError: '조사서를 저장하지 못했습니다.', payload: { type: CONSULTING_REQUEST_TYPES.SAVE_SURVEY_DRAFT, data: { caseId, expectedDraftRevision, snapshot } }, url: consultingApiUrl });
}

export function submitConsultingInitialSurvey({ apiFetch, caseId, consultingApiUrl, fileIds, idempotencyKey } = {}) {
  return postJson({ apiFetch, fallbackError: '조사서를 제출하지 못했습니다.', payload: { type: CONSULTING_REQUEST_TYPES.SUBMIT_INITIAL_SURVEY, data: { caseId, fileIds, idempotencyKey } }, url: consultingApiUrl });
}

export async function uploadConsultingScoreFile({ apiFetch, caseId, fetchImpl, file, fileApiUrl } = {}) {
  const created = await postJson({
    apiFetch,
    fallbackError: '성적표 업로드를 준비하지 못했습니다.',
    payload: { type: CONSULTING_FILE_REQUEST_TYPES.CREATE_SCORE_UPLOAD, data: { caseId, contentType: file?.type, fileName: file?.name, size: file?.size } },
    url: fileApiUrl
  });
  if (!created.ok) return created;
  const upload = created.data?.data;
  if (!upload?.uploadUrl || !upload?.fields || !upload?.fileId || typeof fetchImpl !== 'function') return { ...created, ok: false, error: '업로드 준비 응답이 올바르지 않습니다.', code: 'INVALID_RESPONSE' };
  const form = new FormData();
  Object.entries(upload.fields).forEach(([key, value]) => form.append(key, value));
  form.append('file', file);
  try {
    const response = await fetchImpl(upload.uploadUrl, { method: 'POST', body: form });
    if (!response.ok) return { ...created, ok: false, error: '성적표 파일 전송에 실패했습니다.', status: response.status };
  } catch (error) {
    return { ...created, ok: false, error: error?.message || '성적표 파일 전송에 실패했습니다.', status: 0 };
  }
  return postJson({
    apiFetch,
    fallbackError: '업로드한 성적표를 확인하지 못했습니다.',
    payload: { type: CONSULTING_FILE_REQUEST_TYPES.COMPLETE_SCORE_UPLOAD, data: { caseId, fileId: upload.fileId } },
    url: fileApiUrl
  });
}

export function deleteConsultingScoreFile({ apiFetch, caseId, fileApiUrl, fileId } = {}) {
  return postJson({ apiFetch, fallbackError: '성적표 파일을 삭제하지 못했습니다.', payload: { type: CONSULTING_FILE_REQUEST_TYPES.DELETE_UNSUBMITTED_SCORE_FILE, data: { caseId, fileId } }, url: fileApiUrl });
}
