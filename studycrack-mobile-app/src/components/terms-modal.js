import { TERMS_CONTENT } from '../constants/terms.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTermsModal(openTermsType, termsContent = TERMS_CONTENT) {
  if (!openTermsType) return '';
  const content = termsContent[openTermsType] || {};
  return `<div class="terms-modal-backdrop" data-action="closeTermsModal"><div class="terms-modal" data-action="noopModal"><button class="terms-modal-close" data-action="closeTermsModal">×</button><p class="terms-modal-title">${escapeHtml(content.title || '약관')}</p><div class="terms-modal-body">${escapeHtml(content.body || '약관 내용을 불러오지 못했습니다.')}</div></div></div>`;
}
