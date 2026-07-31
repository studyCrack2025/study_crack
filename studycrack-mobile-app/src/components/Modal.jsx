function classes(...values) {
  return values.filter(Boolean).join(' ');
}

export function Modal({
  children,
  dismissAction = '',
  open = true,
  overlayClass = '',
  panelClass = ''
}) {
  if (!open) return null;
  return (
    <div className={classes('sc-overlay sc-overlay--modal home-modal-overlay', overlayClass)} data-action={dismissAction}>
      <div className={classes('sc-modal home-modal', panelClass)} data-action="noopModal" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
