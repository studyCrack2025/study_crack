const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const overlayStack = [];

export function registerOverlay(panel) {
  if (!panel) return () => {};
  overlayStack.push(panel);
  return () => {
    const index = overlayStack.lastIndexOf(panel);
    if (index >= 0) overlayStack.splice(index, 1);
  };
}

export function isTopOverlay(panel) {
  return Boolean(panel) && overlayStack.at(-1) === panel;
}

function focusableElements(panel) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => (
    !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0
  ));
}

export function captureOverlayFocus() {
  return document.activeElement;
}

export function scheduleOverlayFocus(panel) {
  return window.requestAnimationFrame(() => {
    if (!isTopOverlay(panel)) return;
    const [first] = focusableElements(panel);
    (first || panel)?.focus({ preventScroll: true });
  });
}

export function cancelOverlayFocus(frame) {
  window.cancelAnimationFrame(frame);
}

export function restoreOverlayFocus(element) {
  if (element instanceof HTMLElement && element.isConnected && !element.closest('[inert]')) element.focus({ preventScroll: true });
}

export function trapOverlayFocus(event, panel) {
  const focusable = focusableElements(panel);
  if (!focusable.length) {
    event.preventDefault();
    panel?.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
