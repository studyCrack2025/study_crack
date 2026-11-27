import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatorCutoffLines, calculatorScorePosition, formatCalculatorScore as format } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-display.js';
test('display truncation keeps hundredths without floating point scaling or changing source values', () => {
  for (const [value, expected] of [[678.643517, '678.64'], [10.13, '10.13'], [1.005, '1.00'], [0, '0.00'], [1e-7, '0.00'], [0.1299, '0.12'], [1000, '1,000.00']]) assert.equal(format(value), expected);
  for (const invalid of [null, undefined, NaN, Infinity, -1]) assert.equal(format(invalid), '—');
});
test('verified cutoffs show a single value and original historical scores retain publication precision', () => {
  const reference = { historical70: { year: 2026, score: 85.7 } };
  assert.deepEqual(calculatorCutoffLines(reference), [
    { label: '예상 합격 컷', value: '산출 보류' }, { label: '2026학년도 최종등록자 70% 컷', value: '85.7점' }
  ]);
  assert.deepEqual(calculatorCutoffLines(reference, { status: 'available', cutoffs: { pass: 83.257, registered70: 86.501 } }).map(line => line.value), ['83.25점', '86.50점', '85.7점']);
});


test('score comparison places the three values on one scale and shows signed raw-score differences', () => {
  const cutoffs = { status: 'available', cutoffs: { pass: 889.38, registered70: 902.27 } };
  const result = calculatorScorePosition(895.90, cutoffs);
  assert.deepEqual(result.differences, ['+6.52점', '−6.37점']);
  assert.ok(result.points[1] < result.points[0] && result.points[0] < result.points[2]);
  assert.deepEqual(calculatorScorePosition(5, { status: 'reference_only', cutoffs: { pass: 5, registered70: 5 } }), { points: [50, 50, 50], differences: ['0점', '0점'] });
  assert.equal(calculatorScorePosition(895.90, { status: 'available', cutoffs: { pass: 889.38 } }), null);
});
