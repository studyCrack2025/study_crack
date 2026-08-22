import { TERMS_CONTENT } from '../constants/terms.js';
import { Modal } from './Modal.jsx';

export function TermsModal({ openTermsType = '', termsContent = TERMS_CONTENT }) {
  if (!openTermsType) return null;
  const content = termsContent[openTermsType] || {};
  return (
    <Modal dismissAction="closeTermsModal" ariaLabel={content.title || '약관'} overlayClass="terms-modal-backdrop" panelClass="terms-modal">
      <div className="sc-modal-head terms-modal-head">
        <p className="terms-modal-title">{content.title || '약관'}</p>
        <button type="button" className="sc-overlay-close terms-modal-close" data-action="closeTermsModal" aria-label="닫기">×</button>
      </div>
      <div className="sc-modal-body terms-modal-body">{content.body || '약관 내용을 불러오지 못했습니다.'}</div>
    </Modal>
  );
}
