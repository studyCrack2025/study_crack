import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createCoachingInitialState() {
  return {
    serverResource: {},
    localDraft: {
      coachingMonth: '26년 4월',
      coachingSubjectRows: [],
      coachingPlannerFiles: [],
      coachingExamType: '',
      coachingExamFiles: [],
      coachingExamScores: {},
      coachingTrend: '',
      coachingDropReasons: [],
      coachingAnswers: { step4Reason: '', step5: '', step6: '', step7: '', step8: '' }
    },
    ephemeralUi: {
      coachingSubmitting: false,
      coachingSubmitted: false,
      coachingView: 'sessions',
      coachingSheetOpen: false,
      coachingStep: 1
    }
  };
}

export const coachingSlice = createFeatureSlice('coaching', createCoachingInitialState);
