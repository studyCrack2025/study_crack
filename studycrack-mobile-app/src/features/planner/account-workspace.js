import { createPlannerAccountConnection } from './account-connection.js';
import { bindAccountPlannerHandlers } from './account-actions.js';

const detailsFor = item => ({ minutes: Number(item.minutes || 0), start: item.start || '--:--', end: item.end || '--:--', detailSubject: item.detailSubject || '', activityType: item.activityType || '', memo: item.memo || '' });

export function createPlannerAccountWorkspace(controller, notify, connect = createPlannerAccountConnection) {
  let connection = null, operation = null;
  let generation = 0;
  let view = { mode: 'device', scope: generation, busy: false, verified: false, snapshot: null, result: null };
  const publish = values => { view = { ...view, ...values }; notify(); };
  function invalidated() {
    connection?.dispose(); connection = null; operation = null;
    publish({ scope: ++generation, busy: false, verified: false, snapshot: null, result: { ok: false, error: 'session' } });
  }
  async function run(kind, input) {
    if (operation) return { ok: false, error: 'pending' };
    const wasVerified = view.verified;
    const token = {}; operation = token;
    publish({ busy: true, result: null });
    let current;
    try {
      if (!connection?.active()) {
        if (kind !== 'check') { invalidated(); return { ok: false, error: 'session' }; }
        connection?.dispose();
        publish({ scope: ++generation, snapshot: null, verified: false });
        connection = connect(controller, invalidated);
      }
      current = connection;
      let result;
      if (kind === 'check') result = await current.sync.refresh();
      else if (kind === 'retry') {
        result = await current.sync.flushOne();
        if (result.ok && !current.sync.getSnapshot().queue.length) result = await current.sync.refresh();
      } else if (kind === 'resolve') result = await current.sync.acceptRemote(input);
      else {
        const snapshot = current.sync.getSnapshot();
        if (!view.verified || !snapshot.available || snapshot.queue.length) result = { ok: false, error: 'pending' };
        else if (kind === 'copy') {
          const item = controller.getItems().find(row => row.id === input);
          result = await current.sync.importItem(item, item && detailsFor(item));
        } else result = await current.sync.enqueue(input);
        if (result.ok) {
          publish({ snapshot: current.sync.getSnapshot() });
          result = await current.sync.flushOne();
        }
      }
      if (connection !== current || !current.active()) {
        if (connection === current) invalidated();
        return { ok: false, error: 'session' };
      }
      const snapshot = current.sync.getSnapshot();
      publish({ busy: false, verified: snapshot.available && (result.ok || (wasVerified && ['invalid', 'storage', 'pending'].includes(result.error))), snapshot: [401, 403].includes(result.status) ? null : snapshot, result });
      return result;
    } catch {
      if (!current || connection === current) invalidated();
      return { ok: false, error: 'session' };
    } finally { if (operation === token) operation = null; }
  }
  function getView() {
    return connection && !connection.active() ? { ...view, scope: -1, verified: false, snapshot: null, result: { ok: false, error: 'session' } } : view;
  }
  function getItems() {
    const snapshot = getView().snapshot;
    if (!snapshot?.available) return [];
    const rows = [...snapshot.items.filter(item => !item.deleted)];
    for (const request of snapshot.queue) if (!rows.some(item => item.id === request.data.id) && request.type === 'save_server_planner') rows.push({ ...request.data, completed: false });
    return rows.map(item => ({ ...detailsFor(snapshot.details?.find(row => row.id === item.id) || {}), id: item.id, date: item.date, subject: item.subject,
      content: item.title, done: item.completed, accountRevision: item.revision, accountPending: snapshot.queue.some(row => row.data.id === item.id), accountStored: true }));
  }
  const workspace = {
    getView, getItems, run,
    bindHandlers: (handlers, ctx) => bindAccountPlannerHandlers(workspace, handlers, ctx),
    setMode(mode) {
      if (operation || !['device', 'account'].includes(mode) || (mode === 'account' && (!connection?.active() || !view.verified))) return false;
      publish({ mode }); return true;
    },
    async mutate(kind, item) {
      if (view.mode !== 'account' || !connection?.active()) { invalidated(); return false; }
      if (operation) return false;
      const current = getItems().find(row => row.id === item.id);
      if (['add', 'edit'].includes(kind) && current?.done) { publish({ result: { ok: false, error: 'completed-edit' } }); return false; }
      if (kind === 'add' && current?.accountRevision > 0 && !current.accountPending && ['date', 'subject', 'content'].every(key => current[key] === item[key])
        && JSON.stringify(detailsFor(current)) === JSON.stringify(detailsFor(item))) return true;
      const save = ['add', 'edit', 'cancel'].includes(kind);
      const result = await run('write', { kind: save ? 'save' : kind, id: item.id, ...(save ? { date: item.date, subject: item.subject, title: item.content, details: detailsFor(item) } : {}) });
      return result.ok;
    },
    dispose() { connection?.dispose(); connection = null; operation = null; view = { mode: 'device', scope: ++generation, busy: false, verified: false, snapshot: null, result: null }; }
  };
  return workspace;
}
