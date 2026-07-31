import { renderAppBar } from '../components/app-bar.js';
import { renderAppShell } from '../components/app-shell.js';
import { AnalysisScreen } from '../screens/analysis/AnalysisScreen.jsx';
import { HomeScreen } from '../screens/home/HomeScreen.jsx';
import { PlannerAddScreen } from '../screens/planner/PlannerAddScreen.jsx';
import { PlannerScreen } from '../screens/planner/PlannerScreen.jsx';
import { AuthFindIdScreen, AuthFindPwScreen, AuthLoginScreen, AuthSignupScreen } from '../screens/auth/AuthScreens.jsx';
import { CoachingScreen } from '../screens/coaching/CoachingScreen.jsx';
import { Ob3Screen } from '../screens/onboarding/Ob3Screen.jsx';
import { AccountInfoScreen } from '../screens/mypage/AccountInfoScreen.jsx';
import { PrivacyPolicyScreen, SettingsMainScreen, SettingsTermsPickerScreen, TermsScreen } from '../screens/mypage/LegalScreens.jsx';
import { MyPageScreen } from '../screens/mypage/MyPageScreen.jsx';
import {
  renderAddUniversityScreen,
  renderNotificationSettingsScreen,
  renderNotificationListScreen,
  renderCustomerSupportScreen,
  renderLockedFeatureScreen,
  renderSplashScreen,
  renderOn1Screen,
  renderOn2Screen,
  renderOn3Screen,
  renderOb1Screen,
  renderOb2Screen,
  renderOb4Screen,
  renderOb5Screen,
  renderQualInfoScreen,
  renderRankingScreen,
  renderScoreInfoScreen,
  renderPaymentCompleteScreen,
  renderPaymentScreen,
  renderProEliteScreen,
  renderProIntroScreen,
  renderReportDetailScreen,
  renderReportScreen,
  renderTutorScreen,
  renderWeeklyScreen
} from '../screens/index.js';

function defaultLayout(inner, withTab = false, overlays = '') {
  return renderAppShell({ inner: String(inner || ''), withTab, overlays: String(overlays || '') });
}

function defaultAppbar(title = '', showBack = false) {
  return renderAppBar({ title, showBack });
}

function defaultIcon() {
  return '';
}

function renderMissingScreen(ctx, screenName = '') {
  const layout = ctx.layout || defaultLayout;
  return layout(`<div class="center init-loading"><h3>${screenName || 'home'}</h3><p class="sub">화면 renderer 연결 준비 중입니다.</p></div>`, false);
}

const MOBILE_SCREEN_RENDERER_NAMES = [
  'home',
  'analysis',
  'addUniversity',
  'ranking',
  'qualInfo',
  'scoreInfo',
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

// JSX 화면은 React 트리만 소유한다. 문자열 renderer map에는 같은 screen key를 두지 않는다.
export const MOBILE_SCREEN_COMPONENTS = {
  accountInfo: AccountInfoScreen,
  analysis: AnalysisScreen,
  authFindId: AuthFindIdScreen,
  authFindPw: AuthFindPwScreen,
  authLogin: AuthLoginScreen,
  authSignup: AuthSignupScreen,
  strategy: CoachingScreen,
  home: HomeScreen,
  my: MyPageScreen,
  ob3: Ob3Screen,
  planner: PlannerScreen,
  plannerAdd: PlannerAddScreen,
  privacyPolicy: PrivacyPolicyScreen,
  settingsMain: SettingsMainScreen,
  settingsTermsPicker: SettingsTermsPickerScreen,
  termsScreen: TermsScreen
};

export function getScreenComponent(screenName) {
  return MOBILE_SCREEN_COMPONENTS[screenName] || null;
}

export function createScreenRenderContext(ctx = {}) {
  return {
    appbar: defaultAppbar,
    icon: defaultIcon,
    layout: defaultLayout,
    ...ctx
  };
}

export function createMobileScreenRenderers(ctx = {}) {
  const customRenderers = ctx.screenRenderers || {};
  const renderers = {
    addUniversity: renderAddUniversityScreen,
    customerSupport: renderCustomerSupportScreen,
    lockedFeature: renderLockedFeatureScreen,
    notificationSettings: renderNotificationSettingsScreen,
    notificationList: renderNotificationListScreen,
    splash: renderSplashScreen,
    on1: renderOn1Screen,
    on2: renderOn2Screen,
    on3: renderOn3Screen,
    ob1: renderOb1Screen,
    ob2: renderOb2Screen,
    ob4: renderOb4Screen,
    ob5: renderOb5Screen,
    payment: renderPaymentScreen,
    paymentComplete: renderPaymentCompleteScreen,
    proElite: renderProEliteScreen,
    proIntro: renderProIntroScreen,
    qualInfo: renderQualInfoScreen,
    ranking: renderRankingScreen,
    report: renderReportScreen,
    reportDetail: renderReportDetailScreen,
    scoreInfo: renderScoreInfoScreen,
    tutor: renderTutorScreen,
    weekly: renderWeeklyScreen
  };
  const merged = { ...renderers, ...customRenderers };
  for (const screenName of Object.keys(MOBILE_SCREEN_COMPONENTS)) delete merged[screenName];
  return merged;
}

export function renderMobileScreen(screenName, ctx = {}, options = {}) {
  const renderCtx = createScreenRenderContext(ctx);
  const renderers = options.renderers || createMobileScreenRenderers(renderCtx);
  const renderer = renderers[screenName];
  if (typeof renderer !== 'function') return renderMissingScreen(renderCtx, screenName);
  try {
    return renderer(renderCtx);
  } catch (error) {
    options.onRenderError?.(error, { screenName });
    return renderMissingScreen(renderCtx, screenName);
  }
}
