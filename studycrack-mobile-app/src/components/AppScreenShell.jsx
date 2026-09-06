import { useContext } from 'react';
import { AppOverlayContext } from './AppOverlayContext.js';
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
  const bridge = useContext(AppOverlayContext);
  const GlobalHost = bridge?.Host;
  const localOpen = overlayOpen ?? Boolean(overlays);
  const hasOpenOverlay = localOpen || Boolean(GlobalHost && bridge.open);
  const shouldLockScroll = hasOpenOverlay || (lockScroll ?? dimmed);
  return (
    <AppFrame>
      <AppContent inactive={hasOpenOverlay} lockScroll={shouldLockScroll} screen={screen}>
        <SecondaryScreenHeader title={title} />
        {children}
      </AppContent>
      {GlobalHost ? <GlobalHost {...bridge.props} localOpen={localOpen} localOverlays={overlays} onDismiss={bridge.dismiss} /> : hasOpenOverlay && overlays ? <div className="app-screen-overlays">{overlays}</div> : null}
      {afterScreen}
      {tab ? <TabBar activeTab={tab} dimmed={dimmed || hasOpenOverlay} inactive={hasOpenOverlay} /> : null}
    </AppFrame>
  );
}
