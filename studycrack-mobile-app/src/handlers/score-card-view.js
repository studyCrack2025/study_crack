export function setScoreCardDom(element, view) {
  const card = element?.closest?.('.score-journey-card');
  view ??= card?.querySelector('.score-journey-segment button.active')?.dataset.scoreView;
  if (!card || !['current', 'target'].includes(view)) return false;
  card.querySelectorAll('.score-journey-segment button').forEach(button => button.classList.toggle('active', button.dataset.scoreView === view));
  const track = card.querySelector('.score-journey-track');
  track?.style.setProperty('--score-slide-x', view === 'target' ? '-50%' : '0%');
  track?.style.setProperty('--score-slide-transition', 'transform .56s cubic-bezier(.22,.61,.36,1)');
  return true;
}
