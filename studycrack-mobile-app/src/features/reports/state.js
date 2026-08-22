import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createReportsInitialState() {
  return {
    serverResource: {
      proReports: [],
      proReportsStatus: 'idle',
      weeklyReports: [],
      weeklyReportsStatus: 'idle'
    },
    localDraft: {
      proRequestText: '',
      proEliteMonth: '26년 4월'
    },
    ephemeralUi: {
      proRequestModalOpen: false,
      proRequestSubmitting: false
    }
  };
}

export const reportsSlice = createFeatureSlice('reports', createReportsInitialState);
