import { AppOverlayContext } from '../components/AppOverlayContext.js';
import { useProductGuide } from '../features/product-guide/use-product-guide.js';
import { useCallback, useEffect } from 'react';
import { AquariumGrowthProvider } from '../features/gamification/AquariumGrowthProvider.jsx';

export function AppOverlayProvider({ value, guide, children }) {
  const guideUi = useProductGuide(guide);
  const { state, setState } = guide;
  const eligible = state.userLoadStatus === 'ready' && guide.api.hasClientSession() && ['timer', 'my'].includes(state.screen);
  const streakOpen = Boolean(eligible && state.streakSummary?.open);
  const dismissStreak = useCallback(() => setState({ streakSummary: { open: false, returnTarget: '' } }), [setState]);
  useEffect(() => { if (!eligible && state.streakSummary?.open) dismissStreak(); }, [dismissStreak, eligible, state.streakSummary?.open]);
  const dismiss = useCallback(() => { value.dismiss(); dismissStreak(); }, [value.dismiss, dismissStreak]);
  const bridge = { ...value, dismiss, open: value.open || guideUi.open || streakOpen, props: { ...value.props, streakOpen, streakPresentation: guide.presentation.streak, guideUi, guidePresentation: guide.presentation, onGuideSuspend: () => guide.actionsRef.current?.suspend() } };
  return <AquariumGrowthProvider enabled={state.userLoadStatus === 'ready' && guide.api.hasClientSession()} screen={state.screen} refreshTick={state.gameRefreshTick}><AppOverlayContext.Provider value={bridge}>{children}</AppOverlayContext.Provider></AquariumGrowthProvider>;
}
