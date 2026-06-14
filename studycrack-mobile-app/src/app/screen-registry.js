import { renderAppBar } from '../components/app-bar.js';
import { renderAppShell } from '../components/app-shell.js';
import { AnalysisScreen } from '../screens/analysis/AnalysisScreen.jsx';
import { HomeScreen } from '../screens/home/HomeScreen.jsx';
import { PlannerScreen } from '../screens/planner/PlannerScreen.jsx';
import {
  renderAddUniversityScreen,
  renderAnalysisScreen,
  renderAuthFindIdScreen,
  renderAuthFindPwScreen,
  renderAuthLoginScreen,
  renderAuthSignupScreen,
  renderHomeScreen,
  renderMyPageScreen,
  renderNotificationSettingsScreen,
  renderCustomerSupportScreen,
  renderSettingsMainScreen,
  renderSettingsTermsPickerScreen,
  renderAccountInfoScreen,
  renderPrivacyPolicyScreen,
  renderTermsScreen,
  renderSplashScreen,
  renderOn1Screen,
  renderOn2Screen,
  renderOn3Screen,
  renderOb1Screen,
  renderOb2Screen,
  renderOb3Screen,
  renderOb4Screen,
  renderOb5Screen,
  renderPlannerAddScreen,
  renderPlannerScreen,
  renderQualInfoScreen,
  renderRankingScreen,
  renderScoreInfoScreen,
  renderPaymentCompleteScreen,
  renderPaymentScreen,
  renderProEliteScreen,
  renderProIntroScreen,
  renderReportDetailScreen,
  renderReportScreen,
  renderStrategyScreen,
  renderTutorScreen,
  renderWeeklyScreen
} from '../screens/index.js';

function defaultLayout(inner, withTab = false) {
  return renderAppShell({ inner: String(inner || ''), withTab });
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

export const MOBILE_SCREEN_RENDERER_NAMES = [
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
  'proElite',
  'tutor',
  'proIntro',
  'payment',
  'paymentComplete',
  'my',
  'notificationSettings',
  'customerSupport',
  'settingsMain',
  'settingsTermsPicker',
  'accountInfo',
  'privacyPolicy',
  'termsScreen'
];

// dual-mode: JSX(실제 React 트리) 화면 컴포넌트 레지스트리. 여기 등록된 화면은 main.js가
// 문자열 주입 대신 React 엘리먼트로 렌더해 DOM/scroll 상태를 reconciliation으로 보존한다.
// 미등록 화면은 기존 문자열 renderer 경로로 폴백한다(점진 이관).
export const MOBILE_SCREEN_COMPONENTS = {
  analysis: AnalysisScreen,
  home: HomeScreen,
  planner: PlannerScreen
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
    accountInfo: renderAccountInfoScreen,
    addUniversity: renderAddUniversityScreen,
    analysis: renderAnalysisScreen,
    authFindId: renderAuthFindIdScreen,
    authFindPw: renderAuthFindPwScreen,
    authLogin: renderAuthLoginScreen,
    authSignup: renderAuthSignupScreen,
    customerSupport: renderCustomerSupportScreen,
    home: renderHomeScreen,
    // screen id는 메인 탭/원본 런타임과 동일하게 'my'(레지스트리 camelCase 'myPage'에서 정정).
    my: renderMyPageScreen,
    notificationSettings: renderNotificationSettingsScreen,
    splash: renderSplashScreen,
    on1: renderOn1Screen,
    on2: renderOn2Screen,
    on3: renderOn3Screen,
    ob1: renderOb1Screen,
    ob2: renderOb2Screen,
    ob3: renderOb3Screen,
    ob4: renderOb4Screen,
    ob5: renderOb5Screen,
    payment: renderPaymentScreen,
    paymentComplete: renderPaymentCompleteScreen,
    planner: renderPlannerScreen,
    plannerAdd: renderPlannerAddScreen,
    privacyPolicy: renderPrivacyPolicyScreen,
    proElite: renderProEliteScreen,
    proIntro: renderProIntroScreen,
    qualInfo: renderQualInfoScreen,
    ranking: renderRankingScreen,
    report: renderReportScreen,
    reportDetail: renderReportDetailScreen,
    scoreInfo: renderScoreInfoScreen,
    settingsMain: renderSettingsMainScreen,
    settingsTermsPicker: renderSettingsTermsPickerScreen,
    strategy: renderStrategyScreen,
    termsScreen: renderTermsScreen,
    tutor: renderTutorScreen,
    weekly: renderWeeklyScreen
  };
  return { ...renderers, ...customRenderers };
}

export function renderMobileScreen(screenName, ctx = {}, options = {}) {
  const renderCtx = createScreenRenderContext(ctx);
  const renderers = options.renderers || createMobileScreenRenderers(renderCtx);
  const fallbackScreen = options.fallbackScreen || 'home';
  const renderer = renderers[screenName] || renderers[fallbackScreen];
  if (typeof renderer !== 'function') return renderMissingScreen(renderCtx, screenName);
  try {
    return renderer(renderCtx);
  } catch (error) {
    options.onRenderError?.(error, { screenName, fallbackScreen });
    if (screenName !== fallbackScreen && typeof renderers[fallbackScreen] === 'function') {
      return renderers[fallbackScreen](renderCtx);
    }
    return renderMissingScreen(renderCtx, screenName);
  }
}
