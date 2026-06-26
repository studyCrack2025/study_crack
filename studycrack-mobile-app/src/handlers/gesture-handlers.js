function noop() {}

function getDocument(ctx) {
  return ctx.document || globalThis.document;
}

function query(ctx, selector) {
  return getDocument(ctx)?.querySelector?.(selector) || null;
}

function getRefValue(ref, fallback = null) {
  return ref && typeof ref === 'object' ? ref.current ?? fallback : fallback;
}

function setRefValue(ref, value) {
  if (ref && typeof ref === 'object') ref.current = value;
}

function clearCardGesture(card) {
  if (!card?.dataset) return;
  delete card.dataset.dragStartX;
  delete card.dataset.dragging;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getTouchClientX(event) {
  return event?.touches?.[0]?.clientX ?? event?.changedTouches?.[0]?.clientX;
}

function findNearestHomeCard(ctx, slider) {
  const cards = Array.from(slider?.querySelectorAll?.('.slider-card') || []);
  if (!slider || !cards.length) return 0;
  const sliderRect = slider.getBoundingClientRect();
  const centerX = sliderRect.left + sliderRect.width / 2;
  return cards.reduce((nearest, card, idx) => {
    const rect = card.getBoundingClientRect();
    const cardCenter = rect.left + rect.width / 2;
    const dist = Math.abs(cardCenter - centerX);
    return dist < nearest.dist ? { idx, dist } : nearest;
  }, { idx: 0, dist: Number.POSITIVE_INFINITY }).idx;
}

function resetGestureState(ctx, previousTarget = '') {
  setRefValue(ctx.touchStartXRef, null);
  setRefValue(ctx.touchLastXRef, null);
  setRefValue(ctx.touchTargetRef, '');
  if (!(previousTarget === 'home' && ctx.screen === 'home')) ctx.setHomeDragOffset?.(0);
  if (!(previousTarget === 'score' && ctx.isIOSSafari?.())) {
    if (ctx.screen !== 'ob5') ctx.setScoreDragOffset?.(0);
  }
  clearCardGesture(getRefValue(ctx.touchCardRef));
  setRefValue(ctx.touchCardRef, null);
}

export function createGestureHandlers(ctx) {
  const {
    armScrollGuard = noop,
    ensureScoreJourneyDomReady = noop,
    getHomeSliderState = () => ({}),
    isIOSSafari = () => false,
    markStableScrollPosition = noop,
    requestAnimationFrame = globalThis.requestAnimationFrame || ((fn) => fn()),
    restoreIfUnexpectedTopJump = noop,
    setActiveScoreView = noop,
    setHomeDragOffset = noop,
    setHomeSlideDom = noop,
    setHomeSlideIndex = noop,
    setHomeSlideMotion = noop,
    setScoreCardDom = noop,
    setScoreDragOffset = noop,
    setScoreSlideMotion = noop,
    suppressClickUntilRef,
    waitAndSyncHomeSliderDom = noop
  } = ctx;

  function startGesture(target, clientX) {
    if (typeof clientX !== 'number') return false;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) {
      setRefValue(ctx.touchTargetRef, '');
      setRefValue(ctx.touchStartXRef, null);
      return false;
    }
    if (target?.closest?.('.home-kpi-slider')) {
      if (ctx.screen === 'home' && isIOSSafari()) {
        const slider = query(ctx, '.home-kpi-slider');
        if (slider && slider.dataset.homeSliderReady !== '1') waitAndSyncHomeSliderDom();
      }
      setRefValue(ctx.touchTargetRef, 'home');
      setRefValue(ctx.touchStartXRef, clientX);
      return true;
    }
    if (target?.closest?.('.score-journey-scroll')) {
      const card = target.closest('.score-journey-card');
      setRefValue(ctx.touchTargetRef, 'score');
      setRefValue(ctx.touchStartXRef, clientX);
      setRefValue(ctx.touchCardRef, card);
      if (ctx.screen === 'ob5' && card) {
        card.dataset.dragStartX = String(clientX);
        card.dataset.dragging = '1';
        card.querySelector?.('.score-journey-track')?.style?.setProperty('--score-slide-transition', '0s');
      }
      return true;
    }
    setRefValue(ctx.touchTargetRef, '');
    setRefValue(ctx.touchStartXRef, null);
    return false;
  }

  function moveGesture(clientX) {
    const startX = getRefValue(ctx.touchStartXRef);
    if (typeof startX !== 'number' || typeof clientX !== 'number') return false;
    setRefValue(ctx.touchLastXRef, clientX);
    const delta = clientX - startX;
    const touchTarget = getRefValue(ctx.touchTargetRef, '');

    if (touchTarget === 'home') {
      if (ctx.screen === 'home') {
        const { track, activeIndex = 0, total = 0 } = getHomeSliderState();
        if (!track || !total) return false;
        const max = total - 1;
        const overscrolling = (activeIndex === 0 && delta > 0) || (activeIndex === max && delta < 0);
        const clamped = clamp(delta * (overscrolling ? 0.35 : 0.92), -118, 118);
        track.style.setProperty('--home-slide-x', `calc(-${activeIndex} * (var(--home-slide-card-width) + var(--home-slide-gap)) + ${clamped}px)`);
        track.style.setProperty('--home-slide-transition', '0s');
        return true;
      }
      const atFirst = ctx.homeSlideIndex === 0;
      const atLast = ctx.homeSlideIndex === (ctx.homeTargets || []).length;
      const overscrolling = (atFirst && delta > 0) || (atLast && delta < 0);
      setHomeDragOffset(clamp(delta * (overscrolling ? 0.35 : 0.92), -118, 118));
      return true;
    }

    if (touchTarget === 'score') {
      if (ctx.screen === 'ob5' || isIOSSafari()) {
        const card = getRefValue(ctx.touchCardRef);
        if (!card || card.dataset.dragging !== '1') return false;
        ensureScoreJourneyDomReady(card);
        const currentView = card.querySelector?.('.score-journey-segment button.active')?.getAttribute?.('data-score-view') || 'target';
        const base = currentView === 'target' ? -50 : 0;
        const offsetPct = clamp((delta / Math.max(card.clientWidth || 1, 1)) * 100, -50, 50);
        const track = card.querySelector?.('.score-journey-track');
        if (track) {
          track.style.setProperty('--score-slide-x', `calc(${base}% + ${offsetPct}%)`);
          track.style.setProperty('--score-slide-transition', '0s');
        }
        return true;
      }
      setScoreDragOffset(clamp(delta, -96, 96));
      return true;
    }
    return false;
  }

  function endGesture(clientX) {
    const startX = getRefValue(ctx.touchStartXRef);
    if (typeof startX !== 'number' || typeof clientX !== 'number') return false;
    const touchTarget = getRefValue(ctx.touchTargetRef, '');
    const delta = clientX - startX;
    setRefValue(ctx.touchStartXRef, null);
    setRefValue(ctx.touchLastXRef, null);
    if (!(touchTarget === 'home' && ctx.screen === 'home')) setHomeDragOffset(0);
    if (!(touchTarget === 'score' && isIOSSafari())) {
      if (ctx.screen !== 'ob5') setScoreDragOffset(0);
    }

    const swipeThreshold = touchTarget === 'home' ? 22 : 26;
    if (Math.abs(delta) < swipeThreshold) {
      if (touchTarget === 'home' && ctx.screen === 'home') {
        const slider = query(ctx, '.home-kpi-slider');
        const nearest = findNearestHomeCard(ctx, slider);
        requestAnimationFrame(() => {
          const current = Number(slider?.querySelector?.('.home-kpi-track')?.dataset.homeSlideIndex || 0);
          setHomeSlideDom(nearest, nearest > current ? 'motion-next' : 'motion-prev');
        });
      }
      setRefValue(ctx.touchTargetRef, '');
      return true;
    }

    armScrollGuard(1000);
    if (suppressClickUntilRef && typeof suppressClickUntilRef === 'object') suppressClickUntilRef.current = Date.now() + 260;
    markStableScrollPosition();

    if (touchTarget === 'home') {
      if (ctx.screen === 'home') {
        const { activeIndex = 0, total = 0 } = getHomeSliderState();
        const next = delta < 0 ? Math.min(activeIndex + 1, Math.max(0, total - 1)) : Math.max(activeIndex - 1, 0);
        setHomeSlideDom(next, next > activeIndex ? 'motion-next' : 'motion-prev');
        setRefValue(ctx.touchTargetRef, '');
        setRefValue(ctx.touchCardRef, null);
        restoreIfUnexpectedTopJump();
        return true;
      }
      setHomeSlideIndex((prev) => {
        const next = delta < 0 ? Math.min(prev + 1, (ctx.homeTargets || []).length) : Math.max(prev - 1, 0);
        if (next === prev) return prev;
        setHomeSlideMotion(next > prev ? 'motion-next' : 'motion-prev');
        return next;
      });
    } else if (touchTarget === 'score') {
      if (ctx.screen === 'ob5' || isIOSSafari()) {
        const card = getRefValue(ctx.touchCardRef);
        if (card) {
          const threshold = Math.max(40, (card.clientWidth || 0) * 0.15);
          ensureScoreJourneyDomReady(card);
          const currentView = card.querySelector?.('.score-journey-segment button.active')?.getAttribute?.('data-score-view') || 'target';
          let nextView = currentView;
          if (delta < -threshold) nextView = 'target';
          if (delta > threshold) nextView = 'current';
          setScoreCardDom(card, nextView);
          clearCardGesture(card);
        }
      } else {
        setActiveScoreView((prev) => {
          const next = delta < 0 ? 'target' : 'current';
          if (next === prev) return prev;
          setScoreSlideMotion(next === 'target' ? 'motion-next' : 'motion-prev');
          return next;
        });
      }
    }
    setRefValue(ctx.touchTargetRef, '');
    setRefValue(ctx.touchCardRef, null);
    restoreIfUnexpectedTopJump();
    return true;
  }

  function cancelGesture() {
    resetGestureState(ctx, getRefValue(ctx.touchTargetRef, ''));
    return true;
  }

  function attachGestureListeners(targetDocument = getDocument(ctx)) {
    if (!targetDocument?.addEventListener) return noop;
    const onNativeTouchStart = (event) => startGesture(event.target, getTouchClientX(event));
    const onNativeTouchMove = (event) => moveGesture(getTouchClientX(event));
    const onNativeTouchEnd = (event) => endGesture(getTouchClientX(event));
    const onNativeTouchCancel = () => cancelGesture();
    const onPointerDown = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      startGesture(event.target, event.clientX);
    };
    const onPointerMove = (event) => {
      if (event.pointerType === 'mouse') moveGesture(event.clientX);
    };
    const onPointerUp = (event) => {
      if (event.pointerType === 'mouse') endGesture(event.clientX);
    };
    const onPointerCancel = (event) => {
      if (event.pointerType === 'mouse') cancelGesture();
    };

    targetDocument.addEventListener('touchstart', onNativeTouchStart, { passive: true, capture: true });
    targetDocument.addEventListener('touchmove', onNativeTouchMove, { passive: true, capture: true });
    targetDocument.addEventListener('touchend', onNativeTouchEnd, { passive: true, capture: true });
    targetDocument.addEventListener('touchcancel', onNativeTouchCancel, { passive: true, capture: true });
    targetDocument.addEventListener('pointerdown', onPointerDown, true);
    targetDocument.addEventListener('pointermove', onPointerMove, true);
    targetDocument.addEventListener('pointerup', onPointerUp, true);
    targetDocument.addEventListener('pointercancel', onPointerCancel, true);

    return () => {
      targetDocument.removeEventListener('touchstart', onNativeTouchStart, true);
      targetDocument.removeEventListener('touchmove', onNativeTouchMove, true);
      targetDocument.removeEventListener('touchend', onNativeTouchEnd, true);
      targetDocument.removeEventListener('touchcancel', onNativeTouchCancel, true);
      targetDocument.removeEventListener('pointerdown', onPointerDown, true);
      targetDocument.removeEventListener('pointermove', onPointerMove, true);
      targetDocument.removeEventListener('pointerup', onPointerUp, true);
      targetDocument.removeEventListener('pointercancel', onPointerCancel, true);
    };
  }

  return {
    attachGestureListeners,
    cancelGesture,
    endGesture,
    moveGesture,
    startGesture
  };
}
