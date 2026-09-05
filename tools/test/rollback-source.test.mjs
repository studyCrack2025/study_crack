import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRollbackSource } from '../rollback-source.mjs';

const commit = 'a'.repeat(40);
const inputs = { repository: 'example/site', branch: 'dev', runId: '123', currentRunId: '456', commit, digest: 'b'.repeat(64), confirmation: 'rollback-dev' };
const run = { id: 123, run_attempt: 2, event: 'push', status: 'completed', conclusion: 'success', workflow_id: 10, head_branch: 'dev', head_sha: commit, repository: { id: 1, full_name: inputs.repository }, head_repository: { id: 1, full_name: inputs.repository } };
const artifact = { id: 99, name: `public-site-${commit}-123-2`, expired: false, expires_at: '2099-01-01T00:00:00Z', workflow_run: { id: 123, repository_id: 1, head_repository_id: 1, head_branch: 'dev', head_sha: commit } };
function api(overrides = {}) {
  return async (endpoint) => {
    if (endpoint.endsWith('/workflows/deploy.yml')) return { id: 10, path: '.github/workflows/deploy.yml' };
    if (endpoint.endsWith('/runs/123')) return { ...structuredClone(run), ...overrides.run };
    if (endpoint.includes('/artifacts?')) return { total_count: 1, artifacts: [{ ...structuredClone(artifact), ...overrides.artifact }], ...overrides.list };
    throw new Error(`Unexpected endpoint ${endpoint}`);
  };
}

test('rollback selects one retained artifact from a successful push in the same repository and branch', async () => {
  const result = await resolveRollbackSource(inputs, api());
  assert.deepEqual(result, { artifactId: '99', artifactName: artifact.name, sourceCommit: commit, manifestDigest: inputs.digest, sourceRunId: '123' });
});

for (const [label, changes] of [
  ['failed run', { run: { conclusion: 'failure' } }],
  ['unfinished run', { run: { status: 'in_progress' } }],
  ['pull request', { run: { event: 'pull_request' } }],
  ['different branch', { run: { head_branch: 'main' } }],
  ['different commit', { run: { head_sha: 'c'.repeat(40) } }],
  ['different workflow', { run: { workflow_id: 20 } }],
  ['fork', { run: { head_repository: { id: 2, full_name: 'someone/site' } } }],
  ['expired', { artifact: { expired: true } }],
  ['expiry timestamp', { artifact: { expires_at: '2000-01-01T00:00:00Z' } }],
  ['old attempt', { artifact: { name: `public-site-${commit}-123-1` } }],
  ['artifact provenance', { artifact: { workflow_run: { ...artifact.workflow_run, head_branch: 'main' } } }],
  ['missing artifact', { list: { total_count: 0, artifacts: [] } }],
  ['ambiguous artifact', { list: { total_count: 2, artifacts: [artifact, { ...artifact, id: 100 }] } }]
]) test(`rollback rejects ${label}`, async () => {
  await assert.rejects(resolveRollbackSource(inputs, api(changes)));
});

test('invalid or unconfirmed inputs fail before contacting GitHub', async () => {
  for (const changes of [{ branch: 'feature' }, { runId: '123;evil' }, { runId: '456' }, { commit: 'aaaa' }, { digest: '' }, { confirmation: 'rollback-main' }, { repository: '../other' }]) {
    let calls = 0;
    await assert.rejects(resolveRollbackSource({ ...inputs, ...changes }, async () => { calls++; }));
    assert.equal(calls, 0);
  }
});

test('artifact lookup handles paginated history without accepting a stale attempt', async () => {
  const endpoints = [];
  const base = api();
  const result = await resolveRollbackSource(inputs, async (endpoint) => {
    endpoints.push(endpoint);
    if (endpoint.endsWith('page=1')) return { total_count: 101, artifacts: Array.from({ length: 100 }, (_, id) => ({ ...artifact, id, name: `unrelated-${id}` })) };
    return base(endpoint);
  });
  assert.equal(result.artifactId, '99');
  assert.ok(endpoints.some((endpoint) => endpoint.endsWith('page=2')));
});
