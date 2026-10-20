import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [coachingScreen, coachingPresentation, serviceContent, servicePlan, webPayment, webCheckout, packageSource] = await Promise.all([
  readFile(new URL('../src/screens/coaching/CoachingScreen.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/coaching/presentation.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/service/ServiceContentScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/service/ServicePlanScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../../js/payment.js', import.meta.url), 'utf8'),
  readFile(new URL('../../js/checkout.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

for (const mockCopy of ['총 6시간 30분', '90분', '70분', '6월 2주차 PRO 리포트']) {
  assert.doesNotMatch(servicePlan, new RegExp(mockCopy));
}
assert.doesNotMatch(servicePlan, /#[0-9a-fA-F]{3,8}/);
assert.doesNotMatch(serviceContent, /✦/);
assert.match(serviceContent, /\^https:\\\/\\\//);

assert.match(coachingPresentation, /isError:\s*status === 'error'/);
assert.match(coachingScreen, /kind=\{error \? 'error' : 'empty'\}/);
assert.match(serviceContent, /weeklyReportsStatus = 'idle'/);
assert.match(serviceContent, /주간 점검을 불러오지 못했어요/);
assert.match(serviceContent, /질문 내역을 불러오지 못했어요/);
assert.match(serviceContent, /PRO 리포트를 불러오지 못했어요/);
assert.match(webPayment, /type:\s*'create_payment_intent'/);
assert.match(webPayment, /idempotencyKey:\s*getPaymentIdempotencyKey\(requestedTier\)/);
assert.doesNotMatch(webPayment, /const checkoutData = \{[\s\S]{0,500}userId:/);
assert.match(webCheckout, /const mallReserved = \{ paymentIntentId: checkoutData\.paymentIntentId \}/);
assert.doesNotMatch(webCheckout, /mallReserved = \{[\s\S]{0,400}userId:/);
assert.match(packageSource, /check-phase-three-analysis-profile-tracer\.mjs && node scripts\/check-phase-three-service-tracer\.mjs && node scripts\/check-phase-three-operation-tracer\.mjs/);

console.log('phase 3 coaching/report/commerce tracer contract ok');
