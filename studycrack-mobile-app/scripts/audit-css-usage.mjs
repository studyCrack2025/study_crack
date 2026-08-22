import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CSS_USAGE_ALLOWLIST } from './css-usage-allowlist.mjs';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.join(appRoot, 'src');
const targetArg = process.argv[2];

if (!targetArg) {
  console.error('Usage: node scripts/audit-css-usage.mjs <css-file> [--rules] [--fail]');
  process.exit(1);
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(target);
    return /\.(?:js|jsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const targetPath = path.resolve(appRoot, targetArg);
const targetRelativePath = path.relative(appRoot, targetPath).split(path.sep).join('/');
const require = createRequire(path.join(appRoot, 'package.json'));
const postcss = require('postcss');
const cssRoot = postcss.parse(await readFile(targetPath, 'utf8'));
const classNames = new Set();

cssRoot.walkRules((rule) => {
  for (const match of rule.selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
    classNames.add(match[1]);
  }
});

const sourceFiles = await listSourceFiles(sourceRoot);
const sourceText = (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join('\n');
const allowlist = CSS_USAGE_ALLOWLIST[targetRelativePath] || {};
const invalidAllowlist = Object.keys(allowlist).filter((className) => !classNames.has(className));
if (invalidAllowlist.length) {
  console.error(`${targetRelativePath}: allowlist contains undefined classes: ${invalidAllowlist.join(', ')}`);
  process.exit(1);
}
const sourceUnreferenced = [...classNames].filter((className) => {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !new RegExp(`(^|[^a-zA-Z0-9_-])${escaped}([^a-zA-Z0-9_-]|$)`).test(sourceText);
}).sort();
const allowed = sourceUnreferenced.filter((className) => allowlist[className]);
const candidates = sourceUnreferenced.filter((className) => !allowlist[className]);

console.log(`${targetRelativePath}: ${classNames.size} classes, ${allowed.length} allowlisted, ${candidates.length} source-unreferenced candidates`);
for (const className of allowed) console.log(`allow ${className}: ${allowlist[className]}`);
for (const className of candidates) console.log(className);

if (process.argv.includes('--rules')) {
  const candidateSet = new Set(candidates);
  console.log('\nCandidate rules:');
  cssRoot.walkRules((rule) => {
    const ruleClasses = [...rule.selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]);
    if (ruleClasses.some((className) => candidateSet.has(className))) console.log(rule.selector);
  });
}

if (process.argv.includes('--fail') && candidates.length > 0) process.exitCode = 1;
