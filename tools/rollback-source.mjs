import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function resolveRollbackSource(input, getJson) {
  const { repository, branch, runId, currentRunId, commit, digest, confirmation } = input;
  assert.match(repository, /^[\w-]+\/[\w.-]+$/, 'Invalid repository');
  assert.ok(['dev', 'main'].includes(branch), 'Rollback only dev/main');
  assert.match(runId, /^[1-9][0-9]{0,14}$/, 'Invalid source run ID');
  assert.notEqual(runId, currentRunId, 'Cannot roll back to the current run');
  assert.match(commit, /^[a-f0-9]{40}$/, 'Expected a complete source commit');
  assert.match(digest, /^[a-f0-9]{64}$/, 'Expected the manifest digest from the successful source run');
  assert.equal(confirmation, `rollback-${branch}`, 'Rollback branch confirmation does not match');
  const base = `/repos/${repository}/actions`;
  const [workflow, run] = await Promise.all([getJson(`${base}/workflows/deploy.yml`), getJson(`${base}/runs/${runId}`)]);
  assert.equal(workflow.path, '.github/workflows/deploy.yml', 'Unexpected deployment workflow');
  assert.equal(run.workflow_id, workflow.id, 'Source is not the deployment workflow');
  assert.equal(String(run.id), runId, 'Source run mismatch');
  assert.equal(run.repository?.full_name, repository, 'Source repository mismatch');
  assert.equal(run.head_repository?.full_name, repository, 'Fork artifacts are not eligible');
  assert.equal(run.event, 'push', 'Only successful push releases are eligible');
  assert.equal(run.status, 'completed', 'Source run is not complete');
  assert.equal(run.conclusion, 'success', 'Source release did not pass all deployment gates');
  assert.equal(run.head_branch, branch, 'Source branch does not match destination');
  assert.equal(run.head_sha, commit, 'Source commit does not match requested release');
  assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0, 'Invalid source attempt');
  const name = `public-site-${commit}-${runId}-${run.run_attempt}`;
  const artifacts = [];
  for (let page = 1; ; page++) {
    assert.ok(page <= 100, 'Too many source artifacts; select a more recent release');
    const batch = await getJson(`${base}/runs/${runId}/artifacts?per_page=100&page=${page}`);
    assert.ok(Array.isArray(batch.artifacts) && Number.isSafeInteger(batch.total_count), 'Invalid artifact response');
    artifacts.push(...batch.artifacts);
    if (artifacts.length >= batch.total_count) break;
    assert.ok(batch.artifacts.length > 0, 'Incomplete artifact response');
  }
  const matches = artifacts.filter((artifact) => artifact.name === name);
  assert.equal(matches.length, 1, 'Expected one retained artifact from the latest successful attempt');
  const artifact = matches[0];
  assert.equal(artifact.expired, false, 'Source artifact expired');
  assert.ok(Date.parse(artifact.expires_at) > Date.now(), 'Source artifact retention expired');
  assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0, 'Invalid artifact ID');
  assert.equal(artifact.workflow_run?.id, run.id, 'Artifact run mismatch');
  assert.equal(artifact.workflow_run?.repository_id, run.repository.id, 'Artifact repository mismatch');
  assert.equal(artifact.workflow_run?.head_repository_id, run.head_repository.id, 'Artifact head repository mismatch');
  assert.equal(artifact.workflow_run?.head_branch, branch, 'Artifact branch mismatch');
  assert.equal(artifact.workflow_run?.head_sha, commit, 'Artifact commit mismatch');
  return { artifactId: String(artifact.id), artifactName: name, sourceCommit: commit, manifestDigest: digest, sourceRunId: runId };
}

async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Resolve rollback only in GitHub Actions');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Rollback must be explicitly dispatched');
  assert.equal(process.env.GITHUB_REF, `refs/heads/${process.env.GITHUB_REF_NAME}`, 'Rollback requires a branch ref');
  assert.ok(process.env.GITHUB_TOKEN, 'Actions read token is required');
  const result = await resolveRollbackSource({
    repository: process.env.GITHUB_REPOSITORY, branch: process.env.GITHUB_REF_NAME,
    currentRunId: process.env.GITHUB_RUN_ID, runId: process.env.ROLLBACK_RUN_ID,
    commit: process.env.ROLLBACK_COMMIT, digest: process.env.ROLLBACK_DIGEST, confirmation: process.env.ROLLBACK_CONFIRMATION
  }, async (endpoint) => {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'error', signal: AbortSignal.timeout(15_000)
    });
    assert.ok(response.ok, `GitHub metadata request failed (${response.status})`);
    return response.json();
  });
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(''));
  console.log('Eligible rollback artifact identified; no deployment performed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
