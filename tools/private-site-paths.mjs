import assert from 'node:assert/strict';

export const PRIVATE_SITE_PREFIXES = Object.freeze([
  '.claude/',
  'studycrack-mobile-app/e2e/',
  'studycrack-mobile-app/fixtures/',
  'studycrack-mobile-app/playwright-report/',
  'studycrack-mobile-app/scripts/',
  'studycrack-mobile-app/src/',
  'studycrack-mobile-app/test-results/',
  'tools/'
]);

export const PRIVATE_SITE_FILES = Object.freeze([
  '.gitignore',
  'IMG_2648.jpeg',
  'MOBILE_DEVELOPMENT.md',
  'README.md',
  'basic-preview-example.html',
  'css/basic-preview-example.css',
  'css/promotion-kcc01.css',
  'css/style.css.bak',
  'js/basic-preview-example.js',
  'js/dev-mock.local.example.js',
  'js/promotion-kcc01.js',
  'promotion/kcc01',
  'promotion_kcc01.html',
  'serve.json',
  'studycrack-mobile-app/architecture-baseline.json',
  'studycrack-mobile-app/package-lock.json',
  'studycrack-mobile-app/package.json',
  'studycrack-mobile-app/playwright.config.mjs',
  'studycrack-mobile-app/vite.config.js'
]);

const PRIVATE_SITE_PREFIX_SAMPLES = Object.freeze([
  '.claude/launch.json',
  'studycrack-mobile-app/e2e/core-flows.spec.mjs',
  'studycrack-mobile-app/fixtures/ui-contract.json',
  'studycrack-mobile-app/playwright-report/index.html',
  'studycrack-mobile-app/scripts/check-source.mjs',
  'studycrack-mobile-app/src/runtime/main.js',
  'studycrack-mobile-app/test-results/results.json',
  'tools/check_seo_contract.mjs'
]);

export const PRIVATE_SITE_SMOKE_PATHS = Object.freeze([...new Set([
  'manifest.json',
  'AGENTS.md',
  '.env',
  '.git/config',
  'docs/exec-plans/current.md',
  'backend-backup/StudyCrack_Auth/index.mjs',
  'js/dev-mock.local.js',
  ...PRIVATE_SITE_FILES,
  ...PRIVATE_SITE_PREFIX_SAMPLES
])]);

function assertPrivateSitePath(relative, { prefix = false } = {}) {
  assert.ok(typeof relative === 'string' && relative.length > 0, 'Empty private site path');
  assert.ok(!relative.startsWith('/') && !relative.includes('\\') && !relative.includes('*'), `Unsafe private site path: ${relative}`);
  const parts = relative.replace(/\/$/, '').split('/');
  assert.ok(parts.every((part) => part && part !== '.' && part !== '..' && /^[a-zA-Z0-9_.-]+$/.test(part)), `Unsafe private site path: ${relative}`);
  assert.equal(relative.endsWith('/'), prefix, `Private site ${prefix ? 'prefix' : 'file'} shape mismatch: ${relative}`);
}

export function createPrivateCleanupCommands(bucket) {
  assert.match(bucket, /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'Invalid static bucket');
  for (const prefix of PRIVATE_SITE_PREFIXES) assertPrivateSitePath(prefix, { prefix: true });
  for (const file of PRIVATE_SITE_FILES) assertPrivateSitePath(file);
  const destination = `s3://${bucket}/`;
  return [
    ...PRIVATE_SITE_PREFIXES.map((prefix) => ['s3', 'rm', `${destination}${prefix}`, '--recursive', '--only-show-errors']),
    ...PRIVATE_SITE_FILES.map((file) => ['s3', 'rm', `${destination}${file}`, '--only-show-errors'])
  ];
}
