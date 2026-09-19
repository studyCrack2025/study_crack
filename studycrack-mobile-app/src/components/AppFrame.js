import React from 'react';

export function SecondaryScreenHeader({ title = '' }) {
  if (!title) return null;
  return React.createElement(
    'header',
    { className: 'appbar' },
    React.createElement('button', { type: 'button', className: 'back-btn sc-icon-button', 'data-action': 'back', 'aria-label': '뒤로가기' }, '←'),
    React.createElement('h1', { className: 'title' }, title)
  );
}

export function AppFrame({ children }) {
  return React.createElement(
    'div',
    { className: 'app-shell' },
    React.createElement('div', { className: 'app-frame' }, children)
  );
}

export function AppContent({ children, inactive = false, lockScroll = false, screen }) {
  return React.createElement('div', {
    className: `screen app-screen app-content ${lockScroll ? 'modal-lock' : ''}`.trim(),
    'data-screen': screen,
    inert: inactive ? '' : undefined,
    'aria-hidden': inactive ? 'true' : undefined
  }, children);
}
