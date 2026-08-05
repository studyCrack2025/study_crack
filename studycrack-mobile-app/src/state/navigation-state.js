import { createFeatureSlice } from './create-feature-slice.js';

export function createNavigationInitialState() {
  return {
    serverResource: {},
    localDraft: {},
    ephemeralUi: {
      screen: 'splash',
      tab: 'home',
      history: [],
      loading: true,
      loadingFadeOut: false,
      error: false,
      drawerOpen: false
    }
  };
}

export const navigationSlice = createFeatureSlice('navigation', createNavigationInitialState);
