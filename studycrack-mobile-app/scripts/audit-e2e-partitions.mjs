import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
function cases(suite, shard) {
  const args = [cli, 'test', '--list', '--reporter=json', '--project=mobile-chromium'];
  if (shard) args.push(`--shard=${shard}/6`);
  const report = JSON.parse(execFileSync(process.execPath, args, {
    cwd: appRoot,
    env: { ...process.env, CI: '1', PLAYWRIGHT_SUITE: suite },
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
  }));
  assert.deepEqual(report.errors, [], 'Cannot enumerate browser tests');
  const ids = [];
  function visit(suites) {
    for (const node of suites) {
      for (const spec of node.specs || []) for (const test of spec.tests) ids.push(`${spec.id}:${test.projectName}`);
      visit(node.suites || []);
    }
  }
  visit(report.suites);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate test identity');
  return ids;
}
const all = cases('all'), smoke = cases('smoke'), shards = Array.from({ length: 6 }, (_, i) => cases('regression', i + 1));
const selected = [...smoke, ...shards.flat()];
assert.ok(smoke.length > 0 && shards.every(ids => ids.length > 0), 'Empty verification partition');
assert.equal(new Set(selected).size, selected.length, 'A browser test runs in multiple partitions');
assert.deepEqual([...selected].sort(), [...all].sort(), 'Missing or unexpected browser test');
console.log(`E2E partition passed: ${all.length} tests = smoke ${smoke.length} + shards [${shards.map(ids => ids.length).join(', ')}], missing 0, duplicates 0.`);
