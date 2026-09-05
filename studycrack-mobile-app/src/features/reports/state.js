import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createReportsInitialState() {
  return {
    serverResource: {
      proReports: [],
      proReportsStatus: 'idle',
      proReportsError: '',
      weeklyReports: [],
      weeklyReportsStatus: 'idle',
      weeklyReportsError: ''
    },
    localDraft: {
      proRequestText: '',
      proEliteMonth: '26년 4월'
    },
    ephemeralUi: {
      reportsRefreshTick: 0,
      proRequestModalOpen: false,
      proRequestSubmitting: false
    }
  };
}

export const reportsSlice = createFeatureSlice('reports', createReportsInitialState);
