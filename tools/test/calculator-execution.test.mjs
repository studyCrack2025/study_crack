import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatorComparisonScores } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-execution.js';

const raw = { admissionYear: 2027, basis: 'raw', exam: { kor: { opt: '언어와매체', common: 60, elective: 20, raw: 80 }, math: { opt: '미적분', common: 60, elective: 14, raw: 74 },
  inq1: { name: '물리학Ⅰ', raw: 44 }, inq2: { name: '화학Ⅰ', raw: 45 }, eng: { grd: 2 }, hist: { grd: 1 } } };
function fixture() {
  return { scoreDigest: `sha256:${'a'.repeat(64)}`, execution: { contractVersion: 'calculator-execution-v1', mode: 'development_preview', inputBasis: 'raw', inputScoreDigest: `sha256:${'a'.repeat(64)}`,
    comparisonBasis: 'estimated', comparisonScores: { admissionYear: 2027, basis: 'official', exam: { kor: { opt: '언어와매체', std: 120, pct: 82, grd: 3 }, math: { opt: '미적분', std: 119, pct: 79, grd: 3 },
      inq1: { name: '물리학1', std: 64, pct: 93, grd: 2 }, inq2: { name: '화학1', std: 66, pct: 94, grd: 2 }, eng: { grd: 2 }, hist: { grd: 1 } } },
    scoreConversion: { status: 'estimated', scoreboardId: '2027_KSAT_survey_estimated.json', scoreboardDigest: `sha256:${'b'.repeat(64)}`, reasonCodes: [] } } };
}

test('estimated calculator metrics are validated while raw inputs and equivalent subject labels are preserved', () => {
  const original = structuredClone(raw), body = fixture();
  const scores = calculatorComparisonScores(body, raw);
  assert.equal(scores.basis, 'official'); assert.equal(scores.exam.kor.std, 120);
  assert.equal(scores.exam.inq1.name, '물리학Ⅰ'); assert.equal(scores.exam.eng.grd, 2);
  assert.deepEqual(raw, original);
});

test('unbound estimates, changed subjects or grades, wrong-year tables and invalid metrics cannot produce a comparison', () => {
  for (const mutate of [body => { body.execution.inputScoreDigest = `sha256:${'c'.repeat(64)}`; },
    body => { body.execution.inputBasis = 'official'; }, body => { body.execution.scoreConversion.scoreboardId = '2026_KSAT_scoreboard.json'; },
    body => { body.execution.comparisonScores.exam.inq1.name = '생명과학Ⅰ'; }, body => { body.execution.comparisonScores.exam.eng.grd = 1; },
    body => { body.execution.comparisonScores.exam.kor.pct = 101; }, body => { body.execution.comparisonScores.admissionYear = 2026; },
    body => { body.execution.comparisonBasis = 'official'; }, body => { body.execution.scoreConversion.scoreboardDigest = 'invalid'; }]) {
    const body = fixture(); mutate(body); assert.equal(calculatorComparisonScores(body, raw), null);
  }
});

test('a missing conversion stays unavailable and older official responses keep their existing basis', () => {
  const body = fixture();
  Object.assign(body.execution, { comparisonBasis: null, comparisonScores: null,
    scoreConversion: { status: 'unavailable', scoreboardId: null, scoreboardDigest: null, reasonCodes: ['RAW_SCORE_CONVERSION_NOT_AVAILABLE'] } });
  assert.equal(calculatorComparisonScores(body, raw), raw);
  const official = fixture().execution.comparisonScores;
  assert.equal(calculatorComparisonScores({}, official), official);
});
