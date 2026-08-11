import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PLAN_META } from '../src/constants/plans.js';

const [scriptSource, serviceSource, paymentSource] = await Promise.all([
  readFile(new URL('../../js/script.js', import.meta.url), 'utf8'),
  readFile(new URL('../../service.html', import.meta.url), 'utf8'),
  readFile(new URL('../../payment.html', import.meta.url), 'utf8')
]);

const expectedPrices = {
  Basic: ['25,000원 / 4주', '6,250원 / 주'],
  Starter: ['39,000원 / 1회', '39,000원'],
  Standard: ['49,000원 / 4주', '12,250원 / 주'],
  Pro: ['149,000원 / 4주', '37,250원 / 주']
};

for (const [plan, [introPrice, weeklyPrice]] of Object.entries(expectedPrices)) {
  assert.equal(PLAN_META[plan].introPrice, introPrice, `${plan} intro price changed`);
  assert.equal(PLAN_META[plan].weeklyPrice, weeklyPrice, `${plan} weekly price changed`);
}

for (const token of ['25,000', '39,000', '12,250', '37,250']) {
  assert.ok(scriptSource.includes(token) || serviceSource.includes(token), `Web service source is missing ${token}`);
  assert.ok(paymentSource.includes(token), `Web payment source is missing ${token}`);
}
for (const token of ['49,000', '149,000']) assert.ok(paymentSource.includes(token), `Web payment total is missing ${token}`);

assert.ok(PLAN_META.Basic.features.includes('전 과목 원점수 +1 환산 효율'), 'Basic must expose every subject efficiency');
assert.ok(PLAN_META.Standard.features.includes('합격권 최소 원점수 역산'), 'Standard must include reverse projection');
assert.doesNotMatch(JSON.stringify(PLAN_META), /합격확률|합격 가능성/, 'Mobile plan copy must describe converted scores, not probability');

console.log('plan contracts passed: web prices, Basic efficiency and Standard reverse projection.');
