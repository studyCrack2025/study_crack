import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountPlannerSync } from '../src/features/planner/account-sync.js';
import { createPlannerSyncModel } from '../src/features/planner/sync-model.js';
import { createPlannerTransport } from '../src/features/planner/transport.js';
import { minutesBetween } from '../src/screens/planner/planner-options.js';

const growth = { supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-10-04', revision: 0, asOf: '2026-10-04T01:00:00.000Z', historyStatus: 'not_available', validDayCount: 0, highestUnlockedStage: null, nextStageDays: 1 };
const item = { id: 'plan_1', date: '2026-10-04', subject: '국어', title: '독서', revision: 1, completed: false, deleted: false, firstCompletedAt: null, growthDate: null, updatedAt: growth.asOf };
const document = (version, extra = {}) => ({ version, owner: 'owner', items: [], growth: null, queue: [], imports: [], ...extra });
const keys = ['studycrackPlannerAccount_v1:owner', 'studycrackPlannerAccount_v2:owner'];
function fixture() {
  const values = new Map();
  let blocked = false, active = true;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (blocked) throw Error('quota'); values.set(key, value); } };
  const tails = new Map();
  const locks = { request: async (key, _options, work) => {
    const previous = tails.get(key) || Promise.resolve(); let release;
    const tail = new Promise(resolve => { release = resolve; }); tails.set(key, tail);
    await previous; try { return await work(); } finally { release(); if (tails.get(key) === tail) tails.delete(key); }
  } };
  const calls = [];
  let reply = { ok: true, data: { success: true, data: { items: [{ ...item, plannedMinutes: null, completionSnapshot: null }], cursor: null, growth, capabilities: { protocols: [1, 2], rewardPolicy: null } } } };
  const session = { owner: 'owner', epoch: 'epoch-1', send: async (request, options) => { calls.push({ request: structuredClone(request), protocol: options.protocol }); return structuredClone(reply); } };
  return { values, calls, setReply: next => { reply = next; }, block: () => { blocked = true; }, invalidate: () => { active = false; },
    open: () => createAccountPlannerSync({ owner: 'owner', storage, locks, getSession: () => active ? session : null, uuid: () => 'request_new_1' }) };
}
test('v2 duration requests have strict bounds and v1 rejects additional fields', () => {
  const v1 = createPlannerSyncModel(), v2 = createPlannerSyncModel({ protocol: 2 });
  const request = minutes => ({ type: 'save_server_planner', data: { id: 'new_1', requestId: 'request_new_1', revision: 0, date: item.date, subject: item.subject, title: item.title, completed: false, plannedMinutes: minutes } });
  for (const minutes of [1, 29, 30, 119, 120, 239, 240, 1440]) { assert.equal(v2.validRequest(request(minutes)), true); assert.equal(v1.validRequest(request(minutes)), false); }
  for (const minutes of [undefined, null, 0, -1, 1.5, '30', 1441]) assert.equal(v2.validRequest(request(minutes)), false);
});
test('time inputs keep exact minutes and reject reversed, overnight, missing or malformed ranges', () => {
  assert.equal(minutesBetween('09:00', '09:29'), 29); assert.equal(minutesBetween('09:00', '09:30'), 30);
  assert.equal(minutesBetween('09:00', '11:00'), 120); assert.equal(minutesBetween('09:00', '13:00'), 240);
  for (const [start, end] of [['10:00', '09:00'], ['23:30', '00:30'], ['', '10:00'], ['24:00', '24:30'], ['09:00', '09:00']]) assert.equal(minutesBetween(start, end), 0);
});
test('explicit upgrade preserves v1 raw bytes, metadata and import identity without sending a mutation', async () => {
  const f = fixture();
  const original = document(1, { items: [item], imports: [{ sourceId: 'device_1', id: item.id }], details: [{ id: item.id, minutes: 30, start: '09:00', end: '09:30', detailSubject: '', activityType: '', memo: '기기 메모' }] });
  const raw = JSON.stringify(original); f.values.set(keys[0], raw);
  const sync = f.open(); const result = await sync.upgrade();
  assert.equal(result.ok, true); assert.equal(sync.getSnapshot().version, 2);
  assert.equal(f.values.get(keys[0]), raw); assert.deepEqual(sync.getSnapshot().imports, original.imports);
  assert.deepEqual(sync.getSnapshot().details, original.details);
  assert.equal(sync.getSnapshot().items[0].plannedMinutes, null);
  assert.deepEqual(f.calls.map(row => [row.protocol, row.request.type]), [[2, 'get_server_planner']]);
  assert.equal(f.open().getSnapshot().version, 2);
});
test('v1 in-flight request blocks upgrade and reopening prioritizes its unchanged recovery over v2', async () => {
  const f = fixture(); const request = { type: 'complete_server_planner', data: { id: item.id, revision: 1, requestId: 'legacy_done_1' } };
  const raw = JSON.stringify(document(1, { items: [item], queue: [request] }));
  f.values.set(keys[0], raw); f.values.set(keys[1], JSON.stringify(document(2)));
  const sync = f.open(); assert.equal(sync.getSnapshot().version, 1);
  assert.equal((await sync.upgrade()).error, 'pending'); assert.equal(f.calls.length, 0);
  assert.equal(f.values.get(keys[0]), raw); assert.deepEqual(sync.getSnapshot().queue[0], request);
});
test('damaged legacy data cannot silently select another version and is left untouched', () => {
  for (const raw of ['{broken', JSON.stringify(document(1, { queue: 'bad' }))]) {
    const f = fixture(); f.values.set(keys[0], raw); f.values.set(keys[1], JSON.stringify(document(2)));
    assert.equal(f.open().getSnapshot().available, false); assert.equal(f.values.get(keys[0]), raw);
    assert.equal(f.values.get(keys[1]), JSON.stringify(document(2)));
  }
});
test('an operation queued under the old lock cannot write the upgraded document', async () => {
  const f = fixture(); const sync = f.open();
  const upgrading = sync.upgrade();
  const queued = sync.enqueue({ kind: 'save', id: 'new_1', date: item.date, subject: item.subject, title: item.title, plannedMinutes: 30 });
  assert.equal((await upgrading).ok, true); assert.equal((await queued).error, 'pending');
  assert.equal(sync.getSnapshot().queue.length, 0);
  assert.equal((await sync.enqueue({ kind: 'save', id: 'new_1', date: item.date, subject: item.subject, title: item.title, plannedMinutes: 30 })).ok, true);
});
test('returning to v2 preserves existing import identities and refuses conflicting mappings', async () => {
  for (const collision of [false, true]) {
    const f = fixture();
    const legacy = JSON.stringify(document(1, { items: [item], imports: [{ id: item.id, sourceId: 'source_1' }] }));
    f.values.set(keys[0], legacy); const sync = f.open();
    const other = { ...item, id: collision ? item.id : 'plan_2', plannedMinutes: null, completionSnapshot: null };
    const prior = JSON.stringify(document(2, { items: [other], imports: [{ id: other.id, sourceId: 'source_2' }] }));
    f.values.set(keys[1], prior);
    const result = await sync.upgrade();
    assert.equal(f.values.get(keys[0]), legacy);
    if (collision) { assert.equal(result.error, 'conflict'); assert.equal(f.values.get(keys[1]), prior); }
    else { assert.equal(result.ok, true); assert.equal(sync.getSnapshot().imports.length, 2); }
  }
});
test('upgrade storage, bad/unsupported response and invalidation failures never replace original', async () => {
  for (const failure of ['quota', 'response', 'unsupported', 'session']) {
    const f = fixture(); const raw = JSON.stringify(document(1)); f.values.set(keys[0], raw);
    const sync = f.open();
    if (failure === 'quota') f.block();
    if (failure === 'response') f.setReply({ ok: true, data: { success: true, data: { items: [{ ...item, plannedMinutes: 1.5 }], cursor: null, growth } } });
    if (failure === 'unsupported') f.setReply({ ok: false, status: 400 });
    if (failure === 'session') f.invalidate();
    assert.equal((await sync.upgrade()).ok, false);
    assert.equal(f.values.get(keys[0]), raw); assert.equal(f.values.has(keys[1]), false);
  }
});
test('v2 queues exactly the confirmed duration and refuses an altered completion snapshot', async () => {
  const f = fixture(); const sync = f.open(); await sync.upgrade();
  assert.equal((await sync.enqueue({ kind: 'save', id: 'new_1', date: item.date, subject: item.subject, title: item.title, plannedMinutes: 120 })).ok, true);
  assert.equal(f.open().getSnapshot().queue[0].data.plannedMinutes, 120);
  const model = createPlannerSyncModel({ protocol: 2 });
  const completed = { ...item, completed: true, revision: 2, firstCompletedAt: growth.asOf, plannedMinutes: 30,
    completionSnapshot: { date: item.date, subject: item.subject, plannedMinutes: 30, revision: 1, completedAt: growth.asOf, policyVersion: null, status: 'not_active' } };
  const doc = document(2, { items: [completed] });
  assert.throws(() => model.accept(doc, { ...completed, revision: 3, completionSnapshot: { ...completed.completionSnapshot, plannedMinutes: 240 } }, growth), /response/);
  assert.equal(model.accept(doc, structuredClone(completed), growth).items[0].completionSnapshot.plannedMinutes, 30);
});
test('active reward snapshots are accepted only at matching duration status, and remain immutable', () => {
  const model = createPlannerSyncModel({ protocol: 2 });
  for (const [plannedMinutes, status] of [[29, 'ineligible'], [30, 'issued'], [120, 'issued'], [240, 'issued']]) {
    const completed = { ...item, completed: true, revision: 2, firstCompletedAt: growth.asOf, plannedMinutes,
      completionSnapshot: { date: item.date, subject: item.subject, plannedMinutes, revision: 1, completedAt: growth.asOf, policyVersion: 'planner-ticket-v1', status } };
    const doc = document(2, { items: [completed] });
    assert.equal(model.validDocument(doc, 'owner'), true);
    assert.throws(() => model.accept(doc, { ...completed, revision: 3, completionSnapshot: { ...completed.completionSnapshot, plannedMinutes: 1440 } }, growth), /response/);
    for (const invalid of ['not_active', 'pending', status === 'issued' ? 'ineligible' : 'issued']) assert.equal(model.validDocument(document(2, { items: [{ ...completed, completionSnapshot: { ...completed.completionSnapshot, status: invalid } }] }), 'owner'), false);
  }
});
test('transport binds selected protocol and rejects a mismatched or foreign success', async () => {
  let protocol = 1;
  const send = createPlannerTransport({ owner: 'owner', gameApiUrl: '/game', isActive: () => true, apiFetch: async (_url, options) => {
    assert.equal(JSON.parse(options.body).type, 'planner_sync_v2');
    return { ok: true, status: 200, json: async () => ({ success: true, plannerOwner: 'owner', plannerProtocol: protocol }) };
  } });
  const request = { type: 'get_server_planner', data: {} };
  assert.equal((await send(request, { protocol: 2 })).ok, false);
  protocol = 2; assert.equal((await send(request, { protocol: 2 })).ok, true);
});
