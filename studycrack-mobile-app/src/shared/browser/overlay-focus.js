const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const overlayStack = [];
let pendingReturnFocus = null;

function restoreAttributes(entry) {
  for (const [name, value] of Object.entries(entry.attributes)) {
    if (value === null) entry.root?.removeAttribute?.(name);
    else entry.root?.setAttribute?.(name, value);
  }
}

function syncOverlayStack() {
  for (const entry of overlayStack) {
    if (entry === overlayStack.at(-1)) restoreAttributes(entry);
    else {
      entry.root?.setAttribute?.('inert', '');
      entry.root?.setAttribute?.('aria-hidden', 'true');
    }
  }
}

export function registerOverlay(panel, { root = panel, dismiss } = {}) {
  if (!panel) return () => {};
  const entry = { panel, root, dismiss, attributes: { inert: root?.getAttribute?.('inert') ?? null, 'aria-hidden': root?.getAttribute?.('aria-hidden') ?? null } };
  overlayStack.push(entry);
  syncOverlayStack();
  return () => {
    const index = overlayStack.indexOf(entry);
    if (index < 0) return;
    overlayStack.splice(index, 1);
    restoreAttributes(entry);
    syncOverlayStack();
  };
}

export function isTopOverlay(panel) {
  return Boolean(panel) && overlayStack.at(-1)?.panel === panel;
}

export function dismissTopOverlay() {
  const top = overlayStack.at(-1);
  if (!top) return false;
  top.dismiss?.();
  return true;
}

function focusableElements(panel) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => (
    !element.hidden && !element.closest('[inert], [aria-hidden="true"]') && element.getAttribute('tabindex') !== '-1' && element.getClientRects().length > 0
  ));
}

export function captureOverlayFocus() {
  const previous = pendingReturnFocus;
  pendingReturnFocus = null;
  return previous?.isConnected ? previous : document.activeElement;
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
  const target = element instanceof HTMLElement && element.isConnected && element !== document.body ? element : pendingReturnFocus;
  if (!(target instanceof HTMLElement) || !target.isConnected) return;
  const top = overlayStack.at(-1)?.panel;
  if (target.closest('[inert]') || (top && !top.contains(target))) {
    // Keep the original trigger across a dialog replacement while the page is inactive.
    pendingReturnFocus = target;
    window.requestAnimationFrame(() => {
      if (pendingReturnFocus !== target || overlayStack.length) return;
      pendingReturnFocus = null;
      if (target.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
    });
    return;
  }
  pendingReturnFocus = null;
  target.focus({ preventScroll: true });
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
  if (!panel.contains(document.activeElement) || document.activeElement === panel) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
