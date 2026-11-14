import { apiFailure, apiInvalidResponse, postJson } from '../../shared/api/client.js';

const statuses = new Set(['available', 'unavailable', 'choice_required', 'ineligible']);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const unit = value => value && /^UNIT_[A-Z0-9][A-Z0-9_-]{2,71}$/.test(value.admissionUnitId)
  && ['campusName', 'unitName', 'trackName'].every(key => text(value[key])) && ['ga', 'na', 'da'].includes(value.admissionGroup);
const digest = value => /^sha256:[a-f0-9]{64}$/.test(value || '');
const riskBands = new Set(['stable', 'appropriate', 'neutral', 'challenge', 'risky']);
const forecastUnavailable = code => ({ status: 'unavailable', probability: null, riskBand: null, reasonCodes: [code] });

function safeForecast(value, row, body) {
  if (value === undefined) return forecastUnavailable(row.status === 'available' ? 'FORECAST_BACKEND_UPDATE_REQUIRED' : 'FORECAST_CONVERSION_NOT_AVAILABLE');
  const invalid = () => forecastUnavailable('FORECAST_RESPONSE_INVALID');
  if (!value || !['available', 'unavailable'].includes(value.status) || value.policyVersion !== 'calculator-forecast-publication-1.0.0'
    || value.riskPolicyVersion !== 'admission-risk-1.0.0' || !Array.isArray(value.reasonCodes) || value.reasonCodes.length > 12
    || value.reasonCodes.some(code => !/^[A-Z][A-Z0-9_]{1,99}$/.test(code))) return invalid();
  if (value.status === 'unavailable') return value.probability === null && value.riskBand === null && value.reasonCodes.length
    ? forecastUnavailable(value.reasonCodes[0]) : invalid();
  const probability = value.probability;
  if (row.status !== 'available' || body.basis !== 'official' || !body.release || value.dataReleaseId !== body.release.dataReleaseId
    || value.admissionUnitId !== row.selected?.admissionUnitId || value.validationState !== 'passed' || value.reasonCodes.length
    || !/^probability-\d+\.\d+\.\d+$/.test(value.modelVersion || '') || !/^CALCULATOR_FORECAST_2027_[A-Z0-9][A-Z0-9_-]{2,47}$/.test(value.publicationId || '')
    || typeof value.validatedAt !== 'string' || !Number.isFinite(Date.parse(value.validatedAt)) || !riskBands.has(value.riskBand)
    || !probability || !Number.isInteger(probability.percent) || probability.percent < 1 || probability.percent > 99
    || !['approximate', 'less_than', 'more_than'].includes(probability.qualifier)
    || probability.qualifier === 'less_than' && (probability.percent !== 1 || value.riskBand !== 'risky')
    || probability.qualifier === 'more_than' && (probability.percent !== 99 || value.riskBand !== 'stable')) return invalid();
  return { status: 'available', probability: { percent: probability.percent, qualifier: probability.qualifier }, riskBand: value.riskBand,
    reasonCodes: [], modelVersion: value.modelVersion, publicationId: value.publicationId, validatedAt: value.validatedAt };
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
  return { ...response, data: { ...response.data, results: response.data.results.map(row => ({ ...row, forecast: safeForecast(row.forecast, row, response.data) })) } };
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
