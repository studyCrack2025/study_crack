import { createFeatureSlice } from './create-feature-slice.js';
import { getTodayDateKey, getKoreaDateKey } from '../constants/runtime-defaults.js';

export function createNavigationInitialState() {
  return {
    serverResource: {},
    localDraft: {},
    ephemeralUi: {
      todayDate: getTodayDateKey(),
      studyKoreaDate: getKoreaDateKey(),
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
