import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { e2eSuiteSelection, smokeSpecs } from '../../studycrack-mobile-app/scripts/e2e-suite-policy.mjs';
import { summarizeResults } from '../../studycrack-mobile-app/scripts/summarize-e2e-results.mjs';

test('smoke and regression partition all files without an opt-out or unknown suite fallback', () => {
  assert.equal(smokeSpecs.length, 3);
  assert.deepEqual(e2eSuiteSelection(), { testMatch: '**/*.spec.mjs', testIgnore: [] });
  const smoke = e2eSuiteSelection('smoke'), regression = e2eSuiteSelection('regression');
  assert.deepEqual(smoke.testMatch, regression.testIgnore);
  assert.deepEqual(smoke.testIgnore, []);
  assert.equal(regression.testMatch, '**/*.spec.mjs');
  assert.throws(() => e2eSuiteSelection('typo'));
});

test('CI runs every shard against the same candidate and cannot seal before all succeed', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const prepare = workflow.slice(workflow.indexOf('  prepare:'), workflow.indexOf('  e2e:'));
  const e2e = workflow.slice(workflow.indexOf('  e2e:'), workflow.indexOf('  verify:'));
  const verify = workflow.slice(workflow.indexOf('  verify:'), workflow.indexOf('  rollback:'));
  assert.match(prepare, /node scripts\/audit-e2e-partitions.mjs/);
  assert.match(e2e, /needs: prepare/);
  assert.match(e2e, /fail-fast: false/);
  assert.match(e2e, /shard: \[1, 2, 3, 4, 5, 6\]/);
  assert.match(e2e, /--shard="\$SHARD_INDEX\/6" --workers=1 --retries=0/);
  assert.match(e2e, /needs\.prepare\.outputs\.artifact-name/);
  assert.match(e2e, /site-release\.mjs verify .*"\$GITHUB_SHA" "\$CANDIDATE_DIGEST"/);
  const browserStep = e2e.indexOf('- name: Test the public artifact shard');
  assert.ok(e2e.indexOf('- name: Verify candidate bytes before browser tests') < browserStep);
  assert.ok(e2e.indexOf('- name: Verify candidate bytes remained unchanged during browser tests') > browserStep);
  assert.equal((e2e.match(/run: node .*site-release\.mjs verify/g) || []).length, 2);
  assert.match(verify, /needs: \[prepare, e2e\]/);
  assert.match(verify, /test "\$PREPARE_RESULT" = success && test "\$E2E_RESULT" = success/);
  assert.match(verify, /site-release\.mjs verify .*"\$GITHUB_SHA" "\$CANDIDATE_DIGEST"/);
  assert.doesNotMatch(e2e + verify, /npm run build|continue-on-error|configure-aws-credentials|id-token: write/);
  const config = await readFile(new URL('../../studycrack-mobile-app/playwright.config.mjs', import.meta.url), 'utf8');
  assert.match(config, /fullyParallel: Boolean\(process.env.CI\)/);
  assert.match(config, /retries: 0/);
  assert.match(config, /workers: process.env.CI \? 1/);
});

test('timing report includes nested cases, retries and failures instead of hiding them', () => {
  const report = { stats: { duration: 4000, expected: 1, unexpected: 1, flaky: 1, skipped: 0 }, suites: [{ specs: [{ file: 'one.mjs', tests: [{ status: 'flaky', results: [{ duration: 500 }, { duration: 1000 }] }] }], suites: [{ specs: [{ file: 'two.mjs', tests: [{ status: 'unexpected', results: [{ duration: 2000 }] }] }] }] }] };
  const summary = summarizeResults(report);
  assert.deepEqual(summary.stats, report.stats);
  assert.deepEqual(summary.files, [
    { file: 'two.mjs', tests: 1, duration: 2000, unexpected: 1, flaky: 0 },
    { file: 'one.mjs', tests: 1, duration: 1500, unexpected: 0, flaky: 1 }
  ]);
});
