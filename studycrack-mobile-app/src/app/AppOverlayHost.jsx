import { useEffect } from 'react';
import { MySummarySheet } from '../screens/mypage/MySummarySheet.jsx';
import { ProductGuideError, ProductGuideOverlay } from '../screens/product-guide/ProductGuideOverlay.jsx';
import { StreakSummarySheet } from '../screens/mypage/StreakSummarySheet.jsx';
import { LogoutModal } from '../screens/mypage/LogoutModal.jsx';

export function AppOverlayHost({ localOpen = false, localOverlays = null, onDismiss, guideUi, guidePresentation, onGuideSuspend, streakOpen = false, streakPresentation, logoutModalOpen = false, ...profile }) {
  useEffect(() => {
    if (localOpen && (profile.drawerOpen || streakOpen)) onDismiss?.();
  }, [localOpen, onDismiss, profile.drawerOpen, streakOpen]);
  useEffect(() => { if (localOpen && guideUi?.open) onGuideSuspend?.(); }, [localOpen, guideUi?.open, onGuideSuspend]);
  if (!localOpen && !profile.drawerOpen && !streakOpen && !guideUi?.open && !guideUi?.error && !logoutModalOpen) return null;
  return (
    <div className="app-screen-overlays">
      {localOpen ? localOverlays : guideUi?.open ? <ProductGuideOverlay ui={guideUi} presentation={guidePresentation} /> : streakOpen ? <StreakSummarySheet open presentation={streakPresentation} /> : <MySummarySheet {...profile} />}
      {!localOpen && !profile.drawerOpen && !streakOpen && !guideUi?.open ? <ProductGuideError ui={guideUi} /> : null}
      {logoutModalOpen ? <LogoutModal open /> : null}
    </div>
  );
}
