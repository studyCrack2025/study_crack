import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';
import { calculatorDigest, calculatorReasonCodes, calculatorRecordId } from './calculator-validation.js';

const states = new Set(['current_two_references', 'prior_data_two_estimates', 'historical70_only', 'academic_score_without_cut', 'held', 'explicitly_excluded']);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const missing = code => ({ status: 'held', convertedScore: null, reasonCodes: [code] });
const range = value => value && finite(value.low) && finite(value.high) && value.low <= value.high;

export function safeCalculatorReference(value, target, scores) {
  if (value === undefined) return null;
  const invalid = () => missing('REFERENCE_RESPONSE_INVALID');
  if (!value || value.contractVersion !== 'reviewed-admission-reference-v1' || !states.has(value.status)
    || value.probability !== null || value.empiricallyCalibrated !== false || !calculatorReasonCodes(value.reasonCodes)) return invalid();
  if (value.recordId === null) return value.status === 'held' && [value.convertedScore, value.passReference, value.registered70Reference, value.referenceIndex].every(x => x === null)
    && value.reasonCodes.length ? missing(value.reasonCodes[0]) : invalid();
  if (value.school !== target.university || value.major !== target.major || !calculatorRecordId(value.recordId)
    || !calculatorDigest(value.bundleDigest) || value.targetYear !== 2027 || scores.basis !== 'official'
    || value.publicationReady !== false || value.personalEligibilityApproved !== false
    || target.admissionUnitId && value.candidateAdmissionIdentity?.admissionUnitId !== target.admissionUnitId
    || target.selection && value.recordId !== target.selection.recordId) return invalid();
  const two = ['current_two_references', 'prior_data_two_estimates'].includes(value.status);
  if (value.riskBand !== undefined && (two ? !CALCULATOR_RISK_BANDS.some(([key]) => key === value.riskBand) : value.riskBand !== null)) return invalid();
  if (['held', 'explicitly_excluded'].includes(value.status)) {
    if (![value.convertedScore, value.passReference, value.registered70Reference, value.referenceIndex].every(x => x === null)) return invalid();
  } else if (!finite(value.convertedScore) || value.convertedScore < 0) return invalid();
  if (two) {
    if (!finite(value.passReference) || !finite(value.registered70Reference) || value.registered70Reference <= value.passReference
      || !Number.isInteger(value.referenceIndex) || value.referenceIndex < 1 || value.referenceIndex > 99) return invalid();
  } else if (value.passReference !== null || value.referenceIndex !== null || (value.status === 'historical70_only' ? !finite(value.registered70Reference) : value.registered70Reference !== null)) return invalid();
  if (value.status === 'current_two_references') {
    const b = value.referenceBounds, i = value.indexRange;
    if (!Number.isInteger(value.referenceYear) || value.referenceYear < 2000 || value.referenceYear > 2027 || b?.kind !== 'cut_assumption_range'
      || !range(b.pass) || !range(b.registered70) || b.pass.low > value.passReference + 1e-7 || b.pass.high < value.passReference - 1e-7
      || b.registered70.low > value.registered70Reference + 1e-7 || b.registered70.high < value.registered70Reference - 1e-7
      || !range(i) || i.kind !== 'cut_assumption_range' || i.low < 1 || i.high > 99) return invalid();
  } else if (value.referenceBounds !== null || value.indexRange !== null || (value.status === 'historical70_only' ? value.referenceYear !== 2026 : value.referenceYear !== null)) return invalid();
  const history = value.historical70;
  const historical70 = Number.isInteger(history?.year) && history.year >= 2000 && history.year < 2027 && finite(history.score) && history.score >= 0
    ? { year: history.year, score: history.score }
    : value.status === 'historical70_only' && value.registered70Reference >= 0 ? { year: value.referenceYear, score: value.registered70Reference } : null;
  return { status: two ? 'academic_score_without_cut' : value.status, convertedScore: value.convertedScore, historical70,
    legacyScore: value.status === 'prior_data_two_estimates' || value.identityScope === 'legacy_unit_reference_only',
    recordId: value.recordId, sourceIds: Array.isArray(value.sourceIds) ? value.sourceIds.filter(id => /^SOURCE_[A-Z0-9_-]{1,150}$/.test(id)).slice(0, 20) : [], reasonCodes: value.reasonCodes };
}
