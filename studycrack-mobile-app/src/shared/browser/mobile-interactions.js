import { createScrollOps } from './scroll-ops.js';
import { createTimerOps } from './timer-ops.js';

const scrollOps = createScrollOps();
const timerOps = createTimerOps();

const gestureRefs = Object.freeze({
  touchStartXRef: { current: null },
  touchStartYRef: { current: null },
  touchLastXRef: { current: null },
  touchLastYRef: { current: null },
  touchTargetRef: { current: '' },
  touchCardRef: { current: null },
  suppressClickUntilRef: { current: 0 }
});

export function getHomeSliderState(doc = globalThis.document) {
  const slider = doc?.querySelector?.('.home-kpi-slider');
  const track = slider?.querySelector?.('.home-kpi-track');
  const indicators = doc?.querySelectorAll?.('.home-kpi-indicator i') || [];
  const total = indicators.length;
  const activeIndex = Array.from(indicators).findIndex((element) => element.classList.contains('active'));
  return { slider, track, indicators, total, activeIndex: activeIndex >= 0 ? activeIndex : 0 };
}

export function updatePossibleUnivSlider(slider, nextIndex) {
  if (!slider) return;
  const track = slider.querySelector?.('.possible-univ-track');
  const cards = slider.querySelectorAll?.('.possible-univ-card') || [];
  const total = cards.length;
  if (!track || !total) return;
  const index = Math.max(0, Math.min(Number(nextIndex) || 0, total - 1));
  slider.dataset.slideIndex = String(index);
  const target = Array.from(cards)[index];
  const x = target ? target.offsetLeft : 0;
  track.style.transition = 'transform .35s cubic-bezier(.22,1,.36,1)';
  track.style.transform = `translate3d(-${x}px,0,0)`;
  slider.parentElement?.querySelectorAll?.('.slider-indicator [data-action="slideTo"]')?.forEach((dot, dotIndex) => {
    dot.classList?.toggle?.('active', dotIndex === index);
  });
}

export const mobileInteractions = Object.freeze({ scrollOps, timerOps, ...gestureRefs });
