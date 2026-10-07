import { exitMySurface } from './my-exit-motion.js';

function restoresDrawer(state, target, depth) {
  const origin = state.myReturn;
  return Boolean(origin && depth <= origin.depth && target === origin.screen && state.userLoadStatus === 'ready' && origin.owner === (state.user?.email || ''));
}

export function createMyNavigation() {
  let snapshot = {};
  return {
    deferBack(state, commit, { target, depth } = {}) {
      if (!state.myReturn || state.myReturn.restored) return false;
      return exitMySurface(globalThis.document?.querySelector('.app-content[data-my-flow]'), commit, { revealDrawer: restoresDrawer(state, target, depth) });
    },
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
      const restore = restoresDrawer(state, target, depth);
      return { drawerOpen: restore, myReturn: restore ? { ...state.myReturn, restored: true } : null };
    }
  };
}
