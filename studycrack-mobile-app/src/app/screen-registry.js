import { renderAppBar } from '../components/app-bar.js';
import { renderAppShell } from '../components/app-shell.js';
import { AuthFindIdScreen, AuthFindPwScreen, AuthLoginScreen, AuthSignupScreen } from '../screens/auth/AuthScreens.jsx';
import { PrivacyPolicyScreen, SettingsMainScreen, SettingsTermsPickerScreen, TermsScreen } from '../screens/mypage/LegalScreens.jsx';
import { Ob3Screen } from '../screens/onboarding/Ob3Screen.jsx';
import {
  renderOb1Screen,
  renderOb2Screen,
  renderOb4Screen,
  renderOb5Screen,
  renderOn1Screen,
  renderOn2Screen,
  renderOn3Screen,
  renderSplashScreen
} from '../screens/onboarding/renderers.js';

function defaultLayout(inner, withTab = false, overlays = '') {
  return renderAppShell({ inner: String(inner || ''), withTab, overlays: String(overlays || '') });
}

function defaultAppbar(title = '', showBack = false) {
  return renderAppBar({ title, showBack });
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

export const DEFERRED_APP_SCREEN_NAMES = [
  'home',
  'analysis',
  'addUniversity',
  'ranking',
  'qualInfo',
  'scoreInfo',
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
  ob3: Ob3Screen,
  privacyPolicy: PrivacyPolicyScreen,
  settingsMain: SettingsMainScreen,
  settingsTermsPicker: SettingsTermsPickerScreen,
  termsScreen: TermsScreen
};

const BOOTSTRAP_SCREEN_RENDERERS = {
  splash: renderSplashScreen,
  on1: renderOn1Screen,
  on2: renderOn2Screen,
  on3: renderOn3Screen,
  ob1: renderOb1Screen,
  ob2: renderOb2Screen,
  ob4: renderOb4Screen,
  ob5: renderOb5Screen
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

export function createScreenRenderContext(ctx = {}) {
  return {
    appbar: defaultAppbar,
    icon: () => '',
    layout: defaultLayout,
    ...ctx
  };
}

export function createMobileScreenRenderers(ctx = {}, appRegistry = null) {
  const renderCtx = createScreenRenderContext(ctx);
  const customRenderers = ctx.screenRenderers || {};
  const appRenderers = appRegistry?.createAppScreenRenderers?.(renderCtx) || {};
  const merged = { ...BOOTSTRAP_SCREEN_RENDERERS, ...appRenderers, ...customRenderers };
  for (const screenName of Object.keys(BOOTSTRAP_SCREEN_COMPONENTS)) delete merged[screenName];
  for (const screenName of Object.keys(appRegistry?.MOBILE_APP_SCREEN_COMPONENTS || {})) delete merged[screenName];
  return merged;
}

export function renderMobileScreen(screenName, ctx = {}, options = {}) {
  const renderCtx = createScreenRenderContext(ctx);
  const renderers = options.renderers || createMobileScreenRenderers(renderCtx, options.appRegistry);
  const renderer = renderers[screenName];
  if (typeof renderer !== 'function') return renderMissingScreen(renderCtx, screenName);
  try {
    return renderer(renderCtx);
  } catch (error) {
    options.onRenderError?.(error, { screenName });
    return renderMissingScreen(renderCtx, screenName);
  }
}
