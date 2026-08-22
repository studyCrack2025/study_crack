import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createMobileActionHandlers } from '../src/handlers/mobile-handlers.js';
import { HANDLER_STATE_FIELDS } from '../src/state/handler-state-actions.js';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = new URL('src/', `file://${appRoot}/`);

async function read(relativePath) {
  return readFile(new URL(relativePath, `file://${appRoot}/`), 'utf8');
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = new URL(entry.name, directory.href.endsWith('/') ? directory : new URL(`${directory.href}/`));
    if (entry.isDirectory()) return listSourceFiles(new URL(`${target.href}/`));
    return /\.(?:js|jsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

function extractStringList(source, declarationName) {
  const match = source.match(new RegExp(`(?:export\\s+)?const\\s+${declarationName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${declarationName} declaration was not found`);
  return Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g), (item) => item[1]);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

const [interactionSource, uiSource, registrySource, runtimeSource, accessPolicySource, sourceFiles] = await Promise.all([
  read('fixtures/interaction-contract.json'),
  read('fixtures/ui-contract.json'),
  read('src/app/screen-registry.js'),
  read('src/runtime/main.js'),
  read('src/app/access-policy.js'),
  listSourceFiles(sourceRoot)
]);

const contract = JSON.parse(interactionSource);
const uiContract = JSON.parse(uiSource);
const sourceTexts = await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')));
const discoveredActions = sortedUnique(sourceTexts.flatMap((source) => Array.from(
  source.matchAll(/data-action\s*=\s*(?:\{\s*)?['"]([A-Za-z0-9_-]+)['"](?:\s*\})?/g),
  (match) => match[1]
)));
const registeredScreens = extractStringList(registrySource, 'MOBILE_SCREEN_NAMES');
const fixtureScreens = Object.keys(contract.screens);
const stateActions = Object.fromEntries(Object.entries(HANDLER_STATE_FIELDS).map(([group, fields]) => [
  group,
  Object.fromEntries(fields.map((field) => [`set${field.charAt(0).toUpperCase()}${field.slice(1)}`, () => {}]))
]));
assert.throws(() => createMobileActionHandlers({}), /state action group이 누락/);
const handlerNames = new Set(Object.keys(createMobileActionHandlers({}, stateActions)));

assert.equal(contract.schemaVersion, 1, 'Interaction fixture schema version changed unexpectedly');
assert.deepEqual(contract.viewports, uiContract.viewports, 'Interaction and UI viewport fixtures diverged');
assert.deepEqual(contract.stateProfiles.main, uiContract.states, 'Main state profile and UI state contract diverged');
assert.deepEqual(fixtureScreens, registeredScreens, 'Every registered screen must have one interaction fixture');
assert.deepEqual(discoveredActions, contract.staticActions, 'Static data-action inventory changed; classify the new or removed action');
assert.equal(new Set(contract.staticActions).size, contract.staticActions.length, 'Static action fixture contains duplicates');

for (const [screen, fixture] of Object.entries(contract.screens)) {
  assert.ok(contract.stateProfiles[fixture.profile], `${screen} uses an unknown state profile: ${fixture.profile}`);
  assert.ok(Array.isArray(fixture.actions), `${screen} actions must be an array`);
  for (const action of fixture.actions) {
    assert.ok(discoveredActions.includes(action), `${screen} references a missing static action: ${action}`);
    assert.ok(handlerNames.has(action), `${screen} action has no dispatcher handler: ${action}`);
  }
}

for (const action of discoveredActions) {
  assert.ok(handlerNames.has(action), `Static action has no dispatcher handler: ${action}`);
}

for (const item of contract.allowlistedActions) {
  assert.ok(discoveredActions.includes(item.name), `Allowlisted action is not rendered: ${item.name}`);
  assert.ok(handlerNames.has(item.name), `Allowlisted action has no safe handler: ${item.name}`);
  assert.ok(String(item.reason || '').trim().length >= 12, `Allowlisted action needs a concrete reason: ${item.name}`);
}

assert.deepEqual(Object.keys(contract.planFixtures), ['free', 'starter', 'basic', 'standard', 'pro'], 'Plan fixture order or coverage changed');
assert.deepEqual(contract.planFixtures.starter, contract.planFixtures.basic, 'Starter and Basic currently share the same mobile access contract');
assert.equal(contract.planFixtures.free.mainTabsVisible, true, 'Free users must keep the five-tab navigation visible');
assert.equal(contract.planFixtures.basic.planner, true, 'Planner must be available from Basic');
assert.equal(contract.planFixtures.standard.coaching, true, 'Coaching must be available from Standard');
assert.equal(contract.planFixtures.basic.scoreSimulation, true, 'Score simulation must be available from Basic');
assert.equal(contract.planFixtures.basic.reverseProjection, false, 'Reverse projection must stay locked below Standard');
assert.equal(contract.planFixtures.standard.reverseProjection, true, 'Reverse projection must be available from Standard');
assert.match(accessPolicySource, /const\s+PLAN_RANK\s*=\s*\{[^}]*free:\s*0[^}]*basic:\s*1[^}]*starter:\s*1[^}]*standard:\s*2[^}]*pro:\s*3[^}]*\}/, 'Runtime plan rank changed');
assert.match(accessPolicySource, /strategy:\s*['"]standard['"]/, 'Coaching access tier changed');
assert.match(accessPolicySource, /planner:\s*['"]basic['"]/, 'Planner access tier changed');
assert.match(accessPolicySource, /function\s+filterTabItemsForTier\s*\([^)]*\)\s*\{\s*return\s+items;\s*\}/, 'Bottom tabs must remain visible for locked plans');

console.log(`Interaction contract check passed: ${registeredScreens.length} screens, ${discoveredActions.length} static actions, ${Object.keys(contract.planFixtures).length} plan fixtures.`);
