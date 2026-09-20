import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { assertPublicReferences, loadPublicPolicy } from '../site-release.mjs';

test('current web release includes its new pages and artwork without retired or example pages', async () => {
  const policy = await loadPublicPolicy();
  for (const file of ['404.html', 'css/not-found.css', 'basic-preview.html', 'css/basic-preview.css', 'js/basic-preview.js', ...['hero-phone', 'plan-books', 'proof-classroom', 'result-position', 'result-effects', 'result-priority'].map(name => `assets/basic-v2/${name}.png`)]) {
    assert.ok(policy.files.includes(file), `Missing current public file: ${file}`);
  }
  assert.equal(policy.aliases['basic-preview'], 'basic-preview.html');
  assert.equal(policy.aliases['promotion/kcc01'], undefined);
  assert.ok(policy.files.every(file => !/promotion[-_]kcc01|basic-preview-example/.test(file)));
  const contents = new Map(policy.files.map(file => [file, Buffer.alloc(0)]));
  // Check the actual web sources, not only synthetic packaging fixtures.
  for (const file of policy.files.filter(file => /\.(html|css)$/.test(file) && !file.startsWith('studycrack-mobile'))) {
    contents.set(file, await readFile(new URL(`../../${file}`, import.meta.url)));
  }
  assertPublicReferences(contents);
});

test('dependency diagnostics report every missing reference in one failure', () => {
  const contents = new Map([
    ['index.html', Buffer.from('<img src="/assets/one.png"><img src="/assets/two.png">')],
    ['css/main.css', Buffer.from('body{background:url(/assets/three.png)}')]
  ]);
  assert.throws(() => assertPublicReferences(contents), error => {
    for (const name of ['one', 'two', 'three']) assert.ok(error.message.includes(`assets/${name}.png`));
    return true;
  });
});

test('artifact smoke checks run before the full matrix without replacing it', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const smoke = workflow.indexOf('- name: Check public artifact smoke contracts');
  const full = workflow.indexOf('- name: Test the public artifact');
  assert.ok(smoke > workflow.indexOf('- name: Install browser runtime') && full > smoke);
  const step = workflow.slice(smoke, full);
  assert.ok(step.includes('STUDYCRACK_PREVIEW_ROOT: ${{ github.workspace }}/release-artifact/site'));
  assert.ok(step.includes('fish-artwork-lifecycle public-artifact --workers=1 --retries=0'));
  assert.doesNotMatch(step, /continue-on-error/);
  assert.ok(workflow.slice(full).includes('run: npm run test:e2e'));
});
