import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeCSSCollection, appRoot, hasClassReference, listAuditFiles, loadCSSAuditInputs } from './css-usage-analysis.mjs';
import { CSS_USAGE_ALLOWLIST } from './css-usage-allowlist.mjs';

const { styles, sources } = await loadCSSAuditInputs();
const sourceText = Object.values(sources).join('\n');
const audit = analyzeCSSCollection(styles, sourceText, CSS_USAGE_ALLOWLIST);
const terms = {
  compatibility: /\bhome\b/g,
  homeGesture: /\b(?:homeSlideIndex|homeSlideMotion|homeDragOffset|getHomeSliderState|setHomeSlideDom|waitAndSyncHomeSliderDom)\b|home-kpi-[a-z-]+/g,
  sharedTargetData: /\b(?:homeTargetList|homeTargets)\b/g,
  storageMigration: /\b(?:LEGACY_PLANNER_YEAR_MONTH|activeTab)\b|pl-legacy-|pl-default-/g,
  assetAlias: /\b(?:ONBOARDING_LOGO_SRC|STUDYCRACK_LOGO_SRC|CRACKY_SRC|CRACKY_HI_SRC)\b/g
};
const references = Object.fromEntries(Object.entries(terms).map(([group, expression]) => [group,
  Object.entries(sources).flatMap(([owner, source]) => source.split('\n').flatMap((line, index) => {
    const matches = [...line.matchAll(expression)].map((match) => match[0]);
    return matches.length ? [{ owner, line: index + 1, terms: [...new Set(matches)] }] : [];
  }))
]));
const entry = await readFile(path.join(appRoot, '../studycrack-mobile.html'), 'utf8');
const shellSources = [entry];
for (const match of entry.matchAll(/<script\b[^>]*src="\.\/(js\/[^"?#]+\.js)(?:\?[^"#]*)?"/g)) {
  shellSources.push(await readFile(path.join(appRoot, '..', match[1]), 'utf8'));
}
const bundleFiles = await listAuditFiles(path.join(appRoot, 'dist'), /\.(?:js|css)$/);
const bundle = await Promise.all(bundleFiles.map(async (file) => ({ owner: path.relative(appRoot, file), text: await readFile(file, 'utf8') })));
const cssCandidates = Object.fromEntries(Object.entries(audit).filter(([, result]) => result.candidates.length).map(([owner, result]) => [owner, {
  classes: result.candidates.map((name) => ({
    name,
    shellReference: shellSources.some((source) => hasClassReference(source, name)),
    bundleJavaScriptReference: bundle.some((file) => file.owner.endsWith('.js') && hasClassReference(file.text, name)),
    bundleCSSReference: bundle.some((file) => file.owner.endsWith('.css') && hasClassReference(file.text, name))
  })),
  rules: result.rules
}]));
console.log(JSON.stringify({
  status: 'audit-only; not deletion approval',
  prerequisites: ['Review dynamic classes and mixed selectors', 'Pass compatibility and full browser tests', 'Verify dev smoke and legacy usage evidence', 'Keep a separately revertible deletion commit'],
  counts: {
    sourceModules: Object.keys(sources).length,
    cssOwners: Object.keys(styles).length,
    cssCandidates: Object.values(audit).reduce((sum, result) => sum + result.candidates.length, 0),
    mixedRules: Object.values(audit).reduce((sum, result) => sum + result.rules.filter((rule) => rule.retainedSelectors.length).length, 0)
  },
  references,
  cssCandidates
}, null, 2));
