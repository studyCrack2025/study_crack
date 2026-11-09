import { scoreChoiceLabel } from '../analysis/score-model.js';
import { isConsultingSurveyExam, SCORE_ROWS } from './survey-model.js';

export const SCORE_METRICS = [['standardScore', '표준점수', 0, 200], ['percentile', '백분위', 0, 100], ['grade', '등급', 1, 9]];
export const EMPTY_SCORE_METRICS = Object.freeze({ standardScore: null, percentile: null, grade: null });
export const splitLimits = { korean: [76, 24], math: [74, 26] };
export const isAbsoluteScore = area => area === 'english' || area === 'korean_history';
export const rawScoreMax = area => ['inquiry', 'korean_history'].includes(area) ? 50 : 100;
export const hasReportMetrics = row => SCORE_METRICS.some(([key]) => row[key] != null);

export function labelScoreRows(records) {
  let inquiryNumber = 0;
  return records.map(({ area }) => area === 'inquiry' ? `탐구 ${++inquiryNumber}` : SCORE_ROWS.find(([name]) => name === area)?.[1] || area);
}

export function clearConvertedScores(row) {
  return { ...row, ...(row.convertedFromRaw ? EMPTY_SCORE_METRICS : {}), convertedFromRaw: undefined, confirmed: false };
}

export function scoreConversionBatch(value) {
  if (!isConsultingSurveyExam(value)) return null;
  const entries = value.records.flatMap((row, index) => {
    if (!Number.isInteger(row.rawScore) || (hasReportMetrics(row) && !row.convertedFromRaw)) return [];
    const { area, subject, selection, rawScore, commonRawScore, electiveRawScore } = row;
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
    const metrics = usableMetrics(result.metrics, row.area);
    if (metrics.grade == null || (!isAbsoluteScore(row.area) && (metrics.standardScore == null || metrics.percentile == null))) return;
    updated[index] = { ...row, ...metrics, convertedFromRaw: true, confirmed: false };
  });
  return updated.some((row, index) => row !== records[index]) ? updated : null;
}

function usableMetrics(metrics, area) {
  return Object.fromEntries(SCORE_METRICS.flatMap(([key, , min, max]) => {
    const value = metrics?.[key];
    return (!isAbsoluteScore(area) || key === 'grade') && Number.isInteger(value) && value >= min && value <= max ? [[key, value]] : [];
  }));
}

export function photoScorePatches(results, records) {
  const labels = labelScoreRows(records);
  return records.flatMap((row, index) => {
    const result = results.find(item => item?.area === row.area && (row.area !== 'inquiry' || `탐구 ${item.inquiryNumber}` === labels[index]));
    if (!result) return [];
    const metrics = usableMetrics(result, row.area);
    if (!Object.keys(metrics).length) return [];
    const field = row.area === 'inquiry' ? 'subject' : 'selection';
    const choice = scoreChoiceLabel(result[field]);
    const changed = choice && choice !== scoreChoiceLabel(row[field]);
    const patch = {
      ...(changed ? { ...EMPTY_SCORE_METRICS, rawScore: null, commonRawScore: null, electiveRawScore: null, [field]: choice } : {}),
      ...metrics,
      convertedFromRaw: undefined,
      confirmed: false
    };
    return [{ index, label: labels[index], choice, metrics, patch }];
  });
}
