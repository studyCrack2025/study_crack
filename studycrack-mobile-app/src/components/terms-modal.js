import { TERMS_CONTENT } from '../constants/terms.js';

export function renderTermsModal(openTermsType, termsContent = TERMS_CONTENT) {
  if (!openTermsType) return '';
  const content = termsContent[openTermsType] || {};
  return `<div class="terms-modal-backdrop" data-action="closeTermsModal"><div class="terms-modal" data-action="noopModal"><button class="terms-modal-close" data-action="closeTermsModal">×</button><p class="terms-modal-title">${content.title || ''}</p><div class="terms-modal-body">${content.body || ''}</div></div></div>`;
}
