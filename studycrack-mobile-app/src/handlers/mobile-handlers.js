import { createAnalysisHandlers } from './analysis-handlers.js';
import { createAuthHandlers } from './auth-handlers.js';
import { createCalendarHandlers } from './calendar-handlers.js';
import { createActionDispatcher, mergeHandlerGroups } from './dispatch.js';
import { createFormHandlers } from './form-handlers.js';
import { createGestureHandlers } from './gesture-handlers.js';
import { createGamificationHandlers } from './gamification-handlers.js';
import { createNavigationHandlers } from './navigation-handlers.js';
import { createPlannerHandlers } from './planner-handlers.js';
import { createTimerHandlers } from './timer-handlers.js';
import { createProfileHandlers } from './profile-handlers.js';
import { createProductGuideHandlers } from './product-guide-handlers.js';
import { createServiceHandlers } from './service-handlers.js';
import { requireHandlerStateActions } from '../state/handler-state-actions.js';

export const MOBILE_ACTION_HANDLER_ORDER = [
  'navigation',
  'productGuide',
  'auth',
  'timer',
  'gamification',
  'planner',
  'profile',
  'service',
  'analysis',
  'calendar'
];

function withStateActions(ctx, actionGroups, group) {
  return { ...ctx, ...requireHandlerStateActions(actionGroups, group) };
}

export function createMobileActionHandlerGroups(ctx = {}, stateActions = {}) {
  return {
    navigation: createNavigationHandlers(withStateActions(ctx, stateActions, 'navigation')),
    productGuide: createProductGuideHandlers(withStateActions(ctx, stateActions, 'productGuide')),
    auth: createAuthHandlers(withStateActions(ctx, stateActions, 'auth')),
    timer: createTimerHandlers(withStateActions(ctx, stateActions, 'timer')),
    gamification: createGamificationHandlers(withStateActions(ctx, stateActions, 'gamification')),
    planner: createPlannerHandlers(withStateActions(ctx, stateActions, 'planner')),
    profile: createProfileHandlers(withStateActions(ctx, stateActions, 'profile')),
    service: createServiceHandlers(withStateActions(ctx, stateActions, 'service')),
    analysis: createAnalysisHandlers(withStateActions(ctx, stateActions, 'analysis')),
    calendar: createCalendarHandlers(withStateActions(ctx, stateActions, 'calendar'))
  };
}

export function getOrderedMobileActionGroups(groups) {
  return MOBILE_ACTION_HANDLER_ORDER.map((key) => groups[key]).filter(Boolean);
}

export function createMobileActionHandlers(ctx = {}, stateActions = {}) {
  return mergeHandlerGroups(...getOrderedMobileActionGroups(createMobileActionHandlerGroups(ctx, stateActions)));
}

export function createMobileActionDispatcher(ctx = {}, options = {}) {
  return createActionDispatcher(
    getOrderedMobileActionGroups(createMobileActionHandlerGroups(ctx, options.stateActions)),
    options
  );
}

export function createMobileEventHandlers(ctx = {}, options = {}) {
  const stateActions = options.stateActions || {};
  const form = createFormHandlers(withStateActions(ctx, stateActions, 'form'));
  const gesture = createGestureHandlers(withStateActions(ctx, stateActions, 'gesture'));
  return {
    dispatchAction: createMobileActionDispatcher(ctx, { ...options, stateActions }),
    handleBlur: form.handleBlur,
    handleChange: form.handleChange,
    handleInput: form.handleInput,
    gesture,
    actionHandlers: createMobileActionHandlers(ctx, stateActions)
  };
}

export function createLazyMobileEventHandlers(getContext, options = {}) {
  if (typeof getContext !== 'function') throw new Error('모바일 event context getter가 필요합니다.');
  let cachedContext = null;
  let cachedHandlers = null;
  const current = () => {
    const context = getContext();
    if (!cachedHandlers || cachedContext !== context) {
      cachedContext = context;
      cachedHandlers = createMobileEventHandlers(context, options);
    }
    return cachedHandlers;
  };
  return {
    dispatchAction: (...args) => current().dispatchAction(...args),
    handleBlur: (...args) => current().handleBlur(...args),
    handleChange: (...args) => current().handleChange(...args),
    handleInput: (...args) => current().handleInput(...args),
    gesture: {
      cancelGesture: (...args) => current().gesture.cancelGesture(...args),
      endGesture: (...args) => current().gesture.endGesture(...args),
      getActiveGestureTarget: (...args) => current().gesture.getActiveGestureTarget(...args),
      moveGesture: (...args) => current().gesture.moveGesture(...args),
      startGesture: (...args) => current().gesture.startGesture(...args)
    },
    get actionHandlers() {
      return current().actionHandlers;
    }
  };
}
