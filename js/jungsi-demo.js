(function() {
  'use strict';
const dialog = document.querySelector('#demo-dialog');
const openButton = document.querySelector('.demo-open');
const zoomButton = document.querySelector('.demo-zoom');
const imageScroll = document.querySelector('.demo-scroll');

openButton.addEventListener('click', () => {
  dialog.showModal();
  document.querySelector('.demo-close').focus();
});
document.querySelector('.demo-close').addEventListener('click', () => dialog.close());
zoomButton.addEventListener('click', () => {
  const enlarged = imageScroll.classList.toggle('is-zoomed');
  zoomButton.setAttribute('aria-pressed', String(enlarged));
  zoomButton.textContent = enlarged ? '화면에 맞추기 −' : '원본 크기로 확대 +';
});
dialog.addEventListener('close', () => {
  imageScroll.classList.remove('is-zoomed');
  zoomButton.setAttribute('aria-pressed', 'false');
  zoomButton.textContent = '원본 크기로 확대 +';
  imageScroll.scrollTo(0, 0);
  openButton.focus({ preventScroll: true });
});

})();
