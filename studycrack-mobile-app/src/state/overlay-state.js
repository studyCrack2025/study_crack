import { createFeatureSlice } from './create-feature-slice.js';

export function createOverlayInitialState() {
  return {
    serverResource: {},
    localDraft: {},
    ephemeralUi: {
      streakSummary: { open: false, returnTarget: '' },
      productGuideUi: { open: false, step: 1, mode: 'auto', returnTarget: '', busy: false, error: '' },
      upgradePromptTier: '',
      upgradePromptTarget: '',
      lockedFeatureTarget: '',
      lockedFeatureTier: '',
      lockedFeatureLabel: ''
    }
  };
}

export const overlaySlice = createFeatureSlice('overlay', createOverlayInitialState);
