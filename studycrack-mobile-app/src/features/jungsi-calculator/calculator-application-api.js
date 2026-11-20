import { apiInvalidResponse, postJson } from '../../shared/api/client.js';

export const CALCULATOR_APPLICATION_STATES = Object.freeze(['pending_payment', 'activation_required', 'active', 'expired', 'held', 'rejected', 'input_review', 'check_required', 'revoked']);
const id = value => typeof value === 'string' && /^APP_[0-9a-f-]{36}$/i.test(value);
const date = value => value === null || typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
const account = value => value === null || typeof value === 'string' && value.length <= 254 && value.includes('*') && !/[\r\n]/.test(value);
export function validCalculatorApplication(value) {
  return value && id(value.applicationId) && value.productType === 'calculator' && Number.isSafeInteger(value.revision) && value.revision >= 0
    && ['PAYMENT_REVIEW', 'INVITED', 'CLAIMED', 'REJECTED'].includes(value.applicationState) && ['pending', 'hold', 'input_review', 'verified', 'rejected', 'unknown'].includes(value.paymentStatus)
    && CALCULATOR_APPLICATION_STATES.includes(value.state) && typeof value.accountLinked === 'boolean' && typeof value.accessActive === 'boolean'
    && (!value.accessActive || value.state === 'active' && value.accountLinked && value.applicationState === 'CLAIMED' && value.paymentStatus === 'verified') && [null, 25000].includes(value.amount)
    && ['submittedAt', 'accessEndsAt', 'paymentDueAt'].every(key => date(value[key])) && value.openingAt === '2026-11-28T00:00:00+09:00';
}
export function parseCalculatorApplicationHome(value) {
  if (!value || value.contractVersion !== 'calculator-applications-v1' || !Array.isArray(value.items) || value.items.length > 21
    || value.items.some(item => !validCalculatorApplication(item)) || new Set(value.items.map(item => item.applicationId)).size !== value.items.length
    || typeof value.hasMore !== 'boolean' || typeof value.needsReview !== 'boolean' || !account(value.accountEmailMask)) return null;
  return value;
}
export function readCalculatorReceipt(storage = globalThis.sessionStorage, at = Date.now()) {
  try {
    const value = JSON.parse(storage?.getItem('sc_jungsi_application_v1') || 'null');
    return value?.version === 1 && value.productType === 'calculator' && /^web_[0-9a-f-]{36}$/i.test(value.requestKey || '')
      && /^[A-Za-z0-9_-]{43}$/.test(value.token || '') && Number.isSafeInteger(value.capturedAt) && value.capturedAt <= at && at - value.capturedAt < 86400000
      ? { requestKey: value.requestKey, token: value.token } : null;
  } catch { return null; }
}
async function request(binding, type, data, signal, read = false) {
  const send = () => postJson({ ...binding, url: binding.consultingApiUrl, payload: { type, data }, signal, fallbackError: '계산기 신청 상태를 확인하지 못했습니다.' });
  let result = await send();
  if (read && result.code === 'AUTH_RETRY_REQUIRED' && !signal?.aborted) result = await send();
  return result;
}
export async function getCalculatorApplications(binding, signal) {
  const result = await request(binding, 'student_get_calculator_applications', {}, signal, true);
  if (!result.ok) return result;
  const data = result.data?.success === true ? parseCalculatorApplicationHome(result.data.data) : null;
  return data ? { ...result, data } : apiInvalidResponse(result);
}
export async function previewCalculatorApplication(binding, credentials, signal) {
  const result = await request(binding, 'student_preview_calculator_application_link', credentials, signal, true);
  if (!result.ok) return result;
  const value = result.data?.success === true ? result.data.data : null;
  return value?.contractVersion === 'calculator-application-link-v1' && validCalculatorApplication(value.application) && account(value.accountEmailMask) && typeof value.linked === 'boolean'
    ? { ...result, data: value } : apiInvalidResponse(result);
}
export async function linkCalculatorApplication(binding, credentials, preview, signal) {
  const result = await request(binding, 'student_link_calculator_application_view', { ...credentials, expectedRevision: preview.application.revision, confirmed: true }, signal);
  if (!result.ok) return result;
  const value = result.data?.success === true ? result.data.data : null;
  return value?.applicationId === preview.application.applicationId && value.linked === true && typeof value.idempotent === 'boolean'
    ? { ...result, data: value } : apiInvalidResponse(result);
}
export const calculatorApplicationLabels = Object.freeze({ pending_payment: '신청 접수 · 입금 확인 대기', activation_required: '입금 확인 완료 · 이용 인증 대기', active: '계산기 이용권 활성', expired: '이용 기간 종료', held: '입금 확인 보류', rejected: '신청 거절', input_review: '신청 정보 확인 중', check_required: '이용 정보 확인 필요', revoked: '이용 초대 재발급 필요' });
