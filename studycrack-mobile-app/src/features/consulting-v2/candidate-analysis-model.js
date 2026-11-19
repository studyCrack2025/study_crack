export const RISK_LABELS = Object.freeze({ stable: '안정', match: '적정', reach: '도전', unknown: '판단 보류', manual_review: '수동 검토' });
export const CONFIDENCE_LABELS = Object.freeze({ high: '높음', medium: '보통', low: '낮음', not_available: '평가 불가' });
export const ANALYSIS_REASON_LABELS = Object.freeze({ ANALYSIS_SOURCE_CHANGED: '성적 또는 조사서가 변경되었습니다.', ANALYSIS_SUPERSEDED: '새로운 분석이 실행되었습니다.', ANALYSIS_DATA_VERSION_CHANGED: '대학 기준 데이터 또는 모델이 변경되었습니다.', ANALYSIS_SNAPSHOT_INVALID: '분석 저장 상태를 다시 확인해야 합니다.', ANALYSIS_PROVENANCE_MISSING: '새 검토 기준으로 다시 분석해야 합니다.' });

export function isCandidateSnapshot(value) {
  const w = value?.workspace;
  const catalog = w?.catalog;
  if (!Number.isSafeInteger(value?.caseRevision) || !Number.isSafeInteger(value?.analysisRevision) || !w || !catalog || !w.surveyPreferences
    || ['sourceReady', 'canRun', 'canApprove'].some(key => typeof w[key] !== 'boolean')
    || ['regions', 'tracks', 'units'].some(key => !Array.isArray(catalog[key]) || catalog[key].length > 1000 || catalog[key].some(item => typeof item?.id !== 'string' || typeof item.label !== 'string'))
    || ['desiredRegions', 'desiredMajors', 'desiredTracks'].some(key => !Array.isArray(w.surveyPreferences[key]))) return false;
  const a = value.analysis;
  return a === null || Boolean(a && typeof a.analysisResultId === 'string' && /^sha256:[a-f0-9]{64}$/.test(a.resultDigest || '') && typeof a.stale === 'boolean'
    && a.input?.preferences && a.input?.options && a.result && Array.isArray(a.result.candidates) && a.result.candidates.length <= 10
    && a.result.candidates.every(c => c && typeof c.admissionUnitId === 'string' && (!c.conversionTrace || Array.isArray(c.conversionTrace)) && (!c.reasonCodes || Array.isArray(c.reasonCodes)))
    && Array.isArray(a.result.excluded) && a.result.excluded.every(item => item && Array.isArray(item.reasonCodes))
    && Array.isArray(a.result.warnings) && a.result.warnings.every(item => item && typeof item.code === 'string')
    && (!a.input.scoreSnapshot?.records || Array.isArray(a.input.scoreSnapshot.records))
    && a.result.versions && !Array.isArray(a.result.versions));
}

export function defaultAnalysisOptions(input) {
  return structuredClone(input ? { preferences: input.preferences, options: input.options } : {
    preferences: { regions: [], tracks: [], riskTolerance: 'balanced', commute: { originRegionId: null, maxMinutes: null, dormitoryAllowed: true }, mustInclude: [], exclude: [], priorityOrder: ['region', 'major', 'brand', 'employment', 'commute'] },
    options: { candidateCount: 6, targetBandMix: { stable: 2, match: 2, reach: 2 }, minProbability: null, maxProbability: null, preferenceWeights: { region: 0.5, major: 0.5, brand: 0, employment: 0, commute: 0 } }
  });
}

export function validateAnalysisOptions(value, catalog) {
  const p = value.preferences;
  const o = value.options;
  if (!Number.isInteger(o.candidateCount) || o.candidateCount < 3 || o.candidateCount > 10) return '후보 수는 3~10개로 입력해주세요.';
  if (Object.values(o.targetBandMix).some(n => !Number.isInteger(n) || n < 0 || n > 10) || Object.values(o.targetBandMix).reduce((a, b) => a + b, 0) !== o.candidateCount) return '안정·적정·도전 후보 수의 합을 전체 후보 수에 맞춰주세요.';
  if ([o.minProbability, o.maxProbability].some(n => n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) || (o.minProbability !== null && o.maxProbability !== null && o.minProbability > o.maxProbability)) return '확률 표시 범위를 0~100% 안에서 확인해주세요.';
  if (p.mustInclude.some(id => p.exclude.includes(id))) return '반드시 포함할 후보와 제외할 후보가 겹칩니다.';
  if (p.mustInclude.length > Math.min(6, o.candidateCount) || p.exclude.length > 10 || p.regions.length > 10 || p.tracks.length > 8) return '선택 개수를 줄여주세요. 필수 후보는 최대 6개, 제외 후보는 최대 10개입니다.';
  for (const [key, choices] of [['regions', catalog.regions], ['tracks', catalog.tracks], ['mustInclude', catalog.units], ['exclude', catalog.units]]) {
    if (p[key].some(id => !choices.some(item => item.id === id))) return '기준 목록이 변경되었습니다. 선택값을 다시 확인해주세요.';
  }
  if (p.commute.originRegionId !== null && !catalog.regions.some(item => item.id === p.commute.originRegionId)) return '출발 지역을 다시 선택해주세요.';
  if (p.commute.maxMinutes !== null && (!Number.isInteger(p.commute.maxMinutes) || p.commute.maxMinutes < 0 || p.commute.maxMinutes > 300)) return '통학 시간은 0~300분으로 입력해주세요.';
  return '';
}

export function buildCandidateRunRequest({ caseId, snapshot, form, reason, idempotencyKey }) {
  const error = validateAnalysisOptions(form, snapshot.workspace.catalog);
  if (error) throw new Error(error);
  if (!reason.trim()) throw new Error('선호와 후보 구성의 검토 사유를 입력해주세요.');
  const preferences = { ...form.preferences };
  delete preferences.freeText;
  return { caseId, expectedCaseRevision: snapshot.caseRevision, expectedAnalysisRevision: snapshot.analysisRevision, idempotencyKey, reason: reason.trim(), preferences, options: form.options };
}

export function canApproveAnalysis(snapshot) {
  const a = snapshot?.analysis;
  return Boolean(snapshot?.workspace?.canApprove && snapshot.workspace.sourceReady && a && !a.stale && a.status === 'generated' && ['ready', 'partial'].includes(a.result?.status)
    && a.result.candidates?.length && a.result.candidates.every(c => c.universityName && c.admissionUnitName));
}
export function canLinkAnalysis(snapshot) {
  return Boolean(snapshot?.analysis?.status === 'approved' && !snapshot.analysis.stale && snapshot.workspace?.sourceReady);
}
export function formatAnalysisNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 }).format(value) : '미제공';
}
export function formatAnalysisRange(value, suffix = '') {
  if (!value || ![value.point, value.low, value.high].every(n => typeof n === 'number' && Number.isFinite(n)) || value.low > value.point || value.point > value.high || (suffix === '%' && (value.low < 0 || value.high > 100))) return '미제공';
  return `${formatAnalysisNumber(value.point)}${suffix} (${formatAnalysisNumber(value.low)}~${formatAnalysisNumber(value.high)}${suffix})`;
}
export function candidatesForReport(analysis, previous = []) {
  return analysis.result.candidates.map(candidate => ({ ...candidate, candidateId: candidate.admissionUnitId,
    rationale: previous.find(item => item.candidateId === candidate.admissionUnitId)?.rationale || '' }));
}
