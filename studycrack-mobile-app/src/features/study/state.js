import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createStudyInitialState() {
  return {
    serverResource: {
      studyRecords: [],
      studySubjectRecords: [],
      lastCompletedSession: null,
      studySummary: null,
      studySummaryStatus: 'idle',
      studySummaryError: '',
      studySummaryRefreshTick: 0
    },
    localDraft: {
      activeStudySession: null,
      rewardPendingSessionId: '',
      studyStartDraft: { subject: '', activity: '', plannerItemId: '' }
    },
    ephemeralUi: {
      activePlannerItemId: '',
      activeStudySubject: '',
      completionError: '',
      rewardResult: null,
      studySubjectSheetOnlyPlanned: false,
      studySubjectSheetOpen: false,
      studySessionDetailsOpen: false,
      studyTimerRunning: false,
      studyTimerTick: 0,
      timerPhase: 'idle'
    }
  };
}

export const studySlice = createFeatureSlice('study', createStudyInitialState);
