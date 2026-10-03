import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { prepareMobileResponsePolicy } from '../prepare-mobile-response-policy.mjs';
import { inspectSecurityHeaders } from '../audit-security-headers.mjs';

const script = '\nwindow.boot = true;\n';
const html = `<script>${script}</script><script src="./app.js"></script>`;
test('a mobile candidate hashes exact bytes and keeps each dependency purpose explicit', () => {
  const candidate = prepareMobileResponsePolicy({ html, connectOrigins: ['https://api.example.test'], imageOrigins: ['https://files.example.test'], formOrigins: ['https://pay.example.test'] });
  assert.equal(candidate.applied, false); assert.equal(candidate.compatibilityVerified, false);
  const config = candidate.responseHeadersPolicyConfig;
  const csp = config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
  assert.ok(csp.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`));
  assert.match(csp, /connect-src 'self' https:\/\/api.example.test/);
  assert.match(csp, /form-action 'self' https:\/\/pay.example.test/);
  assert.doesNotMatch(csp, /unsafe-eval|nonce-|report-uri|report-to|report-sample/);
  assert.ok(csp.length <= 1783);
  const headers = new Headers({ 'strict-transport-security': 'max-age=31536000', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': csp, 'permissions-policy': config.CustomHeadersConfig.Items[0].Value });
  assert.deepEqual(inspectSecurityHeaders(headers).findings, []);
  assert.equal(config.SecurityHeadersConfig.StrictTransportSecurity.IncludeSubdomains, false);
  assert.equal(config.SecurityHeadersConfig.StrictTransportSecurity.Preload, false);
});
test('changed inline bytes produce a different policy without a fixed nonce', () => {
  const first = prepareMobileResponsePolicy({ html });
  const second = prepareMobileResponsePolicy({ html: html.replace('true', 'false') });
  assert.notDeepEqual(first.responseHeadersPolicyConfig, second.responseHeadersPolicyConfig);
});
for (const origins of [['https:'], ['https://*.example.test'], ['http://api.example.test'], ['https://user:pass@api.example.test'], ['https://api.example.test/path'], ['https://api.example.test?token=secret']]) {
  test(`unreviewed origins are rejected (${origins[0]})`, () => {
    for (const purpose of ['connectOrigins', 'imageOrigins', 'formOrigins']) assert.throws(() => prepareMobileResponsePolicy({ html, [purpose]: origins }));
  });
}
test('an externalized shell needs neither an inline hash nor a nonce', () => {
  const candidate = prepareMobileResponsePolicy({ html: '<script src="./app.js"></script>' });
  const policy = candidate.responseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
  assert.match(policy, /script-src 'self';/);
  assert.doesNotMatch(policy, /sha256-|nonce-|unsafe-eval/);
});
for (const shell of ['<script nonce="static">boot()</script>', '<script src="https://cdn.example.test/app.js"></script><script>boot()</script>', '<button onclick="boot()">Start</button><script>boot()</script>', '<button onclick=boot()>Start</button><script>boot()</script>', '<script src=https://cdn.example.test/app.js></script><script>boot()</script>', '<html></html>']) {
  test('unsupported shell requires explicit review instead of a permissive fallback', () => {
    assert.throws(() => prepareMobileResponsePolicy({ html: shell }));
  });
}
