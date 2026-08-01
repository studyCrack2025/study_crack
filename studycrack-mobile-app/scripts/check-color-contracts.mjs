import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const stylesRoot = path.join(appRoot, 'src/styles');

async function read(relativePath) {
  return readFile(path.join(appRoot, relativePath), 'utf8');
}

async function listCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listCssFiles(target);
    return entry.name.endsWith('.css') ? [target] : [];
  }));
  return nested.flat();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function countColorLiterals(source) {
  return (stripComments(source).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|oklch\([^)]*\)/gi) || []).length;
}

function relativeLuminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map((value) => parseInt(value, 16) / 255).map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

const contract = JSON.parse(await read('fixtures/ui-contract.json'));
const visual = contract.visualLanguage;
assert.ok(visual, 'visualLanguage contract is missing');

const tokenSource = await read('src/styles/foundation/tokens.css');
for (const [token, value] of Object.entries(visual.palette)) {
  assert.match(tokenSource, new RegExp(`${escapeRegExp(token)}:${escapeRegExp(value)}(?:;|})`, 'i'), `${token} must remain ${value}`);
}

const requiredConsumers = { ...visual.requiredCommonConsumers, ...visual.requiredScreenConsumers };
for (const [relativePath, tokens] of Object.entries(requiredConsumers)) {
  const source = await read(relativePath);
  for (const token of tokens) {
    assert.ok(source.includes(`var(${token})`), `${relativePath} must consume ${token}`);
  }
}

for (const [relativePath, guards] of Object.entries(visual.requiredOwnershipGuards)) {
  const source = await read(relativePath);
  for (const guard of guards) {
    assert.ok(source.includes(guard), `${relativePath} must preserve ${guard}`);
  }
}

for (const pair of visual.contrastPairs) {
  const ratio = contrastRatio(pair.foreground, pair.background);
  assert.ok(ratio >= pair.minimum, `${pair.foreground} on ${pair.background} contrast ${ratio.toFixed(2)} is below ${pair.minimum}`);
}

const cssFiles = await listCssFiles(stylesRoot);
const sources = await Promise.all(cssFiles.map(async (file) => ({ file, source: await readFile(file, 'utf8') })));
const screenColorLiterals = sources.filter(({ file }) => file.includes(`${path.sep}screens${path.sep}`)).reduce((total, { source }) => total + countColorLiterals(source), 0);
const componentColorLiterals = sources.filter(({ file }) => file.includes(`${path.sep}components${path.sep}`)).reduce((total, { source }) => total + countColorLiterals(source), 0);
const allStyles = sources.map(({ source }) => stripComments(source)).join('\n');
const legacyAliasReferences = (allStyles.match(/var\(--(?:primary|primary-dark|primary-soft)\)/g) || []).length;

assert.ok(screenColorLiterals <= visual.auditCeilings.screenColorLiterals, `Screen color literals increased: ${screenColorLiterals} > ${visual.auditCeilings.screenColorLiterals}`);
assert.ok(componentColorLiterals <= visual.auditCeilings.componentColorLiterals, `Component color literals increased: ${componentColorLiterals} > ${visual.auditCeilings.componentColorLiterals}`);
assert.ok(legacyAliasReferences <= visual.auditCeilings.legacyAliasReferences, `Legacy color aliases increased: ${legacyAliasReferences} > ${visual.auditCeilings.legacyAliasReferences}`);

console.log(`Color contract check passed: ${Object.keys(visual.palette).length} palette tokens, ${visual.contrastPairs.length} AA pairs, ${screenColorLiterals} screen literals, ${componentColorLiterals} component literals, ${legacyAliasReferences} legacy aliases.`);
