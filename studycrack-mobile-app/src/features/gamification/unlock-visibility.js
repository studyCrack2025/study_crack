export function observeAquariumUnlock(element, view, { onActive, onNotice }) {
  const doc = element?.ownerDocument, browser = doc?.defaultView;
  if (!element || !browser?.IntersectionObserver || !view.claimUnlock) return;
  let intersecting = false, cancelled = false, pending = false, recheck = false;
  const visible = () => !cancelled && element.isConnected && intersecting && doc.visibilityState === 'visible' && !element.closest('[inert], [aria-hidden="true"]');
  const update = () => {
    const ready = visible(); onActive(ready);
    if (!ready || view.status !== 'ready' || !view.growth?.highestUnlockedStage) return;
    if (pending) { recheck = true; return; }
    pending = true;
    view.claimUnlock(visible).then(claimed => {
      if (claimed && !cancelled) onNotice(claimed);
    }).finally(() => {
      pending = false;
      if (recheck && !cancelled) { recheck = false; update(); }
    });
  };
  const observer = new browser.IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); }, { rootMargin: '0px 0px -96px 0px' });
  observer.observe(element);
  const mutation = new browser.MutationObserver(update);
  for (let parent = element.parentElement; parent; parent = parent.parentElement) mutation.observe(parent, { attributes: true, attributeFilter: ['inert', 'aria-hidden'] });
  doc.addEventListener('visibilitychange', update);
  return () => { cancelled = true; observer.disconnect(); mutation.disconnect(); doc.removeEventListener('visibilitychange', update); };
}
