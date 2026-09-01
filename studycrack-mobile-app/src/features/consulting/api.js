import { postJson } from '../../shared/api/client.js';
import { CONSULTING_REQUEST_TYPES, PAYMENT_REQUEST_TYPES } from '../../shared/api/request-types.js';

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
