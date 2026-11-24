import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { normalizePlanSelection } from './calculator-plan-model.js';
import { admissionUnitId, calculatorDigest, calculatorLabel, calculatorTargetNames } from './calculator-validation.js';

export async function requestCalculatorCatalog({ apiFetch, analysisApiUrl, admissionGroup, query = '', cursor = 0, universityKey, universityName, universities = false, signal }) {
  const result = await postJson({ apiFetch, url: analysisApiUrl, signal, payload: { type: 'get_calculator_catalog', data: { admissionGroup, query, cursor, ...(universities ? { view: 'universities' } : universityKey ? { view: 'units', universityKey } : {}) } }, fallbackError: '모집단위를 불러오지 못했습니다. 다시 시도해주세요.' });
  if (!result.ok) return result;
  const value = result.data;
  if (!value || value.success !== true || value.contractVersion !== (universities ? 'calculator-universities-v1' : 'calculator-catalog-v1') || universityKey !== undefined && (value.universityKey !== universityKey || typeof universityName !== 'string') || value.admissionYear !== 2027 || value.admissionGroup !== admissionGroup || value.query !== query
    || !calculatorDigest(value.catalogDigest) || !Number.isInteger(value.total) || value.total < 0 || !Array.isArray(value.items) || value.items.length > 20 || cursor + value.items.length > value.total
    || (value.nextCursor === null ? cursor + value.items.length !== value.total : !Number.isSafeInteger(value.nextCursor) || value.nextCursor !== cursor + value.items.length || value.nextCursor <= cursor || value.nextCursor >= value.total)
    || new Set(value.items.map(target => universities ? target?.universityKey : target?.selection?.key)).size !== value.items.length
    || !value.items.every(target => universities ? target && /^UNIV_[a-f0-9]{32}$/.test(target.universityKey) && calculatorLabel(target.name) && Number.isSafeInteger(target.unitCount) && target.unitCount > 0 && Array.isArray(target.campuses) && target.campuses.length > 0 && target.campuses.length <= 50 && target.campuses.every(calculatorLabel) : calculatorTargetNames(target)
      && admissionUnitId(target.admissionUnitId) && normalizePlanSelection(target.selection)
      && (!universityKey || target.selection.universityName === universityName) && target.selection.admissionGroup === admissionGroup && target.selection.catalogDigest === value.catalogDigest)) return apiInvalidResponse(result);
  return result;
}
