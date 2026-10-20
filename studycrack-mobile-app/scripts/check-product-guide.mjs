import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { buildMyPagePresentation } from '../src/screens/mypage/presentation.js';
import { parseProductGuide, guideAccountKey, guideCanOpen, guideMutation } from '../src/features/product-guide/model.js';
import { fetchProductGuide, saveProductGuide } from '../src/features/product-guide/api.js';

const record = { supported: true, version: 'ob_2026_09', status: 'in_progress', lastStep: 3, revision: 2 };
assert.equal(parseProductGuide(record).lastStep, 3);
for (const invalid of [{}, { ...record, supported: false }, { ...record, version: 'future' }, { ...record, revision: '2' }, { ...record, status: 'completed', lastStep: 2 }, { ...record, status: 'unseen' }, { ...record, lastStep: 0 }]) assert.equal(parseProductGuide(invalid), null);
assert.equal(guideMutation(record, 'in_progress', 2), null);
assert.equal(guideMutation(record, 'skipped', 2).lastStep, 3);
assert.equal(guideMutation({ ...record, status: 'completed', lastStep: 5 }, 'skipped', 1), null);
assert.equal(guideMutation({ ...record, status: 'skipped' }, 'in_progress', 4), null);
assert.equal(guideMutation({ ...record, status: 'skipped' }, 'completed', 5).status, 'completed');
const state = { screen: 'timer', timerPhase: 'idle', userLoadStatus: 'ready', user: { email: 'one@example.test' } };
assert.equal(guideCanOpen(state), true);
for (const patch of [{ screen: 'paymentComplete' }, { screen: 'plannerAdd' }, { activeStudySession: {} }, { rewardPendingSessionId: 'pending' }, { timerPhase: 'claiming-reward' }, { studySubjectSheetOpen: true }, { myProfileEditOpen: true }]) assert.equal(guideCanOpen({ ...state, ...patch }), false);
assert.equal(guideAccountKey(state, false), '');
assert.equal(guideAccountKey({ ...state, userLoadStatus: 'loading' }, true), '');
assert.notEqual(guideAccountKey(state, true), guideAccountKey({ ...state, user: { email: 'two@example.test' } }, true));
assert.equal(guideAccountKey(state, true), guideAccountKey({ ...state, user: { ...state.user, name: 'updated' } }, true));
const requests = [];
const binding = { userApiUrl: '/user', apiFetch: async (url, options) => { requests.push({ url, ...options }); return { ok: true, status: 200, json: async () => record }; } };
assert.equal((await fetchProductGuide(binding)).ok, true);
assert.equal((await saveProductGuide(binding, guideMutation(record, 'completed', 5))).ok, true);
assert.deepEqual(requests.map(item => JSON.parse(item.body).type), ['get_product_guide', 'save_product_guide']);
assert.deepEqual(Object.keys(JSON.parse(requests[1].body).data).sort(), ['lastStep', 'revision', 'status', 'version']);
const oldServer = { ...binding, apiFetch: async () => ({ ok: true, json: async () => ({ success: true }) }) };
assert.equal((await fetchProductGuide(oldServer)).ok, false);
const controller = new AbortController(); controller.abort();
const before = requests.length;
assert.equal((await fetchProductGuide(binding, controller.signal)).code, 'REQUEST_ABORTED');
assert.equal(requests.length, before);
const persistence = await readFile(new URL('../src/app/use-app-state-persistence.js', import.meta.url), 'utf8');
assert.doesNotMatch(persistence, /productGuide/);
const guideCss = await readFile(new URL('../src/styles/screens/product-guide.css', import.meta.url), 'utf8');
assert.match(guideCss, /max-height: min\(calc\(var\(--sc-visual-height\) - 32px\), calc\(100dvh - 32px\)\)/);
assert.match(guideCss, /@media \(max-height: 480px\)/);
const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
try {
  const { ProductGuideOverlay } = await vite.ssrLoadModule('/src/screens/product-guide/ProductGuideOverlay.jsx');
  for (const [index, theme] of ['goal', 'plan', 'care', 'record', 'find'].entries()) {
    const markup = renderToStaticMarkup(createElement(ProductGuideOverlay, { ui: { step: index + 1, busy: false }, presentation: {} }));
    assert.match(markup, new RegExp(`product-guide-panel product-guide-${theme}`));
    assert.match(markup, /data-action="nextProductGuide"/);
    assert.match(markup, /data-action="closeProductGuide"/);
    assert.match(markup, new RegExp(`${index + 1} / 5`));
  }
  const { MySummaryContent } = await vite.ssrLoadModule('/src/screens/mypage/MySummaryContent.jsx');
  for (const showIdentity of [true, false]) {
    const markup = renderToStaticMarkup(createElement(MySummaryContent, { showIdentity, presentation: buildMyPagePresentation({ user: {} }) }));
    assert.equal((markup.match(/aria-label="공부와 수조 요약"/g) || []).length, 1);
    assert.match(markup, new RegExp(`class="${showIdentity ? 'my-summary-hero-stats' : 'my-study-stats'}"`));
    assert.match(markup, /확인 필요/);
  }
} finally {
  await vite.close();
}
console.log('Product guide contracts passed: strict support, monotonic progress, session gating, request ownership and cancellation.');
