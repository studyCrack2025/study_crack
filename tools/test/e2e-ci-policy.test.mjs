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

test('parallel browser jobs preserve one final gate, scope, immutable bytes and failure propagation', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const prepare = workflow.slice(workflow.indexOf('  prepare:'), workflow.indexOf('  e2e:'));
  const browser = workflow.slice(workflow.indexOf('  e2e:'), workflow.indexOf('  verify:'));
  const verify = workflow.slice(workflow.indexOf('  verify:'), workflow.indexOf('  rollback:'));
  assert.match(workflow, /pull_request:\n    branches: \[dev, main\]/);
  assert.doesNotMatch(workflow, /pull_request_target|continue-on-error/);
  assert.match(prepare, /github.event_name == 'push' \|\| github.event_name == 'pull_request'/);
  assert.match(prepare, /fetch-depth: 0/);
  assert.match(prepare, /node ..\/tools\/verification-scope.mjs/);
  for (const required of ['npm audit --omit=dev', 'npm run check', 'node --test ../tools/test/*.test.mjs', 'npm run build']) {
    assert.ok(prepare.includes(required), required);
  }
  assert.doesNotMatch(prepare, /test:e2e|playwright install/);
  assert.match(browser, /needs: prepare/);
  assert.match(browser, /fail-fast: false/);
  assert.ok(browser.includes("fromJSON(needs.prepare.outputs.suite == 'web-css' && '[1]' || '[1,2,3,4,5,6]')"));
  assert.ok(browser.includes("SHARD_TOTAL: ${{ needs.prepare.outputs.suite == 'web-css' && '1' || '6' }}"));
  assert.match(browser, /PLAYWRIGHT_SUITE: \$\{\{ needs.prepare.outputs.suite \}\}/);
  assert.ok(browser.includes('--shard="$SHARD_INDEX/$SHARD_TOTAL" --workers=1 --retries=0'));
  const tests = browser.indexOf('- name: Test required browser coverage');
  assert.ok(browser.indexOf('- name: Verify candidate bytes before browser tests') < tests);
  assert.ok(browser.indexOf('- name: Verify candidate bytes remained unchanged during browser tests') > tests);
  assert.match(verify, /needs: \[prepare, e2e\]/);
  assert.match(verify, /always\(\) && !cancelled\(\)/);
  assert.match(verify, /PREPARE_RESULT: \$\{\{ needs.prepare.result \}\}/);
  assert.match(verify, /E2E_RESULT: \$\{\{ needs.e2e.result \}\}/);
  assert.ok(verify.includes('test "$PREPARE_RESULT" = success && test "$E2E_RESULT" = success'));
  assert.ok(verify.indexOf('Require every verification job to pass') < verify.indexOf('Seal verified artifact identity'));
  for (const job of [browser, verify]) {
    assert.match(job, /CANDIDATE_DIGEST: .*needs\.prepare\.outputs\.manifest-digest/);
    assert.match(job, /site-release\.mjs verify .*"\$GITHUB_SHA" "\$CANDIDATE_DIGEST"/);
    assert.doesNotMatch(job, /npm run build|site-release\.mjs build/);
  }
  assert.match(verify, /Upload verified public artifact\n        if: github.event_name == 'push'/);
  assert.doesNotMatch(prepare + browser + verify, /configure-aws-credentials|id-token: write/);
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
