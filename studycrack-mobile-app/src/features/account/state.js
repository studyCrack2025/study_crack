import { TODAY_DATE } from '../../constants/runtime-defaults.js';
import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createAccountInitialState() {
  return {
    serverResource: {
      selectedPlan: '',
      personalEvents: [],
      calendarSyncStatus: 'idle'
    },
    localDraft: {
      checkoutPlan: 'Standard',
      duration: '4주',
      calendarEventDraft: null,
      myProfileNameDraft: '',
      myProfilePhoneDraft: '',
      myProfilePhoneCodeDraft: '',
      withdrawPassword: ''
    },
    ephemeralUi: {
      calendarSheetOpen: false,
      calendarSelectedDate: TODAY_DATE,
      calendarMonthAnchor: `${TODAY_DATE.slice(0, 7)}-01`,
      calendarEventFormOpen: false,
      calendarEventEditId: null,
      calendarSaving: false,
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
