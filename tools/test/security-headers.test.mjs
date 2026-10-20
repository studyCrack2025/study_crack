import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { auditSecurityHeaders, inspectSecurityHeaders, auditExitCode } from '../audit-security-headers.mjs';

const policy = "default-src 'self'; script-src 'self'; script-src-attr 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self' https://api.example.com; frame-src 'none'; form-action 'self'";
const baseline = {
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': policy
};
const inspect = (changes = {}, options = {}) => inspectSecurityHeaders(new Headers({ ...baseline, ...changes }), { document: true, https: true, ...options });

test('a bounded baseline passes without requiring HSTS preload or subdomain policy changes', () => {
  assert.deepEqual(inspect().findings, []);
  assert.equal(inspect().cspMode, 'enforced');
  assert.deepEqual(inspect({ 'referrer-policy': 'no-referrer' }).findings, []);
});

test('missing headers and report-only CSP never count as enforced protection', () => {
  const missing = inspectSecurityHeaders(new Headers(), { document: true, https: true });
  assert.deepEqual(missing.findings.sort(), ['csp_missing', 'hsts_missing', 'nosniff_missing_or_invalid', 'permissions_policy_missing', 'referrer_policy_missing_or_weak']);
  const headers = new Headers(baseline);
  headers.delete('content-security-policy');
  headers.set('content-security-policy-report-only', policy);
  const result = inspectSecurityHeaders(headers, { document: true, https: true });
  assert.equal(result.cspMode, 'report-only');
  assert.ok(result.findings.includes('csp_report_only_not_enforced'));
});

for (const [name, value] of [
  ['short', 'max-age=300'], ['disabled', 'max-age=0'], ['duplicate', 'max-age=31536000; max-age=0'],
  ['invalid', 'max-age=forever'], ['combined', 'max-age=31536000, max-age=0'],
  ['unclosed quote', 'max-age="31536000'], ['unopened quote', 'max-age=31536000"']
]) test(`HSTS rejects ${name} directives`, () => {
  assert.ok(inspect({ 'strict-transport-security': value }).findings.includes('hsts_invalid_or_short'));
});

for (const [name, value] of [
  ['inline execution', policy.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")],
  ['eval', policy.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'")],
  ['script element override', `${policy}; script-src-elem https:`],
  ['event handler override', policy.replace("script-src-attr 'none'", "script-src-attr 'unsafe-inline'")],
  ['broad connection', policy.replace('https://api.example.com', 'https:')],
  ['wildcard connection', policy.replace('https://api.example.com', 'https://*.example.com')],
  ['mixed content', policy.replace('https://api.example.com', 'http://api.example.com')],
  ['base URI', policy.replace("base-uri 'self'", 'base-uri *')],
  ['object embedding', policy.replace("object-src 'none'", "object-src 'self'")],
  ['missing frame ancestors', policy.replace("frame-ancestors 'none'; ", '')],
  ['duplicate directive', `${policy}; script-src *`],
  ['combined policies', `${policy}, ${policy}`],
  ['empty script directive', policy.replace("script-src 'self'", 'script-src')]
]) test(`CSP identifies ${name} for review`, () => {
  assert.ok(inspect({ 'content-security-policy': value }).findings.some((code) => code.startsWith('csp_')));
});

test('nonce/hash scripts and data/blob images are allowed without permitting raw reports', () => {
  const value = policy.replace("script-src 'self'", "script-src 'self' 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='") + "; img-src 'self' data: blob:";
  assert.deepEqual(inspect({ 'content-security-policy': value }).findings, []);
  assert.ok(inspect({ 'content-security-policy': `${value}; report-uri https://private.example/report?token=private-secret` }).findings.includes('csp_reporting_requires_privacy_review'));
});

for (const value of ['camera=*, microphone=(), geolocation=()', 'camera=(), camera=*, microphone=(), geolocation=()', 'camera=(), microphone=()', 'camera=(https://bad.example), microphone=(), geolocation=()']) {
  test(`Permissions-Policy requires unambiguous disabled unused sensors (${value})`, () => {
    assert.ok(inspect({ 'permissions-policy': value }).findings.includes('permissions_policy_missing_or_unsafe_directive'));
  });
}

test('non-document responses check transport and nosniff, not document-only controls', () => {
  const headers = new Headers({ 'x-content-type-options': 'nosniff', 'strict-transport-security': 'max-age=31536000' });
  assert.deepEqual(inspectSecurityHeaders(headers, { document: false, https: true }).findings, []);
  headers.delete('strict-transport-security');
  assert.deepEqual(inspectSecurityHeaders(headers, { document: false, https: false }).findings, []);
});

function mockedFetch(mutate = () => {}) {
  return async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.ok(options.signal);
    assert.equal(options.headers, undefined);
    const target = new URL(url).pathname;
    const mime = target.endsWith('.js') ? 'text/javascript' : target.endsWith('.png') ? 'image/png' : target.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
    const values = { ...baseline, 'content-type': mime, 'set-cookie': 'secret-cookie' };
    const result = { status: 200, headers: new Headers(values), body: { cancel: async () => {} } };
    mutate(result, target);
    return result;
  };
}

test('read-only audit covers public entry points and MIME without retaining bodies or raw headers', async () => {
  let cancelled = 0;
  const result = await auditSecurityHeaders({ origin: 'https://dev.studycrack.co.kr', fetchImpl: mockedFetch((response) => {
    response.body = { cancel: async () => { cancelled++; }, getReader() { throw new Error('must not read'); } };
    response.headers.set('content-security-policy-report-only', `${policy}; report-uri https://private.example?token=private-secret`);
  }) });
  assert.equal(result.ok, false, 'unreviewed reporting is surfaced even alongside enforced CSP');
  assert.equal(result.enforcementChanged, false);
  assert.equal(result.serviceWorker, 'not-configured');
  assert.ok(result.manualReview.length > 0);
  assert.equal(cancelled, result.checked);
  for (const path of ['/studycrack-mobile', '/studycrack-mobile.html', '/payment', '/social-callback', '/studycrack-mobile.webmanifest']) assert.ok(result.results.some((entry) => entry.path === path));
  assert.doesNotMatch(JSON.stringify(result), /secret-cookie|private-secret|private\.example|set-cookie|report-uri/);
});

test('unavailable, redirected, wrong MIME and missing public files remain findings in report mode', async () => {
  const result = await auditSecurityHeaders({ origin: 'https://studycrack.co.kr', fetchImpl: mockedFetch((response, path) => {
    if (path === '/payment') throw new Error('private-secret');
    if (path === '/login') { response.status = 302; response.headers.set('location', 'https://private.example?token=secret'); }
    if (path.endsWith('.webmanifest')) response.headers.set('content-type', 'text/html');
    if (path.endsWith('bundle.js')) response.status = 403;
  }) });
  for (const code of ['request_unavailable', 'unexpected_status', 'content_type_mismatch']) assert.ok(result.results.some((entry) => entry.findings.includes(code)));
  assert.equal(result.ok, false);
  assert.equal(auditExitCode(result, { reportOnly: false }), 1);
  assert.equal(auditExitCode(result, { reportOnly: true }), 0);
  assert.doesNotMatch(JSON.stringify(result), /private-secret|private\.example|token/);
});

test('invalid targets are rejected before requests', async () => {
  for (const origin of ['http://dev.studycrack.co.kr', 'https://evil.example', 'http://localhost:3000', 'https://studycrack.co.kr/', 'https://studycrack.co.kr?token=private', 'https://user:pass@studycrack.co.kr']) {
    let calls = 0;
    await assert.rejects(auditSecurityHeaders({ origin, fetchImpl: () => { calls++; } }));
    assert.equal(calls, 0);
  }
});

test('oversized header values are rejected without echoing their contents', () => {
  const result = inspect({ 'content-security-policy': 'private-secret'.repeat(1000) });
  assert.ok(result.findings.includes('header_value_too_large'));
  assert.doesNotMatch(JSON.stringify(result), /private-secret/);
});

test('deployment observes headers after release smoke without changing remote response policies', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node tools\/audit-security-headers\.mjs "https:\/\/\$\{S3_BUCKET\}" --report-only/);
  assert.ok(workflow.indexOf('node tools/smoke-site-release.mjs') < workflow.indexOf('node tools/audit-security-headers.mjs'));
  assert.doesNotMatch(workflow, /aws cloudfront (?:update-distribution|create-response-headers-policy|update-response-headers-policy)/);
});
