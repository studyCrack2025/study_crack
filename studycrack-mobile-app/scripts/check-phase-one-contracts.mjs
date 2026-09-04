import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPathInsideRoot } from '../e2e/support/static-route-path.mjs';
import { attachNetworkStatus } from '../src/shared/browser/network-status.js';
import { isTopOverlay, registerOverlay } from '../src/shared/browser/overlay-focus.js';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const webRoot = fileURLToPath(new URL('../../', import.meta.url));

async function listSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = new URL(entry.name, directory.href.endsWith('/') ? directory : new URL(`${directory.href}/`));
    if (entry.isDirectory()) return listSources(new URL(`${target.href}/`));
    return /\.(?:js|jsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const [
  appFrame,
  appScreenShell,
  tabBar,
  primaryHeader,
  secondaryScreen,
  statusState,
  browserStatus,
  addUniversity,
  overlayFocus,
  overlayHook,
  runtimeEntry,
  tokens,
  shellStyles,
  primitiveStyles,
  secondaryStyles,
  navigationStyles,
  motionStyles
] = await Promise.all([
  read('src/components/AppFrame.js'),
  read('src/components/AppScreenShell.jsx'),
  read('src/components/TabBar.jsx'),
  read('src/components/PrimaryScreenHeader.jsx'),
  read('src/components/SecondaryScreen.jsx'),
  read('src/components/StatusState.js'),
  read('src/shared/browser/network-status.js'),
  read('src/screens/analysis/AddUniversityScreen.jsx'),
  read('src/shared/browser/overlay-focus.js'),
  read('src/components/useOverlayDialog.js'),
  read('src/runtime/main.js'),
  read('src/styles/foundation/tokens.css'),
  read('src/styles/foundation/shell.css'),
  read('src/styles/components/primitives.css'),
  read('src/styles/components/secondary.css'),
  read('src/styles/components/navigation.css'),
  read('src/styles/foundation/motion.css')
]);

const sourceFiles = await listSources(new URL('../src/', import.meta.url));
const manualFrameOwners = [];
for (const file of sourceFiles) {
  if (file.pathname.endsWith('/components/AppFrame.js')) continue;
  const source = await readFile(file, 'utf8');
  if (/className=(?:"app-shell"|['"]app-shell['"])/.test(source)) manualFrameOwners.push(file.pathname.split('/src/')[1]);
}

assert.deepEqual(manualFrameOwners, [], `AppFrame must be the only app-shell DOM owner:\n${manualFrameOwners.join('\n')}`);
assert.match(runtimeEntry, /import\('\.\.\/shared\/browser\/network-status\.js'\)/, 'The global network status adapter must load outside the initial bundle');
assert.match(appFrame, /inert:/, 'AppContent must make covered background content inert');
assert.match(appFrame, /aria-hidden/, 'AppContent must remove covered background content from the accessibility tree');
assert.match(appScreenShell, /inactive=\{hasOpenOverlay\}/, 'Open overlays must make the screen content inactive');
assert.match(appScreenShell, /dimmed=\{dimmed \|\| hasOpenOverlay\}/, 'Open overlays must disable the bottom navigation');
assert.match(appScreenShell, /<TabBar[^>]*inactive=\{hasOpenOverlay\}/, 'Open overlays must make the bottom navigation inactive');
assert.match(tabBar, /inert=\{inactive \? '' : undefined\}/, 'Covered bottom navigation must be inert');
assert.match(tabBar, /aria-hidden=\{inactive \? 'true' : undefined\}/, 'Covered bottom navigation must leave the accessibility tree');

assert.match(primaryHeader, /description/, 'PrimaryScreenHeader must support the shared subtitle hierarchy');
assert.match(primaryHeader, /<h1>/, 'PrimaryScreenHeader must own the primary page heading');
assert.match(secondaryScreen, /StatusState/, 'SecondaryState must delegate status semantics to StatusState');
assert.doesNotMatch(secondaryScreen, /sc-secondary-state/, 'SecondaryState must not retain a second status DOM owner');
assert.doesNotMatch(addUniversity, /function ScreenState/, 'Feature screens must not fork the shared status owner');
assert.match(statusState, /aria-busy/, 'Loading status must expose aria-busy');
assert.match(statusState, /role: error \? 'alert'/, 'Error status must use alert semantics');

assert.match(browserStatus, /addEventListener\('offline'/, 'NetworkStatus must observe browser offline transitions');
assert.match(browserStatus, /addEventListener\('online'/, 'NetworkStatus must expose reconnecting transitions');
assert.match(browserStatus, /setAttribute\('role', 'status'\)/, 'NetworkStatus must announce transitions without an alert');
assert.doesNotMatch(browserStatus, /localStorage|sessionStorage|caches\./, 'NetworkStatus must not cache user data');

for (const selector of [
  '.card,.sc-card',
  '.btn',
  '.btn-quiet',
  '.btn-danger',
  '.sc-icon-button',
  '.planner-input,.sc-input,.sc-select,.sc-textarea',
  '.sc-field',
  '.badge,.sc-badge',
  '.sc-chip',
  '.sc-secondary-segmented',
  '.progress,.track',
  '.sc-metric',
  '.sc-skeleton',
  '.sc-network-status'
]) {
  assert.match(`${primitiveStyles}\n${secondaryStyles}`, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{'), `${selector} shared owner is missing`);
}
assert.match(primitiveStyles, /\.btn\[aria-busy="true"\]/, 'Pending buttons must have a shared visual lock');
assert.match(primitiveStyles, /\.sc-field-error\{/, 'Fields must have a shared error association style');
assert.match(primitiveStyles, /\.progress\[role="progressbar"\],\.track\[role="progressbar"\]/, 'Progress primitives must expose semantic consumers');
assert.doesNotMatch(secondaryStyles, /\.sc-secondary-state/, 'Secondary CSS must not retain a duplicate status primitive');
assert.match(secondaryStyles, /\.sc-secondary-intro\{[^}]*border:0[^}]*background:transparent[^}]*box-shadow:none/, 'Secondary headers must not look like nested cards');

assert.match(tokens, /--sc-layer-navigation:\d+/, 'Navigation layer token is missing');
assert.match(tokens, /--sc-layer-overlay:\d+/, 'Overlay layer token is missing');
assert.match(tokens, /--sc-layer-sheet:\d+/, 'Sheet layer token is missing');
assert.match(shellStyles, /padding-top:calc\(var\(--sc-space-16\) \+ env\(safe-area-inset-top\)\)/, 'Shared scrolling content must own top safe-area padding');
assert.match(navigationStyles, /height:calc\(var\(--sc-tabbar-height\) \+ env\(safe-area-inset-bottom\)\)/, 'Bottom navigation must own its safe-area track');
assert.match(navigationStyles, /\.tabbar button\{[^}]*min-height:var\(--sc-touch-target\)/, 'Every navigation action must meet the touch target contract');
assert.match(navigationStyles, /z-index:var\(--sc-layer-navigation\)/, 'Navigation must consume the shared layer token');

assert.match(overlayFocus, /overlayStack/, 'Overlay focus must use one shared stack');
assert.match(overlayFocus, /registerOverlay/, 'Overlay focus stack registration is missing');
assert.match(overlayFocus, /isTopOverlay/, 'Nested overlays must identify the topmost dialog');
assert.match(overlayHook, /registerOverlay/, 'Every shared overlay must register with the focus stack');
assert.match(overlayHook, /isTopOverlay/, 'Escape and Tab handling must be limited to the topmost overlay');
assert.match(motionStyles, /prefers-reduced-motion:reduce/, 'Reduced-motion fallback must remain explicit');
assert.match(motionStyles, /\.sc-skeleton/, 'Skeleton shimmer must be disabled by the reduced-motion contract');

assert.equal(isPathInsideRoot(webRoot, resolve(webRoot, 'studycrack-mobile.html')), true, 'The no-server route must accept repository assets when WEB_ROOT has a trailing separator');
assert.equal(isPathInsideRoot(webRoot, resolve(webRoot, '../outside.html')), false, 'The no-server route must reject paths outside WEB_ROOT');

const overlayA = {};
const overlayB = {};
const unregisterA = registerOverlay(overlayA);
assert.equal(isTopOverlay(overlayA), true, 'The first registered overlay must own focus');
const unregisterB = registerOverlay(overlayB);
assert.equal(isTopOverlay(overlayA), false, 'A covered overlay must release topmost focus ownership');
assert.equal(isTopOverlay(overlayB), true, 'The nested overlay must own focus');
unregisterB();
assert.equal(isTopOverlay(overlayA), true, 'Closing a nested overlay must restore stack ownership');
unregisterA();
assert.equal(isTopOverlay(overlayA), false, 'Closed overlays must leave the stack');

const networkHandlers = {};
let reconnectCallback = null;
let appendedBanner = null;
let removedBanner = false;
const networkRoot = { dataset: {} };
const networkDocument = {
  body: { append(node) { appendedBanner = node; } },
  createElement() {
    return {
      className: '',
      setAttribute() {},
      textContent: '',
      remove() { removedBanner = true; }
    };
  },
  documentElement: networkRoot
};
const networkWindow = {
  navigator: { onLine: true },
  addEventListener(name, callback) { networkHandlers[name] = callback; },
  clearTimeout() {},
  removeEventListener(name) { delete networkHandlers[name]; },
  setTimeout(callback) { reconnectCallback = callback; return 1; }
};
const detachNetwork = attachNetworkStatus({ doc: networkDocument, win: networkWindow });
assert.equal(networkRoot.dataset.networkStatus, 'online');
networkHandlers.offline();
assert.equal(networkRoot.dataset.networkStatus, 'offline');
assert.equal(appendedBanner.textContent, '오프라인 상태예요');
networkHandlers.online();
assert.equal(networkRoot.dataset.networkStatus, 'reconnecting');
assert.equal(appendedBanner.textContent, '연결을 다시 확인하고 있어요');
reconnectCallback();
assert.equal(networkRoot.dataset.networkStatus, 'online');
detachNetwork();
assert.equal(removedBanner, true);
assert.equal('networkStatus' in networkRoot.dataset, false);

console.log('Phase 1 contracts passed: shared shell, primitives, network status, overlay stack and accessibility owners are complete.');
