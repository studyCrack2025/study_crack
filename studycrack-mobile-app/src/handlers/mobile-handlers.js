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

export const MOBILE_ACTION_HANDLER_ORDER = [
  'navigation',
  'auth',
  'planner',
  'profile',
  'service',
  'analysis',
  'calendar'
];

export function createMobileActionHandlerGroups(ctx = {}) {
  return {
    navigation: createNavigationHandlers(ctx),
    auth: createAuthHandlers(ctx),
    planner: createPlannerHandlers(ctx),
    profile: createProfileHandlers(ctx),
    service: createServiceHandlers(ctx),
    analysis: createAnalysisHandlers(ctx),
    calendar: createCalendarHandlers(ctx)
  };
}

export function getOrderedMobileActionGroups(groups) {
  return MOBILE_ACTION_HANDLER_ORDER.map((key) => groups[key]).filter(Boolean);
}

export function createMobileActionHandlers(ctx = {}) {
  return mergeHandlerGroups(...getOrderedMobileActionGroups(createMobileActionHandlerGroups(ctx)));
}

export function createMobileActionDispatcher(ctx = {}, options = {}) {
  return createActionDispatcher(getOrderedMobileActionGroups(createMobileActionHandlerGroups(ctx)), options);
}

export function createMobileEventHandlers(ctx = {}, options = {}) {
  const form = createFormHandlers(ctx);
  const gesture = createGestureHandlers(ctx);
  return {
    dispatchAction: createMobileActionDispatcher(ctx, options),
    handleBlur: form.handleBlur,
    handleChange: form.handleChange,
    handleInput: form.handleInput,
    gesture,
    actionHandlers: createMobileActionHandlers(ctx)
  };
}
