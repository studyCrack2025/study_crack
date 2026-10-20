import { useCallback, useEffect } from 'react';

export function useAppOverlayBridge({ registry, setState, state, myPresentation }) {
  const dismiss = useCallback(() => setState({ drawerOpen: false, myReturn: null }), [setState]);
  const eligible = state.screen === 'timer' && state.userLoadStatus === 'ready';
  useEffect(() => {
    if (state.drawerOpen && !eligible) dismiss();
    else if (state.myReturn && state.userLoadStatus !== 'ready') dismiss();
  }, [dismiss, eligible, state.drawerOpen, state.myReturn, state.userLoadStatus]);
  const open = Boolean(eligible && state.drawerOpen && registry?.AppOverlayHost);
  return {
    Host: registry?.AppOverlayHost,
    myFlow: Boolean(state.myReturn && !state.myReturn.restored) || state.streakSummary?.returnTarget === 'summary' || state.screen === 'my' || state.screen === 'accountInfo',
    open,
    dismiss,
    props: {
      drawerOpen: open,
      returnSnapshot: state.myReturn?.restored ? state.myReturn : state.streakSummary?.returnSnapshot,
      myPresentation
    }
  };
}
