import { getTodayDateKey } from '../../constants/runtime-defaults.js';
import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createPlannerInitialState() {
  return {
    serverResource: {
      rankingRows: [],
      rankingStatus: 'idle',
      rankingError: '',
      rankingMe: null,
      rankingRefreshTick: 0
    },
    localDraft: {
      plannerItems: [],
      plannerDraft: { subject: '', content: '', durationChoice: '', customMinutes: '', start: '', end: '', detailSubject: '', activityType: '', memo: '' }
    },
    ephemeralUi: {
      rankingPeriod: 'daily',
      selectedDate: getTodayDateKey(),
      plannerCalendarMode: 'week',
      plannerEditIndex: null,
      showStudyBreakdown: false,
      expandedBreakdownSubject: ''
    }
  };
}

export const plannerSlice = createFeatureSlice('planner', createPlannerInitialState);
