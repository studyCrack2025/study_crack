import { isDeferredAppScreen } from './screen-registry.js';
import {
  MAIN_TAB_SCREENS,
  appStateReducer,
  createInitialAppState,
  hydrateAppState
} from '../runtime/app-state.js';
import {
  getMobileLocation,
  hasMobileClientSession,
  isLocalMobilePreview,
  replaceMobileScreenParam
} from '../shared/browser/mobile-runtime.js';

const PUBLIC_MOBILE_SCREENS = new Set([
  'splash', 'on1', 'on2', 'on3', 'authLogin', 'authSignup', 'authFindId', 'authFindPw',
  'privacyPolicy', 'termsScreen'
]);

export function createInitialMobileAppState() {
  const base = hydrateAppState(createInitialAppState());
  const location = getMobileLocation();
  if (!location) return base;
  const screen = new URLSearchParams(location.search).get('screen');
  const hasSession = hasMobileClientSession();
  const sessionSafeBase = hasSession
    ? appStateReducer(base, { type: 'app/patch', payload: { personalEvents: [], calendarSyncStatus: 'loading' } })
    : base;

  if (hasSession && (screen === 'authLogin' || screen === 'authSignup')) {
    return appStateReducer(sessionSafeBase, { type: 'app/patch', payload: { screen: 'home', tab: 'home' } });
  }
  if (!hasSession && screen && !isLocalMobilePreview() && !PUBLIC_MOBILE_SCREENS.has(screen)) {
    replaceMobileScreenParam('authLogin');
    return appStateReducer(base, { type: 'app/patch', payload: { screen: 'authLogin', tab: 'home' } });
  }
  return screen
    ? appStateReducer(sessionSafeBase, {
        type: 'app/patch',
        payload: { screen, ...(MAIN_TAB_SCREENS.includes(screen) ? { tab: screen } : {}) }
      })
    : sessionSafeBase;
}

export function shouldLoadDeferredMobileScreens(screen, registryLoaded) {
  if (registryLoaded) return false;
  return isDeferredAppScreen(screen) || (screen === 'splash' && hasMobileClientSession());
}
