import { inquirySubject, isConsultingSurveyExam, isGradeOnlyArea, SCORE_ROWS, SPLIT_SCORE_LIMITS, splitRawTotal } from './survey-model.js';

const SCORE_METRICS = [['standardScore', 0, 200], ['percentile', 0, 100], ['grade', 1, 9]];
export const EMPTY_SCORE_METRICS = Object.freeze({ standardScore: null, percentile: null, grade: null });
const hasReportMetrics = row => SCORE_METRICS.some(([key]) => row[key] != null);

export function labelScoreRows(records) {
  let inquiryNumber = 0;
  return records.map(({ area }) => area === 'inquiry' ? `탐구 ${++inquiryNumber}` : SCORE_ROWS.find(([name]) => name === area)?.[1] || area);
}

export function clearConvertedScores(row) {
  return { ...(row.convertedFromRaw ? EMPTY_SCORE_METRICS : row.conversionAdmissionYear ? { percentile: null, grade: null } : {}),
    convertedFromRaw: undefined, conversionAdmissionYear: undefined, confirmed: false };
}

export function scoreConversionBatch(value, fields, allowRaw = true) {
  if (!isConsultingSurveyExam(value)) return null;
  let inquiryNumber = 0;
  const entries = value.records.flatMap((row, index) => {
    const field = `scores.${row.area === 'inquiry' ? `inquiry${++inquiryNumber}` : row.area}`;
    if (isGradeOnlyArea(row.area) || fields && !fields.includes(field)) return [];
    const { area, subject, selection, commonRawScore, electiveRawScore } = row;
    const split = Object.hasOwn(SPLIT_SCORE_LIMITS, area);
    const rawScore = split ? splitRawTotal(commonRawScore, electiveRawScore) : row.rawScore;
    if ((split && !selection?.trim()) || (area === 'inquiry' && !inquirySubject(row))) return [];
    const standard = row.standardScore != null && !row.convertedFromRaw;
    if (!standard && !allowRaw) return [];
    if (standard ? row.percentile != null && row.grade != null : hasReportMetrics(row)) return [];
    if (!standard && !Number.isInteger(rawScore)) return [];
    return [{ index, input: { area, subject, selection, rawScore, commonRawScore, electiveRawScore,
      ...(standard ? { standardScore: row.standardScore } : {}) } }];
  });
  if (!entries.length) return null;
  return { examType: value.examType, examYear: value.examYear, entries };
}

export function applyScoreConversions(records, entries, results) {
  const updated = records.slice();
  entries.forEach(({ index, input }, order) => {
    const row = records[index];
    const result = results[order];
    if (row.convertedFromRaw || result?.status !== 'converted') return;
    const metrics = usableMetrics(result.metrics);
    if (metrics.grade == null || metrics.standardScore == null || metrics.percentile == null) return;
    if (input.standardScore != null && input.standardScore !== metrics.standardScore) return;
    const conversionAdmissionYear = [2026, 2027].includes(result.conversionAdmissionYear) ? result.conversionAdmissionYear : undefined;
    updated[index] = { ...row, ...metrics, convertedFromRaw: input.standardScore == null || undefined, conversionAdmissionYear, confirmed: false };
  });
  return updated.some((row, index) => row !== records[index]) ? updated : null;
}

function usableMetrics(metrics) {
  return Object.fromEntries(SCORE_METRICS.flatMap(([key, min, max]) => {
    const value = metrics?.[key];
    return Number.isInteger(value) && value >= min && value <= max ? [[key, value]] : [];
  }));
}
