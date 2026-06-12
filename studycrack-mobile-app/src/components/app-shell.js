export function renderAppShell({ inner = '', withTab = false, dimmed = false, tabBar = '' } = {}) {
  const tab = withTab ? (typeof tabBar === 'function' ? tabBar() : tabBar) : '';
  return `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content ${dimmed ? 'modal-lock' : ''}">${inner}</div>${tab}</div></div>`;
}
