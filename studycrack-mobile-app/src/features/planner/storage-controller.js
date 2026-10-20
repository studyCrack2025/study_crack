import { persistPlannerStorage, readPlannerStorage } from './storage.js';
import { createAccountPlannerSync } from './account-sync.js';
import { createPlannerAccountWorkspace } from './account-workspace.js';

export function createPlannerStorageController({ items = [], storage, commit, notify = () => {} }) {
  let baseline = readPlannerStorage(storage);
  let current = baseline.ok ? baseline.plannerItems : items;
  let pending = [];
  let status = { error: baseline.ok ? '' : 'read', pending: false };
  const report = error => {
    status = { error, pending: pending.length > 0 };
    notify();
  };
  const apply = (next, value) => typeof next === 'function' ? next(value) : next;
  const accept = value => {
    current = value;
    commit(value);
  };
  function save(value) {
    if (!persistPlannerStorage({ plannerItems: value }, storage)) return false;
    baseline = { ok: true, raw: JSON.stringify(value) };
    pending = [];
    accept(value);
    report('');
    return true;
  }
  const controller = {
    openAccountSync(options) { return createAccountPlannerSync({ ...options, storage: storage === undefined ? globalThis.localStorage : storage }); },
    getItems: () => current,
    getStatus: () => status,
    watchUnload() {
      const warn = event => {
        if (!status.pending && status.error !== 'write') return;
        event.preventDefault();
        event.returnValue = '';
      };
      globalThis.addEventListener?.('beforeunload', warn);
      return () => { globalThis.removeEventListener?.('beforeunload', warn); controller.account.dispose(); };
    },
    update(next, { retainOnFailure = false } = {}) {
      const value = apply(next, current);
      const latest = readPlannerStorage(storage);
      const error = !latest.ok || !baseline.ok ? 'read' : latest.raw !== baseline.raw ? 'conflict' : '';
      if (!error && save(value)) return true;
      // 서버 확정 공부 기록의 기기 사본만 보존하며 서버 보상은 재요청하지 않는다.
      if (retainOnFailure) {
        pending.push(next);
        accept(value);
      }
      report(error || 'write');
      return false;
    },
    retry() {
      const latest = readPlannerStorage(storage);
      if (!latest.ok) { report('read'); return false; }
      baseline = latest;
      const value = pending.reduce((items, next) => apply(next, items), latest.plannerItems);
      if (pending.length) {
        if (!save(value)) { accept(value); report('write'); return false; }
      } else {
        accept(value);
        report('');
      }
      return true;
    }
  };
  controller.account = createPlannerAccountWorkspace(controller, notify);
  return controller;
}
