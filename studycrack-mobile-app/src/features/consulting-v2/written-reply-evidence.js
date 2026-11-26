const name = value => typeof value === 'string' && value.length > 0 && value.length <= 120 && !/[<>\u0000-\u001f\u007f]/.test(value);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12;
export const evidenceGroup = value => ({ ga: '가군', na: '나군', da: '다군', other: '기타군' })[value] || '';
export const evidenceBand = value => ({ stable: '안정', appropriate: '적정', neutral: '중립', challenge: '도전', risky: '위험', unknown: '판단 보류' })[value] || '';
export const passLineLabel = unit => unit.proof.cut?.passStatistic === 'final_admission_minimum' ? '최종 합격 최저선' : '합격권 추정선';
export const registeredLineLabel = unit => unit.proof.cut?.registered70Statistic === 'registered_70pct_estimate' ? '등록자 70% 추정선' : '등록자 70%선';
export function evidenceUrl(value) {
  if (typeof value !== 'string' || value.length > 1000 || /[<>\s\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value), host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)
      && !/(?:^|\.)(?:localhost|local|internal)$/.test(host) && ![...url.searchParams.keys()].some(key => /token|signature|credential|authorization|x-amz-|secret/i.test(key)) ? url.href : null;
  } catch { return null; }
}
export function validReplyEvidence(value) {
  if (!value || value.version !== 'written-reply-evidence-v1' || !['official_reviewed', 'historical_reference', 'student_reported', 'unavailable'].includes(value.scoreBasis)
      || ![null, 2026].includes(value.referenceYear) || !Array.isArray(value.units) || value.units.length > 12 || !Array.isArray(value.documents) || value.documents.length > 48
      || !Array.isArray(value.uses) || value.uses.length !== 2 || JSON.stringify(value).length > 35000) return false;
  if ([...value.units, ...value.documents, ...value.uses].some(row => !row || typeof row !== 'object' || Array.isArray(row))
      || value.uses.some(use => !Array.isArray(use.claims) || use.claims.some(claim => !claim || typeof claim !== 'object' || Array.isArray(claim)))) return false;
  if (value.release !== null && (!value.release || ![value.release.releaseId, value.release.formulaVersion, value.release.eligibilityRuleVersion].every(name)
      || !/^sha256:[a-f0-9]{64}$/.test(value.release.contentDigest))) return false;
  const ids = new Set(value.units.map(unit => unit.admissionUnitId)), docs = new Set(value.documents.map(doc => doc.sourceId));
  if (ids.size !== value.units.length || docs.size !== value.documents.length || value.documents.some(doc => !/^SOURCE_[A-Za-z0-9_-]{1,100}$/.test(doc.sourceId)
      || !name(doc.title) || !/^[a-f0-9]{64}$/.test(doc.checksum) || doc.url !== null && evidenceUrl(doc.url) !== doc.url
      || doc.page !== null && (!Number.isInteger(doc.page) || doc.page < 1 || doc.page > 10000)
      || doc.admissionYear !== null && (!Number.isInteger(doc.admissionYear) || doc.admissionYear < 2000 || doc.admissionYear > 2027))) return false;
  const sources = rows => Array.isArray(rows) && rows.length > 0 && rows.length <= 12 && rows.every(id => docs.has(id));
  for (const unit of value.units) {
    const proof = unit.proof, lines = unit.referenceLines, index = unit.possibilityIndex;
    const fromComparison = unit.admissionTrackName !== undefined;
    if (fromComparison && (!name(unit.admissionTrackName) || !['admission_score', 'csat_component'].includes(unit.scoreScope)
        || ![null, 1, 2, 3].includes(unit.preferenceRank) || ['projectedInputs', 'peerEstimate', 'scoreInputEstimated'].some(key => typeof unit[key] !== 'boolean'))) return false;
    if (!/^UNIT_[A-Z0-9_-]{3,72}$/.test(unit.admissionUnitId) || ![unit.universityName, unit.campusName, unit.admissionUnitName].every(name)
        || !evidenceGroup(unit.admissionGroup) || unit.admissionYear !== 2027 || !number(unit.convertedScore) || !(fromComparison && unit.maximumScore === null || number(unit.maximumScore) && unit.maximumScore > 0)
        || !proof || !/^FORMULA_[A-Z0-9_-]{3,100}$/.test(proof.formulaId) || !/^CANONICAL_[A-F0-9]{64}$/.test(proof.scaleId)
        || !/^sha256:[a-f0-9]{64}$/.test(proof.bindingDigest) || !sources(proof.scoreSourceIds)) return false;
    if (lines === null) { if (proof.cut !== null || index !== null || unit.riskBand !== 'unknown') return false; }
    else {
      const cut = proof.cut;
      if (!lines || !number(lines.passLine) || !number(lines.registered70Line) || (fromComparison ? lines.passLine > lines.registered70Line : lines.passLine >= lines.registered70Line) || lines.targetYear !== 2027
          || !Number.isInteger(lines.sourceYear) || lines.sourceYear < 2000 || lines.sourceYear > 2027 || !cut || cut.scaleId !== proof.scaleId
          || !['admission_line_estimate', 'final_admission_minimum'].includes(cut.passStatistic)
          || !['registered_70pct', 'registered_70pct_estimate'].includes(cut.registered70Statistic) || !sources(cut.passSourceIds) || !sources(cut.registered70SourceIds)) return false;
    }
    const expected = index === null ? 'unknown' : index >= 80 ? 'stable' : index >= 65 ? 'appropriate' : index >= 45 ? 'neutral' : index >= 25 ? 'challenge' : 'risky';
    if (index !== null && (!Number.isInteger(index) || index < 1 || index > 99) || unit.riskBand !== expected) return false;
  }
  return value.uses.every((use, index) => use.style === ['core', 'empathic'][index] && Array.isArray(use.claims) && use.claims.length <= 3
    && new Set(use.claims.map(claim => claim.admissionUnitId)).size === use.claims.length && use.claims.every(claim => ids.has(claim.admissionUnitId)
      && ['score', 'cut_comparison'].includes(claim.kind) && (claim.kind === 'score' || value.units.find(unit => unit.admissionUnitId === claim.admissionUnitId).referenceLines)));
}
export function unitEvidenceSources(value, unit, kind) {
  return value.documents.flatMap(doc => {
    const roles = [unit.proof.scoreSourceIds.includes(doc.sourceId) ? '환산점수 계산' : '',
      kind === 'cut_comparison' && unit.proof.cut?.passSourceIds.includes(doc.sourceId) ? passLineLabel(unit) : '',
      kind === 'cut_comparison' && unit.proof.cut?.registered70SourceIds.includes(doc.sourceId) ? registeredLineLabel(unit) : ''].filter(Boolean);
    return roles.length ? [{ ...doc, roles }] : [];
  });
}
