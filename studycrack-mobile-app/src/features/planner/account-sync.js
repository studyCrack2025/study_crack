import { createPlannerSyncModel } from './sync-model.js';

export function createAccountPlannerSync({ owner, storage, getSession, locks = globalThis.navigator?.locks, uuid = () => globalThis.crypto.randomUUID(), timeoutMs = 15000 } = {}) {
  const model = createPlannerSyncModel();
  const key = typeof owner === 'string' && /^[A-Za-z0-9_@.+:-]{1,128}$/.test(owner) ? `studycrackPlannerAccount_v1:${encodeURIComponent(owner)}` : null;
  const sessionNow = () => { try { return getSession?.(); } catch { return null; } };
  const initial = sessionNow();
  const initialSession = initial ? { owner: initial.owner, epoch: initial.epoch, send: initial.send } : null;
  let error = '', disposed = false;
  let inFlight = null;
  const active = () => {
    const session = sessionNow();
    return !disposed && Boolean(key && typeof initialSession?.epoch === 'string' && initialSession.epoch && session?.owner === owner && initialSession.owner === owner
      && session.epoch === initialSession.epoch && session.send === initialSession.send);
  };
  function read() {
    const raw = storage.getItem(key);
    if (raw !== null && raw.length > 4_000_000) throw new Error('storage');
    const doc = raw === null ? { version: 1, owner, items: [], growth: null, queue: [], imports: [] } : JSON.parse(raw);
    if (!model.validDocument(doc, owner)) throw new Error('storage');
    return doc;
  }
  function write(doc) {
    if (!active()) throw new Error('session');
    if (!model.validDocument(doc, owner)) throw new Error('storage');
    const raw = JSON.stringify(doc);
    if (raw.length > 4_000_000) throw new Error('storage');
    storage.setItem(key, raw);
  }
  async function exclusive(work) {
    try {
      if (!active()) throw new Error('session');
      if (typeof locks?.request !== 'function') throw new Error('locking');
      return await locks.request(key, { mode: 'exclusive' }, async () => {
        if (!active()) throw new Error('session');
        const result = await work(read()); error = result?.error || ''; return { ok: true, ...result };
      });
    } catch (cause) {
      error = ['session', 'locking', 'pending', 'conflict', 'response', 'remote', 'unsupported', 'already-imported', 'completed-legacy', 'invalid'].includes(cause?.message) ? cause.message : 'storage';
      return { ok: false, error };
    }
  }
  function requestFor(doc, { kind, id, date, subject, title }) {
    if (doc.queue.some(request => request.data.id === id)) throw new Error('pending');
    const item = doc.items.find(value => value.id === id);
    if (item?.deleted || (!item && kind !== 'save')) throw new Error('conflict');
    const type = { save: 'save_server_planner', complete: 'complete_server_planner', delete: 'delete_server_planner' }[kind];
    const data = { id, requestId: uuid(), revision: item?.revision || 0, ...(kind === 'save' ? { date, subject, title, completed: false } : {}) };
    const request = { type, data };
    if (!model.validRequest(request)) throw new Error('invalid');
    return request;
  }
  const withDetails = (doc, id, details) => details ? { ...doc, details: [...(doc.details || []).filter(row => row.id !== id), { ...details, id }] } : doc;
  async function send(request) {
    if (typeof initialSession.send !== 'function') throw new Error('unsupported');
    let response, timer;
    const controller = new AbortController();
    inFlight = controller;
    try {
      const interrupted = new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('remote')), { once: true });
        timer = setTimeout(() => controller.abort(), Math.min(30000, Math.max(1, Number(timeoutMs) || 15000)));
      });
      response = await Promise.race([initialSession.send(structuredClone(request), { signal: controller.signal }), interrupted]);
    } catch { throw new Error('remote'); }
    finally { clearTimeout(timer); inFlight = null; }
    if (!active()) throw new Error('session');
    return response;
  }
  async function readRemote(doc) {
    let next = doc, cursor = null, revision = null;
    const cursors = new Set(), ids = new Set();
    for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
      const response = await send({ type: 'get_server_planner', data: cursor ? { cursor } : {} });
      if (!response?.ok) return { ok: false, error: 'remote', status: response?.status || 0 };
      const payload = response.data;
      if (payload?.success !== true) throw new Error('response');
      const page = payload.data;
      next = model.acceptPage(next, page);
      if (revision !== null && revision !== page.growth.revision) throw new Error('conflict');
      revision = page.growth.revision;
      for (const item of page.items) { if (ids.has(item.id)) throw new Error('response'); ids.add(item.id); }
      if (page.cursor === null) return { ok: true, next, ids, confirmedGrowth: page.growth };
      if (cursors.has(page.cursor)) throw new Error('response');
      cursors.add(page.cursor); cursor = page.cursor;
    }
    throw new Error('response');
  }
  return {
    getSnapshot() {
      try {
        if (!active()) return { available: false, error: 'session', items: [], queue: [], growth: null };
        const doc = read(); return { available: true, error, ...doc };
      } catch { return { available: false, error: 'storage', items: [], queue: [], growth: null }; }
    },
    refresh() {
      return exclusive(async doc => {
        if (doc.queue.length) throw new Error('pending');
        const result = await readRemote(doc);
        if (!result.ok) return result;
        write(result.next); return { refreshed: true, confirmedGrowth: result.confirmedGrowth };
      });
    },
    acceptRemote(requestId) {
      return exclusive(async doc => {
        const request = doc.queue.find(row => row.data.requestId === requestId);
        if (!request || doc.queue.length !== 1) throw new Error('pending');
        const result = await readRemote(doc);
        if (!result.ok) return result;
        const item = result.next.items.find(row => row.id === request.data.id);
        if (!result.ids.has(request.data.id) || !item || item.revision <= request.data.revision) throw new Error('conflict');
        write({ ...result.next, queue: [], resolved: [...(doc.resolved || []), request] });
        return { resolved: true, confirmedGrowth: result.confirmedGrowth };
      });
    },
    enqueue(input) {
      return exclusive(async doc => {
        const request = requestFor(doc, input);
        write({ ...withDetails(doc, request.data.id, input.details), queue: [...doc.queue, request] });
        return { requestId: request.data.requestId };
      });
    },
    importItem(item, details) {
      return exclusive(async doc => {
        if (item?.done || Number(item?.doneMinutes) > 0) throw new Error('completed-legacy');
        if (typeof item?.id !== 'string' || !item.id.trim()) throw new Error('invalid');
        if (doc.imports.some(row => row.sourceId === item.id)) throw new Error('already-imported');
        const id = uuid();
        const request = requestFor(doc, { kind: 'save', id, date: item.date, subject: item.subject, title: item.content });
        write({ ...withDetails(doc, id, details), imports: [...doc.imports, { sourceId: item.id, id }], queue: [...doc.queue, request] });
        return { id };
      });
    },
    flushOne() {
      return exclusive(async doc => {
        const request = doc.queue[0];
        if (!request) return { empty: true };
        const response = await send(request);
        if (!response?.ok) return { ok: false, error: 'remote', status: response?.status || 0 };
        const payload = response.data;
        const item = payload?.data?.item;
        if (payload?.success !== true || item?.id !== request.data.id || item?.revision !== request.data.revision + 1
          || (request.type === 'save_server_planner' && (item.completed || item.deleted || item.date !== request.data.date || item.subject !== request.data.subject.trim() || item.title !== request.data.title.trim()))
          || (request.type === 'complete_server_planner' && (!item.completed || item.deleted))
          || (request.type === 'delete_server_planner' && !item.deleted)) throw new Error('response');
        const next = model.accept(doc, payload.data.item, payload.data.growth);
        write({ ...next, queue: doc.queue.slice(1) });
        return { requestId: request.data.requestId, replayed: payload.data.replayed === true, confirmedGrowth: payload.data.growth };
      });
    },
    dispose() { disposed = true; inFlight?.abort(); }
  };
}
