import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIVATE_SITE_SMOKE_PATHS } from './private-site-paths.mjs';

export async function auditPublicBoundaries({ origin, expectedCommit, fetchImpl = fetch }) {
  const base = new URL(origin);
  assert.equal(base.origin, origin, 'Use a bare approved origin');
  assert.ok(['https://dev.studycrack.co.kr', 'https://studycrack.co.kr'].includes(origin)
    || (base.protocol === 'http:' && base.hostname === '127.0.0.1'), 'Use an approved origin');
  if (expectedCommit !== undefined) assert.match(expectedCommit, /^[a-f0-9]{40}$/, 'Use a full expected commit');
  const results = [];
  let identity = null;
  for (const target of ['release.json', ...PRIVATE_SITE_SMOKE_PATHS]) {
    let response;
    const findings = [];
    let status = 0;
    try {
      response = await fetchImpl(`${origin}/${target}`, {
        method: 'GET', credentials: 'omit', redirect: 'manual', referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(8000)
      });
      status = response.status;
      if (target !== 'release.json') {
        // Never read private bodies, including a mistaken public response.
        if (![403, 404].includes(status)) findings.push('private_path_not_denied');
      } else if (status !== 200) findings.push('release_unavailable');
      else {
        if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) findings.push('release_mime_invalid');
        const cache = (response.headers.get('cache-control') || '').toLowerCase().split(',').map(value => value.trim());
        if (!['no-cache', 'no-store', 'must-revalidate'].every(value => cache.includes(value)) || cache.includes('immutable')) findings.push('release_cache_invalid');
        const chunks = []; let length = 0;
        if (!response.body) throw new Error();
        for await (const chunk of response.body) {
          length += chunk.length;
          if (length > 4096) throw new Error();
          chunks.push(chunk);
        }
        const candidate = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const branch = origin === 'https://studycrack.co.kr' ? 'main' : origin === 'https://dev.studycrack.co.kr' ? 'dev' : 'local';
        if (candidate?.schema !== 1 || !/^[a-f0-9]{40}$/.test(candidate.commit || '') || candidate.release !== `${branch}-${candidate.commit.slice(0, 8)}`) findings.push('release_identity_invalid');
        else {
          identity = { schema: 1, commit: candidate.commit, release: candidate.release };
          if (expectedCommit !== undefined && candidate.commit !== expectedCommit) findings.push('release_commit_mismatch');
        }
      }
    } catch { findings.push('request_or_identity_unavailable'); }
    finally { try { await response?.body?.cancel(); } catch {} }
    results.push({ path: `/${target}`, status, findings });
  }
  return { schema: 1, origin, ok: results.every(row => !row.findings.length), expectedCommitChecked: expectedCommit !== undefined && identity !== null, identity, denied: results.filter(row => row.path !== '/release.json' && !row.findings.length).length, checked: results.length, results };
}

async function main() {
  const [origin, expectedCommit, ...extra] = process.argv.slice(2);
  assert.ok(origin && !extra.length, 'Expected approved origin and optional full commit');
  const result = await auditPublicBoundaries({ origin, expectedCommit });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `\n### Public boundary and release identity\n\n${result.ok ? 'Passed' : 'Blocked'}: ${result.denied}/${PRIVATE_SITE_SMOKE_PATHS.length} private paths denied. Expected commit ${result.expectedCommitChecked ? 'checked' : 'not checked'}. This does not verify all public bytes or real-account/device behavior.\n\n| Path | HTTP | Findings |\n|---|---|---|\n${result.results.map(row => `| ${row.path} | ${row.status || 'unavailable'} | ${row.findings.join(', ') || 'passed'} |`).join('\n')}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Public boundary audit could not complete.'); process.exitCode = 1; });
}
