import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatorScoreBatch, requestCalculatorScoreConversion } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-score-conversion.js';
import { emptyScores } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-model.js';

const record = { key: 'kor', opt: '언어와매체', common: 60, elective: 20, raw: 80 };
function response() { return { success: true, contractVersion: 'calculator-score-conversion-v1', admissionYear: 2027, inputDigest: `sha256:${'a'.repeat(64)}`,
  scoreboard: { id: '2027_KSAT_survey_estimated.json', digest: `sha256:${'b'.repeat(64)}`, estimated: true }, results: [{ key: 'kor', input: record, status: 'converted', metrics: { standardScore: 120, percentile: 90, grade: 2 }, reasonCodes: [] }] }; }
const run = (body = response(), extra = {}) => requestCalculatorScoreConversion({ analysisApiUrl: '/analysis', records: [record], apiFetch: async () => ({ ok: true, status: 200, json: async () => body }), ...extra });

test('raw input is default and a partial batch preserves zero while excluding incomplete or invalid fields', () => {
  const scores = emptyScores(); assert.equal(scores.basis, 'raw'); assert.deepEqual(calculatorScoreBatch(scores), []);
  Object.assign(scores.exam.kor, { opt: '언어와매체', common: '0', elective: '0' });
  assert.deepEqual(calculatorScoreBatch(scores), [{ key: 'kor', opt: '언어와매체', common: 0, elective: 0, raw: 0 }]);
  scores.exam.kor.common = '77'; assert.deepEqual(calculatorScoreBatch(scores), []);
  Object.assign(scores.exam.inq1, { name: '물리학Ⅰ', raw: '44' }); Object.assign(scores.exam.inq2, { name: '물리학Ⅰ', raw: '45' });
  assert.deepEqual(calculatorScoreBatch(scores), [{ key: 'inq1', name: '물리학Ⅰ', raw: 44 }]);
  assert.deepEqual(calculatorScoreBatch(emptyScores('official')), []);
});

test('only subject inputs are sent; estimated metrics and provenance are retained', async () => {
  let sent;
  const result = await run(response(), { apiFetch: async (_, options) => { sent = JSON.parse(options.body); return { ok: true, status: 200, json: async () => response() }; } });
  assert.deepEqual(sent, { type: 'get_calculator_score_conversion', data: { admissionYear: 2027, records: [record] } }); assert.equal(result.ok, true);
  assert.equal(result.data.results[0].metrics.standardScore, 120); assert.equal(result.data.scoreboard.estimated, true);
});

test('wrong input, year, subject, source, duplicate rows and malformed metrics are rejected', async () => {
  for (const mutate of [b => { b.admissionYear = 2026; }, b => { b.results[0].key = 'math'; }, b => { b.results[0].input = { ...record, raw: 79 }; },
    b => { b.scoreboard.id = '2026_KSAT_scoreboard.json'; }, b => { b.scoreboard.estimated = false; }, b => { b.scoreboard = null; },
    b => { b.results.push(b.results[0]); }, b => { b.results[0].metrics.grade = 0; }, b => { b.results[0].metrics.percentile = 101; },
    b => { b.results[0].metrics.standardScore = null; }, b => { b.results[0].metrics.probability = .9; }]) {
    const body = structuredClone(response()); mutate(body); assert.equal((await run(body)).code, 'INVALID_RESPONSE');
  }
});

test('missing data stays unavailable and an aborted read never returns late metrics', async () => {
  const body = response(); body.scoreboard = null; Object.assign(body.results[0], { status: 'unavailable', metrics: null, reasonCodes: ['RAW_SCORE_CONVERSION_NOT_AVAILABLE'] });
  assert.equal((await run(body)).ok, true);
  const controller = new AbortController(); controller.abort(); assert.equal((await run(response(), { signal: controller.signal })).code, 'REQUEST_ABORTED');
});
