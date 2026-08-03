function classes(...values) {
  return values.filter(Boolean).join(' ');
}

export function Sheet({
  children,
  dismissAction = '',
  open = true,
  overlayClass = '',
  panelClass = ''
}) {
  if (!open) return null;
  return (
    <div className={classes('sc-overlay sc-overlay--sheet planner-sheet-overlay', overlayClass)} data-action={dismissAction}>
      <div className={classes('sc-sheet planner-sheet', panelClass)} data-action="noopModal" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
