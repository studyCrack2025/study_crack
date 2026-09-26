import { AppOverlayContext } from '../components/AppOverlayContext.js';
import { useProductGuide } from '../features/product-guide/use-product-guide.js';
import { useCallback, useEffect } from 'react';
import { AquariumGrowthProvider } from '../features/gamification/AquariumGrowthProvider.jsx';
import { useAppOverlayBridge } from './use-app-overlay-bridge.js';

export function AppOverlayProvider({ value: input, guide, children }) {
  const value = useAppOverlayBridge(input);
  const guideUi = useProductGuide(guide);
  const { state, setState } = guide;
  useEffect(() => { setState({ logoutModalOpen: false }); }, [state.screen, state.loggedIn, setState]);
  const eligible = state.userLoadStatus === 'ready' && guide.api.hasClientSession() && ['timer', 'my'].includes(state.screen);
  const streakOpen = Boolean(eligible && state.streakSummary?.open);
  const dismissStreak = useCallback(() => setState({ streakSummary: { open: false, returnTarget: '' } }), [setState]);
  useEffect(() => { if (!eligible && state.streakSummary?.open) dismissStreak(); }, [dismissStreak, eligible, state.streakSummary?.open]);
  const dismiss = useCallback(() => { value.dismiss(); dismissStreak(); }, [value.dismiss, dismissStreak]);
  const bridge = { ...value, dismiss, open: value.open || guideUi.open || streakOpen || Boolean(state.logoutModalOpen), props: { ...value.props, logoutModalOpen: Boolean(state.logoutModalOpen), streakOpen, streakPresentation: guide.presentation.streak, guideUi, guidePresentation: guide.presentation, onGuideSuspend: () => guide.actionsRef.current?.suspend() } };
  return <AquariumGrowthProvider enabled={state.userLoadStatus === 'ready' && guide.api.hasClientSession()} screen={state.screen} refreshTick={state.gameRefreshTick}><AppOverlayContext.Provider value={bridge}>{children}</AppOverlayContext.Provider></AquariumGrowthProvider>;
}
