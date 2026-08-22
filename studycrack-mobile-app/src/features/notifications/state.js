import { DEFAULT_NOTIFICATIONS } from '../../constants/runtime-defaults.js';
import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createNotificationsInitialState() {
  return {
    serverResource: {
      notifications: { ...DEFAULT_NOTIFICATIONS },
      notiList: [],
      notiStatus: 'idle'
    },
    localDraft: {},
    ephemeralUi: {
      notiPage: 0,
      notiExpandedId: '',
      notiDetailId: '',
      notifModalOpen: false
    }
  };
}

export const notificationsSlice = createFeatureSlice('notifications', createNotificationsInitialState);
