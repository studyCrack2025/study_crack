import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { prepareMobileSecurityFunction } from '../prepare-mobile-security-function.mjs';
import { inspectSecurityHeaders } from '../audit-security-headers.mjs';

const html = '<script src="./js/mobile-boot.js"></script><script type="module" src="./app.js"></script>';
const origin = 'https://dev.studycrack.co.kr';
function setup(options = {}) {
  const candidate = prepareMobileSecurityFunction({ html, origin, ...options });
  const context = vm.createContext({});
  vm.runInContext(candidate.code, context, { timeout: 100 });
  return { candidate, handler: context.handler };
}
function event(uri = '/studycrack-mobile', overrides = {}) {
  return {
    request: { uri, method: 'GET', headers: { host: { value: 'dev.studycrack.co.kr' } }, querystring: { screen: { value: 'timer' } } },
    response: { statusCode: 200, headers: { 'content-type': { value: 'text/html; charset=utf-8' }, 'cache-control': { value: 'no-store' }, 'strict-transport-security': { value: 'max-age=31536000' }, 'x-content-type-options': { value: 'nosniff' }, 'referrer-policy': { value: 'strict-origin-when-cross-origin' }, 'x-frame-options': { value: 'SAMEORIGIN' }, 'content-encoding': { value: 'gzip' } }, cookies: { session: { value: 'opaque-test-cookie' } }, ...overrides }
  };
}
test('report-only is the safe initial mode and still restricts unused sensors', () => {
  const { candidate, handler } = setup();
  assert.equal(candidate.applied, false); assert.equal(candidate.compatibilityVerified, false);
  assert.equal(candidate.runtime, 'cloudfront-js-2.0');
  assert.ok(handler(structuredClone(candidate.testEvent)).headers['permissions-policy']);
  const input = event();
  const previous = structuredClone(input);
  assert.equal(handler(input), input.response);
  assert.equal(input.response.headers['permissions-policy'].value, 'camera=(), microphone=(), geolocation=()');
  assert.ok(input.response.headers['content-security-policy-report-only']);
  assert.equal(input.response.headers['content-security-policy'], undefined);
  for (const [name, value] of Object.entries(previous.response.headers)) assert.deepEqual(input.response.headers[name], value);
  assert.deepEqual(input.response.cookies, previous.response.cookies);
  assert.deepEqual(input.request, previous.request);
  assert.doesNotMatch(candidate.code, /console\.|fetch\(|report-uri|report-to|report-sample|nonce-|unsafe-eval|unsafe-inline.*script-src/);
});
test('enforcement needs an explicit mode and passes baseline inspection', () => {
  const { handler } = setup({ mode: 'enforce' });
  for (const uri of ['/studycrack-mobile', '/studycrack-mobile.html']) {
    const result = handler(event(uri));
    const headers = new Headers(Object.entries(result.headers).map(([name, header]) => [name, header.value]));
    assert.deepEqual(inspectSecurityHeaders(headers).findings, []);
    assert.match(headers.get('content-security-policy'), /script-src 'self';/);
    assert.doesNotMatch(headers.get('content-security-policy'), /sha256-|nonce-|unsafe-eval/);
  }
});
for (const uri of ['/', '/login', '/payment', '/checkout', '/social-callback', '/api/game', '/studycrack-mobile-app/dist/studycrack-mobile.bundle.js', '/studycrack-mobile.webmanifest', '/studycrack-mobile/other', '/studycrack-mobile/', '/%73tudycrack-mobile']) {
  test(`unrelated path is left byte-for-byte equivalent (${uri})`, () => {
    const { handler } = setup({ mode: 'enforce' });
    const input = event(uri); const previous = structuredClone(input.response);
    assert.deepEqual(handler(input), previous);
  });
}
test('production and dev dependencies never mix', () => {
  const dev = setup({ mode: 'enforce' }).handler(event()).headers['content-security-policy'].value;
  assert.match(dev, /https:\/\/api\.dev\.studycrack\.co\.kr/);
  assert.doesNotMatch(dev, /https:\/\/api\.studycrack\.co\.kr/);
  const prod = setup({ origin: 'https://studycrack.co.kr', mode: 'enforce' });
  const input = event(); input.request.headers.host.value = 'studycrack.co.kr';
  const policy = prod.handler(input).headers['content-security-policy'].value;
  assert.match(policy, /https:\/\/api\.studycrack\.co\.kr/);
  assert.doesNotMatch(policy, /api\.dev\./);
});
for (const mutate of [e => { e.request.method = 'POST'; }, e => { e.request.headers.host.value = 'studycrack.co.kr'; }, e => { delete e.request.headers.host; }, e => { e.response.statusCode = 403; }, e => { e.response.statusCode = 302; }, e => { e.response.headers['content-type'].value = 'application/json'; }]) {
  test('wrong host, method, status and MIME do not receive a mobile policy', () => {
    const input = event(); mutate(input); const before = structuredClone(input.response);
    assert.deepEqual(setup({ mode: 'enforce' }).handler(input), before);
  });
}
test('existing enforced or report-only policies are not weakened or silently replaced', () => {
  for (const name of ['content-security-policy', 'content-security-policy-report-only']) {
    const input = event(); input.response.headers[name] = { value: "default-src 'none'" };
    const result = setup({ mode: 'enforce' }).handler(input);
    assert.equal(result.headers[name].value, "default-src 'none'");
    assert.equal(Object.keys(result.headers).filter(key => key.startsWith('content-security-policy')).length, 1);
  }
});
for (const options of [{ origin: 'https://unknown.example' }, { mode: 'auto' }, { html: '<script>boot()</script>' }, { html: '<script src="./boot.js">boot()</script>' }, { html: '<script src="https://cdn.example/boot.js"></script>' }, { imageOrigins: ['https://*.example.test'] }, { html: '<meta http-equiv="Content-Security-Policy" content="script-src *"><script src="./boot.js"></script>' }]) {
  test('unsupported configuration rejects rather than broadening protection', () => assert.throws(() => setup(options)));
}
test('actual mobile source and public policy keep the boot file external and publishable', async () => {
  const shell = await readFile(new URL('../../studycrack-mobile.html', import.meta.url), 'utf8');
  const policy = JSON.parse(await readFile(new URL('../public-site-files.json', import.meta.url), 'utf8'));
  assert.ok(policy.files.includes('js/mobile-boot.js'));
  assert.match(shell, /<script src="\.\/js\/mobile-boot\.js"><\/script>/);
  assert.doesNotMatch(setup({ html: shell }).candidate.code, /sha256-/);
});
