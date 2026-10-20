import assert from 'node:assert/strict';
import { claimAquariumUnlock } from '../src/features/gamification/unlock-ledger.js';

const stages = ['day1', 'day7', 'day15', 'day30', 'day50', 'day100'];
const base = { owner: 'student-a', growth: { policyVersion: 'planner-days-v1', countingSince: '2026-01-01', highestUnlockedStage: 'day7' }, eligible: () => true };
function setup() {
  const values = new Map();
  const browser = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, navigator: { locks: { request: async (_, __, run) => run({}) } } };
  return { browser, values, claim: (patch = {}) => claimAquariumUnlock({ ...base, browser, ...patch }) };
}
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
await check('each confirmed stage can be claimed once, same and older never repeat', async () => {
  const { claim } = setup();
  for (const stage of stages) {
    const growth = { ...base.growth, highestUnlockedStage: stage };
    assert.equal(await claim({ growth }), stage); assert.equal(await claim({ growth }), null);
  }
  assert.equal(await claim(), null);
});
await check('reload shares persisted ledger, other owner remains independent', async () => {
  const { browser, claim } = setup(); await claim();
  assert.equal(await claimAquariumUnlock({ ...base, browser }), null);
  assert.equal(await claim({ owner: 'student-b' }), 'day7');
});
await check('hidden, stale or changed session does not consume record', async () => {
  const { claim, values } = setup(); assert.equal(await claim({ eligible: () => false }), null); assert.equal(values.size, 0);
  let checks = 0; assert.equal(await claim({ eligible: () => ++checks < 2 }), null); assert.equal(values.size, 0);
});
await check('no lock support or contested lock skips only the celebration', async () => {
  const { browser, claim, values } = setup(); browser.navigator.locks.request = async (_, __, run) => run(null);
  assert.equal(await claim(), null); assert.equal(values.size, 0);
  browser.navigator.locks = null; assert.equal(await claim(), null);
});
await check('concurrent claims persist before announcing', async () => {
  const { claim } = setup(); const results = await Promise.all([claim(), claim()]); assert.deepEqual(results, ['day7', null]);
});
await check('blocked write/read or corrupt ledger never announces', async () => {
  const { browser, values, claim } = setup(); await claim(); const key = [...values.keys()][0]; values.set(key, 'bad');
  assert.equal(await claim(), null); values.delete(key);
  browser.localStorage.setItem = () => { throw new Error('quota'); }; assert.equal(await claim(), null);
  browser.localStorage.getItem = () => { throw new Error('blocked'); }; assert.equal(await claim(), null);
});
await check('policy and epoch separate notices without changing growth', async () => {
  const { claim } = setup(); await claim(); const growth = { ...base.growth, countingSince: '2026-02-01' }; const before = JSON.stringify(growth);
  assert.equal(await claim({ growth }), 'day7'); assert.equal(JSON.stringify(growth), before);
});
await check('unknown stage, zero stage, unsupported policy and invalid owner rejected', async () => {
  const { claim, values } = setup();
  for (const stage of [null, 'day200', 'https://bad.example', '__proto__']) assert.equal(await claim({ growth: { ...base.growth, highestUnlockedStage: stage } }), null);
  assert.equal(await claim({ growth: { ...base.growth, policyVersion: 'next' } }), null);
  assert.equal(await claim({ owner: '../student' }), null); assert.equal(values.size, 0);
});
console.log(`Aquarium unlock ledger: ${passed} checks passed.`);
