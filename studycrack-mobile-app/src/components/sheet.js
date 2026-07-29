// 공용 바텀시트 오버레이: 오버레이 클릭으로 dismiss, 패널은 noopModal로 전파 차단(planner-sheet 패턴).
export function renderSheet({
  body = '',
  dismissAction = '',
  overlayClass = '',
  panelClass = '',
  overlayBaseClass = 'sc-overlay sc-overlay--sheet planner-sheet-overlay',
  panelBaseClass = 'sc-sheet planner-sheet'
} = {}) {
  const overlay = `${overlayBaseClass} ${overlayClass}`.trim();
  const panel = `${panelBaseClass} ${panelClass}`.trim();
  return `<div class="${overlay}" data-action="${dismissAction}"><div class="${panel}" data-action="noopModal" role="dialog" aria-modal="true">${body}</div></div>`;
}
