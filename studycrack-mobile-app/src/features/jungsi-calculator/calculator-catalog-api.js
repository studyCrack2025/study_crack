import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { normalizePlanSelection } from './calculator-plan-model.js';

export async function requestCalculatorCatalog({ apiFetch, analysisApiUrl, admissionGroup, query = '', cursor = 0, signal }) {
  const result = await postJson({ apiFetch, url: analysisApiUrl, signal, payload: { type: 'get_calculator_catalog', data: { admissionGroup, query, cursor } }, fallbackError: '모집단위를 불러오지 못했습니다. 다시 시도해주세요.' });
  if (!result.ok) return result;
  const value = result.data;
  if (!value || value.success !== true || value.contractVersion !== 'calculator-catalog-v1' || value.admissionYear !== 2027 || value.admissionGroup !== admissionGroup || value.query !== query
    || !/^sha256:[a-f0-9]{64}$/.test(value.catalogDigest || '') || !Number.isInteger(value.total) || value.total < 0 || !Array.isArray(value.items) || value.items.length > 20 || cursor + value.items.length > value.total
    || (value.nextCursor === null ? cursor + value.items.length !== value.total : !Number.isSafeInteger(value.nextCursor) || value.nextCursor !== cursor + value.items.length || value.nextCursor <= cursor || value.nextCursor >= value.total)
    || new Set(value.items.map(target => target?.selection?.key)).size !== value.items.length
    || !value.items.every(target => target && typeof target.university === 'string' && target.university.trim() && target.university.length <= 160 && typeof target.major === 'string' && target.major.trim() && target.major.length <= 200
      && !/[\u0000-\u001f\u007f]/.test(target.university + target.major) && /^UNIT_[A-Z0-9][A-Z0-9_-]{2,71}$/.test(target.admissionUnitId || '') && normalizePlanSelection(target.selection)
      && target.selection.admissionGroup === admissionGroup && target.selection.catalogDigest === value.catalogDigest)) return apiInvalidResponse(result);
  return result;
}
