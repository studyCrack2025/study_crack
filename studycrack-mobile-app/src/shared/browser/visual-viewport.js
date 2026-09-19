function readViewportMetrics(viewport, fallbackHeight) {
  const height = Math.max(0, Math.round(Number(viewport?.height) || Number(fallbackHeight) || 0));
  const offsetTop = Math.max(0, Math.round(Number(viewport?.offsetTop) || 0));
  return { height, offsetTop };
}

export function attachVisualViewportMetrics({ doc = globalThis.document, win = globalThis.window } = {}) {
  const root = doc?.documentElement;
  if (!root || !win) return () => {};
  const viewport = win.visualViewport;
  let frame = 0;
  const sync = () => {
    const metrics = readViewportMetrics(viewport, win.innerHeight);
    root.style.setProperty('--sc-visual-height', `${metrics.height}px`);
    root.style.setProperty('--sc-visual-offset-top', `${metrics.offsetTop}px`);
    const active = doc.activeElement;
    const editing = active?.matches?.('input:not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"]');
    const inset = Math.max(0, (root.clientHeight || win.innerHeight) - metrics.height - metrics.offsetTop);
    const keyboard = Boolean(editing && inset > 150 && (!viewport?.scale || viewport.scale === 1));
    root.dataset.keyboardOpen = String(keyboard);
    root.style.setProperty('--sc-keyboard-inset', `${keyboard ? inset : 0}px`);
    win.cancelAnimationFrame?.(frame);
    if (!keyboard) return;
    frame = win.requestAnimationFrame?.(() => {
      if (doc.activeElement !== active) return;
      for (let parent = active.parentElement; parent && parent !== doc.body; parent = parent.parentElement) {
        if (!/(auto|scroll)/.test(win.getComputedStyle(parent).overflowY)) continue;
        const field = active.getBoundingClientRect();
        const bounds = parent.getBoundingClientRect();
        const top = Math.max(metrics.offsetTop, bounds.top) + 16;
        const bottom = Math.min(metrics.offsetTop + metrics.height, bounds.bottom) - 16;
        if (field.bottom > bottom) parent.scrollTop += field.bottom - bottom;
        else if (field.top < top) parent.scrollTop -= top - field.top;
      }
    });
  };
  sync();
  viewport?.addEventListener?.('resize', sync);
  viewport?.addEventListener?.('scroll', sync);
  win.addEventListener?.('resize', sync);
  doc.addEventListener?.('focusin', sync);
  doc.addEventListener?.('focusout', sync);
  return () => {
    viewport?.removeEventListener?.('resize', sync);
    viewport?.removeEventListener?.('scroll', sync);
    win.removeEventListener?.('resize', sync);
    doc.removeEventListener?.('focusin', sync);
    doc.removeEventListener?.('focusout', sync);
    win.cancelAnimationFrame?.(frame);
    root.style.removeProperty('--sc-visual-height');
    root.style.removeProperty('--sc-visual-offset-top');
    root.style.removeProperty('--sc-keyboard-inset');
    delete root.dataset.keyboardOpen;
  };
}

export { readViewportMetrics };
