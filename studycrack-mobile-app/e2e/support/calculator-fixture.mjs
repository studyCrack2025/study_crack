export const calculatorApplicationId = 'APP_123e4567-e89b-12d3-a456-426614174000';
export function calculatorLegacyDraft(owner) {
  return { version: 1, owner, admissionYear: 2027, candidates: [], confirmed: { admissionYear: 2027, basis: 'official', exam: {
    kor: { opt: '언어와매체', std: 130, pct: 95, grd: 2 }, math: { opt: '미적분', std: 130, pct: 95, grd: 2 },
    inq1: { name: '사회·문화', std: 65, pct: 95, grd: 2 }, inq2: { name: '생활과 윤리', std: 65, pct: 95, grd: 2 }, eng: { grd: 2 }, hist: { grd: 1 }
  } } };
}
export function calculatorScoreFixture(records) {
  return { success: true, contractVersion: 'calculator-score-conversion-v1', admissionYear: 2027, inputDigest: `sha256:${'a'.repeat(64)}`,
    scoreboard: { id: '2027_KSAT_survey_estimated.json', digest: `sha256:${'b'.repeat(64)}`, estimated: true },
    results: records.map(row => ({ key: row.key, input: row, status: 'converted', metrics: { standardScore: row.raw + (row.key.startsWith('inq') ? 20 : 40), percentile: Math.min(100, row.raw), grade: row.raw === 0 ? 9 : 2 }, reasonCodes: [] })) };
}
export function calculatorAccessFixture({ allowed = true, source = 'purchase', applicationId = calculatorApplicationId,
  accessEndsAt = '2027-01-07T14:59:59.999Z', calculationEnabled = true, mode = 'development_preview', earlyAccess } = {}) {
  const enabled = allowed && source !== 'membership' && calculationEnabled;
  return { success: true, contractVersion: 'jungsi-calculator-access-v1', admissionYear: 2027,
    access: { allowed, source: allowed ? source : 'none' },
    entitlement: allowed && source === 'purchase' ? { applicationId, accessEndsAt } : null,
    service: { state: 'preparing', purchaseAvailable: false, calculationEnabled: enabled, calculationMode: enabled ? mode : 'closed',
      earlyAccess: allowed && source === 'purchase' && (earlyAccess ?? (enabled && mode === 'development_preview')) } };
}
export function calculatorEmptyStorage(applicationId = calculatorApplicationId) {
  return { success: true, data: { contractVersion: 'calculator-input-v1', applicationId, status: 'empty', revision: 0, input: null,
    updatedAt: null, candidateCount: 0, basis: null, source: 'self_reported', reviewed: false, canSave: true, canDelete: false,
    consentRevision: 'CALCULATOR_INPUT_STORAGE_20261120_V1' } };
}

export function calculatorRawPreviewFixture(scores, targets) {
  const scoreDigest = `sha256:${'a'.repeat(64)}`;
  const exam = { ...scores.exam };
  for (const key of ['kor', 'math', 'inq1', 'inq2']) {
    const field = ['kor', 'math'].includes(key) ? 'opt' : 'name';
    exam[key] = { [field]: scores.exam[key][field], std: key.startsWith('inq') ? 65 : 120, pct: 90, grd: 2 };
  }
  return { success: true, contractVersion: 'jungsi-calculator-conversion-v1', admissionYear: 2027, basis: 'raw', scoreSource: 'self_reported', scoreDigest, release: null,
    execution: { contractVersion: 'calculator-execution-v1', mode: 'development_preview', inputBasis: 'raw', inputScoreDigest: scoreDigest,
      comparisonBasis: 'estimated', comparisonScores: { admissionYear: 2027, basis: 'official', exam },
      scoreConversion: { status: 'estimated', scoreboardId: '2027_KSAT_survey_estimated.json', scoreboardDigest: `sha256:${'b'.repeat(64)}`, reasonCodes: [] } },
    results: targets.map(target => ({ ...target, status: 'unavailable', reasonCodes: ['DATA_RELEASE_NOT_READY'], choices: [], selected: null, convertedScore: null, maximumScore: null,
      referenceComparison: { contractVersion: 'reviewed-admission-reference-v1', status: 'prior_data_two_estimates', recordId: 'U_0123456789abcdef', bundleDigest: `sha256:${'c'.repeat(64)}`,
        school: target.university, major: target.major, targetYear: 2027, convertedScore: 630.25 + scores.exam.kor.raw,
        passReference: 650, registered70Reference: 700, referenceIndex: 80, referenceYear: null, referenceBounds: null, indexRange: null,
        probability: null, empiricallyCalibrated: false, publicationReady: false, personalEligibilityApproved: false, reasonCodes: [], sourceIds: [] } })) };
}
