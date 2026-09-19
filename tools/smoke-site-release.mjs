import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheControlFor, IMMUTABLE, loadPublicPolicy, verifySiteRelease } from './site-release.mjs';

const PRIVATE_PATHS = ['manifest.json', 'AGENTS.md', '.env', '.git/config', 'docs/exec-plans/current.md', 'backend-backup/StudyCrack_Auth/index.mjs', 'studycrack-mobile-app/src/runtime/main.js', 'studycrack-mobile-app/package.json', 'studycrack-mobile-app/e2e/core-flows.spec.mjs', 'tools/site-release.mjs', 'css/style.css.bak', 'js/dev-mock.local.js', 'js/dev-mock.local.example.js'];

function contentTypeFor(file) {
  if (file.endsWith('.js')) return /^(?:text|application)\/javascript(?:;|$)/i;
  if (file.endsWith('.css')) return /^text\/css(?:;|$)/i;
  if (file.endsWith('.webmanifest')) return /^application\/manifest\+json(?:;|$)/i;
  if (file.endsWith('.json')) return /^application\/json(?:;|$)/i;
  if (file.endsWith('.webp')) return /^image\/webp(?:;|$)/i;
  if (file.endsWith('.png')) return /^image\/png(?:;|$)/i;
  return /^text\/html(?:;|$)/i;
}

export async function smokeSiteRelease({ origin, manifest, aliases, fetchImpl = fetch }) {
  const base = new URL(origin);
  assert.equal(base.origin, origin, 'Use a bare deployment origin');
  assert.ok(['https://dev.studycrack.co.kr', 'https://studycrack.co.kr'].includes(origin)
    || (base.protocol === 'http:' && base.hostname === '127.0.0.1'), 'Unapproved smoke origin');
  const entries = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const fixed = ['release.json', 'studycrack-mobile.webmanifest', 'js/release.js', 'js/client-diagnostics.js', 'js/config.js', 'js/shared/api.js'];
  const samples = manifest.files.filter(({ path: file }) => file.endsWith('.html') || fixed.includes(file)
    || /^studycrack-mobile-app\/dist\/.+\.(?:js|css)$/.test(file) || file.startsWith('assets/pwa/'));
  const artwork = manifest.files.find(({ path: file }) => /^studycrack-mobile-app\/dist\/assets\/.+\.webp$/.test(file));
  if (artwork) samples.push(artwork);
  const requests = samples.map((entry) => ({ target: entry.path, entry }));
  for (const [alias, source] of Object.entries({ ...aliases, '': 'index.html', 'studycrack-mobile': 'studycrack-mobile.html' })) {
    assert.ok(entries.has(source), `Missing smoke source: ${source}`);
    requests.push({ target: alias, entry: entries.get(source) });
  }
  const request = async (target) => {
    const query = /^(?:js|css)\//.test(target) ? `?v=${manifest.release}` : '';
    try {
      return await fetchImpl(`${origin}/${target}${query}`, { method: 'GET', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15_000) });
    } catch { throw new Error(`Public smoke request failed: /${target}`); }
  };
  for (const { target, entry } of requests) {
    const response = await request(target);
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new Error(`Public smoke status ${response.status}: /${target}`);
    }
    try {
      assert.match(response.headers.get('content-type') || '', contentTypeFor(entry.path), `Wrong public MIME: /${target}`);
      const cache = (response.headers.get('cache-control') || '').toLowerCase().split(',').map((part) => part.trim());
      if (cacheControlFor(entry.path) === IMMUTABLE) {
        assert.ok(cache.includes('immutable') && cache.includes('max-age=31536000') && !cache.includes('no-store') && !cache.includes('no-cache'), `Wrong immutable cache: /${target}`);
      } else {
        assert.ok(['no-cache', 'no-store', 'must-revalidate'].every((part) => cache.includes(part)) && !cache.includes('immutable'), `Wrong entry cache: /${target}`);
      }
    } catch (error) { await response.body?.cancel(); throw error; }
    const digest = createHash('sha256');
    let size = 0;
    assert.ok(response.body, `Missing public body: /${target}`);
    for await (const bytes of response.body) {
      size += bytes.length;
      assert.ok(size <= entry.bytes, `Oversized public body: /${target}`);
      digest.update(bytes);
    }
    assert.equal(size, entry.bytes, `Wrong public size: /${target}`);
    assert.equal(digest.digest('hex'), entry.sha256, `Stale or changed public bytes: /${target}`);
  }
  for (const target of PRIVATE_PATHS) {
    const response = await request(target);
    // Do not read or log potentially private response bodies.
    await response.body?.cancel();
    assert.ok([403, 404].includes(response.status), `Private path is not denied: /${target}`);
  }
  return { checked: requests.length, denied: PRIVATE_PATHS.length, release: manifest.release };
}

async function main() {
  const [origin, output, commit, expectedDigest] = process.argv.slice(2);
  assert.ok(expectedDigest, 'Expected the independently verified manifest digest');
  const { manifest } = await verifySiteRelease({ output, commit, expectedDigest });
  const { aliases } = await loadPublicPolicy();
  const result = await smokeSiteRelease({ origin, manifest, aliases });
  console.log(`Published release ${result.release}: ${result.checked} public responses and ${result.denied} denied private paths passed.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
