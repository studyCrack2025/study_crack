import { postJson } from '../../shared/api/client.js';

async function request(binding, type, data = {}, fallbackError, signal) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, fallbackError, signal, payload: { type, data } });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || fallbackError, code: result.data?.code || result.code, status: result.status };
  return { ok: true, data: result.data.data };
}

export const getStudentConsultingReport = (binding, signal) => request(binding, 'student_get_v2_report', {}, '보고서를 불러오지 못했습니다.', signal);
export function isPublishedPdfReport(report) {
  return Boolean(report?.format === 'approved_pdf_v1' && /^REPORT_[a-f0-9-]{36}$/.test(report.reportId || '') && /^ARTIFACT_[a-f0-9-]{36}$/.test(report.artifactId || '')
    && /^sha256:[a-f0-9]{64}$/.test(report.pdfSha256 || '') && Number.isSafeInteger(report.version) && report.version > 0 && report.version <= 999999
    && report.pageCount === 6 && Number.isSafeInteger(report.bytes) && report.bytes >= 1000 && report.bytes <= 15 * 1024 * 1024 && Number.isSafeInteger(report.contentRevision) && report.contentRevision > 0 && Number.isFinite(Date.parse(report.publishedAt)));
}
export async function openPublishedConsultingPdf(binding, report, inline, signal) {
  if (!isPublishedPdfReport(report) || typeof inline !== 'boolean') return { ok: false, error: '보고서 정보를 다시 불러와주세요.' };
  const result = await request(binding, 'student_preview_report_pdf', { reportVersion: report.version, inline }, 'PDF를 열지 못했습니다. 다시 시도해주세요.', signal);
  if (!result.ok) return result;
  try {
    const data = result.data, url = new URL(data.url);
    if (data.reportId !== report.reportId || data.version !== report.version || data.artifactId !== report.artifactId || data.pdfSha256 !== report.pdfSha256 || data.expiresIn !== 60
      || url.protocol !== 'https:' || url.username || url.password || url.port || !/^[a-z0-9][a-z0-9.-]+\.s3\.ap-northeast-2\.amazonaws\.com$/.test(url.hostname)
      || !new RegExp(`^/generated_reports/[^/]+/(DEV|PROD)-${report.artifactId}\\.pdf$`).test(url.pathname)) return { ok: false, error: '보고서 파일을 확인하지 못했습니다. 최신 보고서를 다시 불러와주세요.' };
    return { ok: true, data: { url: url.href } };
  } catch { return { ok: false, error: 'PDF 주소를 확인하지 못했습니다.' }; }
}
export const getCounselorReportDraft = (binding, caseId, signal) => request(binding, 'counselor_get_v2_report_draft', { caseId }, '보고서 초안을 불러오지 못했습니다.', signal);
export const saveCounselorReportDraft = (binding, data) => request(binding, 'counselor_save_v2_report_draft', data, '보고서 초안을 저장하지 못했습니다.');
export const submitCounselorReportReview = (binding, caseId) => request(binding, 'counselor_submit_v2_report_review', { caseId }, '보고서 검수를 요청하지 못했습니다.');
export const getAdminReportReview = (binding, caseId, signal) => request(binding, 'admin_get_v2_report_review', { caseId }, '검수할 보고서를 불러오지 못했습니다.', signal);
export const approveAdminReport = (binding, data) => request(binding, 'admin_approve_v2_report', data, '보고서를 승인하지 못했습니다.');
export const reopenAdminReport = (binding, data) => request(binding, 'admin_reopen_v2_report', data, '공개 예약을 취소하지 못했습니다.');

export async function downloadConsultingReport(binding, reportId, amendmentVersion, signal) {
  try {
    const response = await binding.apiFetch(binding.pdfApiUrl, { method: 'POST', signal, body: JSON.stringify({ reportId, ...(amendmentVersion !== undefined ? { amendmentVersion } : {}) }) });
    const body = await response.json().catch(() => null);
    return response.ok && body?.success === true && /^https:\/\//.test(body.downloadUrl || '') ? { ok: true, data: { downloadUrl: body.downloadUrl } } : { ok: false, error: body?.error || 'PDF를 만들지 못했습니다.' };
  } catch (_error) { return { ok: false, error: 'PDF를 만들지 못했습니다.' }; }
}

export const getReportAIDraft = (binding, caseId, signal) => request(binding, 'counselor_get_v2_report_ai_draft', { caseId }, 'AI 초안 상태를 불러오지 못했습니다.', signal);
export const queueReportAIDraft = (binding, data, signal) => request(binding, 'counselor_queue_v2_report_ai_draft', data, 'AI 초안 생성을 요청하지 못했습니다.', signal);
export const applyReportAIDraft = (binding, data, signal) => request(binding, 'counselor_apply_v2_report_ai_draft', data, '검토한 초안을 적용하지 못했습니다.', signal);
