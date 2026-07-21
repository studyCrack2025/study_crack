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

function extractClasses(source) {
  const classes = new Set();
  const patterns = [
    /class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g,
    /class(?:Name)?\s*=\s*\{\s*["'`]([^"'`]+)["'`]\s*\}/g,
    /class(?:Name)?\s*=\s*\{\s*`([^`]+)`\s*\}/g,
    /class\s*=\s*\\?["']([^"']+)\\?["']/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      match[1].split(/\s+/).forEach((token) => {
        if (/[${}()]/.test(token)) return;
        const normalized = token.replace(/[^a-zA-Z0-9_-].*$/, '');
        if (/^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(normalized)) classes.add(normalized);
      });
    }
  }
  return classes;
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
const usage = new Map();

for (const path of sourceFiles) {
  const classes = extractClasses(readFileSync(path, 'utf8'));
  for (const className of classes) {
    const paths = usage.get(className) || [];
    paths.push(relative(ROOT, path));
    usage.set(className, paths);
  }
}

const rows = [...usage.entries()].map(([className, paths]) => ({
  className,
  paths,
  current: hasSelector(currentCss, className),
  baseline: hasSelector(baselineCss, className),
  destination: destination(className)
}));
const missing = rows.filter((row) => !row.current);
const recoverable = missing.filter((row) => row.baseline);
const report = {
  baseline: BASELINE,
  sourceClassCount: rows.length,
  currentMissingCount: missing.length,
  baselineRecoverableCount: recoverable.length,
  missing,
  recoverable
};

const rulesArgIndex = process.argv.indexOf('--rules');
if (rulesArgIndex >= 0) {
  const postcss = require('postcss');
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
  console.log(`present in baseline only: ${recoverable.length}`);
  for (const row of recoverable) {
    console.log(`\n${row.className}`);
    console.log(`  used: ${row.paths.join(', ')}`);
    console.log(`  destination: ${row.destination}`);
  }
}
