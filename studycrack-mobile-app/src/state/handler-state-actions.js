import { APP_STATE_FIELD_KINDS, APP_STATE_FIELD_OWNERS, selectAppStateField } from './app-state-schema.js';

export const HANDLER_STATE_FIELDS = Object.freeze({
  navigation: Object.freeze([]),
  auth: Object.freeze([
    'authError', 'authSubmitting', 'findEmailModalOpen', 'foundEmailMasked', 'openTermsType',
    'resetPasswordEmail', 'resetPasswordModalOpen', 'resetPasswordSending', 'resetPasswordStep',
    'signupEmailSending', 'signupError', 'signupForm', 'signupSmsSending', 'signupStep',
    'signupSubmitting', 'signupTerms', 'signupVerifiedEmail', 'signupVerifiedPhone'
  ]),
  timer: Object.freeze([
    'activePlannerItemId', 'activeStudySession', 'activeStudySubject', 'completionError',
    'gameProfile', 'gameProfileError', 'gameProfileStatus', 'gameRefreshTick', 'lastCompletedSession',
    'notifModalOpen', 'plannerItems', 'rewardPendingSessionId', 'rewardResult', 'studyRecords',
    'studySubjectRecords', 'studySubjectSheetOnlyPlanned', 'studySubjectSheetOpen', 'studySummaryRefreshTick',
    'studyTimerRunning', 'studyTimerTick', 'timerPhase'
  ]),
  gamification: Object.freeze([
    'activeFish', 'aquariumActionError', 'aquariumActionStatus', 'aquariumResult',
    'aquariumSelectedFishId', 'aquariumStarterSpeciesId', 'fishCount', 'fishInventory',
    'gameProfile', 'gameRefreshTick'
  ]),
  planner: Object.freeze([
    'expandedBreakdownSubject', 'plannerCalendarMode', 'plannerDraft', 'plannerEditIndex', 'plannerItems',
    'selectedDate', 'showStudyBreakdown'
  ]),
  profile: Object.freeze([
    'history', 'loggedIn', 'logoutModalOpen', 'mbtiAnswers', 'mbtiModalOpen', 'mbtiResult', 'mbtiStep',
    'myProfileEditOpen', 'myProfileNameDraft', 'myProfilePhoneCodeDraft', 'myProfilePhoneDraft',
    'notifications', 'ob2SkippedNoScore', 'obGed', 'obGradeStatus', 'openFaq', 'openTermsType',
    'phoneChangeModalOpen', 'phoneChangeSending', 'phoneChangeStep', 'profileDetailModalOpen',
    'profilePhotoUploading', 'rankingPeriod', 'scoreEditOpen', 'scoreEditState', 'scoreEditStep',
    'scoreExamKey', 'scoreSubjectSaving', 'scores', 'targetMajor', 'user', 'withdrawModalOpen',
    'withdrawPassword'
  ]),
  service: Object.freeze([
    'analysisSearchOpen', 'checkoutPlan', 'coachingDropReasons', 'coachingExamFiles',
    'coachingExamScores', 'coachingExamType', 'coachingPlannerFiles', 'coachingSheetOpen',
    'coachingStep', 'coachingSubjectRows', 'coachingSubmitted', 'coachingSubmitting', 'coachingTrend',
    'coachingView', 'drawerOpen', 'duration', 'history', 'notiDetailId', 'notiExpandedId', 'notiList',
    'notiPage', 'notifModalOpen', 'proReports',
    'proReportsStatus', 'proRequestModalOpen', 'proRequestSubmitting', 'proRequestText',
    'qnaComposerOpen', 'qnaDraftContent', 'qnaDraftTitle', 'qnaHistory', 'qnaStatus',
    'qnaSubmitting', 'targetMajor', 'targetOpen', 'universityModalOpen', 'weeklyReports',
    'weeklyReportsStatus'
  ]),
  analysis: Object.freeze([
    'activeScoreView', 'addingUniversity', 'analysisBarProjectionTarget', 'analysisHighlightedSubject',
    'analysisSearchOpen', 'analysisSearchTerm', 'analysisTargetList', 'homeDragOffset',
    'homeSlideIndex', 'homeSlideMotion', 'homeTargetList', 'scoreDragOffset', 'scoreSlideMotion',
    'targetDeleteCandidate', 'targetDeleteError', 'targetDeleteModalOpen', 'targetDeleteSaving',
    'targetMajor', 'targetOpen', 'targetUnivSlots', 'universityCatalogError',
    'universityCatalogRetryTick', 'universityCatalogStatus', 'universityModalOpen',
    'universityRecommendationRetryTick', 'universitySelectedName'
  ]),
  calendar: Object.freeze([
    'calendarEventDraft', 'calendarEventEditId', 'calendarEventFormOpen', 'calendarMonthAnchor',
    'calendarSaving', 'calendarSelectedDate', 'calendarSheetOpen', 'personalEvents'
  ]),
  form: Object.freeze([
    'analysisSearchTerm', 'coachingAnswers', 'coachingExamFiles', 'coachingExamScores',
    'coachingMonth', 'coachingPlannerFiles', 'coachingSubjectRows', 'myProfileNameDraft',
    'myProfilePhoneCodeDraft', 'myProfilePhoneDraft', 'obGoalText', 'obGradeStatus',
    'obQuestionText', 'obSchoolName', 'obTrack', 'proEliteMonth', 'proRequestText',
    'qnaDraftContent', 'qnaDraftTitle', 'scoreEditState', 'scoreState', 'scores', 'strongSubject',
    'studyDifficulty', 'studyHours', 'targetMajor', 'user', 'weakSubject', 'withdrawPassword'
  ]),
  gesture: Object.freeze([
    'activeScoreView', 'homeDragOffset', 'homeSlideIndex', 'homeSlideMotion', 'scoreDragOffset',
    'scoreSlideMotion'
  ])
});

function setterName(field) {
  return `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
}

export function createHandlerStateActions({ setState, getRootState } = {}) {
  if (typeof setState !== 'function' || typeof getRootState !== 'function') {
    throw new TypeError('handler state action에는 setState와 getRootState가 필요합니다.');
  }

  return Object.fromEntries(Object.entries(HANDLER_STATE_FIELDS).map(([group, fields]) => [
    group,
    Object.freeze(Object.fromEntries(fields.map((field) => {
      if (!APP_STATE_FIELD_OWNERS[field] || !APP_STATE_FIELD_KINDS[field]) {
        throw new Error(`[${group}] 등록되지 않은 state field: ${field}`);
      }
      return [setterName(field), (next) => {
        const value = typeof next === 'function' ? next(selectAppStateField(getRootState(), field)) : next;
        setState({ [field]: value });
      }];
    })))
  ]));
}

export function requireHandlerStateActions(actionGroups, group) {
  const actions = actionGroups?.[group];
  if (!actions) throw new Error(`[${group}] state action group이 누락되었습니다.`);
  for (const field of HANDLER_STATE_FIELDS[group] || []) {
    const action = setterName(field);
    if (typeof actions[action] !== 'function') throw new Error(`[${group}] 필수 action 누락: ${action}`);
  }
  return actions;
}
