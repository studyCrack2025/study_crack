export function createMyNavigation() {
  let snapshot = {};
  return {
    remember(value) { snapshot = value || {}; },
    goto(state, target, mainTab) {
      if (state.drawerOpen && !mainTab) {
        const myReturn = { screen: state.screen, depth: state.history.length, owner: state.user?.email || '', ...snapshot };
        snapshot = {};
        return { myReturn, drawerOpen: false };
      }
      if (state.myReturn && (mainTab || target.startsWith('auth'))) return { myReturn: null, history: state.history.slice(0, state.myReturn.depth) };
      return {};
    },
    back(state, target, depth) {
      if (!state.myReturn || depth > state.myReturn.depth) return {};
      const restore = target === state.myReturn.screen && state.userLoadStatus === 'ready' && state.myReturn.owner === (state.user?.email || '');
      return { drawerOpen: restore, myReturn: restore ? { ...state.myReturn, restored: true } : null };
    }
  };
}
