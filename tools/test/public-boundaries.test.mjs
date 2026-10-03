import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { auditPublicBoundaries } from '../audit-public-boundaries.mjs';
import { PRIVATE_SITE_SMOKE_PATHS } from '../private-site-paths.mjs';

const origin = 'https://dev.studycrack.co.kr';
const commit = 'a'.repeat(40);
const identity = { schema: 1, commit, release: 'dev-aaaaaaaa' };
function mockFetch(mutate = () => {}) {
  return async (url, options) => {
    assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'manual'); assert.equal(options.referrerPolicy, 'no-referrer');
    assert.ok(options.signal); assert.equal(options.headers, undefined);
    const target = new URL(url).pathname.slice(1);
    const release = target === 'release.json';
    const result = { status: release ? 200 : 403, headers: new Headers({ 'content-type': 'application/json', 'cache-control': 'no-cache, no-store, must-revalidate', 'set-cookie': 'private-secret' }),
      body: release ? new Response(JSON.stringify(identity)).body : { cancel: async () => {}, [Symbol.asyncIterator]() { throw new Error('Private content must not be read'); } } };
    mutate(result, target); return result;
  };
}
test('fixed private paths are never read and a bounded release is compared against the expected commit', async () => {
  const result = await auditPublicBoundaries({ origin, expectedCommit: commit, fetchImpl: mockFetch() });
  assert.equal(result.ok, true); assert.equal(result.denied, PRIVATE_SITE_SMOKE_PATHS.length);
  assert.equal(result.checked, PRIVATE_SITE_SMOKE_PATHS.length + 1); assert.deepEqual(result.identity, identity);
  assert.equal(result.expectedCommitChecked, true); assert.doesNotMatch(JSON.stringify(result), /private-secret|set-cookie/);
});
for (const [label, mutate, code] of [
  ['public source', (r, path) => { if (path === 'CLAUDE.md') r.status = 200; }, 'private_path_not_denied'],
  ['SPA fallback', (r, path) => { if (path === 'docs/exec-plans/current.md') r.status = 200; }, 'private_path_not_denied'],
  ['redirected private path', (r, path) => { if (path === '.git/config') r.status = 302; }, 'private_path_not_denied'],
  ['missing version', (r, path) => { if (path === 'release.json') r.status = 403; }, 'release_unavailable'],
  ['wrong MIME', (r, path) => { if (path === 'release.json') r.headers.set('content-type', 'text/html'); }, 'release_mime_invalid'],
  ['stale cache', (r, path) => { if (path === 'release.json') r.headers.set('cache-control', 'max-age=31536000, immutable'); }, 'release_cache_invalid'],
  ['different commit', (r, path) => { if (path === 'release.json') r.body = new Response(JSON.stringify({ ...identity, commit: 'b'.repeat(40), release: 'dev-bbbbbbbb' })).body; }, 'release_commit_mismatch'],
  ['wrong branch', (r, path) => { if (path === 'release.json') r.body = new Response(JSON.stringify({ ...identity, release: 'main-aaaaaaaa' })).body; }, 'release_identity_invalid'],
  ['oversized data', (r, path) => { if (path === 'release.json') r.body = new Response('private-secret'.repeat(1000)).body; }, 'request_or_identity_unavailable'],
  ['invalid JSON', (r, path) => { if (path === 'release.json') r.body = new Response('private-secret').body; }, 'request_or_identity_unavailable']
]) test(`readiness fails closed for ${label}`, async () => {
  const result = await auditPublicBoundaries({ origin, expectedCommit: commit, fetchImpl: mockFetch(mutate) });
  assert.equal(result.ok, false); assert.ok(result.results.some(row => row.findings.includes(code)));
  if (code === 'release_unavailable') assert.equal(result.expectedCommitChecked, false);
  assert.doesNotMatch(JSON.stringify(result), /private-secret|set-cookie/);
});
test('unknown body properties are not included in release output and observed version is not presumed current', async () => {
  const result = await auditPublicBoundaries({ origin, fetchImpl: mockFetch((r, path) => {
    if (path === 'release.json') r.body = new Response(JSON.stringify({ ...identity, internal: 'private-secret' })).body;
  }) });
  assert.equal(result.ok, true); assert.equal(result.expectedCommitChecked, false);
  assert.deepEqual(result.identity, identity); assert.doesNotMatch(JSON.stringify(result), /private-secret/);
});
test('invalid origins and commit input fail before any request', async () => {
  for (const [target, expectedCommit] of [['https://evil.example', commit], [`${origin}/`, commit], [origin, 'main'], [origin, 'a'.repeat(41)], ['https://user:pass@dev.studycrack.co.kr', commit]]) {
    let calls = 0;
    await assert.rejects(auditPublicBoundaries({ origin: target, expectedCommit, fetchImpl: async () => { calls++; } }));
    assert.equal(calls, 0);
  }
});
test('network failures remain sanitized findings and do not prevent checking other paths', async () => {
  const result = await auditPublicBoundaries({ origin, fetchImpl: async () => { throw new Error('private-secret'); } });
  assert.equal(result.checked, PRIVATE_SITE_SMOKE_PATHS.length + 1); assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /private-secret/);
});
test('a separate strict readiness workflow does not write AWS or interpolate untrusted shell input', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/security-readiness.yml', import.meta.url), 'utf8');
  assert.match(workflow, /contents: read/); assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node tools\/audit-security-headers\.mjs "\$PUBLIC_ORIGIN"\s/);
  assert.match(workflow, /audit-public-boundaries\.mjs "\$PUBLIC_ORIGIN" "\$EXPECTED_COMMIT"/);
  assert.doesNotMatch(workflow, /report-only|id-token: write|configure-aws-credentials|aws cloudfront|site-release.mjs publish/);
  assert.doesNotMatch(workflow, /run:.*\$\{\{ inputs\./);
});
