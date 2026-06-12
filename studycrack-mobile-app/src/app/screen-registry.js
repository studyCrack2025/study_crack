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
  renderOb1Screen,
  renderOb2Screen,
  renderOb3Screen,
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

function defaultLayout(content) {
  return String(content || '');
}

function defaultAppbar(title = '') {
  return `<div class="appbar"><button data-action="back">‹</button><strong>${title}</strong></div>`;
}

function defaultIcon() {
  return '';
}

function renderMissingScreen(ctx, screenName = '') {
  const layout = ctx.layout || defaultLayout;
  return layout(`<div class="screen app-screen app-content"><div class="center init-loading"><h3>${screenName || 'home'}</h3><p class="sub">화면 renderer 연결 준비 중입니다.</p></div></div>`, false);
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
  'planner',
  'plannerAdd',
  'ob1',
  'ob2',
  'ob3',
  'strategy',
  'weekly',
  'report',
  'reportDetail',
  'proElite',
  'tutor',
  'proIntro',
  'payment',
  'paymentComplete',
  'myPage',
  'notificationSettings',
  'customerSupport',
  'settingsMain',
  'settingsTermsPicker',
  'accountInfo',
  'privacyPolicy',
  'termsScreen'
];

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
    myPage: renderMyPageScreen,
    notificationSettings: renderNotificationSettingsScreen,
    ob1: renderOb1Screen,
    ob2: renderOb2Screen,
    ob3: renderOb3Screen,
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
