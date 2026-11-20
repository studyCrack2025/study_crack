import test from 'node:test';
import assert from 'node:assert/strict';
import { getCalculatorApplications, linkCalculatorApplication, parseCalculatorApplicationHome, readCalculatorReceipt } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-application-api.js';
const at = Date.parse('2026-11-20T00:00:00.000Z');
const application = { applicationId: 'APP_11111111-1111-4111-8111-111111111111', productType: 'calculator', revision: 0, applicationState: 'PAYMENT_REVIEW', paymentStatus: 'pending', state: 'pending_payment', accountLinked: false, accessActive: false, amount: 25000, submittedAt: new Date(at).toISOString(), accessEndsAt: '2027-01-07T14:59:59.999Z', paymentDueAt: null, openingAt: '2026-11-28T00:00:00+09:00' };
const home = { contractVersion: 'calculator-applications-v1', items: [application], hasMore: false, needsReview: false, accountEmailMask: 's***@example.invalid' };
test('student calculator data is bounded and a pending application cannot claim active access', () => {
  assert.ok(parseCalculatorApplicationHome(home));
  for (const patch of [{ items: [application, application] }, { accountEmailMask: 'private@example.invalid' }, { items: [{ ...application, accessActive: true }] }, { items: [{ ...application, productType: 'consulting' }] }, { items: [{ ...application, amount: 1 }] }]) assert.equal(parseCalculatorApplicationHome({ ...home, ...patch }), null);
});
test('receipt recovery stays calculator-only, same-tab and time-bounded without writing storage', () => {
  const value = { version: 1, productType: 'calculator', requestKey: 'web_11111111-1111-4111-8111-111111111111', token: 'A'.repeat(43), capturedAt: at };
  const read = v => readCalculatorReceipt({ getItem: () => JSON.stringify(v) }, at);
  assert.deepEqual(read(value), { requestKey: value.requestKey, token: value.token });
  for (const patch of [{ productType: 'consulting' }, { capturedAt: at + 1 }, { capturedAt: at - 86400000 }, { token: 'guess' }]) assert.equal(read({ ...value, ...patch }), null);
});
test('an interrupted authenticated read retries once, but a link mutation never auto-replays', async () => {
  const calls = [], binding = { consultingApiUrl: '/synthetic', apiFetch: async (_url, options) => { calls.push(JSON.parse(options.body)); if (calls.length === 1) throw Object.assign(new Error('retry'), { code: 'AUTH_RETRY_REQUIRED' }); return { ok: true, json: async () => ({ success: true, data: home }) }; } };
  assert.equal((await getCalculatorApplications(binding)).ok, true); assert.equal(calls.length, 2);
  calls.length = 0;
  const credentials = { requestKey: 'web_11111111-1111-4111-8111-111111111111', token: 'A'.repeat(43) };
  assert.equal((await linkCalculatorApplication(binding, credentials, { application })).ok, false); assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].data).sort(), ['confirmed', 'expectedRevision', 'requestKey', 'token']);
});
