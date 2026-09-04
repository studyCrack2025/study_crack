import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeferredScreenFallback } from '../src/app/DeferredScreenFallback.js';
import { AppContent } from '../src/components/AppFrame.js';
import { StatusState } from '../src/components/StatusState.js';

const [tokensSource, shellSource, primitivesSource] = await Promise.all([
  readFile(new URL('../src/styles/foundation/tokens.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/foundation/shell.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/components/primitives.css', import.meta.url), 'utf8')
]);
assert.match(tokensSource, /--sc-frame-max-width:430px/, 'The shared mobile frame width token changed');
assert.match(tokensSource, /--sc-control-height:48px/, 'The shared control height token changed');
assert.match(tokensSource, /--sc-touch-target:44px/, 'The shared touch target token changed');
assert.match(tokensSource, /--sc-motion-progress:500ms/, 'The shared progress motion token changed');
assert.match(shellSource, /max-width:var\(--sc-frame-max-width\)/, 'The app frame must consume its foundation width token');
assert.match(shellSource, /\.app-frame\{[^}]*height:100dvh;min-height:100dvh/, 'The app frame must stay anchored to the layout viewport when the keyboard shrinks the visual viewport');
assert.doesNotMatch(shellSource, /\.app-frame\{[^}]*height:var\(--sc-visual-height\)/, 'The keyboard-sized visual viewport must not vertically recenter the outer app frame');
assert.match(primitivesSource, /min-height:var\(--sc-control-height\)/, 'Shared controls must consume the foundation height token');
assert.match(primitivesSource, /min-height:var\(--sc-touch-target\)/, 'Shared status actions must meet the touch target contract');

const loadingMarkup = renderToStaticMarkup(React.createElement(DeferredScreenFallback, {
  onRetry() {},
  screen: 'timer',
  status: 'loading'
}));
assert.match(loadingMarkup, /class="app-shell"><div class="app-frame">/, 'Deferred loading must use the shared app frame');
assert.match(loadingMarkup, /class="screen app-screen app-content" data-screen="timer"/, 'Deferred loading must use the shared app content owner');
assert.match(loadingMarkup, /class="sc-empty is-loading"[^>]*><span[^>]*class="sc-empty-mark"[^>]*>.*?<\/span><div role="status" aria-live="polite" aria-busy="true"><h3>앱 화면을 준비하고 있어요<\/h3>/, 'Deferred loading must expose its heading and shared busy status contract');

const errorMarkup = renderToStaticMarkup(React.createElement(DeferredScreenFallback, {
  onRetry() {},
  screen: 'timer',
  status: 'error'
}));
assert.match(errorMarkup, /class="sc-empty is-error"[^>]*><span[^>]*class="sc-empty-mark"[^>]*>!<\/span><div role="alert"><h3>화면을 불러오지 못했습니다<\/h3>/, 'Deferred failure must expose its heading and shared error status contract');
assert.match(errorMarkup, /<\/div><button[^>]*class="btn btn-primary"[^>]*>다시 시도<\/button><\/div>/, 'Deferred failure must keep its retry action outside the alert region');

const inactiveMarkup = renderToStaticMarkup(React.createElement(AppContent, { inactive: true, screen: 'timer' }, 'covered'));
assert.match(inactiveMarkup, /inert="" aria-hidden="true"/, 'Covered screen content must be inert and hidden from the accessibility tree');
const offlineMarkup = renderToStaticMarkup(React.createElement(StatusState, { kind: 'offline', title: '오프라인 상태예요' }));
assert.match(offlineMarkup, /class="sc-empty is-offline"[\s\S]*role="status" aria-live="polite"/, 'Offline state must use the shared polite status contract');

console.log('foundation primitive behavior passed: deferred loading and error share frame, content and status owners.');
