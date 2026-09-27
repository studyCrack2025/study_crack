import { useOverlayDialog } from './useOverlayDialog.js';
import { useContext, useEffect, useLayoutEffect } from 'react';
import { AppOverlayContext } from './AppOverlayContext.js';
const useSheetLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function classes(...values) {
  return values.filter(Boolean).join(' ');
}

export function Sheet({
  children,
  dismissAction = '',
  open = true,
  suspended = false,
  overlayClass = '',
  panelClass = '',
  ariaLabel = '선택 메뉴',
  variant = 'neutral'
}) {
  const side = useContext(AppOverlayContext)?.myFlow && variant !== 'drawer';
  const { onKeyDown, overlayRef, panelRef } = useOverlayDialog({ dismissAction, open: open && !suspended });
  useSheetLayoutEffect(() => {
    if (suspended && overlayRef.current) {
      overlayRef.current.setAttribute('inert', '');
      overlayRef.current.setAttribute('aria-hidden', 'true');
    }
  }, [open, suspended]);
  if (!open) return null;
  const isPlanner = variant === 'planner';
  return (
    <div ref={overlayRef} inert={suspended ? '' : undefined} aria-hidden={suspended || undefined} className={classes('sc-overlay sc-overlay--sheet', isPlanner && 'planner-sheet-overlay', overlayClass, side && 'sc-overlay--drawer')} data-action={dismissAction}>
      <div ref={panelRef} className={classes('sc-sheet', isPlanner && 'planner-sheet', panelClass, side && 'sc-side-panel')} data-action="noopModal" role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1} onKeyDown={onKeyDown}>
        {variant !== 'drawer' && !side ? <div className="sc-sheet-handle" aria-hidden="true" /> : null}
        {children}
      </div>
    </div>
  );
}
