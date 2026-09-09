import { useEffect, useRef } from 'react';
import {
  cancelOverlayFocus,
  captureOverlayFocus,
  isTopOverlay,
  registerOverlay,
  restoreOverlayFocus,
  scheduleOverlayFocus,
  trapOverlayFocus
} from '../shared/browser/overlay-focus.js';

export function useOverlayDialog({ dismissAction = '', open = true } = {}) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = captureOverlayFocus();
    const unregister = registerOverlay(panelRef.current, { root: overlayRef.current, dismiss: dismissAction ? () => overlayRef.current?.click() : undefined });
    const frame = scheduleOverlayFocus(panelRef.current);

    return () => {
      cancelOverlayFocus(frame);
      unregister();
      restoreOverlayFocus(previousFocus);
    };
  }, [dismissAction, open]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !isTopOverlay(panel) || document.activeElement !== document.body) return undefined;
    // A disabled or removed control can drop focus onto the page during an update.
    const frame = scheduleOverlayFocus(panel);
    return () => cancelOverlayFocus(frame);
  });

  const onKeyDown = (event) => {
    if (!isTopOverlay(panelRef.current) || event.isComposing || event.nativeEvent?.isComposing) return;
    if (event.key === 'Escape' && dismissAction) {
      event.preventDefault();
      overlayRef.current?.click();
      return;
    }
    if (event.key !== 'Tab') return;
    trapOverlayFocus(event, panelRef.current);
  };

  return { onKeyDown, overlayRef, panelRef };
}
