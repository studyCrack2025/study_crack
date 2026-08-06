import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  canAccessTier,
  canUseReverseProjection,
  canUseScoreSimulation,
  filterTabItemsForTier,
  resolveScreenAccess
} from '../src/app/access-policy.js';

const mainSource = await readFile(new URL('../src/runtime/main.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../src/app/MobileApp.js', import.meta.url), 'utf8');
const apiControllerSource = await readFile(new URL('../src/app/use-mobile-api-controller.js', import.meta.url), 'utf8');
const resourceOrchestratorSource = await readFile(new URL('../src/app/use-mobile-resource-orchestrator.js', import.meta.url), 'utf8');
const viewContextSource = await readFile(new URL('../src/app/mobile-view-context.js', import.meta.url), 'utf8');
const effectsSource = await readFile(new URL('../src/app/use-mobile-app-effects.js', import.meta.url), 'utf8');
const routingSource = await readFile(new URL('../src/app/mobile-routing.js', import.meta.url), 'utf8');
const accessSource = await readFile(new URL('../src/app/access-policy.js', import.meta.url), 'utf8');
const runtimeAdapterSource = await readFile(new URL('../src/shared/browser/mobile-runtime.js', import.meta.url), 'utf8');

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = new URL(entry.name, directory.href.endsWith('/') ? directory : new URL(`${directory.href}/`));
    if (entry.isDirectory()) return listJavaScriptFiles(new URL(`${target.href}/`));
    return /\.(?:js|jsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const bootstrapLines = mainSource.split('\n').length;
const appLines = appSource.split('\n').length;
assert.ok(bootstrapLines <= 60, 'runtime/main.js bootstrap은 60줄을 넘을 수 없습니다.');
assert.ok(bootstrapLines + appLines <= 350, 'MobileApp과 bootstrap 합계는 350줄을 넘을 수 없습니다.');
assert.doesNotMatch(mainSource, /\bwindow\b|\bdocument\b|\blocalStorage\b/);
assert.doesNotMatch(mainSource, /const\s+(?:PLAN_RANK|SCREEN_REQUIREMENTS|PUBLIC_MOBILE_SCREENS)\b/);
assert.match(mainSource, /MobileApp/);
assert.doesNotMatch(mainSource, /useSession|useAnalysisResources|saveTargetUnivs|buildDerivedContext/);
assert.match(appSource, /createInitialMobileAppState/);
assert.match(appSource, /useMobileApiController/);
assert.match(appSource, /useMobileResourceOrchestrator/);
assert.match(appSource, /createMobileViewContext/);
assert.match(appSource, /useMobileAppEffects/);
assert.match(appSource, /createLazyMobileEventHandlers/);
assert.doesNotMatch(appSource, /createMobileEventHandlers\(context/);
assert.match(apiControllerSource, /persistTargetUnivs/);
assert.match(resourceOrchestratorSource, /useSession/);
assert.match(viewContextSource, /getMobileRuntimeContext/);
assert.match(effectsSource, /useDeferredScreenRegistry/);
assert.match(effectsSource, /attachGestureEventBridge/);
assert.doesNotMatch(effectsSource, /attachGestureListeners\?\.\(\),\s*\[events\]/);
assert.doesNotMatch(accessSource, /\bwindow\b|\bdocument\b|\blocalStorage\b/);
assert.match(routingSource, /PUBLIC_MOBILE_SCREENS/);
assert.match(runtimeAdapterSource, /window\.CONFIG|browser\?\.CONFIG/);

for (const directory of ['features', 'shared']) {
  const files = await listJavaScriptFiles(new URL(`../src/${directory}/`, import.meta.url));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /from\s+['"][^'"]*\/runtime\//, `${directory} 계층이 runtime을 역참조하면 안 됩니다: ${file.pathname}`);
  }
}

const allSourceFiles = await listJavaScriptFiles(new URL('../src/', import.meta.url));
for (const file of allSourceFiles) {
  if (file.pathname.includes('/shared/browser/')) continue;
  const source = await readFile(file, 'utf8');
  assert.doesNotMatch(source, /\bwindow\./, `window 직접 접근은 shared/browser에서만 허용됩니다: ${file.pathname}`);
}

const freeState = { userTier: 'free', selectedPlan: 'Free', user: {} };
const basicState = {
  userTier: 'basic',
  selectedPlan: 'Basic',
  user: { currentSubscription: { status: 'active', tier: 'basic' } }
};
const standardState = {
  userTier: 'standard',
  selectedPlan: 'Standard',
  user: { currentSubscription: { status: 'active', tier: 'standard' } }
};

assert.equal(canAccessTier(freeState, 'basic'), false);
assert.equal(canAccessTier(basicState, 'basic'), true);
assert.equal(canUseScoreSimulation(basicState), true);
assert.equal(canUseReverseProjection(basicState), false);
assert.equal(canUseReverseProjection(standardState), true);
assert.deepEqual(resolveScreenAccess(freeState, 'planner'), {
  allowed: false,
  requiredTier: 'basic',
  label: '플래너'
});
const tabs = [{ id: 'home' }, { id: 'analysis' }];
assert.equal(filterTabItemsForTier(tabs), tabs, '잠긴 플랜도 하단 탭 자체는 유지해야 합니다.');

console.log(`app assembly contracts passed: bootstrap ${bootstrapLines}, MobileApp ${appLines}, browser globals behind adapters.`);
