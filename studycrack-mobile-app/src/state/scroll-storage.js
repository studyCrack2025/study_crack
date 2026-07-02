import { STORAGE_KEYS, readObject, safeStringifySet } from './storage.js';

export function getScrollY(win = globalThis.window) {
  return win?.scrollY || win?.pageYOffset || 0;
}

export function readScrollPositions(storage = globalThis.localStorage) {
  return readObject(STORAGE_KEYS.scrollPositions, {}, storage);
}

export function saveScrollPositions(positions, storage = globalThis.localStorage) {
  return safeStringifySet(STORAGE_KEYS.scrollPositions, positions || {}, storage);
}

export function rememberScreenScroll(positions, screen, y) {
  return {
    ...(positions || {}),
    [screen]: Number(y) || 0
  };
}

export function prepareNavigationScroll(positions, currentScreen, nextScreen, currentY) {
  const next = rememberScreenScroll(positions, currentScreen, currentY);
  if (typeof next[nextScreen] !== 'number') next[nextScreen] = Number(currentY) || 0;
  return next;
}

export function restoreScrollPosition(screen, positions, scrollTo = globalThis.window?.scrollTo?.bind(globalThis.window)) {
  const y = positions && typeof positions[screen] === 'number' ? positions[screen] : 0;
  if (typeof scrollTo === 'function') scrollTo({ top: y, left: 0, behavior: 'auto' });
  return y;
}
