import { createFeatureSlice } from './create-feature-slice.js';

export function createNavigationInitialState() {
  return {
    serverResource: {},
    localDraft: {},
    ephemeralUi: {
      screen: 'splash',
      tab: 'timer',
      history: [],
      loading: true,
      loadingFadeOut: false,
      error: false,
      drawerOpen: false,
      myReturn: null
    }
  };
}

export const navigationSlice = createFeatureSlice('navigation', createNavigationInitialState);
