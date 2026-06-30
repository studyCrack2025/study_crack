export function renderAppShell({ inner = '', withTab = false, dimmed = false, screen = '', tabBar = '', overlays = '' } = {}) {
  const tab = withTab ? (typeof tabBar === 'function' ? tabBar() : tabBar) : '';
  const screenAttr = screen ? ` data-screen="${String(screen).replace(/"/g, '&quot;')}"` : '';
  // overlays(모달/시트)는 스크롤·transform이 걸린 .app-screen 밖, .app-frame 직속에 둔다.
  // .app-screen은 will-change:transform이라 그 안의 position 오버레이가 스크롤 컨테이너에 묶이고
  // backdrop-filter가 깨진다. 프레임 레벨이면 뷰포트 기준으로 정상 배치·블러된다.
  // 문자열 화면은 setState마다 innerHTML 전체 교체로 모달 노드가 재생성돼 진입 애니메이션이 재생되며
  // 깜빡인다. .app-screen-overlays로 감싸 그 안 모달의 entrance 애니메이션만 끈다(display:contents라 배치엔 영향 없음).
  const overlayLayer = overlays ? `<div class="app-screen-overlays" style="display:contents">${overlays}</div>` : '';
  return `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content ${dimmed ? 'modal-lock' : ''}"${screenAttr}>${inner}</div>${overlayLayer}${tab}</div></div>`;
}
