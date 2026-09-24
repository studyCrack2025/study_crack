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

const [contractSource, assetsSource, registrySource, tabBarSource, accessPolicySource, navigationStyles, motionStyles, shellStyles, timerSource, timerStyles] = await Promise.all([
  read('fixtures/ui-contract.json'),
  read('src/constants/assets.js'),
  read('src/app/screen-registry.js'),
  read('src/components/TabBar.jsx'),
  read('src/app/access-policy.js'),
  read('src/styles/components/navigation.css'),
  read('src/styles/foundation/motion.css'),
  read('src/styles/foundation/shell.css'),
  read('src/screens/timer/HomeDashboard.jsx'),
  read('src/styles/screens/timer.css')
]);

const contract = JSON.parse(contractSource);
const screens = extractStringList(registrySource, 'MOBILE_SCREEN_NAMES');
const mainTabs = extractTabKeys(tabBarSource);

assert.equal(new Set(screens).size, screens.length, 'Screen registry contains duplicate names');
assert.deepEqual(screens, contract.screens, 'Screen registry does not match the 40-screen UI contract');
assert.deepEqual(mainTabs, contract.mainTabs, 'Bottom navigation does not match the five-tab UI contract');
assert.match(tabBarSource, /\{ key: 'timer', label: '홈', icon: 'home' \}/, 'The timer route must be presented as the Home tab');
assert.match(tabBarSource, /className="tabbar-icon"/, 'Bottom navigation icons need a stable visual wrapper');
assert.match(tabBarSource, /item\.key === 'aquarium'/, 'The center aquarium action must remain visually distinct');
assert.match(navigationStyles, /\.tabbar button\{[^}]*justify-content:center/, 'Normal bottom navigation items must center the icon and label as one group');
assert.match(navigationStyles, /\.tabbar button\.is-aquarium\{[^}]*justify-content:flex-end/, 'The raised aquarium action must keep its dedicated geometry');
assert.match(motionStyles, /\.app-screen\[data-screen\]\{animation:mobileScreenEnter/, 'Every registered app screen must share the screen-enter motion');
assert.match(shellStyles, /\.app-content\{[^}]*overflow-y:auto/, 'The app content element must remain the explicit vertical scroll owner');
assert.match(timerSource, /user\?\.profileImage/, 'The Home profile shortcut must use the loaded profile image');
assert.match(timerSource, /onError=\{\(\) => setImageFailed\(true\)\}/, 'The Home profile image must fall back safely when loading fails');
assert.match(timerStyles, /\.timer-v2-profile > img\{[^}]*object-fit:cover/, 'The Home profile image must fill the circular shortcut');
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
const reverseFunction = accessPolicySource.match(/function\s+canUseReverseProjection\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
assert.ok(reverseFunction, 'canUseReverseProjection was not found');
assert.match(reverseFunction, /pickActiveAccessSubscription/, 'Reverse projection must require an active subscription');
assert.deepEqual(
  Array.from(reverseFunction.matchAll(/['"](standard|pro)['"]/g), (item) => item[1]),
  contract.analysis.reverseTiers,
  'Reverse projection tiers changed'
);

console.log(`UI contract check passed: ${screens.length} screens, ${mainTabs.length} tabs, official logo and plan tiers.`);
