import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));

async function read(relativePath) {
  return readFile(new URL(relativePath, `file://${appRoot}/`), 'utf8');
}

function extractStringList(source, declarationName) {
  const match = source.match(new RegExp(`(?:export\\s+)?const\\s+${declarationName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${declarationName} declaration was not found`);
  return Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g), (item) => item[1]);
}

function extractTabKeys(source) {
  const match = source.match(/export\s+const\s+TAB_ITEMS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'TAB_ITEMS declaration was not found');
  return Array.from(match[1].matchAll(/key:\s*['"]([^'"]+)['"]/g), (item) => item[1]);
}

const [contractSource, assetsSource, registrySource, tabBarSource, accessPolicySource] = await Promise.all([
  read('fixtures/ui-contract.json'),
  read('src/constants/assets.js'),
  read('src/app/screen-registry.js'),
  read('src/components/tab-bar.js'),
  read('src/app/access-policy.js')
]);

const contract = JSON.parse(contractSource);
const screens = extractStringList(registrySource, 'MOBILE_SCREEN_RENDERER_NAMES');
const mainTabs = extractTabKeys(tabBarSource);

assert.equal(new Set(screens).size, screens.length, 'Screen registry contains duplicate names');
assert.deepEqual(screens, contract.screens, 'Screen registry does not match the 40-screen UI contract');
assert.deepEqual(mainTabs, contract.mainTabs, 'Bottom navigation does not match the five-tab UI contract');
assert.match(
  assetsSource,
  new RegExp(`export\\s+const\\s+${contract.brand.logoExport}\\s*=\\s*['"]${contract.brand.logoAsset.replaceAll('.', '\\.')}['"]`),
  'The official StudyCrack logo asset contract changed'
);
assert.match(
  assetsSource,
  new RegExp(`export\\s+const\\s+${contract.brand.onboardingLogoExport}\\s*=\\s*${contract.brand.logoExport}`),
  'Onboarding must use the official StudyCrack logo export'
);

const simulationFunction = accessPolicySource.match(/function\s+canUseScoreSimulation\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
assert.ok(simulationFunction, 'canUseScoreSimulation was not found');
assert.ok(!simulationFunction.includes("tier === 'trial'"), 'Trial must not bypass the paid analysis contract');
assert.deepEqual(
  Array.from(simulationFunction.matchAll(/['"](basic|starter|standard|pro)['"]/g), (item) => item[1]),
  contract.analysis.forwardTiers,
  'Forward score simulation tiers changed'
);
assert.match(accessPolicySource, /function\s+canUseReverseProjection[\s\S]*?canAccessTier\(state,\s*['"]standard['"]\)/, 'Reverse projection must start at Standard');

console.log(`UI contract check passed: ${screens.length} screens, ${mainTabs.length} tabs, official logo and plan tiers.`);
