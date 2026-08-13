import { hydrateNavigationStorage } from './navigation-storage.js';
import { hydrateAnalysisStorage } from '../features/analysis/storage.js';
import { hydratePlannerStorage } from '../features/planner/storage.js';
import { hydrateStudyStorage } from '../features/study/storage.js';
import { hydrateAccountStorage } from '../features/account/storage.js';
import { hydrateNotificationsStorage } from '../features/notifications/storage.js';
import { notificationsSlice } from '../features/notifications/state.js';
import {
  appStateReducer,
  createInitialAppState
} from '../state/app-state-schema.js';

export {
  APP_STATE_FIELD_OWNERS,
  APP_STATE_FIELD_KINDS,
  APP_STATE_SLICES,
  appStateReducer,
  createInitialAppState,
  selectAppStateField,
  selectFlatAppState
} from '../state/app-state-schema.js';

// 메인 탭과 매핑되는 screen id (goto 시 탭 동기화 대상). 원본 App().goto와 동일.
export const MAIN_TAB_SCREENS = ['timer', 'planner', 'aquarium', 'analysis', 'strategy'];

// 동기 hydrate adapter를 app 계층에서 조합한다. 각 storage key의 정규화 책임은 feature가 소유한다.
export function hydrateAppState(state = {}, storage = globalThis.localStorage) {
  if (!storage) return state;
  const currentNotifications = notificationsSlice.selectors.field(state, 'notifications');
  const notificationPatch = hydrateNotificationsStorage(storage);
  const patch = {
    ...hydrateAnalysisStorage(storage),
    ...hydratePlannerStorage(storage),
    ...hydrateStudyStorage(storage),
    ...hydrateAccountStorage(storage),
    ...hydrateNavigationStorage(storage),
    ...(notificationPatch.notifications
      ? { notifications: { ...currentNotifications, ...notificationPatch.notifications } }
      : {})
  };
  return appStateReducer(state, { type: 'app/patch', payload: patch });
}

// 내비게이션 백본 (순수). React 셸이 getState/setState를 주입한다.
// onScreenChange: 화면 전환 시 부수효과(스크롤 저장 등) 훅. 브라우저 의존은 셸이 주입.
export function createNavigationOps({ getState, setState, onScreenChange } = {}) {
  function goto(next, addHistory = true) {
    const target = next === 'home' ? 'analysis' : next;
    const state = getState();
    if (!target || target === state.screen) return false;
    onScreenChange?.(state.screen, target);
    const patch = { screen: target };
    if (addHistory && state.screen !== target) patch.history = [...state.history, state.screen];
    if (MAIN_TAB_SCREENS.includes(target)) patch.tab = target;
    setState(patch);
    return true;
  }

  function back() {
    const state = getState();
    onScreenChange?.(state.screen, null);
    if (!state.history.length) return goto('timer', false);
    const clone = [...state.history];
    const prev = clone.pop();
    const target = prev === 'home' ? 'analysis' : prev;
    setState({ history: clone, screen: target, ...(MAIN_TAB_SCREENS.includes(target) ? { tab: target } : {}) });
    return true;
  }

  return { goto, back };
}
