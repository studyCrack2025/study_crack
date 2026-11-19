import { postJson } from '../../shared/api/client.js';

async function request(binding, type, data, signal) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, payload: { type, data }, signal, fallbackError: '후보 분석을 처리하지 못했습니다.' });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || '분석 응답을 확인할 수 없습니다.', code: result.code || result.data?.code, status: result.status };
  return { ok: true, data: result.data.data };
}

export const getCandidateAnalysis = (binding, caseId, signal) => request(binding, 'counselor_get_candidate_analysis', { caseId, analysisResultId: null }, signal);
export const runCandidateAnalysis = (binding, data, signal) => request(binding, 'counselor_run_candidate_analysis', data, signal);
export const approveCandidateAnalysis = (binding, data, signal) => request(binding, 'counselor_approve_candidate_analysis', data, signal);
