export function fitSingleLineText(element, { minSize = 12, step = 0.5 } = {}) {
  const browser = typeof window === 'undefined' ? null : window;
  if (!element || !browser) return () => {};
  const fit = () => {
    element.style.fontSize = '';
    let size = parseFloat(browser.getComputedStyle?.(element)?.fontSize) || 18;
    let guard = 0;
    while (element.scrollWidth > element.clientWidth + 1 && size > minSize && guard < 24) {
      size -= step;
      element.style.fontSize = `${size}px`;
      guard += 1;
    }
  };
  fit();
  browser.addEventListener?.('resize', fit);
  return () => browser.removeEventListener?.('resize', fit);
}
