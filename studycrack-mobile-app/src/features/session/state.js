import { createFeatureSlice } from '../../state/create-feature-slice.js';
import { EMPTY_USER } from '../../constants/runtime-defaults.js';

export function createSessionInitialState() {
  return {
    serverResource: {
      loggedIn: false,
      user: { ...EMPTY_USER },
      userLoadStatus: 'idle',
      userLoadError: '',
      userFetchRetryTick: 0,
      userTier: '',
      foundEmailMasked: '',
      signupVerifiedEmail: '',
      signupVerifiedPhone: ''
    },
    localDraft: {
      resetPasswordEmail: '',
      signupForm: {
        email: '',
        emailCode: '',
        password: '',
        passwordConfirm: '',
        name: '',
        gender: '',
        birthdate: '',
        phoneRaw: '',
        phoneCode: '',
        referral: '인스타그램',
        referralEtc: '',
        promoCode: ''
      },
      signupTerms: {
        standard: false,
        service: false,
        privacy: false,
        refund: false,
        marketing: false
      },
      mbtiAnswers: [],
      mbtiResult: '',
      strongSubject: '',
      weakSubject: '',
      studyHours: '',
      studyDifficulty: '',
      obGradeStatus: '고1/2 재학',
      obSchoolName: '',
      obGed: false,
      obTrack: '예체능',
      obGoalText: '',
      obQuestionText: '',
      obExamType: '3월 모의고사',
      obScoreInputs: {}
    },
    ephemeralUi: {
      findEmailModalOpen: false,
      resetPasswordModalOpen: false,
      resetPasswordStep: 'request',
      resetPasswordSending: false,
      authError: '',
      authSubmitting: false,
      signupEmailSending: false,
      signupSmsSending: false,
      signupSubmitting: false,
      signupStep: 1,
      signupError: '',
      openTermsType: '',
      mbtiModalOpen: false,
      mbtiStep: 'intro',
      ob2SkippedNoScore: false,
      onboardingLoading: false,
      onboardingLoadingText: '',
      isAnalyzing: false
    }
  };
}

export const sessionSlice = createFeatureSlice('session', createSessionInitialState);
