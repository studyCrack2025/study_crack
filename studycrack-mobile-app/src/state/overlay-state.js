import { createFeatureSlice } from './create-feature-slice.js';

export function createOverlayInitialState() {
  return {
    serverResource: {},
    localDraft: {},
    ephemeralUi: {
      upgradePromptTier: '',
      upgradePromptTarget: '',
      lockedFeatureTarget: '',
      lockedFeatureTier: '',
      lockedFeatureLabel: ''
    }
  };
}

export const overlaySlice = createFeatureSlice('overlay', createOverlayInitialState);
