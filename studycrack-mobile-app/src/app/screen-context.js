const ANALYSIS_CONTEXT_KEYS = [
  'analysisApiError', 'analysisApiStatus', 'analysisBacktraceError', 'analysisBacktracePlan',
  'analysisBacktraceStatus', 'analysisHighlightedSubject', 'analysisMajorOptions', 'analysisScoreView',
  'analysisSelected', 'analysisSimRecommendedIndex', 'analysisSimRows', 'analysisStatus',
  'canAccessStandard', 'canUseReverseProjection', 'dimmed', 'isAnalyzing', 'normalizedTargetMajor',
  'scoreExamType', 'scoreTierClass', 'scores', 'tabBarHtml'
];

export const SCREEN_CONTEXT_KEYS = Object.freeze({
  accountInfo: Object.freeze([
    'mbtiAnswers', 'mbtiModalOpen', 'mbtiResult', 'mbtiStep', 'myProfileEditOpen',
    'myProfileNameDraft', 'myProfilePhoneCodeDraft', 'myProfilePhoneDraft', 'phoneChangeModalOpen',
    'phoneChangeSending', 'phoneChangeStep', 'profilePhotoUploading', 'selectedPlan', 'user',
    'withdrawModalOpen', 'withdrawPassword'
  ]),
  addUniversity: Object.freeze([
    'analysisRecommended', 'analysisSearchList', 'analysisSearchTerm', 'analysisTargetList',
    'tabBarHtml', 'universityCatalogError', 'universityCatalogStatus',
    'universityRecommendationError', 'universityRecommendationStatus', 'universitySelectedName'
  ]),
  analysis: Object.freeze(ANALYSIS_CONTEXT_KEYS),
  authFindId: Object.freeze([]),
  authFindPw: Object.freeze([]),
  authLogin: Object.freeze([
    'authError', 'authSubmitting', 'findEmailModalOpen', 'foundEmailMasked', 'openTermsType',
    'resetPasswordEmail', 'resetPasswordModalOpen', 'resetPasswordSending', 'resetPasswordStep',
    'studycrackLogoSrc'
  ]),
  authSignup: Object.freeze([
    'authError', 'openTermsType', 'signupEmailSending',
    'signupError', 'signupForm', 'signupSmsSending', 'signupStep', 'signupSubmitting', 'signupTerms',
    'signupVerifiedEmail', 'signupVerifiedPhone', 'studycrackLogoSrc'
  ]),
  home: Object.freeze([
    'analysisRecommended', 'analysisSearchList', 'analysisSearchTerm', 'analysisTargetList',
    'breakdownDetailMap', 'breakdownSubjects', 'calendarEventDraft', 'calendarEventEditId', 'calendarEventFormOpen', 'calendarMonthCells',
    'calendarMonthLabel', 'calendarNearestDdayLabel', 'calendarNearestEvent', 'calendarSaving',
    'calendarSelectedDate', 'calendarSelectedEvents', 'calendarSheetOpen', 'calendarSyncStatus',
    'calendarWeekdays', 'canAccessBasic', 'crackySrc', 'dimmed', 'formatHms', 'formatMinutesLabel',
    'drawerOpen', 'expandedBreakdownSubject', 'hasClientSession', 'homeDragOffset', 'homeSlideIndex',
    'homeSlideMotion', 'homeTargets', 'icon', 'myRank', 'notiList', 'notiStatus', 'notifModalOpen',
    'percentile', 'plannedScheduleOptions', 'proReports', 'proReportsStatus', 'rankTier', 'rankTierLabel',
    'rankingProgress', 'rankingTotal', 'scoreExamType', 'scoreTierClass', 'showStudyBreakdown',
    'studySubjectSheetOnlyPlanned', 'studySubjectSheetOpen', 'studyTimerRunning', 'tabBarHtml',
    'targetDeleteCandidate', 'targetDeleteError', 'targetDeleteModalOpen', 'targetDeleteSaving',
    'todayPlannerItems', 'todayPlannerProgress',
    'todayPlannerTotalMinutes', 'todayRecord', 'todayStudySeconds', 'todaySubjectsWithTimer', 'user',
    'universityModalOpen', 'userLoadError', 'userLoadStatus', 'weeklyReports', 'weeklyReportsStatus'
  ]),
  my: Object.freeze([
    'dimmed', 'icon', 'mbtiAnswers', 'mbtiModalOpen', 'mbtiResult', 'mbtiStep', 'plannerItems',
    'profileDetailModalOpen', 'profilePhotoUploading', 'selectedPlan', 'studyRecords',
    'studyTimerRunning', 'studyTimerSecondsRef', 'tabBarHtml', 'user'
  ]),
  ob3: Object.freeze(['crackySrc', 'mbtiAnswers', 'mbtiModalOpen', 'mbtiResult', 'mbtiStep']),
  planner: Object.freeze([
    'dimmed', 'plannerCalendarMode', 'plannerCalendarMonthCells', 'plannerEditIndex', 'plannerEditItem',
    'plannerFeedback', 'plannerMonthLabel', 'plannerViewItems', 'plannerWeekDates',
    'selectedPlannerDate', 'selectedPlannerDateKey', 'selectedPlannerWeekday', 'tabBarHtml'
  ]),
  plannerAdd: Object.freeze(['appbar', 'selectedPlannerDate', 'selectedPlannerDateKey']),
  privacyPolicy: Object.freeze(['termsContent']),
  settingsMain: Object.freeze(['logoutModalOpen']),
  settingsTermsPicker: Object.freeze(['openTermsType', 'termsContent']),
  strategy: Object.freeze([
    'coachingAnswers', 'coachingDropReasons', 'coachingExamFiles', 'coachingExamScores',
    'coachingExamType', 'coachingPlannerFiles', 'coachingSheetOpen', 'coachingStep',
    'coachingSubjectRows', 'coachingSubmitting', 'coachingTrend', 'coachingView', 'dimmed',
    'tabBarHtml', 'weeklyReports', 'weeklyReportsStatus'
  ]),
  termsScreen: Object.freeze(['termsContent'])
});

const SCREEN_ACTION_KEYS = Object.freeze({
  authSignup: Object.freeze({ group: 'auth', keys: ['setSignupError', 'setSignupTerms'] })
});

export function createScreenContext(screen, context = {}, actionGroups = {}) {
  const keys = SCREEN_CONTEXT_KEYS[screen];
  if (!keys) throw new Error(`React screen context 계약 누락: ${screen}`);
  const selected = Object.fromEntries(keys.map((key) => [key, context[key]]));
  const actionSpec = SCREEN_ACTION_KEYS[screen];
  if (!actionSpec) return selected;
  const actions = actionGroups[actionSpec.group] || {};
  return {
    ...selected,
    ...Object.fromEntries(actionSpec.keys.map((key) => {
      if (typeof actions[key] !== 'function') throw new Error(`[${screen}] 필수 screen action 누락: ${key}`);
      return [key, actions[key]];
    }))
  };
}
