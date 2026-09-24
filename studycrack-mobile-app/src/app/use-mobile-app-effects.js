import React from 'react';
import { attachGestureEventBridge } from '../handlers/gesture-handlers.js';
import { loadAppScreenRegistry } from './screen-registry.js';
import { shouldLoadDeferredMobileScreens } from './mobile-routing.js';
import { CRACKY_SRC, ONBOARDING_LOGO_SRC } from '../constants/assets.js';
import { setApiAuthExpiredHandler } from '../shared/api/client.js';
import { expireMobileSessionSilently } from '../features/session/mobile-session-adapter.js';
import { hasMobileClientSession, markMobileAppBooted } from '../shared/browser/mobile-runtime.js';
import { mobileInteractions } from '../shared/browser/mobile-interactions.js';
import { attachVisualViewportMetrics } from '../shared/browser/visual-viewport.js';
import { hasSeenIntro } from '../features/session/intro-storage.js';

const { useCallback, useEffect, useLayoutEffect, useRef, useState } = React;

export function useDeferredScreenRegistry(screen) {
  const [registry, setRegistry] = useState(null);
  const [status, setStatus] = useState('idle');
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const shouldLoad = shouldLoadDeferredMobileScreens(screen, Boolean(registry));
    if (!shouldLoad || registry) return undefined;
    let active = true;
    setStatus('loading');
    loadAppScreenRegistry()
      .then((module) => {
        if (!active) return;
        setRegistry(module);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [registry, retryTick, screen]);

  const retry = useCallback(() => {
    setStatus('idle');
    setRetryTick((value) => value + 1);
  }, []);

  return { registry, retry, status };
}

export function useMobileAppEffects({ events, nav, setState, state } = {}) {
  const plannerCenteredRef = useRef(false);
  const eventsRef = useRef(events);
  const { scrollOps, timerOps } = mobileInteractions;
  eventsRef.current = events;

  useEffect(() => attachVisualViewportMetrics(), []);
  useEffect(() => setApiAuthExpiredHandler(expireMobileSessionSilently), []);
  useEffect(() => {
    markMobileAppBooted({ crackySrc: CRACKY_SRC, onboardingLogoSrc: ONBOARDING_LOGO_SRC });
  }, []);

  useLayoutEffect(() => {
    if (state.screen !== 'planner') return;
    const behavior = plannerCenteredRef.current ? 'smooth' : 'auto';
    scrollOps.centerPlannerDate(state.selectedDate, behavior);
    plannerCenteredRef.current = true;
  }, [scrollOps, state.screen, state.selectedDate]);

  useEffect(() => {
    if (state.screen === 'home' || state.homeDragOffset === 0) return;
    setState({ homeDragOffset: 0 });
  }, [setState, state.screen, state.homeDragOffset]);

  useEffect(() => {
    if (state.screen !== 'splash') return undefined;
    const destination = hasMobileClientSession() ? 'timer' : hasSeenIntro() ? 'authLogin' : 'on1';
    const timer = globalThis.setTimeout?.(() => nav.goto(destination, false), 900);
    return () => {
      if (timer) globalThis.clearTimeout?.(timer);
    };
  }, [nav, state.screen]);

  useEffect(() => {
    if (!state.homeSlideMotion) return undefined;
    const timer = globalThis.setTimeout?.(() => setState({ homeSlideMotion: '' }), 420);
    return () => {
      if (timer) globalThis.clearTimeout?.(timer);
    };
  }, [setState, state.homeSlideMotion]);

  useEffect(() => {
    if (!state.scoreSlideMotion) return undefined;
    const timer = globalThis.setTimeout?.(() => setState({ scoreSlideMotion: '' }), 380);
    return () => {
      if (timer) globalThis.clearTimeout?.(timer);
    };
  }, [setState, state.scoreSlideMotion]);

  useEffect(() => {
    const session = state.activeStudySession;
    if (!session || session.status !== 'running') {
      timerOps.stopLiveStudyTimer();
      return undefined;
    }
    timerOps.startLiveStudyTimer(session.startedAt, (seconds) => setState({ studyTimerTick: seconds }));
    const syncAfterResume = () => timerOps.syncLiveStudyTimer();
    const documentRef = globalThis.document;
    globalThis.addEventListener?.('pageshow', syncAfterResume);
    globalThis.addEventListener?.('focus', syncAfterResume);
    documentRef?.addEventListener?.('visibilitychange', syncAfterResume);
    return () => {
      globalThis.removeEventListener?.('pageshow', syncAfterResume);
      globalThis.removeEventListener?.('focus', syncAfterResume);
      documentRef?.removeEventListener?.('visibilitychange', syncAfterResume);
      timerOps.stopLiveStudyTimer();
    };
  }, [setState, state.activeStudySession?.sessionId, timerOps]);

  useEffect(() => {
    if (state.screen === 'accountInfo') return;
    if (!state.phoneChangeModalOpen && !state.myProfileEditOpen) return;
    setState({
      phoneChangeModalOpen: false,
      phoneChangeStep: 'input',
      phoneChangeSending: false,
      myProfileEditOpen: false,
      myProfileNameDraft: '',
      myProfilePhoneDraft: '',
      myProfilePhoneCodeDraft: ''
    });
  }, [setState, state.screen, state.phoneChangeModalOpen, state.myProfileEditOpen]);

  useEffect(() => attachGestureEventBridge(() => eventsRef.current?.gesture), []);
}
