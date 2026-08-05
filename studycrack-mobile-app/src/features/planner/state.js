import { TODAY_DATE } from '../../constants/runtime-defaults.js';
import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createPlannerInitialState() {
  return {
    serverResource: {
      plannerItems: [],
      studyRecords: [],
      studySubjectRecords: [],
      activeStudySession: null,
      rankingRows: [],
      rankingStatus: 'idle',
      rankingError: '',
      rankingMe: null,
      rankingRefreshTick: 0
    },
    localDraft: {
      plannerDraft: { subject: '', content: '', durationChoice: '', customMinutes: '', start: '', end: '', detailSubject: '', activityType: '', memo: '' }
    },
    ephemeralUi: {
      rankingPeriod: 'daily',
      selectedDate: TODAY_DATE,
      plannerCalendarMode: 'week',
      plannerEditIndex: null,
      studyTimerRunning: false,
      studyTimerTick: 0,
      activeStudySubject: '',
      activePlannerItemId: '',
      studySubjectSheetOpen: false,
      studySubjectSheetOnlyPlanned: false,
      showStudyBreakdown: false,
      expandedBreakdownSubject: ''
    }
  };
}

export const plannerSlice = createFeatureSlice('planner', createPlannerInitialState);
