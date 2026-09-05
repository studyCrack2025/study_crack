import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const appRoot = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(appRoot, 'package.json'));
const postcss = require('postcss');

export async function listAuditFiles(directory, matcher) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listAuditFiles(target, matcher) : matcher.test(entry.name) ? [target] : [];
  }));
  return nested.flat().sort();
}

export async function loadCSSAuditInputs() {
  const [cssFiles, sourceFiles] = await Promise.all([
    listAuditFiles(path.join(appRoot, 'src/styles'), /\.css$/),
    listAuditFiles(path.join(appRoot, 'src'), /\.(?:js|jsx)$/)
  ]);
  const readEntries = (files) => Promise.all(files.map(async (file) => [path.relative(appRoot, file).split(path.sep).join('/'), await readFile(file, 'utf8')]));
  const [styles, sources] = await Promise.all([readEntries(cssFiles), readEntries(sourceFiles)]);
  return { styles: Object.fromEntries(styles), sources: Object.fromEntries(sources) };
}

export function hasClassReference(sourceText, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-zA-Z0-9_-])${escaped}([^a-zA-Z0-9_-]|$)`).test(sourceText);
}

export function analyzeCSSUsage(css, sourceText, allowlist = {}) {
  const root = postcss.parse(css);
  const classNames = new Set();
  root.walkRules((rule) => {
    for (const match of rule.selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) classNames.add(match[1]);
  });
  for (const [className, reason] of Object.entries(allowlist)) {
    assert.ok(classNames.has(className), `stale CSS usage allowlist class: ${className}`);
    assert.ok(typeof reason === 'string' && reason.trim(), `CSS usage allowlist needs a reason: ${className}`);
    assert.ok(!hasClassReference(sourceText, className), `redundant CSS usage allowlist class: ${className}`);
  }
  const unreferenced = [...classNames].filter((className) => !hasClassReference(sourceText, className)).sort();
  const allowed = unreferenced.filter((className) => Object.hasOwn(allowlist, className));
  const candidates = unreferenced.filter((className) => !Object.hasOwn(allowlist, className));
  const rules = [];
  root.walkRules((rule) => {
    const selectors = postcss.list.comma(rule.selector);
    const candidateSelectors = selectors.filter((selector) => candidates.some((className) => hasClassReference(selector, className)));
    if (!candidateSelectors.length) return;
    rules.push({
      line: rule.source.start.line,
      selector: rule.selector,
      candidateSelectors,
      retainedSelectors: selectors.filter((selector) => !candidateSelectors.includes(selector))
    });
  });
  return { classCount: classNames.size, allowed, candidates, rules };
}

export function analyzeCSSCollection(styles, sourceText, allowlist = {}) {
  for (const owner of Object.keys(allowlist)) assert.ok(Object.hasOwn(styles, owner), `stale CSS usage allowlist owner: ${owner}`);
  return Object.fromEntries(Object.entries(styles).map(([owner, css]) => [owner, analyzeCSSUsage(css, sourceText, allowlist[owner])]));
}
