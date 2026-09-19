import assert from 'node:assert/strict';
import './check-aquarium-unlock.mjs';
import { createAquariumGrowthResource } from '../src/features/gamification/growth-resource.js';

const stages = [1, 7, 15, 30, 50, 100];
const growth = (days, revision = days) => ({ supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-01-01', revision,
  asOf: '2026-09-12T03:00:00.000Z', historyStatus: 'not_available', validDayCount: days,
  highestUnlockedStage: days ? `day${stages.filter(day => day <= days).at(-1)}` : null,
  nextStageDays: stages.find(day => day > days) ? stages.find(day => day > days) - days : null });
function setup() {
  const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
  const listeners = new Map(), requests = [];
  const browser = { localStorage: storage(), sessionStorage: storage(), crypto: { randomUUID: () => 'session-1' }, hasClientSession: () => true,
    addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  browser.localStorage.setItem('userId', 'student-a');
  let response = () => ({ ok: true, status: 200, json: async () => ({ success: true, plannerOwner: 'student-a', plannerProtocol: 1, data: { growth: growth(30) } }) });
  const resource = createAquariumGrowthResource({ browser, api: { game: '/api/game' }, apiFetch: async (_, options) => { requests.push(JSON.parse(options.body)); return response(options); } });
  resource.start();
  return { resource, browser, listeners, requests, respond: next => { response = next; } };
}
let assertions = 0;
async function check(name, run) { await run(); assertions++; console.log(`PASS ${name}`); }
for (const days of [0, 1, 6, 7, 14, 15, 29, 30, 49, 50, 99, 100, 200]) await check(`confirmed day ${days}`, () => {
  const { resource } = setup(); assert.equal(resource.accept(growth(days)), true);
  assert.equal(resource.getView().backgroundKey, growth(days).highestUnlockedStage || 'day1'); resource.dispose();
});
await check('bound read only, no automatic request or local growth estimate', async () => {
  const { resource, requests } = setup(); assert.equal(requests.length, 0); await resource.refresh();
  assert.deepEqual(requests, [{ type: 'planner_sync_v1', owner: 'student-a', operation: 'get_aquarium_growth', data: {} }]);
  assert.equal(resource.getView().backgroundKey, 'day30'); resource.dispose();
});
await check('network failure retains only confirmed same-session snapshot', async () => {
  const { resource, respond } = setup(); await resource.refresh(); respond(() => { throw new Error('offline'); });
  await resource.refresh(); assert.equal(resource.getView().status, 'stale'); assert.equal(resource.getView().backgroundKey, 'day30'); resource.dispose();
});
for (const status of [400, 401, 403, 409, 503]) await check(`disabled or denied ${status} clears presentation`, async () => {
  const { resource, respond } = setup(); await resource.refresh(); respond(() => ({ ok: false, status, json: async () => ({}) }));
  await resource.refresh(); assert.equal(resource.getView().growth, null); assert.equal(resource.getView().backgroundKey, 'day1'); resource.dispose();
});
for (const corrupt of [{ policyVersion: 'unknown' }, { highestUnlockedStage: 'day200' }, { highestUnlockedStage: 'https://bad.example' }, { validDayCount: -1 }, { historyStatus: 'complete' }, { nextStageDays: 99 }]) await check(`reject invalid growth ${JSON.stringify(corrupt)}`, () => {
  const { resource } = setup(); assert.equal(resource.accept({ ...growth(30), ...corrupt }), false); assert.equal(resource.getView().growth, null); resource.dispose();
});
await check('monotonic snapshot ignores stale reads and rejects conflict', () => {
  const { resource } = setup(); resource.accept(growth(50)); resource.accept(growth(30));
  assert.equal(resource.getView().backgroundKey, 'day50'); assert.equal(resource.accept(growth(100, 50)), false);
  assert.equal(resource.getView().backgroundKey, 'day50'); assert.equal(resource.accept(growth(100), 'student-b'), false); resource.dispose();
});
await check('owner swap and late response cannot restore previous background', async () => {
  const { resource, browser, respond, listeners } = setup(); await resource.refresh(); let release;
  respond(() => new Promise(resolve => { release = resolve; })); const pending = resource.refresh();
  browser.localStorage.setItem('userId', 'student-b'); listeners.get('focus')();
  release({ ok: true, json: async () => ({ success: true, plannerOwner: 'student-a', plannerProtocol: 1, data: { growth: growth(100) } }) });
  await pending; assert.equal(resource.getView().growth, null); assert.equal(resource.getView().backgroundKey, 'day1'); resource.dispose(); assert.equal(listeners.size, 0);
});
await check('duplicate refresh shares one in-flight request and dispose cancels', async () => {
  const { resource, respond, requests } = setup(); respond(() => new Promise(() => {}));
  const pending = resource.refresh(); assert.equal(await resource.refresh(), false); assert.equal(requests.length, 1);
  resource.dispose(); await pending; assert.equal(resource.getView().growth, null);
});
await check('unbound legacy response cannot supply growth', async () => {
  const { resource, respond } = setup(); respond(() => ({ ok: true, json: async () => ({ success: true, data: { growth: growth(100) } }) }));
  await resource.refresh(); assert.equal(resource.getView().growth, null); resource.dispose();
});
await check('blocked storage does not throw or fetch', async () => {
  const resource = createAquariumGrowthResource({ browser: { get localStorage() { throw new Error('blocked'); } }, api: {} });
  assert.doesNotThrow(() => resource.start()); assert.equal(resource.getView().status, 'unavailable'); assert.equal(await resource.refresh(), false);
});
await check('unlock claims require current confirmed growth and active identity', async () => {
  const { resource, browser, respond } = setup();
  browser.navigator = { locks: { request: async (_, __, run) => run({}) } };
  assert.equal(await resource.claimUnlock(() => true), null);
  await resource.refresh(); assert.equal(await resource.claimUnlock(() => false), null);
  assert.equal(await resource.claimUnlock(() => true), 'day30');
  assert.equal(await resource.claimUnlock(() => true), null);
  resource.accept(growth(50)); respond(() => { throw new Error('offline'); }); await resource.refresh();
  assert.equal(await resource.claimUnlock(() => true), null);
  resource.accept(growth(50)); browser.localStorage.setItem('userId', 'student-b');
  assert.equal(await resource.claimUnlock(() => true), null); resource.dispose();
});
console.log(`Aquarium growth resource: ${assertions} checks passed.`);
