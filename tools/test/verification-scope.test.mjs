import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyChanges, gitChangedFiles, resolveVerificationScope, webCssFiles } from '../verification-scope.mjs';
import { e2eSuiteSelection, webCssSpecs } from '../../studycrack-mobile-app/scripts/e2e-suite-policy.mjs';

const repository = 'example/site', baseline = 'a'.repeat(40), head = 'b'.repeat(40);
const run = { repository: { full_name: repository }, head_repository: { full_name: repository }, head_branch: 'dev',
  event: 'push', status: 'completed', conclusion: 'success', path: '.github/workflows/deploy.yml', head_sha: baseline, updated_at: '2026-10-14T00:00:00Z' };
const input = { repository, branch: 'dev', head };
const deps = (overrides = {}) => ({ getJson: async endpoint => ({ workflow_runs: endpoint.includes('event=workflow_dispatch') ? [] : [run] }), changedFiles: async () => ['css/tutorial.css'], ...overrides });

test('only explicitly covered CSS takes the web path; shared, mobile and unknown changes stay full', () => {
  assert.equal(classifyChanges(webCssFiles), 'web-css');
  for (const files of [[], ['css/style.css'], ['js/auth.js'], ['js/shared/api.js'], ['css/studycrack-mobile.css'],
    ['studycrack-mobile-app/src/shared/browser/overlay-focus.js'], ['studycrack-mobile-app/package-lock.json'],
    ['.github/workflows/deploy.yml'], ['tools/verification-scope.mjs'], ['new.css'], ['css/tutorial.css', 'js/tutorial.js']]) {
    assert.equal(classifyChanges(files), 'all', files.join(','));
  }
});

test('compare with the last deployed commit, including changes left by failed deployments', async () => {
  const result = await resolveVerificationScope(input, deps({ changedFiles: async (from, to) => {
    assert.equal(from, baseline); assert.equal(to, head);
    return ['studycrack-mobile-app/src/runtime/main.js', 'css/tutorial.css'];
  } }));
  assert.equal(result.suite, 'all');
  assert.equal((await resolveVerificationScope(input, deps())).suite, 'web-css');
});

test('production and untrusted, unavailable or non-ancestor baselines never reduce coverage', async () => {
  for (const branch of ['main', '', 'feature']) assert.equal((await resolveVerificationScope({ ...input, branch }, deps())).suite, 'all');
  for (const override of [{ conclusion: 'failure' }, { event: 'pull_request' }, { head_branch: 'main' },
    { path: '.github/workflows/another.yml' }, { head_sha: 'bad' }, { head_repository: { full_name: 'fork/site' } }, { status: 'in_progress' }]) {
    assert.equal((await resolveVerificationScope(input, deps({ getJson: async () => ({ workflow_runs: [{ ...run, ...override }] }) }))).suite, 'all');
  }
  for (const override of [
    { getJson: async () => { throw new Error('API unavailable'); } },
    { getJson: async () => ({ workflow_runs: [] }) },
    { changedFiles: async () => { throw new Error('not an ancestor'); } },
    { changedFiles: async () => [] }
  ]) assert.equal((await resolveVerificationScope(input, deps(override))).suite, 'all');
});

test('a newer successful rollback requires full coverage until a subsequent push deploy succeeds', async () => {
  for (const [updated_at, suite] of [['2026-10-15T00:00:00Z', 'all'], ['2026-10-13T00:00:00Z', 'web-css']]) {
    const result = await resolveVerificationScope(input, deps({ getJson: async endpoint => ({ workflow_runs: [
      endpoint.includes('event=workflow_dispatch') ? { ...run, event: 'workflow_dispatch', updated_at } : run
    ] }) }));
    assert.equal(result.suite, suite);
  }
});

test('git detects removals and both sides of renames without losing unusual path names', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'verification-scope-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init'); git('config', 'user.name', 'Verification test'); git('config', 'user.email', 'test@example.invalid');
    await writeFile(path.join(cwd, 'old.css'), 'body {}');
    git('add', '.'); git('commit', '-m', 'baseline'); const base = git('rev-parse', 'HEAD');
    git('mv', 'old.css', 'space name.css'); git('commit', '-m', 'rename'); const current = git('rev-parse', 'HEAD');
    assert.deepEqual(gitChangedFiles(base, current, cwd).sort(), ['old.css', 'space name.css']);
    assert.throws(() => gitChangedFiles(current, base, cwd));
    assert.throws(() => gitChangedFiles('--bad', current, cwd));
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test('reduced suite includes all CSS consumers and public artifact checks, with no mobile rules suite', async () => {
  const root = new URL('../../', import.meta.url);
  const consumers = { 'css/tutorial.css': ['tutorial.html'], 'css/mypage.css': ['analysis.html', 'mypage.html', 'mypage_tutor.html'], 'css/payment-history.css': ['payment-history.html'] };
  assert.deepEqual(Object.keys(consumers).sort(), [...webCssFiles].sort());
  const html = (await readdir(root)).filter(file => file.endsWith('.html'));
  for (const [css, expected] of Object.entries(consumers)) {
    const actual = [];
    for (const file of html) if ((await readFile(new URL(file, root), 'utf8')).includes(`/${css}`)) actual.push(file);
    assert.deepEqual(actual.sort(), expected.sort(), `Update coverage when adding a consumer of ${css}`);
  }
  const mobileFiles = execFileSync('git', ['ls-files', 'studycrack-mobile-app/src', 'studycrack-mobile.html'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  for (const file of mobileFiles.filter(file => /\.(?:js|jsx|mjs|html|css)$/.test(file))) {
    const source = await readFile(new URL(file, root), 'utf8');
    for (const css of webCssFiles) assert.ok(!source.includes(`/${css}`), `${file} now depends on ${css}; use full coverage`);
  }
  for (const file of (await readdir(new URL('css/', root))).filter(file => file.endsWith('.css'))) {
    const source = await readFile(new URL(`css/${file}`, root), 'utf8');
    for (const css of webCssFiles) assert.doesNotMatch(source, new RegExp(`(?:@import|url\\()[^;]*${path.basename(css).replace('.', '\\.')}`));
  }
  const selection = e2eSuiteSelection('web-css');
  assert.ok(webCssSpecs.includes('public-artifact.spec.mjs'));
  assert.ok(!webCssSpecs.includes('game-rules-guide.spec.mjs'));
  assert.deepEqual(selection.testIgnore, []);
  for (const spec of webCssSpecs) await readFile(new URL(`studycrack-mobile-app/e2e/${spec}`, root));
});
