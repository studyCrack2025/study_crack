const ANALYSIS_CONTEXT_KEYS = [
  'analysisApiError', 'analysisApiStatus', 'analysisBacktraceError', 'analysisBacktracePlan',
  'analysisBacktraceStatus', 'analysisHighlightedSubject', 'analysisMajorOptions', 'analysisScoreView',
  'analysisSelected', 'analysisSimRecommendedIndex', 'analysisSimRows', 'analysisStatus', 'analysisCalculationRequested',
  'canAccessStandard', 'canUseReverseProjection', 'dimmed', 'isAnalyzing', 'normalizedTargetMajor',
  'scoreExamType', 'scoreTierClass', 'scores', 'tab'
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
    'tab', 'universityCatalogError', 'universityCatalogStatus',
    'universityRecommendationError', 'universityRecommendationStatus', 'universitySelectedName'
  ]),
  analysis: Object.freeze(ANALYSIS_CONTEXT_KEYS),
  aquarium: Object.freeze([
    'activeFish', 'aquariumActionError', 'aquariumActionStatus', 'aquariumResult',
    'aquariumDrawRevealStep', 'aquariumMode', 'aquariumSelectedFishId', 'aquariumStarterSpeciesId', 'dimmed', 'fishCatalog',
    'fishCatalogError', 'fishCatalogStatus', 'fishCount', 'fishInventory', 'gameProfile',
    'gameProfileError', 'gameProfileStatus', 'pendingDraw', 'pendingDrawError', 'pendingDrawStatus', 'tab', 'todayPlannerItems'
  ]),
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
  customerSupport: Object.freeze([
    'openFaq', 'qnaComposerOpen', 'qnaDraftContent', 'qnaDraftTitle', 'qnaHistory', 'qnaStatus', 'qnaSubmitting'
  ]),
  lockedFeature: Object.freeze([
    'lockedFeatureLabel', 'lockedFeatureTarget', 'lockedFeatureTier', 'tab', 'upgradePromptTarget', 'upgradePromptTier'
  ]),
  my: Object.freeze([
    'dimmed', 'mbtiAnswers', 'mbtiModalOpen', 'mbtiResult', 'mbtiStep', 'plannerItems',
    'profileDetailModalOpen', 'profilePhotoUploading', 'selectedPlan', 'studyRecords',
    'studyTimerRunning', 'studyTimerSecondsRef', 'tab', 'user'
  ]),
  notificationList: Object.freeze(['notiDetailId', 'notiList', 'notiPage', 'notiStatus']),
  notificationSettings: Object.freeze(['notifications']),
  ob1: Object.freeze(['crackySrc', 'obGoalText', 'obGradeStatus', 'obQuestionText', 'obSchoolName', 'obTrack']),
  ob2: Object.freeze(['crackySrc', 'obExamType']),
  ob3: Object.freeze(['crackySrc', 'mbtiAnswers', 'mbtiModalOpen', 'mbtiResult', 'mbtiStep']),
  ob4: Object.freeze([
    'analysisGaugeColor', 'analysisGaugeFill', 'analysisSelected', 'analysisStatus', 'analysisStatusColor',
    'crackySrc', 'liveCurrentScore', 'mbtiResult', 'scoreTierClass', 'targetMajor'
  ]),
  ob5: Object.freeze([
    'activeScoreView', 'analysisApiStatus', 'analysisSelected', 'analysisSimRows', 'analysisTargetScore',
    'canUseReverseProjection', 'crackySrc', 'gaugeCurrent', 'gaugeCurrentPct', 'gaugePassPct',
    'gaugeSafePct', 'gaugeTarget', 'gaugeTargetPct', 'ob3IsAnalyzing', 'scoreDragOffset',
    'scoreSlideMotion', 'scoreState', 'scoreTierClass', 'scores'
  ]),
  on1: Object.freeze([]),
  on2: Object.freeze([]),
  on3: Object.freeze([]),
  planner: Object.freeze([
    'dimmed', 'plannerCalendarMode', 'plannerCalendarMonthCells', 'plannerEditIndex', 'plannerEditItem',
    'plannerFeedback', 'plannerMonthLabel', 'plannerViewItems', 'plannerWeekDates',
    'calendarEventDraft', 'calendarEventEditId', 'calendarEventFormOpen', 'calendarMonthCells', 'calendarMonthLabel', 'calendarNearestDdayLabel', 'calendarNearestEvent', 'calendarSaving',
    'calendarSelectedDate', 'calendarSelectedEvents', 'calendarSheetOpen', 'calendarSyncStatus', 'calendarWeekdays', 'personalEvents',
    'normalizedTargetMajor', 'selectedPlannerDate', 'selectedPlannerDateKey', 'selectedPlannerWeekday', 'tab'
  ]),
  plannerAdd: Object.freeze(['selectedPlannerDate', 'selectedPlannerDateKey']),
  payment: Object.freeze(['checkoutPlan', 'duration']),
  paymentComplete: Object.freeze([]),
  privacyPolicy: Object.freeze(['termsContent']),
  qualInfo: Object.freeze(['obGoalText', 'obGradeStatus', 'obQuestionText', 'obSchoolName', 'obTrack']),
  ranking: Object.freeze(['formatHms', 'rankingError', 'rankingMe', 'rankingPeriod', 'rankingRows', 'rankingStatus']),
  proElite: Object.freeze([
    'proReports', 'proReportsStatus', 'proRequestModalOpen', 'proRequestSubmitting', 'proRequestText'
  ]),
  proIntro: Object.freeze(['checkoutPlan', 'upgradePromptTarget', 'upgradePromptTier']),
  report: Object.freeze([
    'proReports', 'proReportsStatus', 'proRequestModalOpen', 'proRequestSubmitting', 'proRequestText', 'tab'
  ]),
  reportDetail: Object.freeze([]),
  scoreInfo: Object.freeze([
    'scoreEditOpen', 'scoreEditState', 'scoreEditStep', 'scoreExamKey', 'scoreExamType',
    'scoreInfoSubjects', 'scoreSubjectSaving', 'user'
  ]),
  settingsMain: Object.freeze(['logoutModalOpen']),
  settingsTermsPicker: Object.freeze(['openTermsType', 'termsContent']),
  splash: Object.freeze(['crackyHiSrc', 'studycrackLogoSrc']),
  strategy: Object.freeze([
    'coachingAnswers', 'coachingDropReasons', 'coachingExamFiles', 'coachingExamScores',
    'coachingExamType', 'coachingPlannerFiles', 'coachingSheetOpen', 'coachingStep',
    'coachingSubjectRows', 'coachingSubmitting', 'coachingTrend', 'coachingView', 'dimmed',
    'tab', 'weeklyReports', 'weeklyReportsStatus'
  ]),
  timer: Object.freeze([
    'activeStudySession', 'analysisScoreView', 'calendarNearestDdayLabel', 'calendarNearestEvent', 'canAccessBasic', 'completionError', 'dimmed', 'drawerOpen', 'fishCount', 'formatHms', 'formatMinutesLabel',
    'gameProfile', 'gameProfileError', 'gameProfileStatus', 'gameRules', 'gameRulesOpen', 'habitatDays', 'habitatStatus', 'hasClientSession',
    'normalizedTargetMajor', 'plannedScheduleOptions', 'rewardPendingSessionId', 'rewardResult', 'studySessionDetailsOpen', 'studyStartDraft', 'studySubjectSheetOnlyPlanned',
    'selectedPlan', 'studySubjectSheetOpen', 'studySummary', 'studySummaryError', 'studySummaryStatus', 'studyTimerRunning',
    'studyTimerTick', 'tab', 'timerPhase', 'todayPlannerItems', 'todayPlannerProgress',
    'todayPlannerTotalMinutes', 'todayStudySeconds', 'user', 'userLoadError', 'userLoadStatus'
  ]),
  tutor: Object.freeze([
    'qnaComposerOpen', 'qnaDraftContent', 'qnaDraftTitle', 'qnaHistory', 'qnaStatus', 'qnaSubmitting'
  ]),
  weekly: Object.freeze(['crackySrc', 'tab', 'weeklyReports']),
  termsScreen: Object.freeze(['termsContent'])
});

const SCREEN_ACTION_KEYS = Object.freeze({
  authSignup: Object.freeze({ group: 'auth', keys: ['setSignupError', 'setSignupTerms'] })
});

export function createScreenContext(screen, context = {}, actionGroups = {}, state = {}) {
  const keys = SCREEN_CONTEXT_KEYS[screen];
  if (!keys) throw new Error(`React screen context 계약 누락: ${screen}`);
  const selected = Object.fromEntries(keys.map((key) => [
    key,
    Object.prototype.hasOwnProperty.call(context, key) ? context[key] : state[key]
  ]));
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
