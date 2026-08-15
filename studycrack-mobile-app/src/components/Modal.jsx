import { useOverlayDialog } from './useOverlayDialog.js';

function classes(...values) {
  return values.filter(Boolean).join(' ');
}

export function Modal({
  children,
  dismissAction = '',
  open = true,
  overlayClass = '',
  panelClass = '',
  ariaLabel = '안내'
}) {
  const { onKeyDown, overlayRef, panelRef } = useOverlayDialog({ dismissAction, open });
  if (!open) return null;
  return (
    <div ref={overlayRef} className={classes('sc-overlay sc-overlay--modal sc-modal-padded-overlay', overlayClass)} data-action={dismissAction}>
      <div ref={panelRef} className={classes('sc-modal sc-modal-padded', panelClass)} data-action="noopModal" role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}
