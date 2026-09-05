import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createSupportInitialState() {
  return {
    serverResource: {
      qnaHistory: [],
      qnaStatus: 'idle',
      qnaError: ''
    },
    localDraft: {
      qnaDraftTitle: '',
      qnaDraftContent: ''
    },
    ephemeralUi: {
      qnaRefreshTick: 0,
      openFaq: '',
      qnaComposerOpen: false,
      qnaSubmitting: false
    }
  };
}

export const supportSlice = createFeatureSlice('support', createSupportInitialState);
