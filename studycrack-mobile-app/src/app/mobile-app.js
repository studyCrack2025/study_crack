import { createMobileEventHandlers } from '../handlers/mobile-handlers.js';
import {
  createMobileScreenRenderers,
  createScreenRenderContext,
  renderMobileScreen
} from './screen-registry.js';

export function createMobileAppKernel(ctx = {}, options = {}) {
  let currentCtx = createScreenRenderContext(ctx);
  const renderers = createMobileScreenRenderers(currentCtx);
  const events = createMobileEventHandlers(currentCtx, options.dispatchOptions || {});

  function updateContext(patch = {}) {
    currentCtx = createScreenRenderContext({ ...currentCtx, ...patch });
    return currentCtx;
  }

  function render(screenName = currentCtx.screen || 'home', patch = {}) {
    const nextCtx = Object.keys(patch).length ? updateContext(patch) : currentCtx;
    return renderMobileScreen(screenName, nextCtx, {
      fallbackScreen: options.fallbackScreen || 'home',
      onRenderError: options.onRenderError,
      renderers
    });
  }

  return {
    dispatchAction: events.dispatchAction,
    events,
    getContext: () => currentCtx,
    render,
    renderers,
    updateContext
  };
}
