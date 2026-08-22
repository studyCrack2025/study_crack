import { TabBar } from './TabBar.jsx';

export function AppScreenShell({
  afterScreen = null,
  children,
  dimmed = false,
  lockScroll = null,
  overlayOpen = null,
  overlays = null,
  screen,
  tab = '',
  title = ''
}) {
  const hasOpenOverlay = overlayOpen ?? Boolean(overlays);
  const shouldLockScroll = lockScroll ?? Boolean(dimmed || hasOpenOverlay);
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${shouldLockScroll ? 'modal-lock' : ''}`} data-screen={screen}>
          {title ? <div className="appbar"><button type="button" className="back-btn" data-action="back" aria-label="뒤로가기">←</button><div className="title">{title}</div></div> : null}
          {children}
        </div>
        {hasOpenOverlay && overlays ? <div className="app-screen-overlays">{overlays}</div> : null}
        {afterScreen}
        {tab ? <TabBar activeTab={tab} dimmed={dimmed} /> : null}
      </div>
    </div>
  );
}
