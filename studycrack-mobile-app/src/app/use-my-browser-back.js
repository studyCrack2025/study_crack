import { useEffect, useRef } from 'react';
import { dismissTopOverlay } from '../shared/browser/overlay-focus.js';

export function useMyBrowserBack(active, back) {
  const latestBack = useRef(back);
  latestBack.current = back;
  useEffect(() => {
    if (!active) return undefined;
    const history = globalThis.history;
    const marker = `my-${Date.now()}`;
    const original = history.state;
    const push = () => history.pushState({ ...original, scMyPanel: marker }, '');
    push();
    const onBack = () => {
      if (history.state?.scMyPanel === marker) return;
      push();
      if (!dismissTopOverlay()) latestBack.current?.();
    };
    globalThis.addEventListener('popstate', onBack);
    return () => {
      globalThis.removeEventListener('popstate', onBack);
      if (history.state?.scMyPanel === marker) history.back();
    };
  }, [active]);
}
