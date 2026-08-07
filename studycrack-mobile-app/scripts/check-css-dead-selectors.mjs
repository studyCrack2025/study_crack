import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CSS_USAGE_ALLOWLIST } from './css-usage-allowlist.mjs';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.join(appRoot, 'src');
const styleRoot = path.join(sourceRoot, 'styles');
const baselinePath = path.join(appRoot, 'fixtures/css-dead-selector-baseline.json');
const require = createRequire(path.join(appRoot, 'package.json'));
const postcss = require('postcss');

async function listFiles(directory, matcher) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target, matcher);
    return matcher.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const [cssFiles, sourceFiles, baselineSource] = await Promise.all([
  listFiles(styleRoot, /\.css$/),
  listFiles(sourceRoot, /\.(?:js|jsx)$/),
  readFile(baselinePath, 'utf8')
]);
const sourceText = (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join('\n');
const baseline = JSON.parse(baselineSource);
const actual = {};

for (const cssFile of cssFiles) {
  const relative = path.relative(appRoot, cssFile).split(path.sep).join('/');
  const cssRoot = postcss.parse(await readFile(cssFile, 'utf8'));
  const classNames = new Set();
  cssRoot.walkRules((rule) => {
    for (const match of rule.selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) classNames.add(match[1]);
  });
  const allowlist = CSS_USAGE_ALLOWLIST[relative] || {};
  const staleAllowlist = Object.keys(allowlist).filter((className) => !classNames.has(className));
  assert.deepEqual(staleAllowlist, [], `${relative} contains stale CSS usage allowlist entries`);
  const candidates = [...classNames].filter((className) => {
    if (allowlist[className]) return false;
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(`(^|[^a-zA-Z0-9_-])${escaped}([^a-zA-Z0-9_-]|$)`).test(sourceText);
  }).sort();
  if (candidates.length) actual[relative] = candidates;
}

assert.deepEqual(actual, baseline, 'CSS dead-selector baseline changed; remove confirmed debt or document deliberate dynamic usage');
const candidateCount = Object.values(actual).reduce((sum, candidates) => sum + candidates.length, 0);
console.log(`CSS dead-selector contract passed: ${cssFiles.length} files, ${candidateCount} existing candidates, 0 new candidates.`);
