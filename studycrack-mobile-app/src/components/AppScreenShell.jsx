import { TabBar } from './TabBar.jsx';

export function AppScreenShell({
  afterScreen = null,
  children,
  dimmed = false,
  overlays = null,
  screen,
  tab = '',
  title = ''
}) {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${dimmed || overlays ? 'modal-lock' : ''}`} data-screen={screen}>
          {title ? <div className="appbar"><button type="button" className="back-btn" data-action="back" aria-label="뒤로가기">←</button><div className="title">{title}</div></div> : null}
          {children}
        </div>
        {overlays ? <div className="app-screen-overlays" style={{ display: 'contents' }}>{overlays}</div> : null}
        {afterScreen}
        {tab ? <TabBar activeTab={tab} dimmed={dimmed} /> : null}
      </div>
    </div>
  );
}
