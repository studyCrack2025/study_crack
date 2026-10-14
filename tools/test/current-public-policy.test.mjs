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
  for (const slug of ['terms', 'privacy', 'refund', 'delete-account']) {
    assert.equal(policy.aliases[slug], `${slug}.html`);
    assert.ok(policy.files.includes(`${slug}.html`));
  }
  assert.ok(policy.files.includes('css/legal-page.css'));
  assert.ok(!policy.files.some(file => file.startsWith('content/legal/')));
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

test('both verification scopes retain public artifact smoke before deployment', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const { e2eSuiteSelection } = await import('../../studycrack-mobile-app/scripts/e2e-suite-policy.mjs');
  const browser = workflow.indexOf('- name: Test required browser coverage');
  const seal = workflow.indexOf('- name: Seal verified artifact identity');
  assert.ok(browser > workflow.indexOf('- name: Install browser runtime') && seal > browser);
  const step = workflow.slice(browser, seal);
  assert.ok(step.includes('STUDYCRACK_PREVIEW_ROOT: ${{ github.workspace }}/release-artifact/site'));
  assert.ok(step.includes('--workers=2 --retries=0'));
  assert.doesNotMatch(step, /continue-on-error/);
  assert.equal(e2eSuiteSelection('all').testMatch, '**/*.spec.mjs');
  assert.ok(e2eSuiteSelection('web-css').testMatch.includes('**/public-artifact.spec.mjs'));
  for (const spec of ['fish-artwork-lifecycle', 'payment-account-switch', 'public-artifact']) {
    await readFile(new URL(`../../studycrack-mobile-app/e2e/${spec}.spec.mjs`, import.meta.url));
  }
});
