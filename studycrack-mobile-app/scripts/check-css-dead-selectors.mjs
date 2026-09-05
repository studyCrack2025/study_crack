import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CSS_USAGE_ALLOWLIST } from './css-usage-allowlist.mjs';
import { analyzeCSSCollection, loadCSSAuditInputs } from './css-usage-analysis.mjs';

const { styles, sources } = await loadCSSAuditInputs();
const audit = analyzeCSSCollection(styles, Object.values(sources).join('\n'), CSS_USAGE_ALLOWLIST);
const baseline = JSON.parse(await readFile(new URL('../fixtures/css-dead-selector-baseline.json', import.meta.url), 'utf8'));
const actual = Object.fromEntries(Object.entries(audit).filter(([, entry]) => entry.candidates.length).map(([owner, entry]) => [owner, entry.candidates]));
assert.deepEqual(actual, baseline, 'CSS dead-selector baseline changed; remove confirmed debt or document deliberate dynamic usage');
const count = Object.values(actual).reduce((sum, candidates) => sum + candidates.length, 0);
console.log(`CSS dead-selector contract passed: ${Object.keys(styles).length} files, ${count} existing candidates, 0 new candidates.`);
