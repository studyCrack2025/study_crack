import assert from 'node:assert/strict';
import { createNavigationOps, MAIN_TAB_SCREENS } from '../src/runtime/app-state.js';
import { hydrateNavigationStorage, persistNavigationStorage } from '../src/runtime/navigation-storage.js';
import { hydratePlannerStorage } from '../src/features/planner/storage.js';
import { replaceMobileScreenParam } from '../src/shared/browser/mobile-runtime.js';
import { assertProductImportBoundary } from './product-import-boundary.mjs';

assert.doesNotThrow(() => assertProductImportBoundary({ modulePaths: ['studycrack-mobile-app/src/components/Map.jsx', 'assets/images/logo.png'], dependencyNames: ['react'] }));
for (const modulePath of ['docs/design-docs/Map.tsx', 'client/public/__manus__/runtime.js', 'node_modules/vite-plugin-manus-runtime/index.js', 'docs\\design-docs\\Map.tsx']) {
  assert.throws(() => assertProductImportBoundary({ modulePaths: [modulePath] }), /production graph/);
}
assert.throws(() => assertProductImportBoundary({ dependencyNames: ['vite-plugin-manus-runtime'] }), /manifest/);
assert.throws(() => assertProductImportBoundary({ outputTexts: ['fetch("/__manus__/runtime")'] }), /production output/);

function storageWith(values = {}) {
  const data = new Map(Object.entries(values));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}
for (const [previous, expected] of [['home', 'analysis'], ['my', 'timer'], ...MAIN_TAB_SCREENS.map((tab) => [tab, tab])]) {
  const storage = storageWith({ activeTab: previous, unrelatedDraft: 'keep' });
  const hydrated = hydrateNavigationStorage(storage);
  assert.equal(hydrated.tab, expected);
  assert.equal(storage.getItem('activeTab'), previous, 'hydration must not rewrite storage');
  persistNavigationStorage(hydrated, storage);
  assert.equal(storage.getItem('activeTab'), expected);
  assert.equal(storage.getItem('unrelatedDraft'), 'keep');
}
assert.deepEqual(hydrateNavigationStorage(storageWith()), {});
assert.deepEqual(hydrateNavigationStorage({ getItem() { throw new Error('denied'); } }), {});
assert.doesNotThrow(() => persistNavigationStorage({ tab: 'timer' }, { setItem() { throw new Error('denied'); } }));

let state = { screen: 'timer', tab: 'timer', history: [] };
const nav = createNavigationOps({ getState: () => state, setState: (patch) => { state = { ...state, ...patch }; } });
assert.equal(nav.goto('home'), true);
assert.deepEqual(state, { screen: 'analysis', tab: 'analysis', history: ['timer'] });
assert.equal(nav.goto('home'), false, 'the alias must not add duplicate history');
nav.goto('accountInfo');
nav.back();
assert.equal(state.screen, 'analysis');
nav.back();
assert.equal(state.screen, 'timer');
const oldHistory = ['home'];
state = { screen: 'my', tab: 'timer', history: oldHistory };
nav.back();
assert.deepEqual(state, { screen: 'analysis', tab: 'analysis', history: [] });
assert.deepEqual(oldHistory, ['home'], 'back must not mutate a saved history array');
nav.back();
assert.equal(state.screen, 'timer');
assert.equal(state.tab, 'timer');

const previousWindow = globalThis.window;
try {
  const currentHistoryState = { marker: 'preserve' };
  let replaced;
  globalThis.window = {
    location: { href: 'https://mobile.example/studycrack-mobile.html?screen=home&source=bookmark#saved' },
    history: { state: currentHistoryState, replaceState: (...args) => { replaced = args; } }
  };
  replaceMobileScreenParam('analysis');
  assert.deepEqual(replaced, [currentHistoryState, '', '/studycrack-mobile.html?screen=analysis&source=bookmark#saved']);
  globalThis.window.history.replaceState = () => { throw new Error('denied'); };
  assert.doesNotThrow(() => replaceMobileScreenParam('analysis'));
} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

const oldPlans = [{ subject: '국어', date: '15', content: '직접 저장한 계획', minutes: 30 }];
const planStorage = storageWith({ plannerItems: JSON.stringify(oldPlans) });
const first = hydratePlannerStorage(planStorage).plannerItems;
assert.equal(first.length, 1);
assert.equal(first[0].content, oldPlans[0].content);
assert.equal(first[0].date, '2026-07-15');
assert.match(first[0].id, /^pl-legacy-/);
assert.deepEqual(hydratePlannerStorage(planStorage).plannerItems, first, 'legacy IDs must stay stable across reloads');
assert.equal(planStorage.getItem('plannerItems'), JSON.stringify(oldPlans));
console.log('Phase 5 compatibility passed: alias navigation/back, stored tabs, URL state/query/hash and legacy user drafts.');
