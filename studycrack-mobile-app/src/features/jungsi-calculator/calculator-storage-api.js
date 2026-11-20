import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { prepareCalculatorScores } from './calculator-model.js';

export const CALCULATOR_STORAGE_CONSENT = 'CALCULATOR_INPUT_STORAGE_20261120_V1';
export function normalizeStoredCalculatorInput(value) {
  const score = prepareCalculatorScores(value?.scores);
  if (!score.ok || !Array.isArray(value?.targets) || value.targets.length > 6) return null;
  const seen = new Set(), targets = [];
  for (const row of value.targets) {
    if (!row || typeof row.university !== 'string' || !row.university.trim() || row.university.length > 160 || typeof row.major !== 'string' || !row.major.trim() || row.major.length > 200
      || /[\u0000-\u001f\u007f]/.test(row.university + row.major) || row.admissionUnitId !== undefined && !/^UNIT_[A-Z0-9][A-Z0-9_-]{2,71}$/.test(row.admissionUnitId)) return null;
    const pair = JSON.stringify([row.university.trim(), row.major.trim()]); if (seen.has(pair)) return null; seen.add(pair);
    targets.push({ university: row.university.trim(), major: row.major.trim(), ...(row.admissionUnitId ? { admissionUnitId: row.admissionUnitId } : {}) });
  }
  return { scores: score.data, targets };
}
export function parseCalculatorStoredInput(data, applicationId) {
  if (!data || data.contractVersion !== 'calculator-input-v1' || data.applicationId !== applicationId || !['saved', 'empty'].includes(data.status)
    || !Number.isSafeInteger(data.revision) || data.revision < 0 || data.source !== 'self_reported' || data.reviewed !== false || typeof data.canSave !== 'boolean' || data.consentRevision !== CALCULATOR_STORAGE_CONSENT
    || data.updatedAt !== null && (typeof data.updatedAt !== 'string' || data.updatedAt.length > 40 || !Number.isFinite(Date.parse(data.updatedAt)))) return null;
  if (data.status === 'empty') return data.input === null && data.candidateCount === 0 && data.basis === null ? data : null;
  const input = normalizeStoredCalculatorInput(data.input);
  return input && data.revision > 0 && data.updatedAt !== null && data.candidateCount === input.targets.length && data.basis === input.scores.basis ? { ...data, input } : null;
}
export async function requestCalculatorStorage(binding, { applicationId, type = 'student_get_calculator_input', data = {}, signal }) {
  const read = type === 'student_get_calculator_input';
  const send = () => postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, signal, payload: { type, data: { applicationId, ...data } }, fallbackError: '계산기 저장 자료를 확인하지 못했습니다.' });
  let result = await send();
  if (read && result.code === 'AUTH_RETRY_REQUIRED' && !signal?.aborted) result = await send();
  if (!result.ok) return result;
  const record = result.data?.success === true ? parseCalculatorStoredInput(result.data.data, applicationId) : null;
  if (!record || !read && record.revision !== data.expectedRevision + 1 || type === 'student_save_calculator_input' && JSON.stringify(record.input) !== JSON.stringify(data.input)
    || type === 'student_delete_calculator_input' && record.status !== 'empty') return apiInvalidResponse(result);
  return { ...result, data: record };
}
