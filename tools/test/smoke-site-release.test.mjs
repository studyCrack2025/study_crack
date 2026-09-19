import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { cacheControlFor } from '../site-release.mjs';
import { smokeSiteRelease } from '../smoke-site-release.mjs';

const origin = 'https://dev.studycrack.co.kr';
const publicFiles = ['index.html', 'studycrack-mobile.html', 'release.json', 'studycrack-mobile.webmanifest', 'js/release.js', 'js/config.js', 'js/shared/api.js', 'studycrack-mobile-app/dist/studycrack-mobile.bundle.js', 'studycrack-mobile-app/dist/studycrack-mobile.css', 'studycrack-mobile-app/dist/chunks/app-12345678.js', 'studycrack-mobile-app/dist/chunks/app-12345678.css', 'studycrack-mobile-app/dist/assets/fish-12345678.webp', 'promotion/kcc01'];
const manifest = { commit: 'a'.repeat(40), release: 'dev-aaaaaaaa', files: publicFiles.map((file) => ({ path: file, bytes: 7, sha256: createHash('sha256').update('fixture').digest('hex') })) };
const aliases = { 'promotion/kcc01': 'index.html' };
function mockFetch(mutate = () => {}) {
  return async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, 'GET');
    assert.ok(options.signal);
    const file = new URL(url).pathname.slice(1);
    const target = file === 'studycrack-mobile' ? 'studycrack-mobile.html' : file || 'index.html';
    const known = publicFiles.includes(target);
    const mime = target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : target.endsWith('.webmanifest') ? 'application/manifest+json' : target.endsWith('.json') ? 'application/json' : target.endsWith('.webp') ? 'image/webp' : 'text/html';
    const result = { status: known ? 200 : 404, headers: { 'content-type': mime, 'cache-control': cacheControlFor(target) }, body: known ? 'fixture' : 'Not found' };
    mutate(result, file, url);
    return new Response(result.body, result);
  };
}

test('deployment smoke verifies public bytes, cache/MIME, clean URL and private-path denial without credentials', async () => {
  const paths = [];
  const result = await smokeSiteRelease({ origin, manifest, aliases, fetchImpl: mockFetch((_, file, url) => paths.push([file, url])) });
  assert.ok(result.checked > 10);
  assert.ok(paths.some(([file, url]) => file === 'js/config.js' && url.includes('?v=dev-aaaaaaaa')));
  assert.ok(paths.some(([file]) => file === 'studycrack-mobile'));
  assert.ok(paths.some(([file]) => file === 'manifest.json'));
});

for (const [label, mutate] of [
  ['stale bytes', (r, file) => { if (file === 'release.json') r.body = 'oldfile'; }],
  ['missing entry', (r, file) => { if (file.endsWith('bundle.js')) r.status = 404; }],
  ['wrong MIME', (r, file) => { if (file.endsWith('.js')) r.headers['content-type'] = 'text/html'; }],
  ['immutable HTML', (r, file) => { if (file.endsWith('.html')) r.headers['cache-control'] = 'max-age=31536000, immutable'; }],
  ['uncached hashed asset', (r, file) => { if (file.endsWith('.webp')) r.headers['cache-control'] = 'no-store'; }],
  ['public private path', (r, file) => { if (file === 'manifest.json') r.status = 200; }],
  ['oversized response', (r, file) => { if (file === 'release.json') r.body = 'fixture oversized'; }],
  ['redirect', (r, file) => { if (file === 'release.json') r.status = 302; }]
]) test(`deployment smoke rejects ${label}`, async () => {
  await assert.rejects(smokeSiteRelease({ origin, manifest, aliases, fetchImpl: mockFetch(mutate) }));
});

test('smoke accepts only known deployment origins or explicit loopback tests', async () => {
  for (const invalid of ['http://dev.studycrack.co.kr', 'https://evil.example', 'https://dev.studycrack.co.kr/path', 'https://user:pass@dev.studycrack.co.kr', 'https://dev.studycrack.co.kr?token=secret']) {
    let calls = 0;
    await assert.rejects(smokeSiteRelease({ origin: invalid, manifest, aliases, fetchImpl: async () => { calls++; } }));
    assert.equal(calls, 0);
  }
});
