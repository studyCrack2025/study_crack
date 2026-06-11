import { createActionContext, shouldKeepScrollForAction } from './action-utils.js';

export function createActionDispatcher(handlerGroups = [], options = {}) {
  const {
    beforeDispatch,
    keepScrollActions,
    keepScrollPosition,
    onUnhandled
  } = options;

  const handlers = handlerGroups.reduce((acc, group) => ({ ...acc, ...group }), {});

  return async function dispatchAction(event, override = {}) {
    const ctx = createActionContext(event, override);
    const { action, actionEl } = ctx;
    if (!actionEl || !action) return { handled: false, reason: 'missing-action', ...ctx };

    if (shouldKeepScrollForAction(action, keepScrollActions)) {
      keepScrollPosition?.();
    }

    const beforeResult = await beforeDispatch?.(ctx);
    if (beforeResult === false) return { handled: true, cancelled: true, ...ctx };

    const handler = handlers[action];
    if (!handler) {
      await onUnhandled?.(ctx);
      return { handled: false, reason: 'unhandled-action', ...ctx };
    }

    const result = await handler(ctx);
    return { handled: true, result, ...ctx };
  };
}

export function mergeHandlerGroups(...groups) {
  return groups.reduce((acc, group) => ({ ...acc, ...group }), {});
}
