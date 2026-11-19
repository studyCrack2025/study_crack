import assert from 'node:assert/strict';
import { observeAquariumUnlock } from '../src/features/gamification/unlock-visibility.js';
import { claimAquariumUnlock } from '../src/features/gamification/unlock-ledger.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const values = new Map(), locks = [], notices = [], activity = [], events = new Map();
  let intersection, mutation, inert = false, ownerActive = true;
  const browser = {
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    navigator: { locks: { request: (_, __, run) => new Promise(resolve => { locks.push({ run, resolve }); }) } },
    IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} disconnect() {} },
    MutationObserver: class { constructor(callback) { mutation = callback; } observe() {} disconnect() {} }
  };
  const doc = { defaultView: browser, visibilityState: 'visible', addEventListener: (key, handler) => events.set(key, handler), removeEventListener: key => events.delete(key) };
  const element = { ownerDocument: doc, parentElement: { parentElement: null }, closest: () => inert };
  const view = { status: 'ready', growth: { policyVersion: 'planner-days-v1', countingSince: '2026-01-01', highestUnlockedStage: 'day100' },
    claimUnlock: visible => claimAquariumUnlock({ browser, owner: 'student-a', growth: view.growth, eligible: () => ownerActive && visible() }) };
  const dispose = observeAquariumUnlock(element, view, { onActive: value => activity.push(value), onNotice: value => notices.push(value) });
  return { values, locks, notices, activity, dispose,
    intersect: value => intersection([{ isIntersecting: value }]),
    visibility: value => { doc.visibilityState = value; events.get('visibilitychange')?.(); },
    inert: value => { inert = value; mutation(); },
    changeOwner: () => { ownerActive = false; },
    run: () => { const lock = locks.shift(); assert.ok(lock, 'a claim must be waiting for the browser lock'); const value = lock.run({}); return () => lock.resolve(value); }
  };
}

let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
await check('visible wakeup during a pending hidden claim is processed after the claim settles', async () => {
  const f = setup(); f.intersect(true); f.intersect(false);
  const release = f.run(); assert.equal(f.values.size, 0);
  f.intersect(true); release(); await settle();
  assert.equal(f.locks.length, 1, 'the visible transition cannot be dropped while pending');
  f.run()(); await settle();
  assert.deepEqual(f.notices, ['day100']); assert.equal(f.values.size, 1); f.dispose();
});
await check('a successfully persisted claim survives leaving the viewport before its result arrives', async () => {
  const f = setup(); f.intersect(true); const release = f.run();
  assert.equal(f.values.size, 1); f.intersect(false); release(); await settle();
  assert.deepEqual(f.notices, ['day100']); assert.equal(f.activity.at(-1), false);
  f.intersect(true); f.run()(); await settle(); assert.deepEqual(f.notices, ['day100']); f.dispose();
});
await check('hidden and inert surfaces never consume an unlock', async () => {
  const f = setup(); f.visibility('hidden'); f.intersect(true); assert.equal(f.locks.length, 0);
  f.inert(true); f.visibility('visible'); assert.equal(f.locks.length, 0);
  f.inert(false); assert.equal(f.locks.length, 1);
  f.run()(); await settle(); assert.deepEqual(f.notices, ['day100']); f.dispose();
});
await check('invalidation before lock acquisition prevents writing the previous account ledger', async () => {
  const f = setup(); f.intersect(true); f.changeOwner(); f.run()(); await settle();
  assert.equal(f.values.size, 0); assert.deepEqual(f.notices, []); assert.equal(f.locks.length, 0); f.dispose();
});
await check('unmount after persistence does not announce into a disposed view', async () => {
  const f = setup(); f.intersect(true); const release = f.run(); f.dispose(); release(); await settle();
  assert.deepEqual(f.notices, []); assert.equal(f.locks.length, 0);
});
await check('an already seen stage does not loop or announce twice', async () => {
  const f = setup(); f.intersect(true); f.run()(); await settle();
  f.intersect(false); f.intersect(true); f.run()(); await settle();
  assert.deepEqual(f.notices, ['day100']); assert.equal(f.locks.length, 0); f.dispose();
});
console.log(`Aquarium unlock visibility: ${passed} checks passed.`);
