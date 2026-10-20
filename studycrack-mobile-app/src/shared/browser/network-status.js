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
    banner.textContent = status === 'offline' ? '오프라인 상태예요. 표시 중인 정보는 최신 상태가 아닐 수 있어요.' : status === 'reconnecting' ? '다시 연결됐어요. 필요한 화면에서 다시 시도해주세요.' : '';
  };
  const offline = () => { win.clearTimeout(timer); set('offline'); };
  const online = () => { win.clearTimeout(timer); set('reconnecting'); timer = win.setTimeout(() => set('online'), 3000); };
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
