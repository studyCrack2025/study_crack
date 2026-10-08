import { postJson } from '../../shared/api/client.js';

async function request(binding, type, data = {}, fallbackError, signal) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, fallbackError, signal, payload: { type, data } });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || fallbackError, code: result.data?.code || result.code, status: result.status };
  return { ok: true, data: result.data.data };
}

export const getStudentConsultingReport = (binding, signal) => request(binding, 'student_get_v2_report', {}, '보고서를 불러오지 못했습니다.', signal);
export const getCounselorReportDraft = (binding, caseId, signal) => request(binding, 'counselor_get_v2_report_draft', { caseId }, '보고서 초안을 불러오지 못했습니다.', signal);
export const saveCounselorReportDraft = (binding, data) => request(binding, 'counselor_save_v2_report_draft', data, '보고서 초안을 저장하지 못했습니다.');
export const submitCounselorReportReview = (binding, caseId) => request(binding, 'counselor_submit_v2_report_review', { caseId }, '보고서 검수를 요청하지 못했습니다.');
export const getAdminReportReview = (binding, caseId, signal) => request(binding, 'admin_get_v2_report_review', { caseId }, '검수할 보고서를 불러오지 못했습니다.', signal);
export const approveAdminReport = (binding, data) => request(binding, 'admin_approve_v2_report', data, '보고서를 승인하지 못했습니다.');

export async function downloadConsultingReport(binding, reportId) {
  try {
    const response = await binding.apiFetch(binding.pdfApiUrl, { method: 'POST', body: JSON.stringify({ reportId }) });
    const body = await response.json().catch(() => null);
    return response.ok && body?.success === true && /^https:\/\//.test(body.downloadUrl || '') ? { ok: true, downloadUrl: body.downloadUrl } : { ok: false, error: body?.error || 'PDF를 만들지 못했습니다.' };
  } catch (_error) { return { ok: false, error: 'PDF를 만들지 못했습니다.' }; }
}
