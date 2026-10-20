import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createAccountInitialState() {
  return {
    serverResource: {
      productGuide: null,
      selectedPlan: '',
      personalEvents: [],
      calendarSupportsIdempotency: false,
      calendarSyncStatus: 'idle'
    },
    localDraft: {
      checkoutPlan: 'Standard',
      calendarEventDraft: null,
      myProfileNameDraft: '',
      myProfilePhoneDraft: '',
      myProfilePhoneCodeDraft: '',
      withdrawPassword: ''
    },
    ephemeralUi: {
      calendarEventFormOpen: false,
      calendarEventEditId: null,
      calendarSaving: false,
      calendarMutationError: '',
      calendarMutationRecovery: null,
      logoutModalOpen: false,
      withdrawModalOpen: false,
      withdrawSubmitting: false,
      phoneChangeModalOpen: false,
      phoneChangeStep: 'input',
      phoneChangeSending: false,
      myProfileEditOpen: false,
      profileDetailModalOpen: false,
      profilePhotoUploading: false
    }
  };
}

export const accountSlice = createFeatureSlice('account', createAccountInitialState);
