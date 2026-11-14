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

function possibility(body) {
  return { contractVersion: 'cut-reference-public-v1', policyVersion: 'cut-reference-possibility-1.0.0', basis: 'cut_reference_heuristic',
    status: 'available', validationState: 'passed', index: { points: 82 }, riskBand: 'stable', reasonCodes: [], probability: null, empiricallyCalibrated: false,
    publicationId: 'CUT_RELEASE_TEST', publicationDigest: `sha256:${'c'.repeat(64)}`, referenceDigest: `sha256:${'d'.repeat(64)}`,
    sourceYear: 2026, targetYear: 2027, validatedAt: '2026-11-01T00:00:00.000Z',
    dataReleaseId: body.release.dataReleaseId, admissionUnitId: body.results[0].selected.admissionUnitId };
}

test('reviewed index carries its source year, target year and five-band classification', async () => {
  const body = response(); body.results[0].possibility = possibility(body);
  const result = await run(body), row = result.data.results[0];
  assert.equal(result.ok, true); assert.equal(row.possibility.riskBand, 'stable'); assert.deepEqual(row.possibility.index, { points: 82 });
  assert.equal(row.possibility.sourceYear, 2026); assert.equal(row.possibility.targetYear, 2027);
});

test('old probability fields cannot become possibility points; converted scores remain available', async () => {
  const body = response(); body.results[0].forecast = { status: 'available', probability: { percent: 99 }, riskBand: 'stable' };
  const result = await run(body), row = result.data.results[0];
  assert.equal(result.ok, true); assert.equal(row.convertedScore, 743.1256); assert.equal(row.forecast, undefined);
  assert.equal(row.possibility.index, null); assert.deepEqual(row.possibility.reasonCodes, ['CUT_REFERENCE_BACKEND_UPDATE_REQUIRED']);
});

test('unreviewed, malformed, different unit/release, measured-probability or invalid-year indices are hidden', async () => {
  const mutations = [p => { p.validationState = 'failed'; }, p => { p.status = 'unavailable'; }, p => { p.dataReleaseId = 'ADMISSION_RELEASE_2027_OTHER'; },
    p => { p.admissionUnitId = 'UNIT_OTHER_MAJOR'; }, p => { p.riskBand = 'unknown'; }, p => { p.index.points = 100; }, p => { p.index.points = 0; },
    p => { p.index.points = NaN; }, p => { p.index.points = 82.4; }, p => { p.index.percent = 82; }, p => { p.probability = { percent: 82 }; },
    p => { p.empiricallyCalibrated = true; }, p => { p.reasonCodes = ['CUT_REFERENCE_REVIEW_REQUIRED']; }, p => { p.policyVersion = 'unreviewed'; },
    p => { p.publicationDigest = null; }, p => { p.referenceDigest = null; }, p => { p.sourceYear = 2028; }, p => { p.targetYear = 2026; }];
  for (const mutate of mutations) {
    const body = response(); body.results[0].possibility = possibility(body); mutate(body.results[0].possibility);
    const result = await run(body), row = result.data.results[0];
    assert.equal(result.ok, true); assert.equal(row.convertedScore, 743.1256); assert.equal(row.possibility.index, null); assert.equal(row.possibility.riskBand, null);
  }
});

test('missing data remains null while reviewed extreme points stay points', async () => {
  const body = response(); body.results[0].possibility = { ...possibility(body), status: 'unavailable', validationState: 'not_available', index: null, riskBand: null,
    dataReleaseId: null, admissionUnitId: null, publicationId: null, publicationDigest: null, referenceDigest: null, sourceYear: null, targetYear: null, validatedAt: null,
    reasonCodes: ['CUT_REFERENCE_REVIEW_REQUIRED'] };
  let result = await run(body); assert.equal(result.data.results[0].possibility.index, null);
  for (const [points, riskBand] of [[1, 'risky'], [99, 'stable']]) {
    body.results[0].possibility = { ...possibility(body), index: { points }, riskBand };
    result = await run(body); assert.deepEqual(result.data.results[0].possibility.index, { points });
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
