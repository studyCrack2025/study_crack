import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderModal } from '../src/components/modal.js';
import { renderSheet } from '../src/components/sheet.js';
import { renderTermsModal } from '../src/components/terms-modal.js';
import { readViewportMetrics } from '../src/runtime/visual-viewport.js';

const modal = renderModal({ body: '<p>body</p>', dismissAction: 'closeTest' });
const sheet = renderSheet({ body: '<p>body</p>', dismissAction: 'closeTest' });
const terms = renderTermsModal('standard');

assert.match(modal, /sc-overlay sc-overlay--modal home-modal-overlay/);
assert.match(modal, /sc-modal home-modal/);
assert.match(modal, /role="dialog" aria-modal="true"/);
assert.match(sheet, /sc-overlay sc-overlay--sheet planner-sheet-overlay/);
assert.match(sheet, /sc-sheet planner-sheet/);
assert.match(terms, /sc-modal-head terms-modal-head/);
assert.match(terms, /sc-modal-body terms-modal-body/);
assert.deepEqual(readViewportMetrics({ height: 512.4, offsetTop: 17.7 }, 844), { height: 512, offsetTop: 18 });
assert.deepEqual(readViewportMetrics(null, 844), { height: 844, offsetTop: 0 });

const [modalCss, sheetCss, authSource, analysisSource] = await Promise.all([
  readFile(new URL('../src/styles/components/modals.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/components/sheets.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/auth/AuthScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/analysis/AnalysisScreen.jsx', import.meta.url), 'utf8')
]);

assert.match(modalCss, /--sc-visual-height/);
assert.match(sheetCss, /--sc-sheet-max-height/);
assert.match(authSource, /app-screen-overlays/);
assert.match(analysisSource, /app-screen-overlays/);

console.log('overlay contracts passed');
