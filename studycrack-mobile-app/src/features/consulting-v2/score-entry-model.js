import { FOREIGN_LANGUAGE_SUBJECTS, inquirySubject, isConsultingSurveyExam, isGradeOnlyArea, SCORE_ROWS, SPLIT_SCORE_LIMITS, splitRawTotal } from './survey-model.js';

const SCORE_METRICS = [['standardScore', 0, 200], ['percentile', 0, 100], ['grade', 1, 9]];
export const EMPTY_SCORE_METRICS = Object.freeze({ standardScore: null, percentile: null, grade: null });
const hasReportMetrics = row => SCORE_METRICS.some(([key]) => row[key] != null);

export function labelScoreRows(records) {
  let inquiryNumber = 0;
  return records.map(({ area }) => area === 'inquiry' ? `탐구 ${++inquiryNumber}` : SCORE_ROWS.find(([name]) => name === area)?.[1] || area);
}

export function clearConvertedScores(row) {
  return { ...(row.convertedFromRaw ? EMPTY_SCORE_METRICS : {}), convertedFromRaw: undefined, confirmed: false };
}

export function scoreConversionBatch(value) {
  if (!isConsultingSurveyExam(value)) return null;
  const entries = value.records.flatMap((row, index) => {
    if (isGradeOnlyArea(row.area) || hasReportMetrics(row)) return [];
    const { area, subject, selection, commonRawScore, electiveRawScore } = row;
    const split = Object.hasOwn(SPLIT_SCORE_LIMITS, area);
    const rawScore = split ? splitRawTotal(commonRawScore, electiveRawScore) : row.rawScore;
    if (!Number.isInteger(rawScore) || (split && !selection?.trim()) || (area === 'inquiry' && !inquirySubject(row))) return [];
    return [{ index, input: { area, subject, selection, rawScore, commonRawScore, electiveRawScore } }];
  });
  if (!entries.length) return null;
  return { examType: value.examType, examYear: value.examYear, entries };
}

export function applyScoreConversions(records, entries, results) {
  const updated = records.slice();
  entries.forEach(({ index }, order) => {
    const row = records[index];
    const result = results[order];
    if (row.convertedFromRaw || result?.status !== 'converted') return;
    const metrics = usableMetrics(result.metrics);
    if (metrics.grade == null || metrics.standardScore == null || metrics.percentile == null) return;
    updated[index] = { ...row, ...metrics, convertedFromRaw: true, confirmed: false };
  });
  return updated.some((row, index) => row !== records[index]) ? updated : null;
}

function usableMetrics(metrics) {
  return Object.fromEntries(SCORE_METRICS.flatMap(([key, min, max]) => {
    const value = metrics?.[key];
    return Number.isInteger(value) && value >= min && value <= max ? [[key, value]] : [];
  }));
}

export function photoGradeSuggestions(records, photoRecords) {
  if (!Array.isArray(photoRecords)) return [];
  return records.flatMap(row => {
    if (!isGradeOnlyArea(row.area) || row.grade != null) return [];
    const matches = photoRecords.filter(item => item?.area === row.area);
    if (matches.length !== 1) return [];
    const { grade, subject } = matches[0];
    if (!Number.isInteger(grade) || grade < 1 || grade > 9) return [];
    if (row.area !== 'foreign_language') return [{ area: row.area, label: row.subject, patch: { grade } }];
    if (!FOREIGN_LANGUAGE_SUBJECTS.includes(subject) || (row.subject && row.subject !== subject)) return [];
    return [{ area: row.area, label: subject, patch: { subject, grade } }];
  });
}
