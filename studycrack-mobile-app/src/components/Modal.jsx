import { useOverlayDialog } from './useOverlayDialog.js';
import { useContext } from 'react';
import { AppOverlayContext } from './AppOverlayContext.js';

function classes(...values) {
  return values.filter(Boolean).join(' ');
}

export function Modal({
  children,
  dismissAction = '',
  onDismiss,
  onPanelKeyDown,
  open = true,
  overlayClass = '',
  panelClass = '',
  ariaLabel = '안내'
}) {
  const bridge = useContext(AppOverlayContext);
  const side = bridge?.myFlow && !/로그아웃|탈퇴|삭제/.test(ariaLabel);
  const { onKeyDown, overlayRef, panelRef } = useOverlayDialog({ dismissAction, onDismiss, open });
  if (!open) return null;
  return (
    <div ref={overlayRef} className={classes('sc-overlay sc-overlay--modal sc-modal-padded-overlay', overlayClass, side && 'sc-overlay--drawer')} data-action={dismissAction} onClick={onDismiss ? event => { if (event.target === event.currentTarget) { event.stopPropagation(); onDismiss(); } } : undefined}>
      <div ref={panelRef} className={classes('sc-modal sc-modal-padded', panelClass, side && 'sc-side-panel')} data-action="noopModal" role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1} onKeyDown={event => { onKeyDown(event); if (!event.defaultPrevented) onPanelKeyDown?.(event); }}>
        {children}
      </div>
    </div>
  );
}
