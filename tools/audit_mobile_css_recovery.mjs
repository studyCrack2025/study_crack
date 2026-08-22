import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const APP_ROOT = join(ROOT, 'studycrack-mobile-app');
const STYLE_ROOT = join(APP_ROOT, 'src/styles');
const ENTRY_PATH = join(APP_ROOT, 'src/runtime/main.js');
const REMOVED_STYLE_FILES = [
  'design-v2.css',
  'layout/mobile-bridge.css',
  'layout/mobile-layout-system.css'
];
const CONTRACTS = [
  { file: 'foundation/shell.css', selector: '.app-frame', properties: ['width', 'min-width', 'max-width', 'height', 'display', 'overflow'], values: { display: ['flex'] } },
  { file: 'foundation/shell.css', selector: '.app-content', properties: ['width', 'min-width', 'max-width', 'height', 'box-sizing', 'position', 'padding-bottom'] },
  { file: 'components/primitives.css', selector: '.card', properties: ['width', 'min-width', 'box-sizing', 'padding', 'border', 'border-radius', 'background'], allowedFiles: ['components/primitives.css', 'foundation/motion.css'] },
  { file: 'components/primitives.css', selector: '.btn', properties: ['width', 'min-width', 'min-height', 'display', 'align-items', 'justify-content', 'padding'], values: { display: ['inline-flex'] }, allowedFiles: ['components/primitives.css', 'foundation/motion.css'] },
  { file: 'components/primitives.css', selector: '.planner-input', properties: ['width', 'min-width', 'min-height', 'box-sizing', 'padding', 'border', 'font-size'], allowedFiles: ['components/primitives.css', 'foundation/motion.css'] },
  { file: 'components/primitives.css', selector: '.mobile-card-stack', properties: ['width', 'min-width', 'display', 'gap'], values: { display: ['grid'] } },
  { file: 'components/secondary.css', selector: '.sc-secondary-page', properties: ['width', 'min-width', 'display', 'gap', 'box-sizing', 'padding'], values: { display: ['grid'] } },
  { file: 'components/modals.css', selector: '.sc-overlay', properties: ['position', 'width', 'height', 'display', 'overflow', 'background'], values: { position: ['absolute'], display: ['flex'] }, allowedFiles: ['components/modals.css', 'foundation/motion.css'] },
  { file: 'components/modals.css', selector: '.sc-modal', properties: ['position', 'width', 'max-width', 'max-height', 'display', 'box-sizing', 'overflow'], values: { position: ['relative'], display: ['flex'] }, allowedFiles: ['components/modals.css', 'foundation/motion.css'] },
  { file: 'components/navigation.css', selector: '.tabbar', properties: ['position', 'height', 'display', 'grid-template-columns', 'padding', 'z-index'], values: { position: ['absolute'], display: ['grid'] } },
  { file: 'screens/auth.css', selector: '.auth-unified-card', properties: ['width', 'max-width', 'min-width', 'display', 'gap', 'padding'], values: { display: ['grid'] } },
  { file: 'screens/auth.css', selector: '.auth-sso-btn', properties: ['width', 'min-width', 'min-height', 'display', 'grid-template-columns', 'align-items', 'padding'], values: { display: ['grid'] } },
  { file: 'screens/auth-recovery.css', selector: '.find-email-modal.auth-recovery-modal', properties: ['width', 'max-height', 'display', 'grid-template-rows', 'box-sizing', 'overflow'], values: { display: ['grid'] } },
  { file: 'screens/analysis-unified.css', selector: '.analysis-loading-stage', properties: ['min-height', 'display', 'place-items', 'padding'], values: { display: ['grid'] } },
  { file: 'screens/analysis-unified.css', selector: '.analysis-result-card', properties: ['display', 'gap', 'padding', 'overflow'], values: { display: ['grid'] } },
  { file: 'screens/planner.css', selector: '.planner-plan-list', properties: ['display', 'gap', 'padding-bottom'], values: { display: ['grid'] } },
  { file: 'screens/mypage.css', selector: '.my-page', properties: ['width', 'min-width', 'max-width', 'display', 'gap', 'padding', 'box-sizing'], values: { display: ['grid'] }, allowedFiles: ['screens/mypage.css', 'foundation/motion.css'] },
  { file: 'screens/mypage-data.css', selector: '.account-marketing-row .notify-switch', properties: ['position', 'width', 'height', 'padding', 'border-radius'] }
];

const require = createRequire(join(APP_ROOT, 'package.json'));
const postcss = require('postcss');

function walk(dir, extensions) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? walk(path, extensions)
      : extensions.has(extname(path)) ? [path] : [];
  });
}

function relativeStylePath(path) {
  return relative(STYLE_ROOT, path).split('\\').join('/');
}

function ruleIncludesSelector(rule, selector) {
  return rule.selectors.some((candidate) => candidate.trim() === selector);
}

const cssFiles = walk(STYLE_ROOT, new Set(['.css']));
const roots = new Map(cssFiles.map((path) => [relativeStylePath(path), postcss.parse(readFileSync(path, 'utf8'), { from: path })]));

function collectDeclarations(root, selector) {
  const declarations = new Map();
  root?.walkRules((rule) => {
    if (!ruleIncludesSelector(rule, selector)) return;
    rule.walkDecls((decl) => declarations.set(decl.prop, decl.value));
  });
  return declarations;
}

function selectorOwners(selector) {
  const owners = [];
  for (const [file, root] of roots) {
    let found = false;
    root.walkRules((rule) => {
      if (ruleIncludesSelector(rule, selector)) found = true;
    });
    if (found) owners.push(file);
  }
  return owners;
}

const contractResults = CONTRACTS.map((contract) => {
  const declarations = collectDeclarations(roots.get(contract.file), contract.selector);
  const owners = selectorOwners(contract.selector);
  const allowedFiles = new Set(contract.allowedFiles || [contract.file]);
  const unexpectedOwners = owners.filter((file) => !allowedFiles.has(file));
  const missingProperties = contract.properties.filter((property) => !declarations.has(property));
  const invalidValues = Object.entries(contract.values || {}).flatMap(([property, allowed]) => {
    const value = declarations.get(property);
    return value && !allowed.includes(value) ? [{ property, value, allowed }] : [];
  });
  return {
    file: contract.file,
    selector: contract.selector,
    owners,
    unexpectedOwners,
    missingProperties,
    invalidValues,
    valid: owners.includes(contract.file) && unexpectedOwners.length === 0 && missingProperties.length === 0 && invalidValues.length === 0
  };
});

const entrySource = readFileSync(ENTRY_PATH, 'utf8');
const removedStyleFailures = REMOVED_STYLE_FILES.flatMap((file) => {
  const failures = [];
  if (existsSync(join(STYLE_ROOT, file))) failures.push(`${file}: retired file still exists`);
  if (entrySource.includes(file)) failures.push(`${file}: runtime entry still imports retired file`);
  return failures;
});
const contractFailures = contractResults.filter((result) => !result.valid);
const report = {
  contractCount: CONTRACTS.length,
  contractFailureCount: contractFailures.length,
  removedStyleFailureCount: removedStyleFailures.length,
  removedStyleFailures,
  contracts: contractResults
};

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(`current CSS ownership/property contracts: ${CONTRACTS.length}`);
  console.log(`contract failures: ${contractFailures.length}`);
  console.log(`retired style failures: ${removedStyleFailures.length}`);
  for (const failure of removedStyleFailures) console.log(`\n${failure}`);
  for (const contract of contractFailures) {
    console.log(`\n${contract.selector} (${contract.file})`);
    if (!contract.owners.includes(contract.file)) console.log('  selector missing from owner file');
    if (contract.unexpectedOwners.length) console.log(`  unexpected owners: ${contract.unexpectedOwners.join(', ')}`);
    if (contract.missingProperties.length) console.log(`  missing properties: ${contract.missingProperties.join(', ')}`);
    for (const invalid of contract.invalidValues) {
      console.log(`  invalid ${invalid.property}: ${invalid.value} (expected ${invalid.allowed.join(' or ')})`);
    }
  }
}

if (contractFailures.length > 0 || removedStyleFailures.length > 0) process.exitCode = 1;
