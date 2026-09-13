import assert from 'node:assert/strict';
import { createGestureHandlers } from '../src/handlers/gesture-handlers.js';
import { setScoreCardDom } from '../src/handlers/score-card-view.js';

for (const ios of [false, true]) {
  let active = 'target', state = 'target';
  const styles = new Map();
  const buttons = ['current', 'target'].map(view => ({ dataset: { scoreView: view }, classList: { toggle: (_name, enabled) => { if (enabled) active = view; } } }));
  const track = { style: { setProperty: (key, value) => styles.set(key, value) } };
  const card = { dataset: {}, clientWidth: 300, closest: () => card, querySelectorAll: () => buttons,
    querySelector: selector => selector.includes('button.active') ? { getAttribute: () => active, dataset: { scoreView: active } } : track };
  const target = { closest: selector => selector.startsWith('input') || selector.includes('home-kpi') ? null : card };
  const ctx = { screen: 'ob5', isIOSSafari: () => ios, setActiveScoreView: value => { state = value; }, setScoreDragOffset() {}, setHomeDragOffset() {} };
  for (const name of ['touchStartXRef','touchStartYRef','touchLastXRef','touchLastYRef','touchTargetRef','touchCardRef','suppressClickUntilRef']) ctx[name] = { current: null };
  const gestures = createGestureHandlers(ctx);
  gestures.startGesture(target, 100, 100); gestures.moveGesture(240, 100); gestures.endGesture(240, 100);
  assert.equal(active, 'current'); assert.equal(state, 'current'); assert.equal(styles.get('--score-slide-x'), '0%');
  gestures.startGesture(target, 240, 100); gestures.moveGesture(100, 100); gestures.endGesture(100, 100);
  assert.equal(active, 'target'); assert.equal(state, 'target'); assert.equal(styles.get('--score-slide-x'), '-50%');
  for (const cancel of [false, true]) {
    gestures.startGesture(target, 100, 100); gestures.moveGesture(110, 100);
    if (cancel) gestures.cancelGesture(); else gestures.endGesture(110, 100);
    assert.equal(styles.get('--score-slide-x'), '-50%'); assert.equal(active, 'target'); assert.equal(state, 'target');
    assert.equal(card.dataset.dragging, undefined); assert.equal(ctx.touchCardRef.current, null);
  }
  assert.equal(setScoreCardDom(null, 'current'), false);
  assert.equal(setScoreCardDom(card, 'invalid'), false);
}
console.log('Score card gesture contracts passed: normal/iOS swipe, short drag, cancellation and DOM/state agreement.');
