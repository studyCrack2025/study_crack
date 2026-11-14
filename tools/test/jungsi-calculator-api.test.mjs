import test from 'node:test';
import assert from 'node:assert/strict';
import { requestCalculatorAccess, requestCalculatorConversion } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-api.js';

const scores = { admissionYear: 2027, basis: 'official', exam: {} };
const targets = [{ university: '예시대학교', major: '경영학과' }];
const option = { admissionUnitId: 'UNIT_EXAMPLE_BUSINESS', campusName: '서울캠퍼스', unitName: '경영학과', trackName: '수능 일반', admissionGroup: 'na' };
function response() {
  return { success: true, contractVersion: 'jungsi-calculator-conversion-v1', admissionYear: 2027, basis: 'official', scoreSource: 'self_reported', scoreDigest: `sha256:${'1'.repeat(64)}`,
    release: { dataReleaseId: 'ADMISSION_RELEASE_2027_TEST', contentDigest: `sha256:${'2'.repeat(64)}`, formulaVersion: 'formula-1.0.0', eligibilityRuleVersion: 'eligibility-1.0.0' },
    results: [{ ...targets[0], status: 'available', reasonCodes: [], choices: [option], selected: option, convertedScore: 743.1256, maximumScore: 1000 }] };
}
async function run(body = response(), extra = {}) {
  return requestCalculatorConversion({ scores, targets, analysisApiUrl: '/read-only-analysis', apiFetch: async () => ({ ok: true, status: 200, json: async () => body }), ...extra });
}

test('calculator adapter submits only confirmed inputs/targets and preserves a finite actual score including zero', async () => {
  let sent;
  const body = response(); body.results[0].convertedScore = 0;
  const result = await run(body, { apiFetch: async (url, options) => {
    sent = JSON.parse(options.body); assert.equal(url, '/read-only-analysis');
    assert.equal(options.headers, undefined);
    return { ok: true, status: 200, json: async () => body };
  } });
  assert.deepEqual(sent, { type: 'get_calculator_conversion', data: { scores, targets } });
  assert.equal(result.ok, true); assert.equal(result.data.results[0].convertedScore, 0);
});

test('wrong-year/target, nonfinite or fabricated unapproved results are never displayed as scores', async () => {
  const mutations = [
    value => { value.admissionYear = 2026; }, value => { value.results[0].major = '다른 학과'; },
    value => { value.results[0].convertedScore = null; }, value => { value.results[0].convertedScore = Infinity; },
    value => { value.release = null; }, value => { value.results[0].status = 'unavailable'; },
    value => { value.results[0].selected = null; }, value => { value.results[0].choices = []; },
    value => { value.scoreSource = 'verified'; }, value => { value.basis = 'raw'; }
  ];
  for (const mutate of mutations) { const body = response(); mutate(body); assert.equal((await run(body)).code, 'INVALID_RESPONSE'); }
});

test('unavailable data is a successful explanation; insufficient access is distinct from login expiration', async () => {
  const body = response(); body.release = null;
  Object.assign(body.results[0], { status: 'unavailable', reasonCodes: ['DATA_RELEASE_NOT_READY'], selected: null, choices: [], convertedScore: null, maximumScore: null });
  assert.equal((await run(body)).ok, true);
  const denied = await run(null, { apiFetch: async () => ({ ok: false, status: 402, json: async () => ({ code: 'CALCULATOR_ACCESS_REQUIRED' }) }) });
  assert.equal(denied.ok, false); assert.match(denied.error, /Basic/);
  const thrown = await run(null, { apiFetch: async () => { throw Object.assign(new Error('membership needed'), { status: 402, code: 'CALCULATOR_ACCESS_REQUIRED' }); } });
  assert.equal(thrown.ok, false); assert.match(thrown.error, /Basic/);
});

test('an aborted calculation cannot return a result even if the transport resolves later', async () => {
  const controller = new AbortController(); controller.abort();
  const result = await run(response(), { signal: controller.signal });
  assert.equal(result.ok, false); assert.equal(result.code, 'REQUEST_ABORTED');
});

function forecast(body) {
  return { status: 'available', probability: { percent: 82, qualifier: 'approximate' }, riskBand: 'stable', reasonCodes: [],
    policyVersion: 'calculator-forecast-publication-1.0.0', riskPolicyVersion: 'admission-risk-1.0.0', modelVersion: 'probability-1.0.0',
    publicationId: 'CALCULATOR_FORECAST_2027_TEST', validatedAt: '2026-11-01T00:00:00.000Z', validationState: 'passed',
    dataReleaseId: body.release.dataReleaseId, admissionUnitId: body.results[0].selected.admissionUnitId };
}

test('validated probability carries its explicit release/unit and five-band classification', async () => {
  const body = response(); body.results[0].forecast = forecast(body);
  const result = await run(body);
  assert.equal(result.ok, true); assert.equal(result.data.results[0].forecast.riskBand, 'stable');
  assert.deepEqual(result.data.results[0].forecast.probability, { percent: 82, qualifier: 'approximate' });
});

test('legacy backend responses keep converted scores and explicitly withhold probability', async () => {
  const result = await run(response());
  assert.equal(result.ok, true); assert.equal(result.data.results[0].convertedScore, 743.1256);
  assert.equal(result.data.results[0].forecast.probability, null);
  assert.deepEqual(result.data.results[0].forecast.reasonCodes, ['FORECAST_BACKEND_UPDATE_REQUIRED']);
});

test('malformed/unvalidated/wrong-unit or release forecasts suppress only probability and classification', async () => {
  const mutations = [
    row => { row.forecast.validationState = 'failed'; }, row => { row.forecast.status = 'unavailable'; },
    row => { row.forecast.dataReleaseId = 'ADMISSION_RELEASE_2027_OTHER'; }, row => { row.forecast.admissionUnitId = 'UNIT_OTHER_MAJOR'; },
    row => { row.forecast.riskBand = 'unknown'; }, row => { row.forecast.probability.percent = 100; },
    row => { row.forecast.probability.percent = 0; }, row => { row.forecast.probability.percent = NaN; },
    row => { row.forecast.probability.qualifier = 'more_than'; }, row => { row.forecast.modelVersion = null; },
    row => { row.forecast.reasonCodes = ['FORECAST_VALIDATION_NOT_PASSED']; }, row => { row.forecast.policyVersion = 'unreviewed'; }
  ];
  for (const mutate of mutations) {
    const body = response(); body.results[0].forecast = forecast(body); mutate(body.results[0]);
    const result = await run(body), row = result.data.results[0];
    assert.equal(result.ok, true); assert.equal(row.convertedScore, 743.1256);
    assert.equal(row.forecast.probability, null); assert.equal(row.forecast.riskBand, null);
  }
});

test('unavailable forecasts never become zero percent and extremes retain an explicit inequality', async () => {
  const body = response(); body.results[0].forecast = { ...forecast(body), status: 'unavailable', probability: null, riskBand: null, reasonCodes: ['FORECAST_UNIT_NOT_VALIDATED'] };
  let result = await run(body); assert.equal(result.data.results[0].forecast.probability, null);
  for (const [percent, qualifier, riskBand] of [[1, 'less_than', 'risky'], [99, 'more_than', 'stable']]) {
    body.results[0].forecast = { ...forecast(body), probability: { percent, qualifier }, riskBand };
    result = await run(body); assert.equal(result.ok, true); assert.deepEqual(result.data.results[0].forecast.probability, { percent, qualifier });
  }
});

test('access preflight sends no client identity, drops member records and never enables checkout', async () => {
  let payload;
  const result = await requestCalculatorAccess({ analysisApiUrl: '/analysis', apiFetch: async (_, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ success: true, contractVersion: 'jungsi-calculator-access-v1', admissionYear: 2027,
      access: { allowed: true, source: 'membership', student: { email: 'PRIVATE' } }, service: { state: 'preparing', purchaseAvailable: false }, userId: 'PRIVATE' }) };
  } });
  assert.deepEqual(payload, { type: 'get_calculator_access' });
  assert.deepEqual(result.data, { access: { allowed: true, source: 'membership' }, service: { state: 'preparing', purchaseAvailable: false } });
  assert.equal(JSON.stringify(result.data).includes('PRIVATE'), false);
});

test('missing or inconsistent preflight data cannot grant access or purchases', async () => {
  const base = () => ({ success: true, contractVersion: 'jungsi-calculator-access-v1', admissionYear: 2027, access: { allowed: true, source: 'membership' }, service: { state: 'preparing', purchaseAvailable: false } });
  for (const mutate of [value => { value.admissionYear = 2026; }, value => { value.access.allowed = 'true'; }, value => { value.access.source = 'none'; },
    value => { value.service.purchaseAvailable = true; }, value => { value.service.state = 'open_for_sales'; }]) {
    const body = base(); mutate(body);
    const result = await requestCalculatorAccess({ analysisApiUrl: '/analysis', apiFetch: async () => ({ ok: true, status: 200, json: async () => body }) });
    assert.equal(result.ok, false); assert.equal(result.code, 'INVALID_RESPONSE');
  }
});
