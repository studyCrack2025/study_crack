import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlannerStorageController } from '../src/features/planner/storage-controller.js';
import { createPlannerSyncModel } from '../src/features/planner/sync-model.js';
import { createPlannerTransport } from '../src/features/planner/api.js';
import { createPlannerAccountConnection } from '../src/features/planner/account-connection.js';
import { createPlannerAccountWorkspace } from '../src/features/planner/account-workspace.js';

function createFixtureHandlers({ plannerRepository: repo, now }) {
  const dispatch = type => async ({ userId, data }) => {
    if (type === 'get_server_planner') return { statusCode: 200, body: { success: true, data: { ...await repo.listItems(userId, data.cursor), growth: await repo.getGrowth(userId) || emptyGrowth() } } };
    const receipt = await repo.getReceipt(userId, data.requestId);
    if (receipt) return { statusCode: 200, body: { success: true, data: { ...receipt.result, replayed: true } } };
    const stored = await repo.getItem(userId, data.id);
    if ((stored?.revision || 0) !== data.revision || stored?.deleted) return { statusCode: 409, body: { code: 'PLANNER_REVISION_CONFLICT' } };
    const previous = await repo.getGrowth(userId);
    const at = now().toISOString(), day = new Date(now().getTime() + 9 * 3600000).toISOString().slice(0, 10);
    const item = { id: data.id, date: data.date, subject: data.subject?.trim(), title: data.title?.trim(), revision: 0, completed: false, deleted: false, firstCompletedAt: null, growthDate: null, ...stored, updatedAt: at };
    let increment = 0;
    if (type === 'save_server_planner') Object.assign(item, { date: data.date, subject: data.subject.trim(), title: data.title.trim(), completed: false });
    if (type === 'delete_server_planner') item.deleted = true;
    if (type === 'complete_server_planner') {
      if (!item.firstCompletedAt) { item.firstCompletedAt = at; if (item.date === day) { item.growthDate = day; increment = (await repo.getDay(userId, day)) ? 0 : 1; } }
      item.completed = true;
    }
    item.revision++;
    const count = (previous?.validDayCount || 0) + increment;
    const growth = { supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-09-12', revision: (previous?.revision || 0) + 1,
      asOf: at, historyStatus: 'not_available', validDayCount: count, highestUnlockedStage: count ? 'day1' : null, nextStageDays: count ? 7 - count : 1 };
    const result = { item, growth, replayed: false };
    await repo.commit({ userId, item, growth, receipt: { requestId: data.requestId, result }, day: increment ? { date: day } : null });
    return { statusCode: 200, body: { success: true, data: result } };
  };
  return Object.fromEntries(['get_server_planner', 'save_server_planner', 'complete_server_planner', 'delete_server_planner'].map(type => [type, dispatch(type)]));
}
const emptyGrowth = () => ({ supported: true, policyVersion: 'planner-days-v1', countingSince: '2026-09-12', revision: 0, asOf: '2026-09-12T03:00:00.000Z', historyStatus: 'not_available', validDayCount: 0, highestUnlockedStage: null, nextStageDays: 1 });
const createPlannerHandlers = process.env.STUDYCRACK_PLANNER_BACKEND_CONTRACT === '1'
  ? (await import('../../backend-backup/StudyCrack_Gamification/src/handlers/planner-handlers.mjs')).createPlannerHandlers : createFixtureHandlers;

const draft = { kind: 'save', id: 'task_1', date: '2026-09-12', subject: '국어', title: '독서' };
function fixture() {
  const values = new Map([['plannerItems', JSON.stringify([{ id: 'legacy_1', date: draft.date, subject: draft.subject, content: draft.title, minutes: 30 }])]]);
  let blocked = false, readBlocked = false, nextId = 0, lockTail = Promise.resolve();
  const storage = { getItem: key => { if (readBlocked) throw Error('blocked'); return values.get(key) ?? null; }, setItem: (key, value) => { if (blocked) throw Error('quota'); values.set(key, value); } };
  const locks = { request: async (_key, _options, work) => { const prior = lockTail; let release; lockTail = new Promise(resolve => { release = resolve; }); await prior; try { return await work(); } finally { release(); } } };
  const items = new Map(), receipts = new Map(), days = new Map(), growth = new Map(), sent = [];
  const repo = {
    getStudent: async userId => ({ userid: userId, currentSubscription: { tier: 'basic', status: 'active' } }),
    getItem: async (owner, id) => structuredClone(items.get(`${owner}/${id}`) || null),
    getReceipt: async (owner, id) => structuredClone(receipts.get(`${owner}/${id}`) || null),
    getGrowth: async owner => structuredClone(growth.get(owner) || null),
    getDay: async (owner, day) => structuredClone(days.get(`${owner}/${day}`) || null),
    listItems: async (owner, cursor) => {
      const rows = [...items.entries()].filter(([key, item]) => key.startsWith(`${owner}/`) && (!cursor || item.id > cursor)).map(([, item]) => item).sort((a, b) => a.id.localeCompare(b.id));
      return { items: structuredClone(rows.slice(0, 50)), cursor: rows.length > 50 ? rows[49].id : null };
    },
    commit: async plan => { items.set(`${plan.userId}/${plan.item.id}`, structuredClone(plan.item)); receipts.set(`${plan.userId}/${plan.receipt.requestId}`, structuredClone(plan.receipt)); growth.set(plan.userId, structuredClone(plan.growth)); if (plan.day) days.set(`${plan.userId}/${plan.day.date}`, structuredClone(plan.day)); }
  };
  let now = new Date('2026-09-12T03:00:00.000Z');
  const handlers = createPlannerHandlers({ plannerRepository: repo, plannerConfig: { mode: 'on', countingSince: '2026-09-12' }, now: () => now });
  const sender = owner => async request => { sent.push({ owner, ...structuredClone(request) }); const result = await handlers[request.type]({ userId: owner, data: request.data }); return { ok: result.statusCode === 200, status: result.statusCode, data: result.body }; };
  let session = { owner: 'owner-a', epoch: 'login_1', send: sender('owner-a') };
  const controller = createPlannerStorageController({ storage, commit() {} });
  const open = (extra = {}) => controller.openAccountSync({ owner: session.owner, getSession: () => session, locks, uuid: () => `generated_${++nextId}`, ...extra });
  return { values, storage, open, sent, items, growth, receipts, repo, sender, get session() { return session; }, set session(value) { session = value; },
    block: value => { blocked = value; }, blockRead: value => { readBlocked = value; }, setNow: value => { now = new Date(value); } };
}
test('opening an account performs no writes/network and never automatically imports legacy data', () => {
  const f = fixture(); const before = [...f.values]; const sync = f.open();
  assert.equal(sync.getSnapshot().items.length, 0); assert.equal(sync.getSnapshot().growth, null);
  assert.deepEqual([...f.values], before); assert.equal(f.sent.length, 0);
});
test('queued create is durable before send; completion starts only after server save', async () => {
  const f = fixture(); const sync = f.open();
  assert.equal((await sync.enqueue({ kind: 'complete', id: draft.id })).ok, false);
  assert.equal((await sync.enqueue(draft)).ok, true); assert.equal(f.sent.length, 0);
  assert.equal(sync.getSnapshot().queue.length, 1); assert.equal(sync.getSnapshot().growth, null);
  assert.equal((await sync.flushOne()).ok, true);
  assert.equal((await sync.enqueue({ kind: 'complete', id: draft.id })).ok, true); assert.equal(sync.getSnapshot().growth.validDayCount, 0);
  assert.equal((await sync.flushOne()).ok, true); assert.equal(sync.getSnapshot().growth.validDayCount, 1);
});
test('unknown response replays the exact persisted request after reopening', async () => {
  const f = fixture(); const send = f.session.send; let lost = true;
  f.session.send = async request => { const response = await send(request); if (lost) { lost = false; throw Error('lost'); } return response; };
  const sync = f.open(); await sync.enqueue(draft); const request = sync.getSnapshot().queue[0];
  assert.equal((await sync.flushOne()).ok, false); assert.deepEqual(sync.getSnapshot().queue[0], request);
  const reopened = f.open(); assert.equal((await reopened.flushOne()).replayed, true);
  assert.deepEqual(f.sent[0], f.sent[1]); assert.equal(f.items.size, 1); assert.equal(reopened.getSnapshot().queue.length, 0);
});
test('post-response storage failure preserves request for receipt recovery rather than resubmitting a new identity', async () => {
  const f = fixture(); const send = f.session.send; f.session.send = async request => { const response = await send(request); f.block(true); return response; };
  const sync = f.open(); await sync.enqueue(draft); assert.equal((await sync.flushOne()).error, 'storage'); f.block(false);
  assert.equal(sync.getSnapshot().queue.length, 1); f.session.send = send;
  const reopened = f.open(); assert.equal((await reopened.flushOne()).replayed, true);
});
test('storage quota failure cannot enqueue, send, clear originals or invent success', async () => {
  const f = fixture(); const before = [...f.values]; const sync = f.open(); f.block(true);
  assert.equal((await sync.enqueue(draft)).error, 'storage'); assert.equal(f.sent.length, 0); assert.deepEqual([...f.values], before);
});
test('broken, foreign-owner and unreadable account storage are never overwritten', async () => {
  for (const raw of ['{broken', 'null', JSON.stringify({ version: 1, owner: 'other', items: [], growth: null, queue: [], imports: [] })]) {
    const f = fixture(); f.values.set('studycrackPlannerAccount_v1:owner-a', raw); const sync = f.open();
    assert.equal(sync.getSnapshot().available, false); assert.equal((await sync.enqueue(draft)).ok, false);
    assert.equal(f.values.get('studycrackPlannerAccount_v1:owner-a'), raw);
  }
  const f = fixture(); const sync = f.open(); f.blockRead(true); assert.equal((await sync.enqueue(draft)).ok, false); assert.equal(f.sent.length, 0);
});
test('Web Locks absence refuses writes instead of using a non-atomic cross-tab fallback', async () => {
  const f = fixture(); const sync = f.open({ locks: {} }); assert.equal((await sync.enqueue(draft)).error, 'locking'); assert.equal(f.values.size, 1);
});
test('two tabs cannot overwrite each other; same original cannot have ambiguous pending revisions', async () => {
  const f = fixture(); const a = f.open(), b = f.open();
  const results = await Promise.all([a.enqueue(draft), b.enqueue(draft)]);
  assert.equal(results.filter(result => result.ok).length, 1); assert.equal(b.getSnapshot().queue.length, 1);
  await Promise.all([a.flushOne(), b.flushOne()]); assert.equal(f.sent.length, 1);
});
test('switching account hides old state and prevents the old queue from being sent as the new account', async () => {
  const f = fixture(); const old = f.open(); await old.enqueue(draft);
  f.session = { owner: 'owner-b', epoch: 'login_2', send: f.sender('owner-b') };
  assert.equal(old.getSnapshot().available, false); assert.equal((await old.flushOne()).error, 'session'); assert.equal(f.sent.length, 0);
  const current = f.open(); assert.equal(current.getSnapshot().queue.length, 0); assert.equal(current.getSnapshot().items.length, 0);
  await current.enqueue(draft); await current.flushOne(); assert.equal(f.sent[0].owner, 'owner-b');
  assert.equal(JSON.parse(f.values.get('studycrackPlannerAccount_v1:owner-a')).queue.length, 1);
});
test('logout and same-account relogin invalidate old closures even when account ID matches', async () => {
  const f = fixture(); const old = f.open(); await old.enqueue(draft);
  f.session = { ...f.session, epoch: 'login_2' }; assert.equal((await old.flushOne()).error, 'session');
  assert.equal((await f.open().flushOne()).ok, true); old.dispose(); assert.equal(old.getSnapshot().available, false);
  const mutable = fixture(); const opened = mutable.open(); await opened.enqueue(draft);
  mutable.session.epoch = 'mutated-login'; assert.equal((await opened.flushOne()).error, 'session'); assert.equal(mutable.sent.length, 0);
});
test('account switch during flight ignores late response and retains the original request', async () => {
  const f = fixture(); const send = f.session.send;
  f.session.send = async request => { const response = await send(request); f.session = { owner: 'owner-b', epoch: 'login_2', send: f.sender('owner-b') }; return response; };
  const sync = f.open(); await sync.enqueue(draft); assert.equal((await sync.flushOne()).error, 'session');
  assert.equal(JSON.parse(f.values.get('studycrackPlannerAccount_v1:owner-a')).queue.length, 1);
  assert.equal(f.values.has('studycrackPlannerAccount_v1:owner-b'), false);
});
test('explicit import is once per source and account, leaves legacy data untouched and never queues completion', async () => {
  const f = fixture(); const raw = f.values.get('plannerItems'); const item = JSON.parse(raw)[0]; const sync = f.open();
  assert.equal((await sync.importItem(item)).ok, true); assert.equal((await sync.importItem(item)).error, 'already-imported');
  assert.equal(sync.getSnapshot().queue[0].type, 'save_server_planner'); assert.equal(f.values.get('plannerItems'), raw);
  assert.equal((await sync.flushOne()).ok, true); assert.equal(sync.getSnapshot().growth.validDayCount, 0);
});
test('already-completed or study-record imports are deferred rather than minting growth again', async () => {
  const f = fixture(); const sync = f.open();
  for (const extra of [{ done: true }, { doneMinutes: 20 }]) assert.equal((await sync.importItem({ id: 'old', date: draft.date, subject: draft.subject, content: draft.title, ...extra })).error, 'completed-legacy');
  assert.equal(f.values.size, 1); assert.equal(f.sent.length, 0);
});
test('cancel and recomplete retain original first-completion history, delete prevents ID reuse', async () => {
  const f = fixture(); const sync = f.open(); await sync.enqueue(draft); await sync.flushOne();
  await sync.enqueue({ kind: 'complete', id: draft.id }); await sync.flushOne(); const first = sync.getSnapshot().items[0].firstCompletedAt;
  await sync.enqueue(draft); await sync.flushOne(); await sync.enqueue({ kind: 'complete', id: draft.id }); await sync.flushOne();
  assert.equal(sync.getSnapshot().growth.validDayCount, 1); assert.equal(sync.getSnapshot().items[0].firstCompletedAt, first);
  await sync.enqueue({ kind: 'delete', id: draft.id }); await sync.flushOne(); assert.equal((await sync.enqueue(draft)).error, 'conflict');
});
test('completion first arriving after KST midnight remains completed without retroactive growth', async () => {
  const f = fixture(); const sync = f.open(); await sync.enqueue(draft); await sync.flushOne(); await sync.enqueue({ kind: 'complete', id: draft.id });
  f.setNow('2026-09-12T15:01:00.000Z'); await sync.flushOne(); assert.equal(sync.getSnapshot().items[0].completed, true); assert.equal(sync.getSnapshot().growth.validDayCount, 0);
});
test('remote denial/conflict/offline never rebases revision, discards queue or changes growth', async () => {
  for (const status of [401, 403, 409, 429, 503]) {
    const f = fixture(); f.session.send = async () => ({ ok: false, status }); const sync = f.open(); await sync.enqueue(draft);
    const request = sync.getSnapshot().queue[0]; const result = await sync.flushOne(); assert.equal(result.status, status);
    assert.deepEqual(sync.getSnapshot().queue[0], request); assert.equal(sync.getSnapshot().growth, null); assert.equal(sync.getSnapshot().error, 'remote');
  }
});
test('malformed or mismatched success cannot consume a queued request', async () => {
  for (const corrupt of [response => { response.data.data.item.id = 'other'; }, response => { response.data.data.growth.validDayCount = -1; }, response => { response.data.data.item.deleted = true; }, response => { response.data.data.growth.highestUnlockedStage = 'day100'; }]) {
    const f = fixture(); const send = f.session.send; f.session.send = async request => { const response = await send(request); corrupt(response); return response; };
    const sync = f.open(); await sync.enqueue(draft); assert.equal((await sync.flushOne()).error, 'response'); assert.equal(sync.getSnapshot().queue.length, 1);
  }
});
test('bad dates, fields and oversized imports fail without changing stored data', async () => {
  for (const extra of [{ date: '2026-02-30' }, { date: '2026-99-99' }, { title: 'x'.repeat(201) }, { subject: '\u200b' }, { id: '../other' }, { kind: 'unknown' }]) {
    const f = fixture(); const sync = f.open(); assert.equal((await sync.enqueue({ ...draft, ...extra })).ok, false); assert.equal(f.values.size, 1);
  }
});
test('stalled transport releases the lock after timeout without losing its durable request', async () => {
  const f = fixture(); let signal; f.session.send = (_request, options) => { signal = options.signal; return new Promise(() => {}); };
  const sync = f.open({ timeoutMs: 5 }); await sync.enqueue(draft);
  assert.equal((await sync.flushOne()).error, 'remote'); assert.equal(signal.aborted, true); assert.equal(sync.getSnapshot().queue.length, 1);
  assert.equal((await sync.enqueue({ ...draft, id: 'task_2' })).ok, true);
});
test('older replay growth cannot roll back a newer confirmed snapshot; equal revision disagreement is rejected', async () => {
  const f = fixture(); const sync = f.open(); await sync.enqueue(draft); await sync.flushOne(); const old = sync.getSnapshot();
  await sync.enqueue({ kind: 'complete', id: draft.id }); await sync.flushOne(); const newer = sync.getSnapshot();
  const model = createPlannerSyncModel();
  const merged = model.accept(newer, old.items[0], old.growth);
  assert.equal(merged.growth.validDayCount, 1); assert.equal(merged.items[0].completed, true);
  assert.throws(() => model.accept(newer, { ...newer.items[0], title: 'mismatch' }, newer.growth));
  assert.throws(() => model.accept(newer, newer.items[0], { ...old.growth, revision: newer.growth.revision + 1 }));
});
test('refresh accepts empty accounts repeatedly and never uploads legacy plans', async () => {
  const f = fixture(); const sync = f.open();
  assert.equal((await sync.refresh()).ok, true);
  f.setNow('2026-09-12T04:00:00.000Z');
  assert.equal((await sync.refresh()).ok, true);
  assert.equal(sync.getSnapshot().growth.validDayCount, 0);
  assert.deepEqual(f.sent.map(row => row.type), ['get_server_planner', 'get_server_planner']);
});
test('refresh restores confirmed server plans on a new device without changing legacy records', async () => {
  const f = fixture(); const sync = f.open(); await sync.enqueue(draft); await sync.flushOne();
  f.values.delete('studycrackPlannerAccount_v1:owner-a');
  const before = f.values.get('plannerItems');
  assert.equal((await f.open().refresh()).ok, true);
  assert.equal(f.open().getSnapshot().items[0].title, draft.title);
  assert.equal(f.values.get('plannerItems'), before);
});
test('refresh cannot rebase or discard pending operations', async () => {
  const f = fixture(); const sync = f.open(); await sync.enqueue(draft); const before = [...f.values];
  assert.equal((await sync.refresh()).error, 'pending'); assert.equal(f.sent.length, 0); assert.deepEqual([...f.values], before);
});
test('paginated refresh writes once only after all pages pass validation', async () => {
  const f = fixture(); const source = f.open(); await source.enqueue(draft); await source.flushOne(); const doc = source.getSnapshot();
  f.values.delete('studycrackPlannerAccount_v1:owner-a');
  let calls = 0;
  f.session.send = async request => { calls++; assert.equal(f.values.has('studycrackPlannerAccount_v1:owner-a'), false);
    assert.deepEqual(request.data, calls === 1 ? {} : { cursor: 'task_1' });
    return { ok: true, data: { success: true, data: { items: [{ ...doc.items[0], id: `task_${calls}` }], growth: doc.growth, cursor: calls === 1 ? 'task_1' : null } } };
  };
  const sync = f.open(); assert.equal((await sync.refresh()).ok, true); assert.equal(sync.getSnapshot().items.length, 2);
});
test('malformed, looping and revision-changing pages preserve the entire previous snapshot', async () => {
  for (const fault of ['loop', 'duplicate', 'growth', 'failed']) {
    const f = fixture(); const source = f.open(); await source.enqueue(draft); await source.flushOne(); const doc = source.getSnapshot(); const before = [...f.values]; let calls = 0;
    f.session.send = async () => { calls++; return fault === 'failed' && calls === 2 ? { ok: false, status: 503 } : { ok: true, data: { success: true, data: {
      items: fault === 'duplicate' ? doc.items : [], growth: { ...doc.growth, revision: fault === 'growth' ? doc.growth.revision + calls : doc.growth.revision },
      cursor: fault === 'loop' || calls === 1 ? 'next' : null
    } } }; };
    assert.equal((await f.open().refresh()).ok, false); assert.deepEqual([...f.values], before);
  }
});
test('owner-bound transport rejects legacy or foreign responses and never sends while inactive', async () => {
  let active = true, calls = 0, body = { success: true, plannerOwner: 'owner-a', plannerProtocol: 1 };
  const send = createPlannerTransport({ owner: 'owner-a', gameApiUrl: '/test', isActive: () => active, apiFetch: async (_url, options) => {
    calls++; assert.deepEqual(JSON.parse(options.body), { type: 'planner_sync_v1', owner: 'owner-a', operation: 'get_server_planner', data: {} });
    return { ok: true, json: async () => body };
  } });
  const request = { type: 'get_server_planner', data: {} };
  assert.equal((await send(request)).ok, true);
  body = { success: true }; assert.equal((await send(request)).code, 'INVALID_RESPONSE');
  body = { success: true, plannerOwner: 'owner-b', plannerProtocol: 1 }; assert.equal((await send(request)).ok, false);
  active = false; assert.equal((await send(request)).code, 'PLANNER_ACCOUNT_CHANGED'); assert.equal(calls, 3);
});
test('owner-bound transport discards a late success after session invalidation', async () => {
  let active = true;
  const send = createPlannerTransport({ owner: 'owner-a', gameApiUrl: '/test', isActive: () => active, apiFetch: async () => {
    active = false; return { ok: true, json: async () => ({ success: true, plannerOwner: 'owner-a', plannerProtocol: 1 }) };
  } });
  assert.equal((await send({ type: 'get_server_planner', data: {} })).code, 'PLANNER_ACCOUNT_CHANGED');
});
test('browser connection invalidates on account storage events, logout marker removal and unmount', () => {
  for (const kind of ['storage', 'logout', 'dispose']) {
    const f = fixture(); f.values.set('userId', 'owner-a'); const session = new Map(); const listeners = new Map(); let invalidations = 0;
    const browser = { localStorage: f.storage, sessionStorage: { getItem: key => session.get(key), setItem: (key, value) => session.set(key, value) }, hasClientSession: () => true,
      crypto: { randomUUID: () => 'login-marker' }, navigator: { locks: { request: async (_key, _options, work) => work() } },
      addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: type => listeners.delete(type) };
    const controller = createPlannerStorageController({ storage: f.storage, commit() {} });
    const connection = createPlannerAccountConnection(controller, () => { invalidations++; }, { browser, api: { game: '/test' }, apiFetch() { throw Error('unexpected request'); } });
    assert.equal(connection.active(), true); assert.equal(connection.sync.getSnapshot().available, true);
    if (kind === 'storage') listeners.get('storage')({ key: 'userId', oldValue: 'owner-a', newValue: null });
    else if (kind === 'logout') { session.clear(); listeners.get('focus')(); }
    else connection.dispose();
    assert.equal(connection.sync.getSnapshot().available, false); assert.equal(listeners.size, 0); assert.equal(invalidations, kind === 'dispose' ? 0 : 1);
  }
});

const uiDraft = { id: draft.id, date: draft.date, subject: draft.subject, content: draft.title, minutes: 30, start: '09:00', end: '09:30', detailSubject: '독서', activityType: '복습', memo: '기기 메모' };
function workspaceFor(f) {
  return createPlannerAccountWorkspace({ getItems: () => JSON.parse(f.values.get('plannerItems')) }, () => {}, () => {
    const owner = f.session.owner, epoch = f.session.epoch, sync = f.open();
    return { sync, active: () => f.session.owner === owner && f.session.epoch === epoch, dispose: () => sync.dispose() };
  });
}
test('workspace explicitly selects account mode then saves, completes, cancels, edits and deletes without changing device data', async () => {
  const f = fixture(), workspace = workspaceFor(f); const before = f.values.get('plannerItems');
  assert.equal(workspace.setMode('account'), false); assert.equal(f.sent.length, 0);
  assert.equal((await workspace.run('check')).ok, true); assert.equal(workspace.setMode('account'), true);
  assert.equal(await workspace.mutate('add', uiDraft), true);
  assert.equal(workspace.getItems()[0].memo, uiDraft.memo); assert.equal(f.sent[1].data.memo, undefined); assert.equal(f.sent[1].data.minutes, undefined);
  assert.equal(await workspace.mutate('complete', uiDraft), true); assert.equal(workspace.getItems()[0].done, true); assert.equal(workspace.getView().snapshot.growth.validDayCount, 1);
  assert.equal(await workspace.mutate('edit', { ...uiDraft, content: '수정' }), false);
  assert.equal(await workspace.mutate('cancel', uiDraft), true);
  assert.equal(await workspace.mutate('edit', { ...uiDraft, content: '수정' }), true);
  assert.equal(await workspace.mutate('delete', uiDraft), true); assert.equal(workspace.getItems().length, 0);
  assert.equal(workspace.getView().snapshot.growth.validDayCount, 1); assert.equal(f.values.get('plannerItems'), before);
});
test('workspace leaves a new draft pending after lost response and repeat submit after recovery does not duplicate it', async () => {
  const f = fixture(); const send = f.session.send; let lose = true;
  f.session.send = async request => { const response = await send(request); if (request.type === 'save_server_planner' && lose) { lose = false; throw Error('lost'); } return response; };
  const workspace = workspaceFor(f); await workspace.run('check'); workspace.setMode('account');
  assert.equal(await workspace.mutate('add', uiDraft), false); assert.equal(workspace.getItems()[0].accountPending, true); assert.equal(workspace.getItems()[0].done, false);
  assert.equal(await workspace.mutate('add', { ...uiDraft, id: 'another' }), false);
  assert.equal((await workspace.run('retry')).ok, true);
  const requests = f.sent.length; assert.equal(await workspace.mutate('add', uiDraft), true); assert.equal(f.sent.length, requests); assert.equal(f.items.size, 1);
});
test('workspace confirms completion only after response; concurrent mutations are refused', async () => {
  const f = fixture(); const send = f.session.send; let release;
  f.session.send = request => request.type === 'complete_server_planner' ? new Promise(resolve => { release = async () => resolve(await send(request)); }) : send(request);
  const workspace = workspaceFor(f); await workspace.run('check'); workspace.setMode('account'); await workspace.mutate('add', uiDraft);
  const completion = workspace.mutate('complete', uiDraft);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  assert.equal(workspace.getItems()[0].done, false); assert.equal(workspace.getView().snapshot.growth.validDayCount, 0);
  assert.equal(await workspace.mutate('delete', uiDraft), false); assert.equal(workspace.setMode('device'), false);
  await release(); assert.equal(await completion, true); assert.equal(workspace.getItems()[0].done, true);
});
test('workspace refuses old primary actions after account change without falling back to device writes', async () => {
  const f = fixture(), workspace = workspaceFor(f); await workspace.run('check'); workspace.setMode('account'); await workspace.mutate('add', uiDraft);
  const before = [...f.values], sent = f.sent.length; f.session = { owner: 'owner-b', epoch: 'login_2', send: f.sender('owner-b') };
  assert.equal(workspace.getItems().length, 0); assert.equal(await workspace.mutate('complete', uiDraft), false);
  assert.equal(workspace.getView().mode, 'account'); assert.deepEqual([...f.values], before); assert.equal(f.sent.length, sent);
});
test('metadata and durable request are atomic; invalid details and quota failure never send', async () => {
  const f = fixture(), workspace = workspaceFor(f); await workspace.run('check'); workspace.setMode('account'); const before = [...f.values], sent = f.sent.length;
  assert.equal(await workspace.mutate('add', { ...uiDraft, memo: 'x'.repeat(2001) }), false);
  assert.deepEqual([...f.values], before); assert.equal(f.sent.length, sent);
  assert.equal(workspace.getView().verified, true); f.block(true);
  assert.equal(await workspace.mutate('add', uiDraft), false); assert.deepEqual([...f.values], before);
  f.block(false); assert.equal(await workspace.mutate('add', uiDraft), true);
});
test('explicit conflict resolution archives original request and accepts only a newer server item', async () => {
  const f = fixture(), sync = f.open(); await sync.enqueue(draft); await sync.flushOne();
  await sync.enqueue({ ...draft, title: '내 대기 변경' }); const request = sync.getSnapshot().queue[0];
  await f.sender('owner-a')({ type: 'save_server_planner', data: { ...request.data, requestId: 'other_request', title: '다른 기기 변경' } });
  assert.equal((await sync.flushOne()).status, 409);
  assert.equal((await sync.acceptRemote(request.data.requestId)).ok, true);
  const doc = sync.getSnapshot(); assert.equal(doc.queue.length, 0); assert.equal(doc.items[0].title, '다른 기기 변경'); assert.deepEqual(doc.resolved, [request]);
});
test('missing or unchanged server item cannot discard a pending request even by explicit conflict resolution', async () => {
  const f = fixture(), sync = f.open(); await sync.enqueue(draft); const request = sync.getSnapshot().queue[0]; const before = [...f.values];
  assert.equal((await sync.acceptRemote(request.data.requestId)).ok, false); assert.deepEqual([...f.values], before);
  await sync.flushOne(); await sync.enqueue({ kind: 'complete', id: draft.id }); const pending = sync.getSnapshot().queue[0], saved = [...f.values];
  assert.equal((await sync.acceptRemote(pending.data.requestId)).ok, false); assert.deepEqual([...f.values], saved);
});
test('workspace import preserves local time and memo without adding them to the server payload', async () => {
  const f = fixture(); f.values.set('plannerItems', JSON.stringify([uiDraft])); const workspace = workspaceFor(f);
  await workspace.run('check'); assert.equal((await workspace.run('copy', uiDraft.id)).ok, true);
  assert.equal(workspace.getItems()[0].memo, uiDraft.memo); assert.equal(f.sent.at(-1).data.memo, undefined);
  workspace.dispose(); assert.equal(workspace.getView().mode, 'device'); assert.equal(workspace.getItems().length, 0);
});
