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
  // header / scroll body 2영역: panel은 overflow:hidden, body만 독립 스크롤(하단 radius·safe-area 보장).
  return `<div class="terms-modal-backdrop" data-action="closeTermsModal"><div class="terms-modal" data-action="noopModal"><div class="terms-modal-head"><p class="terms-modal-title">${escapeHtml(content.title || '약관')}</p><button class="terms-modal-close" data-action="closeTermsModal" aria-label="닫기">×</button></div><div class="terms-modal-body">${escapeHtml(content.body || '약관 내용을 불러오지 못했습니다.')}</div></div></div>`;
}
