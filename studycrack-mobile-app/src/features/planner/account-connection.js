import { getMobileBrowserServices } from '../../shared/browser/mobile-runtime.js';
import { createPlannerTransport } from './api.js';

export function createPlannerAccountConnection(controller, onInvalidated, environment = getMobileBrowserServices()) {
  const { browser, api, apiFetch } = environment;
  const owner = browser?.localStorage?.getItem('userId');
  if (!owner || !browser?.hasClientSession?.() || !api?.game || !apiFetch) throw new Error('session');
  const markerKey = 'studycrackPlannerSession_v1';
  const epoch = browser.crypto.randomUUID();
  browser.sessionStorage.setItem(markerKey, epoch);
  let disposed = false;
  function active() {
    try { return !disposed && browser.hasClientSession() && browser.localStorage.getItem('userId') === owner && browser.sessionStorage.getItem(markerKey) === epoch; }
    catch { return false; }
  }
  const send = createPlannerTransport({ owner, apiFetch, gameApiUrl: api.game, isActive: active });
  const sync = controller.openAccountSync({ owner, locks: browser.navigator?.locks, uuid: () => browser.crypto.randomUUID(), getSession: () => active() ? { owner, epoch, send } : null });
  function dispose() {
    disposed = true; sync.dispose();
    browser.removeEventListener('storage', changed); browser.removeEventListener('focus', checked); browser.removeEventListener('pageshow', checked);
  }
  function invalidate() { dispose(); onInvalidated?.(); }
  function changed(event) { if (event.key === null || (event.key === 'userId' && event.oldValue !== event.newValue)) invalidate(); }
  function checked() { if (!active()) invalidate(); }
  browser.addEventListener('storage', changed); browser.addEventListener('focus', checked); browser.addEventListener('pageshow', checked);
  return { sync, active, dispose };
}
