import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE_ROOT = join(ROOT, 'studycrack-mobile-app/src');
const STYLE_ROOT = join(SOURCE_ROOT, 'styles');
const BASELINE = '4ffbfef1e4598c6cda3ca124b5ece7834917694c';
const BASELINE_CSS = [
  'studycrack-mobile-app/src/styles/design-v2.css',
  'css/studycrack-mobile.css'
];
const INTENTIONALLY_UNSTYLED = new Map([
  ['mbti-survey-q', 'Question wrapper; child survey blocks own the layout.'],
  ['analysis-result-stage', 'React bridge uses inline display:contents.'],
  ['profile-photo-pick-text', 'Text inherits the styled profile-photo-pick label.'],
  ['ob5-after-eta', 'Semantic onboarding result group; child cards own the layout.'],
  ['planner-detail-groups', 'Semantic group wrapper; planner-detail-group owns visibility and layout.']
]);
const PROPERTY_CONTRACTS = [
  { selector: '.card', properties: ['min-width', 'box-sizing'] },
  { selector: '.planner-input', properties: ['width', 'min-width', 'min-height', 'box-sizing', 'padding', 'border'] },
  { selector: '.planner-title-card .top-card-head', properties: ['display', 'grid-template-columns', 'gap', 'align-items'], values: { display: ['grid'] } },
  { selector: '.top-infographic', properties: ['display', 'align-items', 'justify-content', 'padding'], values: { display: ['flex'] } },
  { selector: '.top-infographic i', properties: ['display', 'width', 'background'] },
  { selector: '.auth-unified-card', properties: ['display', 'gap'], values: { display: ['grid'] } },
  { selector: '.auth-sso-btn', properties: ['display', 'grid-template-columns', 'align-items', 'padding'], values: { display: ['grid'] } },
  { selector: '.find-email-modal.auth-recovery-modal', properties: ['display', 'gap', 'box-sizing'], values: { display: ['grid'] } },
  { selector: '.account-marketing-row .notify-switch', properties: ['position', 'width', 'height', 'padding'] },
  { selector: '.planner-premium-cta', properties: ['display', 'gap', 'overflow'], values: { display: ['grid'] } },
  { selector: '.planner-premium-copy', properties: ['display', 'gap'], values: { display: ['grid'] } },
  { selector: '.planner-plan-list', properties: ['display', 'gap'], values: { display: ['grid'] } },
  { selector: '.home-report-preview-grid', properties: ['display', 'grid-template-columns', 'gap'], values: { display: ['grid'] } },
  { selector: '.mobile-card-stack', properties: ['width', 'min-width', 'display', 'gap'], values: { display: ['grid'] } },
  { selector: '.analysis-title', properties: ['margin'], values: { margin: ['0'] } },
  { selector: '.sub', properties: ['margin'], values: { margin: ['0'] } },
  { selector: '.home-section-last', properties: ['display', 'gap', 'margin'], values: { display: ['grid'], margin: ['0'] } },
  { selector: '.kpi-row.score-row', properties: ['display', 'grid-template-columns', 'gap'], values: { display: ['grid'] } },
  { selector: '.kpi-row.score-row .kpi-item', properties: ['min-width', 'display', 'gap', 'padding', 'text-align'], values: { display: ['grid'] } },
  { selector: '.kpi-row.score-row .kpi-item b', properties: ['display', 'width', 'min-width'], values: { display: ['block'] } }
];
const require = createRequire(join(ROOT, 'studycrack-mobile-app/package.json'));

function walk(dir, extensions) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? walk(path, extensions)
      : extensions.has(extname(path)) ? [path] : [];
  });
}

function readBaseline(path) {
  return execFileSync('git', ['show', `${BASELINE}:${path}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
}

function stripTemplateExpressions(value) {
  let result = '';
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    if (depth === 0 && char === '$' && next === '{') {
      depth = 1;
      index += 1;
      continue;
    }
    if (depth > 0) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      continue;
    }
    result += char;
  }
  return result;
}

function extractClassGroups(source) {
  const groups = [];
  const patterns = [
    /class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g,
    /class(?:Name)?\s*=\s*\{\s*["'`]([^"'`]+)["'`]\s*\}/g,
    /class(?:Name)?\s*=\s*\{\s*`([^`]+)`\s*\}/g,
    /class\s*=\s*\\?["']([^"']+)\\?["']/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const classes = new Set();
      stripTemplateExpressions(match[1]).split(/\s+/).forEach((token) => {
        if (/[${}()]/.test(token)) return;
        const normalized = token.replace(/[^a-zA-Z0-9_-].*$/, '');
        if (normalized.endsWith('-')) return;
        if (/^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(normalized)) classes.add(normalized);
      });
      if (classes.size) groups.push(classes);
    }
  }
  return groups;
}

function hasSelector(css, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\.${escaped}(?![a-zA-Z0-9_-])`).test(css);
}

function destination(className) {
  if (/^(appbar|back-btn|title)$/.test(className)) return 'components/navigation.css';
  if (/(modal|backdrop|overlay)/.test(className)) return 'components/modals.css';
  if (/(sheet)/.test(className)) return 'components/sheets.css';
  if (/(drawer)/.test(className)) return 'components/drawers.css';
  if (/^(auth|signup|find-email|reset-password)/.test(className)) return 'screens/auth*.css';
  if (/^(onboarding|ob-|cta-|loading-overlay)/.test(className)) return 'screens/onboarding.css';
  if (/^(planner)/.test(className)) return 'screens/planner*.css';
  if (/^(coach|weekly|report)/.test(className)) return 'screens/coaching-or-reports.css';
  if (/^(analysis|add-univ)/.test(className)) return 'screens/analysis*.css';
  if (/^(payment|plan-|pro-)/.test(className)) return 'screens/service.css';
  if (/^(my-|profile|score-|qna|noti)/.test(className)) return 'screens/mypage*.css';
  return 'components/primitives.css';
}

const sourceFiles = walk(SOURCE_ROOT, new Set(['.js', '.jsx']));
const cssFiles = walk(STYLE_ROOT, new Set(['.css']));
const currentCss = cssFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
const baselineCss = BASELINE_CSS.map(readBaseline).join('\n');
const postcss = require('postcss');
const currentCssRoot = postcss.parse(currentCss);
const usage = new Map();
const companionCoverage = new Map();

for (const path of sourceFiles) {
  const classGroups = extractClassGroups(readFileSync(path, 'utf8'));
  for (const classes of classGroups) {
    for (const className of classes) {
      const paths = usage.get(className) || [];
      paths.push(relative(ROOT, path));
      usage.set(className, paths);
      const companions = companionCoverage.get(className) || new Set();
      for (const companion of classes) {
        if (companion !== className && hasSelector(currentCss, companion)) companions.add(companion);
      }
      companionCoverage.set(className, companions);
    }
  }
}

const rows = [...usage.entries()].map(([className, paths]) => ({
  className,
  paths,
  current: hasSelector(currentCss, className),
  baseline: hasSelector(baselineCss, className),
  coveredBy: [...(companionCoverage.get(className) || [])],
  destination: destination(className)
}));
const missing = rows.filter((row) => !row.current);
const uncovered = missing.filter((row) => row.coveredBy.length === 0);
const intentional = uncovered
  .filter((row) => INTENTIONALLY_UNSTYLED.has(row.className))
  .map((row) => ({ ...row, reason: INTENTIONALLY_UNSTYLED.get(row.className) }));
const actionable = uncovered.filter((row) => !INTENTIONALLY_UNSTYLED.has(row.className));
const recoverable = missing.filter((row) => row.baseline);
const propertyContracts = PROPERTY_CONTRACTS.map((contract) => {
  const declarations = new Map();
  currentCssRoot.walkRules((rule) => {
    const selectors = rule.selector.split(',').map((selector) => selector.trim());
    if (!selectors.includes(contract.selector)) return;
    rule.walkDecls((decl) => declarations.set(decl.prop, decl.value));
  });
  const missingProperties = contract.properties.filter((property) => !declarations.has(property));
  const invalidValues = Object.entries(contract.values || {}).flatMap(([property, allowed]) => {
    const value = declarations.get(property);
    return value && !allowed.includes(value) ? [{ property, value, allowed }] : [];
  });
  return {
    selector: contract.selector,
    declarations: Object.fromEntries(declarations),
    missingProperties,
    invalidValues,
    valid: missingProperties.length === 0 && invalidValues.length === 0
  };
});
const propertyContractFailures = propertyContracts.filter((contract) => !contract.valid);
const report = {
  baseline: BASELINE,
  sourceClassCount: rows.length,
  currentMissingCount: missing.length,
  currentUncoveredCount: uncovered.length,
  currentActionableCount: actionable.length,
  baselineRecoverableCount: recoverable.length,
  missing,
  uncovered,
  intentional,
  actionable,
  recoverable,
  propertyContracts,
  propertyContractFailureCount: propertyContractFailures.length
};

const rulesArgIndex = process.argv.indexOf('--rules');
if (rulesArgIndex >= 0) {
  const destinationFilter = process.argv[rulesArgIndex + 1] || '';
  const targetClasses = new Set(recoverable
    .filter((row) => !destinationFilter || row.destination === destinationFilter)
    .map((row) => row.className));
  const root = postcss.parse(baselineCss);
  const emitted = new Set();
  root.walkRules((rule) => {
    const relevant = [...targetClasses].some((className) => hasSelector(rule.selector, className));
    if (!relevant) return;
    const text = rule.parent?.type === 'atrule'
      ? `@${rule.parent.name} ${rule.parent.params}{${rule.toString()}}`
      : rule.toString();
    if (!emitted.has(text)) {
      emitted.add(text);
      console.log(text);
    }
  });
} else if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(`baseline: ${BASELINE}`);
  console.log(`source classes: ${rows.length}`);
  console.log(`missing in current CSS: ${missing.length}`);
  console.log(`missing without styled companion: ${uncovered.length}`);
  console.log(`actionable missing selectors: ${actionable.length}`);
  console.log(`present in baseline only: ${recoverable.length}`);
  console.log(`property contract failures: ${propertyContractFailures.length}`);
  for (const contract of propertyContractFailures) {
    console.log(`\n${contract.selector}`);
    if (contract.missingProperties.length) console.log(`  missing properties: ${contract.missingProperties.join(', ')}`);
    for (const invalid of contract.invalidValues) {
      console.log(`  invalid ${invalid.property}: ${invalid.value} (expected ${invalid.allowed.join(' or ')})`);
    }
  }
  for (const row of recoverable) {
    console.log(`\n${row.className}`);
    console.log(`  used: ${row.paths.join(', ')}`);
    console.log(`  destination: ${row.destination}`);
  }
}

if (rulesArgIndex < 0 && propertyContractFailures.length > 0) process.exitCode = 1;
