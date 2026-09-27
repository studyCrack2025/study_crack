const pending = new Map();

export function cancelMyExits() {
  for (const cancel of [...pending.values()]) cancel();
}

export function exitMySurface(panel, commit) {
  if (!panel || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (pending.has(panel)) return true;
  let timer;
  const cleanup = () => {
    clearTimeout(timer);
    panel.removeEventListener('animationend', end);
    panel.removeAttribute('data-my-exit');
    pending.delete(panel);
    if (panel.matches('.app-content')) document.dispatchEvent(new CustomEvent('sc-my-exit', { detail: false }));
  };
  const finish = () => { cleanup(); if (panel.isConnected) commit(); };
  const end = event => { if (event.target === panel && event.animationName === 'myDrawerOut') finish(); };
  pending.set(panel, cleanup);
  panel.dataset.myExit = 'true';
  if (panel.matches('.app-content')) document.dispatchEvent(new CustomEvent('sc-my-exit', { detail: true }));
  panel.addEventListener('animationend', end);
  timer = setTimeout(finish, 380);
  return true;
}

const replay = new WeakSet();
export function captureMyDismiss(event) {
  const action = event.target.closest?.('[data-action]');
  if (!action) return;
  if (replay.has(action)) { replay.delete(action); return; }
  const overlay = action.closest('.sc-overlay');
  const panel = overlay?.querySelector('.sc-side-panel, .my-summary-sheet');
  if (!panel) return;
  if (panel.hasAttribute('data-my-exit')) { event.stopPropagation(); event.preventDefault(); return; }
  if (action.dataset.action !== overlay.dataset.action) return;
  if (exitMySurface(panel, () => { replay.add(action); action.click(); })) {
    event.stopPropagation();
    event.preventDefault();
  }
}
