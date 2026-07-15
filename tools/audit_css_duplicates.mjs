#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const topLimit = Number(process.env.TOP || 12);

function listCssFiles() {
  const output = execFileSync('rg', ['--files', '-g', '*.css'], { encoding: 'utf8' }).trim();
  return output ? output.split('\n').filter(Boolean) : [];
}

function normalizeSelector(selector) {
  return selector.trim().replace(/\s+/g, ' ');
}

function scanFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = new Map();
  const ruleRegex = /([^{}]+)\{/g;
  let match;

  while ((match = ruleRegex.exec(css))) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('@')) continue;

    for (const part of raw.split(',')) {
      const selector = normalizeSelector(part);
      if (!selector || selector.startsWith('@')) continue;
      if (['from', 'to', '0%', '50%', '100%'].includes(selector)) continue;
      selectors.set(selector, (selectors.get(selector) || 0) + 1);
    }
  }

  const duplicates = [...selectors.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return {
    file,
    bytes: Buffer.byteLength(source),
    lines: source.split(/\n/).length,
    uniqueSelectors: selectors.size,
    duplicatedSelectors: duplicates.length,
    duplicateHits: duplicates.reduce((total, [, count]) => total + count - 1, 0),
    importantCount: (source.match(/!important/g) || []).length,
    mediaCount: (source.match(/@media/g) || []).length,
    topDuplicates: duplicates.slice(0, topLimit).map(([selector, count]) => ({ selector, count })),
    selectorSet: new Set(selectors.keys()),
  };
}

function buildCrossFileReport(results) {
  const owners = new Map();
  for (const result of results) {
    for (const selector of result.selectorSet) {
      if (!owners.has(selector)) owners.set(selector, []);
      owners.get(selector).push(result.file);
    }
  }

  return [...owners.entries()]
    .filter(([, files]) => files.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, topLimit)
    .map(([selector, files]) => ({ selector, files }));
}

const files = listCssFiles();
const results = files.map(scanFile).sort((a, b) => b.duplicateHits - a.duplicateHits);
const crossFile = buildCrossFileReport(results);

if (asJson) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    files: results.map(({ selectorSet, ...result }) => result),
    crossFile,
  }, null, 2));
} else {
  for (const result of results) {
    console.log(`${result.file} | lines=${result.lines} | kb=${Math.round(result.bytes / 1024)} | dupSelectors=${result.duplicatedSelectors} | dupHits=${result.duplicateHits} | important=${result.importantCount} | media=${result.mediaCount}`);
    if (result.topDuplicates.length) {
      console.log(`  top: ${result.topDuplicates.map(({ selector, count }) => `${count} ${selector}`).join(' || ')}`);
    }
  }

  console.log(`\nCross-file selectors: ${crossFile.length}+ shown`);
  for (const item of crossFile) {
    console.log(`  ${item.files.length} | ${item.selector} | ${item.files.join(', ')}`);
  }
}
