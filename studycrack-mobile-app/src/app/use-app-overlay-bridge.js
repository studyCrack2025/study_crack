import { useCallback, useEffect } from 'react';

export function useAppOverlayBridge({ registry, setState, state, myPresentation }) {
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
      myPresentation
    }
  };
}
