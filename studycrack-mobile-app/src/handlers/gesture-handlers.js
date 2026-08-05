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

function getTouchClientY(event) {
  return event?.touches?.[0]?.clientY ?? event?.changedTouches?.[0]?.clientY;
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
  setRefValue(ctx.touchStartYRef, null);
  setRefValue(ctx.touchLastXRef, null);
  setRefValue(ctx.touchLastYRef, null);
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
    setActiveScoreView,
    setHomeDragOffset,
    setHomeSlideDom = noop,
    setHomeSlideIndex,
    setHomeSlideMotion,
    setScoreCardDom = noop,
    setScoreDragOffset,
    setScoreSlideMotion,
    suppressClickUntilRef,
    waitAndSyncHomeSliderDom = noop
  } = ctx;

  function startGesture(target, clientX, clientY = null) {
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
      setRefValue(ctx.touchStartYRef, clientY);
      return true;
    }
    if (target?.closest?.('.score-journey-scroll')) {
      const card = target.closest('.score-journey-card');
      setRefValue(ctx.touchTargetRef, 'score');
      setRefValue(ctx.touchStartXRef, clientX);
      setRefValue(ctx.touchStartYRef, clientY);
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
    setRefValue(ctx.touchStartYRef, null);
    return false;
  }

  function moveGesture(clientX, clientY = null) {
    const startX = getRefValue(ctx.touchStartXRef);
    if (typeof startX !== 'number' || typeof clientX !== 'number') return false;
    setRefValue(ctx.touchLastXRef, clientX);
    if (typeof clientY === 'number') setRefValue(ctx.touchLastYRef, clientY);
    const delta = clientX - startX;
    const startY = getRefValue(ctx.touchStartYRef);
    const deltaY = typeof startY === 'number' && typeof clientY === 'number' ? clientY - startY : 0;
    const touchTarget = getRefValue(ctx.touchTargetRef, '');

    if (touchTarget === 'home') {
      if (Math.abs(delta) < 8 || Math.abs(delta) < Math.abs(deltaY) * 1.1) return false;
      // 단일 출처: 드래그 오프셋을 state(homeDragOffset)로만 반영한다. JSX 트랙 style이
      // homeSlideIndex + homeDragOffset로 transform을 계산하므로 DOM 직접 조회/CSS 변수 주입이 불필요하고,
      // 그 둘이 React 재렌더와 충돌해 생기던 desync(스와이프 먹통/탭 왕복 후 멈춤)를 제거한다.
      const max = (ctx.homeTargets || []).length;
      const atFirst = ctx.homeSlideIndex <= 0;
      const atLast = ctx.homeSlideIndex >= max;
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

  function endGesture(clientX, clientY = null) {
    const startX = getRefValue(ctx.touchStartXRef);
    if (typeof startX !== 'number' || typeof clientX !== 'number') return false;
    const touchTarget = getRefValue(ctx.touchTargetRef, '');
    const delta = clientX - startX;
    const startY = getRefValue(ctx.touchStartYRef);
    const endY = typeof clientY === 'number' ? clientY : getRefValue(ctx.touchLastYRef);
    const deltaY = typeof startY === 'number' && typeof endY === 'number' ? endY - startY : 0;
    setRefValue(ctx.touchStartXRef, null);
    setRefValue(ctx.touchStartYRef, null);
    setRefValue(ctx.touchLastXRef, null);
    setRefValue(ctx.touchLastYRef, null);
    // 홈 드래그 오프셋은 제스처 종료 시 항상 0으로 되돌린다(state 단일 출처).
    // 작은 스와이프/세로 우세 제스처면 offset 0 → 현재 카드로 자연 스냅백(JSX 트랜지션).
    if (touchTarget === 'home') setHomeDragOffset(0);
    if (!(touchTarget === 'score' && isIOSSafari())) {
      if (ctx.screen !== 'ob5') setScoreDragOffset(0);
    }

    const swipeThreshold = touchTarget === 'home' ? 22 : 26;
    if (touchTarget === 'home' && Math.abs(delta) < Math.abs(deltaY) * 1.1) {
      setRefValue(ctx.touchTargetRef, '');
      setRefValue(ctx.touchCardRef, null);
      restoreIfUnexpectedTopJump();
      return true;
    }
    if (Math.abs(delta) < swipeThreshold) {
      setRefValue(ctx.touchTargetRef, '');
      return true;
    }

    armScrollGuard(1000);
    if (suppressClickUntilRef && typeof suppressClickUntilRef === 'object') suppressClickUntilRef.current = Date.now() + 260;
    markStableScrollPosition();

    if (touchTarget === 'home') {
      // 커밋도 state 단일 출처. 현재 homeSlideIndex(state) 기준으로 다음 인덱스를 계산한다.
      // (DOM의 getHomeSliderState가 인디케이터를 못 읽으면 total=0→인덱스 0 고정되던 버그 제거.)
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
    const onNativeTouchStart = (event) => startGesture(event.target, getTouchClientX(event), getTouchClientY(event));
    const onNativeTouchMove = (event) => {
      const handled = moveGesture(getTouchClientX(event), getTouchClientY(event));
      if (handled && getRefValue(ctx.touchTargetRef, '') === 'home') event.preventDefault?.();
    };
    const onNativeTouchEnd = (event) => endGesture(getTouchClientX(event), getTouchClientY(event));
    const onNativeTouchCancel = () => cancelGesture();
    const onPointerDown = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      startGesture(event.target, event.clientX, event.clientY);
    };
    const onPointerMove = (event) => {
      if (event.pointerType === 'mouse') moveGesture(event.clientX, event.clientY);
    };
    const onPointerUp = (event) => {
      if (event.pointerType === 'mouse') endGesture(event.clientX, event.clientY);
    };
    const onPointerCancel = (event) => {
      if (event.pointerType === 'mouse') cancelGesture();
    };

    targetDocument.addEventListener('touchstart', onNativeTouchStart, { passive: true, capture: true });
    targetDocument.addEventListener('touchmove', onNativeTouchMove, { passive: false, capture: true });
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
