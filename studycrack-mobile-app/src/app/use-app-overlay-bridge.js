import { useCallback, useEffect } from 'react';

export function useAppOverlayBridge({ registry, setState, state }) {
  const dismiss = useCallback(() => setState({ drawerOpen: false }), [setState]);
  const eligible = state.screen === 'timer' && state.userLoadStatus === 'ready';
  useEffect(() => {
    if (state.drawerOpen && !eligible) dismiss();
  }, [dismiss, eligible, state.drawerOpen]);
  const open = Boolean(eligible && state.drawerOpen && registry?.AppOverlayHost);
  return {
    Host: registry?.AppOverlayHost,
    open,
    dismiss,
    props: {
      drawerOpen: open,
      user: state.user,
      selectedPlan: state.selectedPlan,
      gameProfile: state.gameProfile,
      gameProfileStatus: state.gameProfileStatus,
      studySummary: state.studySummary,
      studySummaryStatus: state.studySummaryStatus
    }
  };
}
