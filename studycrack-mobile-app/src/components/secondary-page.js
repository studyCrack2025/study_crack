export function renderSecondaryIntro({ eyebrow = '', title = '', description = '', aside = '' } = {}) {
  return `<header class="sc-secondary-intro"><div>${eyebrow ? `<span class="sc-secondary-eyebrow">${eyebrow}</span>` : ''}<h2>${title}</h2>${description ? `<p>${description}</p>` : ''}</div>${aside ? `<div class="sc-secondary-intro-aside">${aside}</div>` : ''}</header>`;
}

export function renderSecondaryState({ kind = 'empty', title = '', description = '' } = {}) {
  const mark = kind === 'loading' ? '<i></i>' : kind === 'error' ? '!' : '—';
  return `<div class="sc-secondary-state is-${kind}" role="status"><span aria-hidden="true">${mark}</span><div><b>${title}</b>${description ? `<p>${description}</p>` : ''}</div></div>`;
}
