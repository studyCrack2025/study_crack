import React from 'react';

const STATUS_KINDS = new Set(['empty', 'error', 'loading', 'offline']);

export function StatusState({ action = null, className = '', description = '', kind = 'empty', title = '' }) {
  const resolvedKind = STATUS_KINDS.has(kind) ? kind : 'empty';
  const loading = resolvedKind === 'loading';
  const error = resolvedKind === 'error';
  const offline = resolvedKind === 'offline';
  const classes = ['sc-empty', `is-${resolvedKind}`, className].filter(Boolean).join(' ');
  const mark = loading ? React.createElement('i') : error ? '!' : offline ? '↕' : '✓';
  return React.createElement(
    'div',
    { className: classes },
    React.createElement('span', { className: 'sc-empty-mark', 'aria-hidden': 'true' }, mark),
    React.createElement(
      'div',
      {
        role: error ? 'alert' : loading || offline ? 'status' : undefined,
        'aria-live': loading || offline ? 'polite' : undefined,
        'aria-busy': loading ? 'true' : undefined
      },
      React.createElement('h3', null, title),
      description ? React.createElement('p', null, description) : null
    ),
    action
  );
}
