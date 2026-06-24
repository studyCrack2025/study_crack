export function renderAppShell({ inner = '', withTab = false, dimmed = false, screen = '', tabBar = '' } = {}) {
  const tab = withTab ? (typeof tabBar === 'function' ? tabBar() : tabBar) : '';
  const screenAttr = screen ? ` data-screen="${String(screen).replace(/"/g, '&quot;')}"` : '';
  return `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content ${dimmed ? 'modal-lock' : ''}"${screenAttr}>${inner}</div>${tab}</div></div>`;
}
