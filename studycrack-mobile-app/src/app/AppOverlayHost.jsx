import { useEffect } from 'react';
import { ProfileDrawer } from '../screens/mypage/ProfileDrawer.jsx';

export function AppOverlayHost({ localOpen = false, localOverlays = null, onDismiss, ...profile }) {
  useEffect(() => {
    if (localOpen && profile.drawerOpen) onDismiss?.();
  }, [localOpen, onDismiss, profile.drawerOpen]);
  if (!localOpen && !profile.drawerOpen) return null;
  return (
    <div className="app-screen-overlays">
      {localOpen ? localOverlays : <ProfileDrawer {...profile} />}
    </div>
  );
}
