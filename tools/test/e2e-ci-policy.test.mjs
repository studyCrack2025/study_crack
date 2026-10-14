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

test('one PR check preserves security, artifact identity, required coverage and failure propagation', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const verify = workflow.slice(workflow.indexOf('  verify:'), workflow.indexOf('  rollback:'));
  assert.match(workflow, /pull_request:\n    branches: \[dev, main\]/);
  assert.doesNotMatch(workflow, /pull_request_target|  prepare:|  e2e:|matrix:|continue-on-error/);
  assert.match(verify, /github.event_name == 'push' \|\| github.event_name == 'pull_request'/);
  assert.match(verify, /fetch-depth: 0/);
  assert.match(verify, /node ..\/tools\/verification-scope.mjs/);
  assert.match(verify, /PLAYWRIGHT_SUITE: \$\{\{ steps.scope.outputs.suite \}\}/);
  assert.match(verify, /--workers=2 --retries=0/);
  for (const required of ['npm audit --omit=dev', 'npm run check', 'node --test ../tools/test/*.test.mjs', 'npm run build']) {
    assert.ok(verify.includes(required), required);
  }
  const browserStep = verify.indexOf('- name: Test required browser coverage');
  assert.ok(verify.indexOf('- name: Seal candidate bytes before browser tests') < browserStep);
  assert.ok(verify.indexOf('- name: Seal verified artifact identity') > browserStep);
  assert.match(verify, /site-release\.mjs verify .*"\$GITHUB_SHA" "\$CANDIDATE_DIGEST"/);
  assert.match(verify, /steps\.candidate\.outputs\.manifest-digest/);
  assert.doesNotMatch(verify, /configure-aws-credentials|id-token: write/);
  const config = await readFile(new URL('../../studycrack-mobile-app/playwright.config.mjs', import.meta.url), 'utf8');
  assert.match(config, /fullyParallel: Boolean\(process.env.CI\)/);
  assert.match(config, /retries: 0/);
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
