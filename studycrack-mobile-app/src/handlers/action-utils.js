export const DEFAULT_KEEP_SCROLL_ACTIONS = new Set([
  'openStreakSummary', 'closeStreakSummary',
  'openProductGuide', 'closeProductGuide', 'nextProductGuide', 'previousProductGuide', 'retryProductGuide', 'dismissProductGuideError',
  'toggleFaq',
  'toggleStudyBreakdown',
  'openUniversityModal',
  'closeUniversityModal',
  'openDrawer',
  'closeDrawer',
  'openScoreEdit',
  'closeScoreEdit',
  'openCalendarSheet',
  'closeCalendarSheet',
  'selectCalendarDate',
  'calendarPrevMonth',
  'calendarNextMonth',
  'openCalendarEventForm',
  'closeCalendarEventForm',
  'setPlannerCalendarMode',
  'plannerCalendarPrevWeek',
  'plannerCalendarNextWeek',
  'plannerCalendarToday'
]);

export function getActionElement(event, selector = '[data-action]') {
  return event?.target?.closest?.(selector) || null;
}

export function getAction(actionEl) {
  return actionEl?.getAttribute?.('data-action') || '';
}

export function getData(actionEl, name, fallback = '') {
  const value = actionEl?.getAttribute?.(`data-${name}`);
  return value == null ? fallback : value;
}

export function isOverlaySelfClick(event, actionEl) {
  return Boolean(event && actionEl && event.target === actionEl);
}

export function shouldKeepScrollForAction(action, keepScrollActions = DEFAULT_KEEP_SCROLL_ACTIONS) {
  return keepScrollActions.has(action);
}

export function createActionContext(event, options = {}) {
  const actionEl = options.actionEl || getActionElement(event);
  const action = options.action || getAction(actionEl);
  return {
    action,
    actionEl,
    event,
    isOverlaySelfClick: isOverlaySelfClick(event, actionEl)
  };
}
