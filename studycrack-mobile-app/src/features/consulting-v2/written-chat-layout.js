export function installWrittenChatViewport(browser, element, onResize = () => {}) {
  if (!element || !browser?.document?.documentElement) return () => {};
  const root = browser.document.documentElement, viewport = browser.visualViewport;
  const previous = root.getAttribute('data-written-chat');
  const originalScroll = { left: browser.scrollX || 0, top: browser.scrollY || 0 };
  let frame = null, disposed = false, last = '';
  root.setAttribute('data-written-chat', 'open');
  const update = () => {
    frame = null;
    if (disposed) return;
    const height = Math.max(1, viewport?.height || browser.innerHeight);
    const width = Math.max(1, viewport?.width || browser.innerWidth);
    const top = Math.max(0, viewport?.offsetTop || 0), left = Math.max(0, viewport?.offsetLeft || 0);
    const value = [height, width, top, left].join(':');
    if (last === value) return;
    last = value;
    for (const [key, number] of Object.entries({ height, width, top, left })) element.style.setProperty(`--consulting-chat-${key}`, `${number}px`);
    element.setAttribute('data-compact', String(height <= 560));
    onResize();
  };
  const schedule = () => { if (frame === null && !disposed) frame = browser.requestAnimationFrame(update); };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  browser.addEventListener('resize', schedule);
  browser.addEventListener('orientationchange', schedule);
  update();
  return () => {
    disposed = true;
    if (frame !== null) browser.cancelAnimationFrame(frame);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    browser.removeEventListener('resize', schedule);
    browser.removeEventListener('orientationchange', schedule);
    if (previous === null) root.removeAttribute('data-written-chat');
    else root.setAttribute('data-written-chat', previous);
    browser.scrollTo?.(originalScroll);
  };
}

export function shouldSendWrittenEnter(event, { composing = false, compositionEndedAt = -Infinity, now = Date.now() } = {}) {
  return Boolean(event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.repeat
    && !composing && !event.isComposing && !event.nativeEvent?.isComposing && event.keyCode !== 229 && event.nativeEvent?.keyCode !== 229
    && now - compositionEndedAt >= 50);
}
