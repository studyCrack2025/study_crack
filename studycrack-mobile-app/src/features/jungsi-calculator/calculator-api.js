import { apiFailure, apiInvalidResponse, postJson } from '../../shared/api/client.js';

const statuses = new Set(['available', 'unavailable', 'choice_required', 'ineligible']);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const unit = value => value && /^UNIT_[A-Z0-9][A-Z0-9_-]{2,71}$/.test(value.admissionUnitId)
  && ['campusName', 'unitName', 'trackName'].every(key => text(value[key])) && ['ga', 'na', 'da'].includes(value.admissionGroup);
const digest = value => /^sha256:[a-f0-9]{64}$/.test(value || '');
const riskBands = new Set(['stable', 'appropriate', 'neutral', 'challenge', 'risky']);
const possibilityUnavailable = code => ({ status: 'unavailable', index: null, riskBand: null, reasonCodes: [code] });

function safePossibility(value, row, body) {
  if (value === undefined) return possibilityUnavailable('CUT_REFERENCE_BACKEND_UPDATE_REQUIRED');
  const invalid = () => possibilityUnavailable('CUT_REFERENCE_RESPONSE_INVALID');
  if (!value || value.contractVersion !== 'cut-reference-public-v1' || value.policyVersion !== 'cut-reference-possibility-1.0.0'
    || value.basis !== 'cut_reference_heuristic' || value.probability !== null || value.empiricallyCalibrated !== false
    || !Array.isArray(value.reasonCodes) || value.reasonCodes.length > 12 || value.reasonCodes.some(code => !/^[A-Z][A-Z0-9_]{1,99}$/.test(code))) return invalid();
  if (value.status === 'unavailable') return value.index === null && value.riskBand === null && value.validationState === 'not_available'
    && value.reasonCodes.length && ['dataReleaseId', 'admissionUnitId', 'publicationId', 'publicationDigest', 'referenceDigest', 'sourceYear', 'targetYear', 'validatedAt'].every(key => value[key] === null)
    ? possibilityUnavailable(value.reasonCodes[0]) : invalid();
  if (value.status !== 'available' || row.status !== 'available' || body.basis !== 'official' || !body.release
    || value.dataReleaseId !== body.release.dataReleaseId || value.admissionUnitId !== row.selected?.admissionUnitId
    || value.validationState !== 'passed' || value.reasonCodes.length || !riskBands.has(value.riskBand)
    || !value.index || Object.keys(value.index).length !== 1 || !Number.isInteger(value.index.points) || value.index.points < 1 || value.index.points > 99
    || !/^CUT_RELEASE_[A-Z0-9][A-Z0-9_-]{2,95}$/.test(value.publicationId || '') || !digest(value.publicationDigest) || !digest(value.referenceDigest)
    || !Number.isInteger(value.sourceYear) || value.sourceYear < 2000 || value.sourceYear > 2027 || value.targetYear !== 2027
    || typeof value.validatedAt !== 'string' || !Number.isFinite(Date.parse(value.validatedAt))) return invalid();
  return { status: 'available', index: { points: value.index.points }, riskBand: value.riskBand, reasonCodes: [],
    sourceYear: value.sourceYear, targetYear: value.targetYear, policyVersion: value.policyVersion, publicationId: value.publicationId, validatedAt: value.validatedAt };
}

function validResponse(body, scores, targets) {
  if (!body || body.success !== true || body.contractVersion !== 'jungsi-calculator-conversion-v1' || body.admissionYear !== 2027
    || body.basis !== scores.basis || body.scoreSource !== 'self_reported' || !digest(body.scoreDigest)
    || !Array.isArray(body.results) || body.results.length !== targets.length) return false;
  if (body.release !== null && (!body.release || !/^ADMISSION_RELEASE_2027_[A-Z0-9][A-Z0-9_-]{2,47}$/.test(body.release.dataReleaseId || '')
    || !digest(body.release.contentDigest) || !/^formula-\d+\.\d+\.\d+$/.test(body.release.formulaVersion || '')
    || !/^eligibility-\d+\.\d+\.\d+$/.test(body.release.eligibilityRuleVersion || ''))) return false;
  return body.results.every((row, index) => {
    const target = targets[index];
    if (!row || row.university !== target.university || row.major !== target.major || !statuses.has(row.status)
      || !Array.isArray(row.reasonCodes) || row.reasonCodes.length > 12 || row.reasonCodes.some(code => !/^[A-Z][A-Z0-9_]{1,99}$/.test(code))
      || !Array.isArray(row.choices) || row.choices.length > 12 || row.choices.some(value => !unit(value))
      || new Set(row.choices.map(value => value.admissionUnitId)).size !== row.choices.length
      || row.selected !== null && (!unit(row.selected) || !row.choices.some(value => ['admissionUnitId', 'campusName', 'unitName', 'trackName', 'admissionGroup'].every(key => value[key] === row.selected[key])))) return false;
    if (row.status === 'available') return body.release !== null && scores.basis === 'official' && row.selected !== null
      && (!target.admissionUnitId || row.selected.admissionUnitId === target.admissionUnitId)
      && Number.isFinite(row.convertedScore) && Number.isFinite(row.maximumScore) && row.maximumScore > 0 && row.reasonCodes.length === 0;
    return row.convertedScore === null && row.maximumScore === null && row.reasonCodes.length > 0;
  });
}

export async function requestCalculatorConversion({ apiFetch, analysisApiUrl, scores, targets, signal }) {
  const response = await postJson({ apiFetch, url: analysisApiUrl, signal,
    payload: { type: 'get_calculator_conversion', data: { scores, targets } }, fallbackError: '환산점수를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' });
  if (!response.ok) {
    if (response.code === 'CALCULATOR_ACCESS_REQUIRED') return apiFailure('환산점수 조회는 Basic·Starter·Standard·Pro 이용 계정에서 가능합니다.', response);
    if (response.code === 'INVALID_CALCULATOR_INPUT') return apiFailure('입력 성적과 선택한 후보를 다시 확인해주세요.', response);
    return response;
  }
  if (!validResponse(response.data, scores, targets)) return apiInvalidResponse(response, '환산 결과를 확인하지 못했습니다. 다시 조회해주세요.');
  return { ...response, data: { ...response.data, results: response.data.results.map(row => {
    const safe = { ...row, possibility: safePossibility(row.possibility, row, response.data) }; delete safe.forecast; return safe;
  }) } };
}

export async function requestCalculatorAccess({ apiFetch, analysisApiUrl, signal }) {
  const response = await postJson({ apiFetch, url: analysisApiUrl, signal, payload: { type: 'get_calculator_access' }, fallbackError: '이용 상태를 확인하지 못했습니다. 잠시 후 다시 확인해주세요.' });
  if (!response.ok) return response;
  const value = response.data;
  if (!value || value.success !== true || value.contractVersion !== 'jungsi-calculator-access-v1' || value.admissionYear !== 2027
    || !value.access || typeof value.access.allowed !== 'boolean' || !['membership', 'manager', 'none'].includes(value.access.source)
    || value.access.allowed !== (value.access.source !== 'none') || !value.service || value.service.purchaseAvailable !== false
    || !['preparing', 'candidate_check_required'].includes(value.service.state)) return apiInvalidResponse(response, '이용 상태를 확인하지 못했습니다. 다시 확인해주세요.');
  return { ...response, data: { access: { allowed: value.access.allowed, source: value.access.source }, service: { state: value.service.state, purchaseAvailable: false } } };
}
