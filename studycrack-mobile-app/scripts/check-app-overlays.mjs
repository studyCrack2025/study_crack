import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import * as focus from '../src/shared/browser/overlay-focus.js';
import { createNavigationHandlers } from '../src/handlers/navigation-handlers.js';

function surface(attributes = {}) {
  const attrs = new Map(Object.entries(attributes));
  return {
    getAttribute: name => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: name => attrs.delete(name)
  };
}

const bottom = surface();
const top = surface();
let dismissed = 0;
let navigated = 0;
const removeBottom = focus.registerOverlay(bottom, { root: bottom });
const removeTop = focus.registerOverlay(top, { root: top, dismiss: () => { dismissed += 1; } });
assert.equal(bottom.getAttribute('inert'), '', 'covered overlays must not remain interactive');
assert.equal(bottom.getAttribute('aria-hidden'), 'true');
assert.equal(top.getAttribute('inert'), null);
const navigation = createNavigationHandlers({ back: () => { navigated += 1; } });
navigation.back();
assert.equal(dismissed, 1, 'back closes the top overlay before navigating');
assert.equal(navigated, 0);
removeTop();
assert.equal(bottom.getAttribute('inert'), null);
assert.equal(bottom.getAttribute('aria-hidden'), null);
navigation.back();
assert.equal(navigated, 0, 'a non-dismissible dialog must not allow background back navigation');
removeBottom();
navigation.back();
assert.equal(navigated, 1);
removeBottom();
assert.equal(focus.isTopOverlay(bottom), false, 'cleanup is idempotent');

const preserved = surface({ inert: '', 'aria-hidden': 'true' });
const removePreserved = focus.registerOverlay(preserved, { root: preserved });
const removeCover = focus.registerOverlay(top, { root: top });
removePreserved();
removeCover();
assert.equal(preserved.getAttribute('inert'), '');
assert.equal(preserved.getAttribute('aria-hidden'), 'true');

const vite = await createServer({ appType: 'custom', logLevel: 'silent', root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true, hmr: false } });
try {
  const [{ AppOverlayContext }, { AppOverlayHost }, { AppScreenShell }] = await Promise.all([
    vite.ssrLoadModule('/src/components/AppOverlayContext.js'),
    vite.ssrLoadModule('/src/app/AppOverlayHost.jsx'),
    vite.ssrLoadModule('/src/components/AppScreenShell.jsx')
  ]);
  const bridge = { Host: AppOverlayHost, open: true, props: { drawerOpen: true, user: { name: '검수 학생' } }, dismiss: () => {} };
  const render = (value, shellProps = {}) => renderToStaticMarkup(createElement(AppOverlayContext.Provider, { value }, createElement(AppScreenShell, { screen: 'timer', tab: 'timer', ...shellProps }, createElement('p', null, '학습 화면'))));
  const markup = render(bridge);
  assert.equal((markup.match(/class="app-frame"/g) || []).length, 1);
  assert.equal((markup.match(/class="app-screen-overlays"/g) || []).length, 1);
  assert.match(markup, /aria-label="프로필 메뉴"/);
  assert.match(markup, /data-screen="timer" inert="" aria-hidden="true"/);
  assert.match(markup, /aria-label="주요 메뉴"[^>]*inert=""/);
  const local = render(bridge, { overlays: createElement('div', { role: 'dialog', 'aria-label': '작성 중' }, '입력'), lockScroll: false });
  assert.match(local, /aria-label="작성 중"/);
  assert.doesNotMatch(local, /aria-label="프로필 메뉴"/);
  assert.match(local, /app-content modal-lock/, 'an explicit scroll option cannot unlock a visible dialog');
  const closed = render({ ...bridge, open: false, props: { drawerOpen: false } }, { overlayOpen: false, overlays: createElement('div', null, '숨김') });
  assert.doesNotMatch(closed, /app-screen-overlays|inert=""|숨김/);
  const standalone = render(null, { overlays: createElement('div', { role: 'dialog' }, '기존 팝업') });
  assert.match(standalone, /기존 팝업/);
} finally {
  await vite.close();
}
const timer = await readFile(new URL('../src/screens/timer/TimerScreen.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(timer, /ProfileDrawer|drawerOpen/, 'the home screen must not own the global profile overlay');
console.log('App overlay contracts passed: single host, local priority, locking, stack isolation and back.');
