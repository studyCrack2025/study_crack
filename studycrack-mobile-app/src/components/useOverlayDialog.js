import { useEffect, useRef } from 'react';
import {
  cancelOverlayFocus,
  captureOverlayFocus,
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
    const frame = scheduleOverlayFocus(panelRef.current);

    return () => {
      cancelOverlayFocus(frame);
      restoreOverlayFocus(previousFocus);
    };
  }, [open]);

  const onKeyDown = (event) => {
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
