export function renderAppBar({ title = '', showBack = false } = {}) {
  const left = showBack
    ? '<button class="back-btn" data-action="back">←</button>'
    : '<div style="width:36px"></div>';
  return `<div class="appbar">${left}<div class="title">${title}</div></div>`;
}
