import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Expand only alongside browser coverage for every page that consumes the stylesheet.
export const webCssFiles = ['css/tutorial.css', 'css/mypage.css', 'css/payment-history.css'];

export function classifyChanges(files) {
  return files.length > 0 && files.every(file => webCssFiles.includes(file)) ? 'web-css' : 'all';
}

export async function resolveVerificationScope({ repository, branch, head }, { getJson, changedFiles }) {
  const full = reason => ({ suite: 'all', reason, baseline: '' });
  if (branch !== 'dev') return full('Production and unknown targets require the full suite.');
  try {
    assert.match(repository, /^[\w-]+\/[\w.-]+$/);
    assert.match(head, /^[a-f0-9]{40}$/);
    const endpoint = `/repos/${repository}/actions/workflows/deploy.yml/runs?branch=dev&status=success&per_page=1`;
    const [response, rollbacks] = await Promise.all([
      getJson(`${endpoint}&event=push`), getJson(`${endpoint}&event=workflow_dispatch`)
    ]);
    const run = response.workflow_runs?.[0];
    assert.ok(run, 'No successful deployment');
    assert.equal(run.repository?.full_name, repository);
    assert.equal(run.head_repository?.full_name, repository);
    assert.equal(run.head_branch, branch);
    assert.equal(run.event, 'push');
    assert.equal(run.status, 'completed');
    assert.equal(run.conclusion, 'success');
    assert.equal(run.path?.split('@')[0], '.github/workflows/deploy.yml');
    assert.match(run.head_sha, /^[a-f0-9]{40}$/);
    assert.ok(Number.isFinite(Date.parse(run.updated_at)));
    assert.ok(Array.isArray(rollbacks.workflow_runs));
    const rollback = rollbacks.workflow_runs[0];
    if (rollback) {
      assert.equal(rollback.event, 'workflow_dispatch');
      assert.ok(Number.isFinite(Date.parse(rollback.updated_at)));
      if (Date.parse(rollback.updated_at) >= Date.parse(run.updated_at)) return full('The latest successful deployment was a rollback; running the full suite.');
    }
    // A failed earlier deployment must not disappear from the next change assessment.
    const files = await changedFiles(run.head_sha, head);
    const suite = classifyChanges(files);
    return { suite, baseline: run.head_sha, reason: suite === 'web-css'
      ? 'Only covered desktop stylesheets changed since the last successful deployment.'
      : 'Shared, mobile, other files, or an empty diff require the full suite.' };
  } catch {
    return full('A trusted deployment baseline could not be established; running the full suite.');
  }
}

export function gitChangedFiles(base, head, cwd = process.cwd()) {
  for (const ref of [base, head]) assert.match(ref, /^[a-f0-9]{40}$/);
  execFileSync('git', ['merge-base', '--is-ancestor', base, head], { cwd, stdio: 'pipe' });
  return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, head, '--'], {
    cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
  }).split('\0').filter(Boolean);
}

async function main() {
  const scope = await resolveVerificationScope({
    repository: process.env.GITHUB_REPOSITORY,
    branch: process.env.GITHUB_BASE_REF || process.env.GITHUB_REF_NAME,
    head: process.env.GITHUB_SHA
  }, {
    changedFiles: gitChangedFiles,
    getJson: async endpoint => {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
        redirect: 'error', signal: AbortSignal.timeout(15_000)
      });
      assert.ok(response.ok, 'Cannot read deployment history');
      return response.json();
    }
  });
  await appendFile(process.env.GITHUB_OUTPUT, `suite=${scope.suite}\n`);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Verification scope: ${scope.suite}\n${scope.reason}\n\nBaseline: ${scope.baseline || 'unavailable'}\n`);
  console.log(`${scope.suite}: ${scope.reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
