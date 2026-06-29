export function renderAppShell({ inner = '', withTab = false, dimmed = false, screen = '', tabBar = '', overlays = '' } = {}) {
  const tab = withTab ? (typeof tabBar === 'function' ? tabBar() : tabBar) : '';
  const screenAttr = screen ? ` data-screen="${String(screen).replace(/"/g, '&quot;')}"` : '';
  // overlays(모달/시트)는 스크롤·transform이 걸린 .app-screen 밖, .app-frame 직속에 둔다.
  // .app-screen은 will-change:transform이라 그 안의 position 오버레이가 스크롤 컨테이너에 묶이고
  // backdrop-filter가 깨진다. 프레임 레벨이면 뷰포트 기준으로 정상 배치·블러된다.
  return `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content ${dimmed ? 'modal-lock' : ''}"${screenAttr}>${inner}</div>${overlays || ''}${tab}</div></div>`;
}
