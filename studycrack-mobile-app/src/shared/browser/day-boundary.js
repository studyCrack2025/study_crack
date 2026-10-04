export function attachDayBoundaryCheck(check, { win = globalThis.window, doc = globalThis.document } = {}) {
  const visible = () => { if (doc?.visibilityState !== 'hidden') check(); };
  check();
  const timer = setInterval(check, 30000);
  win?.addEventListener('pageshow', check);
  win?.addEventListener('focus', check);
  doc?.addEventListener('visibilitychange', visible);
  return () => {
    clearInterval(timer);
    win?.removeEventListener('pageshow', check);
    win?.removeEventListener('focus', check);
    doc?.removeEventListener('visibilitychange', visible);
  };
}
