import React from 'react';
import { createLazyMobileEventHandlers } from '../handlers/mobile-handlers.js';
import { createHandlerStateActions } from '../state/handler-state-actions.js';
import { resolveScreenAccess } from './access-policy.js';
import { createInitialMobileAppState } from './mobile-routing.js';
import { createMobileViewContext } from './mobile-view-context.js';
import { createScreenContext } from './screen-context.js';
import { getScreenComponent, isDeferredAppScreen } from './screen-registry.js';
import { useMobileApiController } from './use-mobile-api-controller.js';
import { useDeferredScreenRegistry, useMobileAppEffects } from './use-mobile-app-effects.js';
import { useMobileResourceOrchestrator } from './use-mobile-resource-orchestrator.js';
import { useAppStatePersistence } from './use-app-state-persistence.js';
import {
  MAIN_TAB_SCREENS,
  appStateReducer,
  createNavigationOps,
  selectFlatAppState
} from '../runtime/app-state.js';
import { mobileInteractions } from '../shared/browser/mobile-interactions.js';
import { AppContent, AppFrame } from '../components/AppFrame.js';
import { StatusState } from '../components/StatusState.js';
import { DeferredScreenFallback } from './DeferredScreenFallback.js';

const { useCallback, useMemo, useReducer, useRef } = React;

function MissingScreenFallback({ screen }) {
  return React.createElement(
    AppFrame,
    null,
    React.createElement(
      AppContent,
      { screen },
      React.createElement(
        StatusState,
        {
          action: React.createElement('button', { type: 'button', className: 'btn btn-primary', 'data-action': 'goto', 'data-target': 'timer' }, '타이머로 이동'),
          description: '타이머로 돌아가 다시 시도해 주세요.',
          kind: 'error',
          title: '화면을 찾을 수 없습니다'
        }
      )
    )
  );
}

export function MobileApp() {
  const [rootState, dispatchState] = useReducer(appStateReducer, undefined, createInitialMobileAppState);
  const state = useMemo(() => selectFlatAppState(rootState), [rootState]);
  const setState = useCallback((patch) => dispatchState({ type: 'app/patch', payload: patch }), []);
  const stateRef = useRef(state);
  const rootStateRef = useRef(rootState);
  const plannerContentRef = useRef('');
  const plannerCustomMinutesRef = useRef('');
  const qnaDraftRef = useRef({ title: '', content: '' });
  const operationLocksRef = useRef(new Set());
  stateRef.current = state;
  rootStateRef.current = rootState;
  useAppStatePersistence(rootState);

  const deferredScreens = useDeferredScreenRegistry(state.screen);
  const handlerStateActions = useMemo(
    () => createHandlerStateActions({ setState, getRootState: () => rootStateRef.current }),
    [setState]
  );
  const nav = useMemo(() => createNavigationOps({
    getState: () => stateRef.current,
    setState
  }), [setState]);
  const api = useMobileApiController({ setState, stateRef });
  const { retryUserLoad } = useMobileResourceOrchestrator({ api, setState, state, stateRef });

  const beforeGoto = useCallback(({ target } = {}) => {
    const access = resolveScreenAccess(stateRef.current, target);
    if (access.allowed) return true;
    setState({
      upgradePromptTier: access.requiredTier,
      upgradePromptTarget: access.label,
      lockedFeatureTarget: target,
      lockedFeatureTier: access.requiredTier,
      lockedFeatureLabel: access.label,
      ...(MAIN_TAB_SCREENS.includes(target) ? { tab: target } : {})
    });
    nav.goto('lockedFeature');
    return false;
  }, [nav, setState]);

  const viewContext = createMobileViewContext({
    api,
    beforeGoto,
    nav,
    refs: { operationLocksRef, plannerContentRef, plannerCustomMinutesRef, qnaDraftRef },
    retryUserLoad,
    setState,
    state,
    stateRef
  });
  const contextRef = useRef({ ...state, ...viewContext });
  contextRef.current = { ...state, ...viewContext };
  const events = useMemo(
    () => createLazyMobileEventHandlers(() => contextRef.current, { stateActions: handlerStateActions }),
    [handlerStateActions]
  );
  useMobileAppEffects({ events, nav, setState, state });

  const onClick = useCallback((event) => {
    if (Date.now() < mobileInteractions.suppressClickUntilRef.current) {
      event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }
    events.dispatchAction(event);
  }, [events]);
  const onInput = useCallback((event) => events.handleInput?.(event), [events]);
  const onChange = useCallback((event) => events.handleChange?.(event), [events]);
  const onBlur = useCallback((event) => events.handleBlur?.(event), [events]);
  const wrapperProps = {
    className: 'studycrack-mobile-root',
    style: { display: 'contents' },
    onClick,
    onInput,
    onChange,
    onBlur
  };

  if (isDeferredAppScreen(state.screen) && !deferredScreens.registry) {
    return React.createElement(
      'div',
      wrapperProps,
      React.createElement(DeferredScreenFallback, {
        onRetry: deferredScreens.retry,
        screen: state.screen,
        status: deferredScreens.status
      })
    );
  }

  const ScreenComponent = getScreenComponent(state.screen, deferredScreens.registry);
  if (ScreenComponent) {
    const screenContext = createScreenContext(state.screen, viewContext, handlerStateActions, state);
    return React.createElement('div', wrapperProps, React.createElement(ScreenComponent, screenContext));
  }
  return React.createElement('div', wrapperProps, React.createElement(MissingScreenFallback, { screen: state.screen }));
}

export default MobileApp;
