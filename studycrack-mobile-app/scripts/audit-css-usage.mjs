import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CSS_USAGE_ALLOWLIST } from './css-usage-allowlist.mjs';
import { analyzeCSSUsage, appRoot, loadCSSAuditInputs } from './css-usage-analysis.mjs';

const targetArg = process.argv[2];
if (!targetArg) {
  console.error('Usage: node scripts/audit-css-usage.mjs <css-file> [--rules] [--fail]');
  process.exit(1);
}
const targetPath = path.resolve(appRoot, targetArg);
const owner = path.relative(appRoot, targetPath).split(path.sep).join('/');
const { sources } = await loadCSSAuditInputs();
const allowlist = CSS_USAGE_ALLOWLIST[owner] || {};
const audit = analyzeCSSUsage(await readFile(targetPath, 'utf8'), Object.values(sources).join('\n'), allowlist);
console.log(`${owner}: ${audit.classCount} classes, ${audit.allowed.length} allowlisted, ${audit.candidates.length} source-unreferenced candidates`);
for (const className of audit.allowed) console.log(`allow ${className}: ${allowlist[className]}`);
for (const className of audit.candidates) console.log(className);
if (process.argv.includes('--rules')) {
  console.log('\nCandidate rules (not deletion approval):');
  for (const rule of audit.rules) {
    console.log(`${rule.line}: ${rule.selector}`);
    if (rule.retainedSelectors.length) console.log(`  retain grouped selectors: ${rule.retainedSelectors.join(', ')}`);
  }
}
if (process.argv.includes('--fail') && audit.candidates.length > 0) process.exitCode = 1;
