import { postJson } from '../../shared/api/client.js';

async function request(binding, type, data, fallbackError) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, fallbackError, payload: { type, data } });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || fallbackError, code: result.data?.code || result.code };
  return { ok: true, data: result.data.data };
}

export const getV2SurveySchema = binding => request(binding, 'student_get_v2_survey_schema', {}, '조사서 구성을 불러오지 못했습니다.');
export const getV2SurveyDraft = binding => request(binding, 'student_get_v2_survey_draft', {}, '저장된 조사서를 불러오지 못했습니다.');
export const convertV2SurveyScores = (binding, data) => request(binding, 'student_convert_v2_survey_scores', data, '자동 환산을 잠시 이용할 수 없습니다. 성적표 수치를 직접 입력할 수 있습니다.');
export const saveV2SurveyDraft = (binding, data) => request(binding, 'student_save_v2_survey_draft', data, '조사서를 저장하지 못했습니다.');
export const submitV2Survey = (binding, data, supplement = false) => request(binding, supplement ? 'student_submit_v2_supplement' : 'student_submit_v2_survey', data, '조사서를 제출하지 못했습니다.');

async function fileRequest(binding, type, data, fallbackError) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.fileApiUrl, fallbackError, payload: { type, data } });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || fallbackError, code: result.data?.code || result.code };
  return { ok: true, data: result.data.data };
}

export const readV2ScorePhoto = (binding, data) => fileRequest(binding, 'consulting_read_score_photo', data, '사진을 읽지 못했습니다. 성적표 수치를 직접 입력할 수 있습니다.');
export const deleteV2ScoreFile = (binding, data) => fileRequest(binding, 'consulting_delete_unsubmitted_score_file', data, '성적표를 삭제하지 못했습니다.');

export async function uploadV2ScoreFile(binding, { caseId, file }) {
  const created = await fileRequest(binding, 'consulting_create_score_upload', { caseId, fileName: file.name, contentType: file.type, size: file.size }, '업로드를 준비하지 못했습니다.');
  if (!created.ok) return created;
  const form = new FormData();
  Object.entries(created.data.fields || {}).forEach(([key, value]) => form.append(key, String(value)));
  form.append('file', file);
  try {
    const uploaded = await binding.fetchImpl(created.data.uploadUrl, { method: 'POST', body: form, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!uploaded.ok) return { ok: false, error: '성적표 업로드에 실패했습니다.', code: 'UPLOAD_FAILED' };
  } catch (_error) {
    return { ok: false, error: '성적표 업로드에 실패했습니다.', code: 'UPLOAD_FAILED' };
  }
  return fileRequest(binding, 'consulting_complete_score_upload', { caseId, fileId: created.data.fileId }, '업로드 확인에 실패했습니다.');
}
