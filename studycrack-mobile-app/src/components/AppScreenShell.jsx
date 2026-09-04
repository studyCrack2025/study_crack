import { TabBar } from './TabBar.jsx';
import { AppContent, AppFrame, SecondaryScreenHeader } from './AppFrame.js';

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
    <AppFrame>
      <AppContent inactive={hasOpenOverlay} lockScroll={shouldLockScroll} screen={screen}>
        <SecondaryScreenHeader title={title} />
        {children}
      </AppContent>
      {hasOpenOverlay && overlays ? <div className="app-screen-overlays">{overlays}</div> : null}
      {afterScreen}
      {tab ? <TabBar activeTab={tab} dimmed={dimmed || hasOpenOverlay} inactive={hasOpenOverlay} /> : null}
    </AppFrame>
  );
}
