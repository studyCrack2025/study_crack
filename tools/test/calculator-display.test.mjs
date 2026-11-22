import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCalculatorScore as format, formatCalculatorRange as range } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-display.js';
test('display truncation keeps hundredths without floating point scaling or changing source values', () => {
  for (const [value, expected] of [[678.643517, '678.64'], [10.13, '10.13'], [1.005, '1.00'], [0, '0.00'], [1e-7, '0.00'], [0.1299, '0.12'], [1000, '1,000.00']]) assert.equal(format(value), expected);
  assert.equal(range(726.965, { low: 726.961, high: 727.979 }), '726.96~727.97');
  for (const invalid of [null, undefined, NaN, Infinity, -1]) assert.equal(format(invalid), '—');
});
