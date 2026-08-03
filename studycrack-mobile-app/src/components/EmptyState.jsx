export function EmptyState({ action = null, className = '', description = '', loading = false, title = '' }) {
  return (
    <div className={`sc-empty ${loading ? 'is-loading' : ''} ${className}`.trim()} role={loading ? 'status' : undefined} aria-live={loading ? 'polite' : undefined}>
      <span className="sc-empty-mark" aria-hidden="true">{loading ? <i /> : '✓'}</span>
      <div><b>{title}</b>{description ? <p>{description}</p> : null}</div>
      {action}
    </div>
  );
}
