// 공용 모달 오버레이: 오버레이 클릭으로 dismiss, 패널은 noopModal로 전파 차단(원본 home-modal 패턴).
export function renderModal({
  body = '',
  dismissAction = '',
  overlayClass = '',
  panelClass = '',
  overlayBaseClass = 'sc-overlay sc-overlay--modal home-modal-overlay',
  panelBaseClass = 'sc-modal home-modal'
} = {}) {
  const overlay = `${overlayBaseClass} ${overlayClass}`.trim();
  const panel = `${panelBaseClass} ${panelClass}`.trim();
  return `<div class="${overlay}" data-action="${dismissAction}"><div class="${panel}" data-action="noopModal" role="dialog" aria-modal="true">${body}</div></div>`;
}
