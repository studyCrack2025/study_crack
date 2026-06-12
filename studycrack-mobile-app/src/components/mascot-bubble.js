import { CRACKY_SRC } from '../constants/assets.js';

export function mascotSizeClass(size = 'sm') {
  return size === 'lg' ? 'cracky-lg' : size === 'md' ? 'cracky-md' : 'cracky-sm';
}

export function renderMascotBubble({ text = '', size = 'sm', crackySrc = CRACKY_SRC } = {}) {
  return `<div class="mascot"><div class="mascot-badge"><img src="${crackySrc}" class="cracky-img ${mascotSizeClass(size)}" alt="크랙이"/></div><div class="bubble">${text}</div></div>`;
}
