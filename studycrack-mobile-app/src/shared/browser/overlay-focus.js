const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

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
    const [first] = focusableElements(panel);
    (first || panel)?.focus({ preventScroll: true });
  });
}

export function cancelOverlayFocus(frame) {
  window.cancelAnimationFrame(frame);
}

export function restoreOverlayFocus(element) {
  if (element instanceof HTMLElement && element.isConnected) element.focus({ preventScroll: true });
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
