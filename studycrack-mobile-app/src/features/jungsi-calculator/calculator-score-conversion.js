import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { SUBJECTS } from './calculator-model.js';
import { calculatorDigest as digest } from './calculator-validation.js';

const OFFICIAL_SCOREBOARD = '2027_KSAT_scoreboard.json';
const ESTIMATED_SCOREBOARD = '2027_KSAT_survey_estimated.json';
export const calculatorScoreboardId = estimated => estimated ? ESTIMATED_SCOREBOARD : OFFICIAL_SCOREBOARD;

const integer = (value, max) => (typeof value === 'number' || typeof value === 'string' && /^\d{1,3}$/.test(value.trim())) && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= max;
export const scoreRecordKey = row => JSON.stringify(row);

export function calculatorScoreBatch(scores) {
  if (scores?.basis !== 'raw') return [];
  return SUBJECTS.flatMap(([key, , options, limits]) => {
    const row = scores.exam?.[key], field = limits ? 'opt' : 'name';
    if (!row || !options.includes(row[field]) || key === 'inq2' && row.name === scores.exam.inq1?.name) return [];
    if (limits) {
      if (!integer(row.common, limits[0]) || !integer(row.elective, limits[1])) return [];
      const common = Number(row.common), elective = Number(row.elective);
      return [{ key, opt: row.opt, common, elective, raw: common + elective }];
    }
    return integer(row.raw, 50) ? [{ key, name: row.name, raw: Number(row.raw) }] : [];
  });
}

export async function requestCalculatorScoreConversion({ apiFetch, analysisApiUrl, records, signal }) {
  const response = await postJson({ apiFetch, url: analysisApiUrl, signal, payload: { type: 'get_calculator_score_conversion', data: { admissionYear: 2027, records } }, fallbackError: '예상 성적을 불러오지 못했습니다. 다시 시도해주세요.' });
  if (!response.ok) return response;
  const value = response.data, board = value?.scoreboard;
  if (!value || value.success !== true || value.contractVersion !== 'calculator-score-conversion-v1' || value.admissionYear !== 2027 || !digest(value.inputDigest)
    || !Array.isArray(value.results) || value.results.length !== records.length
    || board !== null && (!board || typeof board.estimated !== 'boolean' || board.id !== calculatorScoreboardId(board.estimated) || !digest(board.digest))
    || !value.results.every((row, index) => {
      if (!row || row.key !== records[index].key || scoreRecordKey(row.input) !== scoreRecordKey(records[index]) || !Array.isArray(row.reasonCodes)) return false;
      if (row.status === 'unavailable') return row.metrics === null && row.reasonCodes.length === 1 && row.reasonCodes[0] === 'RAW_SCORE_CONVERSION_NOT_AVAILABLE';
      return row.status === 'converted' && board !== null && row.reasonCodes.length === 0 && row.metrics && Object.keys(row.metrics).length === 3
        && Number.isInteger(row.metrics.standardScore) && row.metrics.standardScore >= 0 && row.metrics.standardScore <= 200
        && Number.isInteger(row.metrics.percentile) && row.metrics.percentile >= 0 && row.metrics.percentile <= 100
        && Number.isInteger(row.metrics.grade) && row.metrics.grade >= 1 && row.metrics.grade <= 9;
    })) return apiInvalidResponse(response, '예상 성적의 입력 기준을 확인하지 못했습니다. 다시 시도해주세요.');
  return { ...response, data: value };
}
