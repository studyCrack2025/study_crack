import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { safeOfferEstimate } from './calculator-api.js';
import { normalizePlanSelection } from './calculator-plan-model.js';
import { admissionUnitId, calculatorTargetNames } from './calculator-validation.js';

export async function requestCalculatorRecommendations(binding, { scores, admissionGroup, preferences, previousUniversities, profile, signal }) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: profile ? binding.consultingApiUrl : binding.analysisApiUrl, signal,
    payload: profile
      ? { type: 'student_get_calculator_profile_recommendations', data: { ...profile, admissionGroup, previousUniversities } }
      : { type: 'get_calculator_recommendations', data: { scores, admissionGroup, preferences, previousUniversities } },
    fallbackError: '추천을 불러오지 못했습니다. 다시 시도해주세요.' });
  if (!result.ok) return result;
  const value = result.data, bands = preferences.strategy === 'safe' ? ['stable', 'appropriate'] : ['neutral', 'challenge', 'appropriate'];
  if (value?.success !== true || value.contractVersion !== 'calculator-recommendations-v1' || value.admissionYear !== 2027
    || value.admissionGroup !== admissionGroup || value.strategy !== preferences.strategy || !['estimated', 'official'].includes(value.scoreBasis)
    || scores.basis === 'official' && value.scoreBasis !== 'official' || !Array.isArray(value.items) || value.items.length > 2) return apiInvalidResponse(result);
  const seen = new Set(), items = [];
  for (const row of value.items) {
    const target = row?.target, selection = normalizePlanSelection(target?.selection);
    if (!calculatorTargetNames(target) || !admissionUnitId(target.admissionUnitId) || selection?.admissionGroup !== admissionGroup
      || !/^UNIV_[a-f0-9]{32}$/.test(row.universityKey || '') || seen.has(row.universityKey) || !bands.includes(row.riskBand)
      || !Number.isInteger(row.tier) || row.tier < 0 || row.tier > 5 || !Number.isFinite(row.convertedScore) || row.convertedScore < 0
      || !Number.isFinite(row.cutoffs?.pass) || !Number.isFinite(row.cutoffs?.registered70) || row.cutoffs.pass < 0 || row.cutoffs.pass >= row.cutoffs.registered70
      || row.scoreScope !== undefined && row.scoreScope !== 'csat_component') return apiInvalidResponse(result);
    seen.add(row.universityKey);
    items.push({ ...row, target: { university: target.university, major: target.major, admissionUnitId: target.admissionUnitId, selection },
      offerEstimate: safeOfferEstimate(row.offerEstimate, row.scoreScope) });
  }
  if (items.length === 2 && (items[0].riskBand === 'appropriate' || items[1].riskBand !== 'appropriate'
    || items[0].target.selection.catalogDigest !== items[1].target.selection.catalogDigest)
    || value.repeatedUniversities !== items.filter(row => previousUniversities.includes(row.universityKey)).length) return apiInvalidResponse(result);
  return { ...result, data: { ...value, items } };
}
