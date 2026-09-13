import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PLAN_META } from '../src/constants/plans.js';
import { createServiceHandlers } from '../src/handlers/service-handlers.js';

const [scriptSource, serviceSource, paymentSource] = await Promise.all([
  readFile(new URL('../../js/script.js', import.meta.url), 'utf8'),
  readFile(new URL('../../service.html', import.meta.url), 'utf8'),
  readFile(new URL('../../payment.html', import.meta.url), 'utf8')
]);

const expectedPrices = {
  Basic: ['25,000원', ''],
  Starter: ['39,000원 / 1회', ''],
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

const text = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const cards = [...paymentSource.matchAll(/<article class="price-row[^"\n]*" data-tier="([a-z]+)">([\s\S]*?)<\/article>/g)];
assert.equal(cards.length, 4);
const totals = { basic: '25,000', starter: '39,000', standard: '49,000', pro: '149,000' };
for (const [plan, meta] of Object.entries(PLAN_META)) {
  const tier = plan.toLowerCase();
  const card = cards.find(row => row[1] === tier)?.[2];
  assert.ok(card, `${plan} web card exists`);
  assert.equal(text(card.match(/<h2[^>]*>(.*?)<\/h2>/s)[1]), plan.toUpperCase());
  assert.equal(meta.desc, text(card.match(/<p>(.*?)<\/p>/s)[1]), `${plan} subtitle`);
  assert.deepEqual(meta.features, [...card.matchAll(/<li>(.*?)<\/li>/gs)].map(row => text(row[1])), `${plan} exact ordered benefits`);
  assert.equal(meta.originalPrice, text(card.match(/<span class="price-origin">(.*?)<\/span>/s)?.[1] || ''), `${plan} list price`);
  assert.equal(meta.discountNote || '', text(card.match(/<span class="price-discount-note">(.*?)<\/span>/s)?.[1] || ''), `${plan} discount and total`);
  assert.ok(meta.payPrice.startsWith(`${totals[tier]}원`));
  assert.ok(text(card).includes(totals[tier]));
  assert.ok(text(card).includes(`${plan.toUpperCase()} 선택하기`));
  if (['standard', 'pro'].includes(tier)) {
    assert.equal(meta.weeklyPrice, `${text(card.match(/<strong>(.*?)<\/strong>/s)[1])}원 / 주`);
    assert.equal(meta.payPrice, `${totals[tier]}원 / 4주`);
  } else {
    assert.equal(meta.weeklyPrice, '');
    assert.doesNotMatch(meta.payPrice + meta.billingNote, /4주|28일/);
  }
  let destination;
  const handlers = createServiceHandlers({ checkoutPlan: plan, duration: '12주', document: { body: { dataset: { selectedDuration: '8주' } } }, window: { location: { assign: url => { destination = url; } } } });
  assert.equal(handlers.selectDuration, undefined);
  handlers.openWebPayment();
  const url = new URL(destination, 'https://example.test');
  assert.equal(url.searchParams.get('plan'), tier);
  assert.equal(url.searchParams.get('duration'), ['standard', 'pro'].includes(tier) ? '4주' : null, 'stale duration cannot affect checkout');
}
assert.match(paymentSource, /모든 플랜은 VAT 포함 단건 결제/);
assert.match(serviceSource, /합격컷 도달 위한 목표 성적 제시/);
assert.ok(!PLAN_META.Basic.features.includes('합격컷 도달 위한 목표 성적 제시'), 'Do not silently merge conflicting web benefits');
assert.doesNotMatch(JSON.stringify(PLAN_META), /합격확률|합격 가능성/, 'Mobile plan copy must describe converted scores, not probability');

console.log('plan contracts passed: four web purchase cards, ordered benefits, prices and stale-duration handoff.');
