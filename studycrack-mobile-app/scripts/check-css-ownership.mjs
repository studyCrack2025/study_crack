import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const styleRoot = path.join(appRoot, 'src/styles');
const bootstrapEntry = path.join(appRoot, 'src/runtime/main.js');
const appEntry = path.join(appRoot, 'src/app/screen-registry-app.js');
const expectedBootstrapStyles = new Set([
  'components/insights.css',
  'components/mbti-survey.css',
  'components/modals.css',
  'components/primitives.css',
  'components/secondary.css',
  'foundation/base.css',
  'foundation/motion.css',
  'foundation/shell.css',
  'foundation/tokens.css',
  'screens/auth-recovery.css',
  'screens/auth-signup.css',
  'screens/auth.css',
  'screens/locked-splash.css',
  'screens/onboarding.css'
]);
const expectedDeferredStyles = new Set([
  'components/streak-summary.css',
  'screens/product-guide.css',
  'components/aquarium-scene.css',
  'components/study-overview.css',
  'components/primary-screen-header.css',
  'components/my-summary.css',
  'components/navigation.css',
  'components/sheets.css',
  'screens/analysis-base.css',
  'screens/analysis-unified.css',
  'screens/analysis.css',
  'screens/aquarium.css',
  'screens/coaching.css',
  'screens/mypage-data.css',
  'screens/mypage-support.css',
  'screens/mypage.css',
  'screens/onboarding-results.css',
  'screens/planner-add.css',
  'screens/planner-calendar.css',
  'screens/planner.css',
  'screens/ranking.css',
  'screens/reports.css',
  'screens/score-input.css',
  'screens/service.css',
  'screens/timer.css'
]);

async function listCss(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listCss(target);
    return entry.name.endsWith('.css') ? [target] : [];
  }));
  return nested.flat();
}

function importedStyles(source) {
  return new Set([...source.matchAll(/import ['"]\.\.\/styles\/([^'"]+\.css)['"];?/g)].map((match) => match[1]));
}

function assertSameSet(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label} CSS ownership changed; move the file deliberately and update this contract`);
}

const [bootstrapSource, appSource, cssFiles] = await Promise.all([
  readFile(bootstrapEntry, 'utf8'),
  readFile(appEntry, 'utf8'),
  listCss(styleRoot)
]);
const bootstrapStyles = importedStyles(bootstrapSource);
const deferredStyles = importedStyles(appSource);
const allStyles = new Set(cssFiles.map((file) => path.relative(styleRoot, file).split(path.sep).join('/')));
const ownedStyles = new Set([...bootstrapStyles, ...deferredStyles]);

assertSameSet(bootstrapStyles, expectedBootstrapStyles, 'bootstrap');
assertSameSet(deferredStyles, expectedDeferredStyles, 'signed-in deferred');
assertSameSet(ownedStyles, allStyles, 'all modular');
for (const file of bootstrapStyles) assert.ok(!deferredStyles.has(file), `${file} must have exactly one CSS entry owner`);
assert.ok(![...allStyles].some((file) => file.startsWith('layout/')), 'retired layout CSS must not return');

console.log(`CSS ownership contracts passed: ${bootstrapStyles.size} bootstrap, ${deferredStyles.size} deferred, ${allStyles.size} total.`);
