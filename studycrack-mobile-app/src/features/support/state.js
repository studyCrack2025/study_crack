import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createSupportInitialState() {
  return {
    serverResource: {
      qnaHistory: [],
      qnaStatus: 'idle'
    },
    localDraft: {
      qnaDraftTitle: '',
      qnaDraftContent: ''
    },
    ephemeralUi: {
      openFaq: '',
      qnaComposerOpen: false,
      qnaSubmitting: false
    }
  };
}

export const supportSlice = createFeatureSlice('support', createSupportInitialState);
