import { postJson } from '../../shared/api/client.js';
import { ANALYSIS_REQUEST_TYPES } from '../../shared/api/request-types.js';

async function request(binding, type, data, fallbackError) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, fallbackError, payload: { type, data } });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || fallbackError, code: result.data?.code || result.code };
  return { ok: true, data: result.data.data };
}

export const getV2SurveySchema = binding => request(binding, 'student_get_v2_survey_schema', {}, '조사서 구성을 불러오지 못했습니다.');
export const getV2SurveyDraft = binding => request(binding, 'student_get_v2_survey_draft', {}, '저장된 조사서를 불러오지 못했습니다.');
export const convertV2SurveyScores = (binding, data) => request(binding, 'student_convert_v2_survey_scores', data, '자동 환산을 잠시 이용할 수 없습니다.');
export const saveV2SurveyDraft = (binding, data) => request(binding, 'student_save_v2_survey_draft', data, '조사서를 저장하지 못했습니다.');
export const submitV2Survey = (binding, data, supplement = false) => request(binding, supplement ? 'student_submit_v2_supplement' : 'student_submit_v2_survey', data, '조사서를 제출하지 못했습니다.');

export async function fetchV2SurveyUniversities({ analysisApiUrl, apiFetch, signal }) {
  const fallbackError = '대학 목록을 불러오지 못했습니다.';
  const response = await postJson({
    apiFetch, signal, url: analysisApiUrl, fallbackError,
    payload: { type: ANALYSIS_REQUEST_TYPES.GET_UNIVERSITY_CATALOG, catalogView: 'consulting_preferences' }
  });
  if (!response.ok) return response;
  const list = Array.isArray(response.data) ? response.data : response.data?.univs;
  if (!Array.isArray(list)) return { ok: false, error: fallbackError };
  const universities = new Map();
  for (const item of list) {
    const name = item?.univName;
    if (typeof name !== 'string' || !name.trim()) continue;
    const regions = Array.isArray(item.regions) ? item.regions.filter(region => typeof region === 'string' && region.trim()).map(region => region.trim()) : [];
    const univName = name.trim();
    universities.set(univName, [...new Set([...(universities.get(univName) || []), ...regions])]);
  }
  if (!universities.size) return { ok: false, error: fallbackError };
  const catalog = Array.from(universities, ([univName, regions]) => ({ univName, regions }));
  return { ok: true, data: catalog.sort((a, b) => a.univName.localeCompare(b.univName, 'ko')) };
}

async function fileRequest(binding, type, data, fallbackError) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.fileApiUrl, fallbackError, payload: { type, data } });
  if (!result.ok || result.data?.success !== true || !result.data.data) {
    return { ok: false, error: result.status >= 500 ? fallbackError : result.error || fallbackError, code: result.data?.code || result.code, status: result.status };
  }
  return { ok: true, data: result.data.data };
}

export const deleteV2ScoreFile = (binding, data) => fileRequest(binding, 'consulting_delete_unsubmitted_score_file', data, '성적표를 삭제하지 못했습니다.');
export const readV2ScorePhoto = (binding, data) => fileRequest(binding, 'consulting_read_score_photo', data, '사진을 읽지 못했습니다. 성적을 직접 입력할 수 있어요.');
export const confirmV2ScoreUpload = (binding, data) => fileRequest(binding, 'consulting_complete_score_upload', data, '첨부 확인에 실패했어요. 파일 옆에서 다시 확인할 수 있어요.');

export async function uploadV2ScoreFile(binding, { caseId, file }) {
  const created = await fileRequest(binding, 'consulting_create_score_upload', { caseId, fileName: file.name, contentType: file.type, size: file.size }, '성적표 업로드를 시작하지 못했어요. 잠시 후 파일을 다시 선택해 주세요.');
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
  const { fileId } = created.data;
  const confirmed = await confirmV2ScoreUpload(binding, { caseId, fileId });
  if (!confirmed.ok && (!confirmed.status || confirmed.status >= 500)) {
    return { ...confirmed, pendingFile: { fileId, displayName: file.name, contentType: file.type, size: file.size, status: 'upload_pending' } };
  }
  return confirmed;
}
