import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatorCardScoreComparison, calculatorCutoffLines, calculatorScorePosition, formatCalculatorScore as format } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-display.js';
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

const cardComparison = (score, pass, registered70) => calculatorCardScoreComparison(score, { status: 'available', cutoffs: { pass, registered70 } });

test('group cards fix both cutoff markers and move the score continuously across five positions', () => {
  for (const [score, expected, differences] of [
    [85.70, 23.75, ['−0.70점', '−2.30점']],
    [86.40, 36, ['0점', '−1.60점']],
    [87.20, 50, ['+0.80점', '−0.80점']],
    [88.00, 64, ['+1.60점', '0점']],
    [88.70, 76.25, ['+2.30점', '+0.70점']]
  ]) {
    const result = cardComparison(score, 86.40, 88.00);
    assert.deepEqual(result.points.slice(1), [36, 64]);
    assert.ok(Math.abs(result.points[0] - expected) < 1e-7);
    assert.equal(result.offscale, null);
    assert.deepEqual(result.differences, differences);
  }
  const close = cardComparison(691.79, 691.70, 692.17);
  const far = cardComparison(866.50, 860.29, 869.00);
  assert.deepEqual(close.points.slice(1), far.points.slice(1));
  assert.equal(Math.round(100 * (close.points[0] - 36) / 28), 19);
  assert.equal(Math.round(100 * (far.points[0] - 36) / 28), 71);
});

test('group cards show a central reference for tied or single cutoffs and preserve known differences', () => {
  assert.deepEqual(cardComparison(88, 88, 88), { points: [50, 50, 50], differences: ['0점', '0점'], offscale: null });
  assert.deepEqual(cardComparison(88.70, 88, 88), { points: [null, 50, 50], differences: ['+0.70점', '+0.70점'], offscale: null });
  assert.deepEqual(cardComparison(87, 88, undefined), { points: [null, 50, null], differences: ['−1.00점', null], offscale: null });
  assert.deepEqual(cardComparison(88, undefined, 88), { points: [50, null, 50], differences: [null, '0점'], offscale: null });
  assert.deepEqual(calculatorCutoffLines(null, { status: 'reference_only', cutoffs: { registered70: 88 } }).map(line => line.value), ['산출 보류', '88.00점']);
  assert.equal(cardComparison(88, 89, 88), null);
  assert.equal(cardComparison(88, NaN, Infinity), null);
  assert.equal(cardComparison(NaN, 87, 88), null);
  assert.equal(calculatorCardScoreComparison(88, { status: 'unavailable', cutoffs: { pass: 87, registered70: 90 } }), null);
});

test('offscale scores indicate direction and unverified distribution fields do not move score markers', () => {
  const low = cardComparison(70, 86.40, 88.00), high = cardComparison(99, 86.40, 88.00);
  assert.deepEqual(low, { points: [8, 36, 64], differences: ['−16.40점', '−18.00점'], offscale: 'left' });
  assert.deepEqual(high, { points: [92, 36, 64], differences: ['+12.60점', '+11.00점'], offscale: 'right' });
  assert.deepEqual(calculatorCardScoreComparison(99, {
    status: 'available', cutoffs: { pass: 86.40, registered70: 88.00 }, distribution: { registered50: 90, registered90: 87.9 }
  }), high);
});
