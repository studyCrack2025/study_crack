export function attachNetworkStatus({ doc = document, win = window } = {}) {
  const root = doc?.documentElement;
  if (!root || !win) return () => {};
  const banner = doc.createElement('div');
  banner.className = 'sc-network-status';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-atomic', 'true');
  doc.body?.append(banner);
  let timer = 0;
  const set = (status) => {
    root.dataset.networkStatus = status;
    banner.textContent = status === 'offline' ? '오프라인 상태예요' : status === 'reconnecting' ? '연결을 다시 확인하고 있어요' : '';
  };
  const offline = () => { win.clearTimeout(timer); set('offline'); };
  const online = () => { set('reconnecting'); timer = win.setTimeout(() => set('online'), 1800); };
  set(win.navigator?.onLine === false ? 'offline' : 'online');
  win.addEventListener('offline', offline);
  win.addEventListener('online', online);
  return () => {
    win.clearTimeout(timer);
    win.removeEventListener('offline', offline);
    win.removeEventListener('online', online);
    banner.remove();
    delete root.dataset.networkStatus;
  };
}
