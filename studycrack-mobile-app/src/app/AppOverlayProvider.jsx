import { AppOverlayContext } from '../components/AppOverlayContext.js';
import { useProductGuide } from '../features/product-guide/use-product-guide.js';
import { useCallback, useEffect, useState } from 'react';
import { AquariumGrowthProvider } from '../features/gamification/AquariumGrowthProvider.jsx';
import { useAppOverlayBridge } from './use-app-overlay-bridge.js';
import { cancelMyExits, captureMyDismiss } from './my-exit-motion.js';
import { MySummaryContent } from '../screens/mypage/MySummaryContent.jsx';
import { MyMenuList } from '../screens/mypage/MyMenuList.jsx';
import { useMyBrowserBack } from './use-my-browser-back.js';

export function AppOverlayProvider({ value: input, guide, children }) {
  const value = useAppOverlayBridge(input);
  const guideUi = useProductGuide(guide);
  const { state, setState } = guide;
  useMyBrowserBack(state.userLoadStatus === 'ready' && Boolean(state.drawerOpen || state.myReturn), guide.nav.back);
  const [myExiting, setMyExiting] = useState(false);
  useEffect(() => {
    const update = event => setMyExiting(event.detail === true);
    document.addEventListener('sc-my-exit', update);
    return () => document.removeEventListener('sc-my-exit', update);
  }, []);
  useEffect(() => cancelMyExits, [state.user, state.userLoadStatus]);
  useEffect(() => { setState({ logoutModalOpen: false }); }, [state.screen, state.loggedIn, setState]);
  const eligible = state.userLoadStatus === 'ready' && guide.api.hasClientSession() && ['timer', 'my'].includes(state.screen);
  const streakOpen = Boolean(eligible && state.streakSummary?.open);
  const dismissStreak = useCallback(() => setState({ streakSummary: { open: false, returnTarget: '' } }), [setState]);
  useEffect(() => { if (!eligible && state.streakSummary?.open) dismissStreak(); }, [dismissStreak, eligible, state.streakSummary?.open]);
  const dismiss = useCallback(() => { value.dismiss(); dismissStreak(); }, [value.dismiss, dismissStreak]);
  const bridge = { ...value, dismiss, open: value.open || guideUi.open || streakOpen || Boolean(state.logoutModalOpen), props: { ...value.props, logoutModalOpen: Boolean(state.logoutModalOpen), streakOpen, streakPresentation: guide.presentation.streak, guideUi, guidePresentation: guide.presentation, onGuideSuspend: () => guide.actionsRef.current?.suspend() } };
  bridge.returnBackdrop = myExiting && state.myReturn && !state.myReturn.restored && state.userLoadStatus === 'ready' ? <aside className="my-return-backdrop" inert="" aria-hidden="true"><header className="my-summary-head"><h1>마이</h1></header><div className="my-summary-body" ref={node => { if (node) node.scrollTop = state.myReturn.scroll || 0; }}><MySummaryContent presentation={input.myPresentation} showIdentity /><MyMenuList compact /></div></aside> : null;
  return <AquariumGrowthProvider enabled={state.userLoadStatus === 'ready' && guide.api.hasClientSession()} screen={state.screen} refreshTick={state.gameRefreshTick}><AppOverlayContext.Provider value={bridge}><div style={{ display: 'contents' }} onClickCapture={captureMyDismiss}>{children}</div></AppOverlayContext.Provider></AquariumGrowthProvider>;
}
