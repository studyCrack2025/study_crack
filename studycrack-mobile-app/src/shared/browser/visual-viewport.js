function readViewportMetrics(viewport, fallbackHeight) {
  const height = Math.max(0, Math.round(Number(viewport?.height) || Number(fallbackHeight) || 0));
  const offsetTop = Math.max(0, Math.round(Number(viewport?.offsetTop) || 0));
  return { height, offsetTop };
}

export function attachVisualViewportMetrics({ doc = globalThis.document, win = globalThis.window } = {}) {
  const root = doc?.documentElement;
  if (!root || !win) return () => {};
  const viewport = win.visualViewport;
  const sync = () => {
    const metrics = readViewportMetrics(viewport, win.innerHeight);
    root.style.setProperty('--sc-visual-height', `${metrics.height}px`);
    root.style.setProperty('--sc-visual-offset-top', `${metrics.offsetTop}px`);
  };
  sync();
  viewport?.addEventListener?.('resize', sync);
  viewport?.addEventListener?.('scroll', sync);
  win.addEventListener?.('resize', sync);
  return () => {
    viewport?.removeEventListener?.('resize', sync);
    viewport?.removeEventListener?.('scroll', sync);
    win.removeEventListener?.('resize', sync);
    root.style.removeProperty('--sc-visual-height');
    root.style.removeProperty('--sc-visual-offset-top');
  };
}

export { readViewportMetrics };
