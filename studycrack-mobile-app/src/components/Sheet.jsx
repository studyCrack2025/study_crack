import { useOverlayDialog } from './useOverlayDialog.js';

function classes(...values) {
  return values.filter(Boolean).join(' ');
}

export function Sheet({
  children,
  dismissAction = '',
  open = true,
  overlayClass = '',
  panelClass = '',
  ariaLabel = '선택 메뉴',
  variant = 'neutral'
}) {
  const { onKeyDown, overlayRef, panelRef } = useOverlayDialog({ dismissAction, open });
  if (!open) return null;
  const isPlanner = variant === 'planner';
  return (
    <div ref={overlayRef} className={classes('sc-overlay sc-overlay--sheet', isPlanner && 'planner-sheet-overlay', overlayClass)} data-action={dismissAction}>
      <div ref={panelRef} className={classes('sc-sheet', isPlanner && 'planner-sheet', panelClass)} data-action="noopModal" role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="sc-sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
