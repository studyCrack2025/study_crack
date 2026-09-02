import { AuthFindIdScreen, AuthFindPwScreen, AuthLoginScreen, AuthSignupScreen } from '../screens/auth/AuthScreens.jsx';
import { PrivacyPolicyScreen, SettingsMainScreen, SettingsTermsPickerScreen, TermsScreen } from '../screens/mypage/LegalScreens.jsx';
import { On1Screen, On2Screen, On3Screen, SplashScreen } from '../screens/onboarding/IntroScreens.jsx';
import { Ob3Screen } from '../screens/onboarding/Ob3Screen.jsx';
import { Ob4Screen, Ob5Screen } from '../screens/onboarding/ResultScreens.jsx';
import { Ob1Screen, Ob2Screen } from '../screens/onboarding/SurveyScreens.jsx';

const MOBILE_SCREEN_NAMES = [
  'timer',
  'aquarium',
  'analysis',
  'addUniversity',
  'ranking',
  'qualInfo',
  'scoreInfo',
  'consulting',
  'authLogin',
  'authFindId',
  'authFindPw',
  'authSignup',
  'splash',
  'on1',
  'on2',
  'on3',
  'planner',
  'plannerAdd',
  'ob1',
  'ob2',
  'ob3',
  'ob4',
  'ob5',
  'strategy',
  'weekly',
  'report',
  'reportDetail',
  'lockedFeature',
  'proElite',
  'tutor',
  'proIntro',
  'payment',
  'paymentComplete',
  'my',
  'notificationSettings',
  'notificationList',
  'customerSupport',
  'settingsMain',
  'settingsTermsPicker',
  'accountInfo',
  'privacyPolicy',
  'termsScreen'
];

export const DEFERRED_APP_SCREEN_NAMES = [
  'timer',
  'aquarium',
  'analysis',
  'addUniversity',
  'ranking',
  'qualInfo',
  'scoreInfo',
  'consulting',
  'planner',
  'plannerAdd',
  'strategy',
  'weekly',
  'report',
  'reportDetail',
  'lockedFeature',
  'proElite',
  'tutor',
  'proIntro',
  'payment',
  'paymentComplete',
  'my',
  'notificationSettings',
  'notificationList',
  'customerSupport',
  'accountInfo'
];

const DEFERRED_APP_SCREEN_SET = new Set(DEFERRED_APP_SCREEN_NAMES);

export const BOOTSTRAP_SCREEN_COMPONENTS = {
  authFindId: AuthFindIdScreen,
  authFindPw: AuthFindPwScreen,
  authLogin: AuthLoginScreen,
  authSignup: AuthSignupScreen,
  ob1: Ob1Screen,
  ob2: Ob2Screen,
  ob3: Ob3Screen,
  ob4: Ob4Screen,
  ob5: Ob5Screen,
  on1: On1Screen,
  on2: On2Screen,
  on3: On3Screen,
  privacyPolicy: PrivacyPolicyScreen,
  settingsMain: SettingsMainScreen,
  settingsTermsPicker: SettingsTermsPickerScreen,
  splash: SplashScreen,
  termsScreen: TermsScreen
};

let appRegistryModule = null;
let appRegistryPromise = null;

export function isDeferredAppScreen(screenName) {
  return DEFERRED_APP_SCREEN_SET.has(screenName);
}

export function loadAppScreenRegistry() {
  if (appRegistryModule) return Promise.resolve(appRegistryModule);
  if (!appRegistryPromise) {
    appRegistryPromise = import('./screen-registry-app.js')
      .then((module) => {
        appRegistryModule = module;
        return module;
      })
      .catch((error) => {
        appRegistryPromise = null;
        throw error;
      });
  }
  return appRegistryPromise;
}

export function getScreenComponent(screenName, appRegistry = null) {
  return BOOTSTRAP_SCREEN_COMPONENTS[screenName] || appRegistry?.MOBILE_APP_SCREEN_COMPONENTS?.[screenName] || null;
}
