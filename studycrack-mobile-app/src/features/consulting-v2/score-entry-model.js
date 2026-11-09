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

export function scoreReportResult(records, photoRecords, fillBlanks) {
  const patches = new Map();
  const rows = [];
  const seen = new Set();
  const candidates = Array.isArray(photoRecords) ? photoRecords.slice(0, 7) : [];
  for (const item of candidates) {
    const area = item?.area;
    const label = area === 'inquiry' && [1, 2].includes(item.inquiryNumber)
      ? `탐구 ${item.inquiryNumber}`
      : area !== 'inquiry' && SCORE_ROWS.find(([name]) => name === area)?.[1];
    if (!label || seen.has(label)) continue;
    const { standardScore, percentile, grade } = usableMetrics(item);
    const subject = area === 'inquiry' || area === 'foreign_language' ? item.subject : item.selection;
    const choice = typeof subject === 'string' && subject.length <= 40 ? subject : '';
    const gradeOnly = isGradeOnlyArea(area);
    if (gradeOnly ? !grade : [standardScore, percentile, grade].every(value => value == null)) continue;
    if (area === 'foreign_language' && !FOREIGN_LANGUAGE_SUBJECTS.includes(choice)) continue;
    seen.add(label);
    let status = '';
    const row = gradeOnly && records.find(record => record.area === area);
    if (row) {
      const otherSubject = area === 'foreign_language' && row.subject && row.subject !== choice;
      if (row.grade != null || otherSubject) {
        status = !otherSubject && row.grade === grade ? '입력값과 일치' : '기존 입력 유지';
      } else if (fillBlanks && candidates.filter(candidate => candidate?.area === area).length === 1) {
        patches.set(area, area === 'foreign_language' ? { subject: choice, grade } : { grade });
        status = '자동 반영';
      }
    }
    const values = [
      choice,
      !gradeOnly && standardScore != null ? `표준점수 ${standardScore}` : '',
      !gradeOnly && percentile != null ? `백분위 ${percentile}` : '',
      grade ? `${grade}등급` : ''
    ].filter(Boolean).join(' · ');
    rows.push({ label, values, status });
  }
  return { rows, records: patches.size ? records.map(row => patches.has(row.area) ? { ...row, ...patches.get(row.area) } : row) : null };
}
