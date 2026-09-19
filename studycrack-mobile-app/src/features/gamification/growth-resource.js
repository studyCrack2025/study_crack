import { createPlannerTransport } from '../planner/api.js';
import { createPlannerSyncModel } from '../planner/sync-model.js';
import { claimAquariumUnlock } from './unlock-ledger.js';

export function createAquariumGrowthResource({ browser, api, apiFetch }, notify = () => {}) {
  const model = createPlannerSyncModel();
  let owner = '', epoch = '', disposed = false, invalidated = false, request = null, send = null;
  let view = { status: 'idle', growth: null, backgroundKey: 'day1' };
  const marker = 'studycrackGrowthSession_v1';
  function active() {
    try { return !disposed && !invalidated && owner && browser.hasClientSession() && browser.localStorage.getItem('userId') === owner && browser.sessionStorage.getItem(marker) === epoch; }
    catch { return false; }
  }
  const publish = next => { view = { ...view, ...next }; if (!disposed) notify(); };
  const clear = status => publish({ status, growth: null, backgroundKey: 'day1' });
  function invalidate() { invalidated = true; request?.abort(); clear('account-changed'); }
  function changed(event) { if (event.key === null || (event.key === 'userId' && event.oldValue !== event.newValue)) invalidate(); }
  function checked() { if (!active()) invalidate(); }
  function accept(growth, confirmedOwner = owner) {
    if (!active() || confirmedOwner !== owner) return false;
    try {
      const next = model.acceptPage({ items: [], growth: view.growth }, { items: [], growth, cursor: null }).growth;
      publish({ status: 'ready', growth: next, backgroundKey: next.highestUnlockedStage || 'day1' });
      return true;
    } catch { publish({ status: view.growth ? 'stale' : 'error' }); return false; }
  }
  const resource = {
    start() {
      try {
        owner = browser.localStorage.getItem('userId');
        if (!owner || !browser.hasClientSession() || !api?.game || !apiFetch) { clear('unavailable'); return; }
        epoch = browser.crypto.randomUUID(); browser.sessionStorage.setItem(marker, epoch);
        send = createPlannerTransport({ owner, apiFetch, gameApiUrl: api.game, isActive: active });
        browser.addEventListener('storage', changed); browser.addEventListener('focus', checked); browser.addEventListener('pageshow', checked);
      } catch { clear('unavailable'); }
    },
    getView() { return active() ? view : { status: !send && !invalidated ? 'unavailable' : 'account-changed', growth: null, backgroundKey: 'day1' }; },
    accept,
    claimUnlock(visible) {
      const growth = view.growth;
      return claimAquariumUnlock({ browser, owner, growth, eligible: () => active() && view.status === 'ready' && view.growth === growth && visible() });
    },
    async refresh() {
      if (!send || !active() || request) return false;
      const controller = new AbortController(); request = controller;
      publish({ status: 'loading' });
      try {
        const response = await send({ type: 'get_aquarium_growth', data: {} }, { signal: controller.signal });
        if (!active()) return false;
        if (!response.ok) {
          if ([400, 401, 403, 409, 503].includes(response.status) || ['INVALID_RESPONSE', 'PLANNER_ACCOUNT_CHANGED'].includes(response.code)) clear('unavailable');
          else publish({ status: view.growth ? 'stale' : 'error' });
          return false;
        }
        if (response.data?.success !== true) { clear('unavailable'); return false; }
        return accept(response.data.data?.growth);
      } catch { if (active()) publish({ status: view.growth ? 'stale' : 'error' }); return false; }
      finally { if (request === controller) request = null; }
    },
    dispose() {
      disposed = true; request?.abort();
      browser?.removeEventListener('storage', changed); browser?.removeEventListener('focus', checked); browser?.removeEventListener('pageshow', checked);
    }
  };
  return resource;
}
