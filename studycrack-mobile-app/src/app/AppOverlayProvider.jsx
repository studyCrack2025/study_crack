import { AppOverlayContext } from '../components/AppOverlayContext.js';
import { useProductGuide } from '../features/product-guide/use-product-guide.js';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AquariumGrowthProvider } from '../features/gamification/AquariumGrowthProvider.jsx';
import { useAppOverlayBridge } from './use-app-overlay-bridge.js';
import { cancelMyExits, captureMyDismiss } from './my-exit-motion.js';
import { MySummarySheet } from '../screens/mypage/MySummarySheet.jsx';
import { useMyBrowserBack } from './use-my-browser-back.js';
import { useStudyDayClock } from '../features/study/use-study-day-clock.js';
import { useStudySummaryResource } from '../features/study/use-study-summary-resource.js';
import { hydrateStudyRecovery } from '../features/study/recovery-storage.js';

export function AppOverlayProvider({ value: input, guide, children }) {
  const value = useAppOverlayBridge(input);
  const guideUi = useProductGuide(guide);
  const { state, setState } = guide;
  const recoveredOwner = useRef('');
  const owner = state.user?.sub || state.user?.email || '';
  useLayoutEffect(() => {
    if (state.userLoadStatus !== 'ready' || !owner || recoveredOwner.current === owner) return;
    recoveredOwner.current = owner;
    setState(hydrateStudyRecovery(state));
  }, [owner, state.userLoadStatus, setState]);
  useStudyDayClock(state, setState);
  useStudySummaryResource({ enabled: state.userLoadStatus === 'ready' && guide.api.hasClientSession(), dayKey: state.studyKoreaDate,
    owner: state.user?.sub || state.user?.email, getApiBinding: guide.api.getUserApiBinding, refreshTick: state.studySummaryRefreshTick, setState });
  useMyBrowserBack(state.userLoadStatus === 'ready' && Boolean(state.drawerOpen || state.myReturn), guide.nav.back);
  const [myExiting, setMyExiting] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  useEffect(() => {
    let timer;
    const saved = () => { setSaveNotice(true); clearTimeout(timer); timer = setTimeout(() => setSaveNotice(false), 4000); };
    setSaveNotice(false);
    document.addEventListener('sc-profile-saved', saved);
    return () => { clearTimeout(timer); document.removeEventListener('sc-profile-saved', saved); };
  }, [state.user?.email]);
  useEffect(() => {
    const update = event => setMyExiting(event.detail === true);
    document.addEventListener('sc-my-exit', update);
    return () => document.removeEventListener('sc-my-exit', update);
  }, []);
  useEffect(() => cancelMyExits, [state.user?.sub, state.user?.email, state.userLoadStatus]);
  useEffect(() => { setState({ logoutModalOpen: false }); }, [state.screen, state.loggedIn, setState]);
  const eligible = state.userLoadStatus === 'ready' && guide.api.hasClientSession() && ['timer', 'my'].includes(state.screen);
  const streakOpen = Boolean(eligible && state.streakSummary?.open);
  const dismissStreak = useCallback(() => setState({ streakSummary: { open: false, returnTarget: '' } }), [setState]);
  useEffect(() => { if (!eligible && state.streakSummary?.open) dismissStreak(); }, [dismissStreak, eligible, state.streakSummary?.open]);
  const dismiss = useCallback(() => { value.dismiss(); dismissStreak(); }, [value.dismiss, dismissStreak]);
  const bridge = { ...value, dismiss, open: value.open || guideUi.open || streakOpen || Boolean(state.logoutModalOpen), props: { ...value.props, logoutModalOpen: Boolean(state.logoutModalOpen), streakOpen, streakPresentation: guide.presentation.streak, guideUi, guidePresentation: guide.presentation, onGuideSuspend: () => guide.actionsRef.current?.suspend() } };
  const keepMy = state.userLoadStatus === 'ready' && Boolean(value.props.drawerOpen || state.myReturn);
  const covered = !value.props.drawerOpen;
  return <AquariumGrowthProvider enabled={state.userLoadStatus === 'ready' && guide.api.hasClientSession()} screen={state.screen} refreshTick={state.gameRefreshTick}><AppOverlayContext.Provider value={bridge}><div className="my-navigation-layer" data-my-covered={keepMy && covered || undefined} style={{ display: 'contents' }} onClickCapture={captureMyDismiss}>{children}{saveNotice ? <div className="profile-save-notice" role="status">정성조사서를 저장했어요.</div> : null}<div className="my-persistent-host" data-covered={covered || undefined} data-exiting={myExiting || undefined} onClick={children.props.onClick} onChange={children.props.onChange} onInput={children.props.onInput} onBlur={children.props.onBlur}><MySummarySheet {...value.props} drawerOpen={keepMy} suspended={covered} /></div></div></AppOverlayContext.Provider></AquariumGrowthProvider>;
}
