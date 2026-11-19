import { inquirySubject, isConsultingSurveyExam, isGradeOnlyArea, SCORE_ROWS, SPLIT_SCORE_LIMITS, splitRawTotal } from './survey-model.js';

const SCORE_METRICS = [['standardScore', 0, 200], ['percentile', 0, 100], ['grade', 1, 9]];
export const EMPTY_SCORE_METRICS = Object.freeze({ standardScore: null, percentile: null, grade: null });

export function labelScoreRows(records) {
  let inquiryNumber = 0;
  return records.map(({ area }) => area === 'inquiry' ? `탐구 ${++inquiryNumber}` : SCORE_ROWS.find(([name]) => name === area)?.[1] || area);
}

export function clearConvertedScores(row) {
  return { ...EMPTY_SCORE_METRICS, convertedFromRaw: undefined, conversionAdmissionYear: undefined, conversionExamType: undefined, confirmed: false };
}

export function scoreConversionLabel(row) {
  if (!row.conversionAdmissionYear) return '';
  return row.conversionExamType === 'september_mock' ? `${row.conversionAdmissionYear - 1}년 9월 평가원 참고`
    : `${row.conversionAdmissionYear}학년도 수능${row.conversionAdmissionYear < 2027 ? ' 참고' : ' 기준'}`;
}

export function scoreConversionBatch(value, fields, allowRaw = true, editedFields = []) {
  if (!isConsultingSurveyExam(value)) return null;
  let inquiryNumber = 0;
  const entries = value.records.flatMap((row, index) => {
    const field = `scores.${row.area === 'inquiry' ? `inquiry${++inquiryNumber}` : row.area}`;
    if (isGradeOnlyArea(row.area) || row.convertedFromRaw || fields && !fields.includes(field) || !allowRaw && !editedFields.includes(field)) return [];
    const { area, subject, selection, commonRawScore, electiveRawScore } = row;
    const split = Object.hasOwn(SPLIT_SCORE_LIMITS, area);
    const rawScore = split ? splitRawTotal(commonRawScore, electiveRawScore) : row.rawScore;
    if ((split && !selection?.trim()) || (area === 'inquiry' && !inquirySubject(row))) return [];
    if (!Number.isInteger(rawScore)) return [];
    return [{ index, input: { area, subject, selection, rawScore, commonRawScore, electiveRawScore } }];
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
    const conversionExamType = result.conversionExamType;
    if (conversionExamType != null && !['csat', 'september_mock'].includes(conversionExamType)) return;
    updated[index] = { ...row, ...metrics, convertedFromRaw: true, conversionAdmissionYear, conversionExamType, confirmed: false };
  });
  return updated.some((row, index) => row !== records[index]) ? updated : null;
}

function usableMetrics(metrics) {
  return Object.fromEntries(SCORE_METRICS.flatMap(([key, min, max]) => {
    const value = metrics?.[key];
    return Number.isInteger(value) && value >= min && value <= max ? [[key, value]] : [];
  }));
}
