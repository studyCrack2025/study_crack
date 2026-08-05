import { createAnalysisHandlers } from './analysis-handlers.js';
import { createAuthHandlers } from './auth-handlers.js';
import { createCalendarHandlers } from './calendar-handlers.js';
import { createActionDispatcher, mergeHandlerGroups } from './dispatch.js';
import { createFormHandlers } from './form-handlers.js';
import { createGestureHandlers } from './gesture-handlers.js';
import { createNavigationHandlers } from './navigation-handlers.js';
import { createPlannerHandlers } from './planner-handlers.js';
import { createProfileHandlers } from './profile-handlers.js';
import { createServiceHandlers } from './service-handlers.js';
import { requireHandlerStateActions } from '../state/handler-state-actions.js';

export const MOBILE_ACTION_HANDLER_ORDER = [
  'navigation',
  'auth',
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
    auth: createAuthHandlers(withStateActions(ctx, stateActions, 'auth')),
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
