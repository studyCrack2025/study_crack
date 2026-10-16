const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/basic-preview.js'), 'utf8');
function setup(v2 = false, loggedIn = false, refresh = false) {
  const calls = [], redirects = [];
  let currentUser = loggedIn;
  const window = { dataLayer: [], location: { replace: url => redirects.push(url) } };
  if (v2) window.SCTrack = {
    event: (name, params) => calls.push({ name, params }),
    once: (key, name, params) => calls.push({ key, name, params })
  };
  const ctx = vm.createContext({ window, document: { addEventListener() {} },
    localStorage: { getItem: () => currentUser ? 'test-user' : null },
    tryRefreshToken: async () => { currentUser = refresh; return refresh; } });
  vm.runInContext(source, ctx);
  return { ctx, window, calls, redirects, run: code => vm.runInContext(code, ctx) };
}
(async () => {
  for (const v2 of [false, true]) {
    const s = setup(v2);
    s.run("trackBasicPreview('basic_preview_start', { preview_state: 'wrong', email: 'never-send' })");
    s.run("trackBasicPreview('basic_preview_state', { preview_state: 'needs_scores', email: 'never-send' })");
    s.run("trackBasicPreview('basic_preview_state', { preview_state: 'unknown' })");
    s.run("trackBasicPreview('unknown_event', { event: 'purchase' })");
    const events = v2 ? s.calls : s.window.dataLayer;
    assert.equal(events.length, 3);
    assert.equal(JSON.stringify(events).includes('never-send'), false);
    const values = events.map(e => (e.params || e).preview_state);
    assert.deepEqual(values, ['loading', 'needs_scores', 'analysis_failed']);
    assert.equal(JSON.stringify(events).includes('analysis_view'), false);
    s.run("trackBasicPreview('basic_preview_ready')");
    s.run("trackBasicPreview('basic_unlock_click')");
    assert.equal(v2 ? s.calls.at(-1).name : s.window.dataLayer.at(-1).event, v2 ? 'cta_click' : 'basic_unlock_click');
    if (v2) assert.deepEqual(s.calls.slice(3, 5).map(e => e.name), ['analysis_view', 'score_impact_view']);
    else assert.equal(s.window.dataLayer.at(-1).tier_state, 'free');
    const anonymous = setup(v2);
    assert.equal(await anonymous.run('ensureBasicPreviewSession()'), false);
    assert.deepEqual(anonymous.redirects, ['/login?returnUrl=%2Fbasic-preview']);
    const event = v2 ? anonymous.calls[0].params : anonymous.window.dataLayer[0];
    assert.equal(event.preview_state, 'unauthorized');
    for (const opts of [[true, false], [false, true]]) {
      const authenticated = setup(v2, ...opts);
      assert.equal(await authenticated.run('ensureBasicPreviewSession()'), true);
      assert.equal(authenticated.redirects.length, 0);
      assert.equal(authenticated.calls.length + authenticated.window.dataLayer.length, 0);
    }
  }
  console.log('PASS: dev/V2 bridge, safe states, parameter allowlist, ready/CTA semantics, anonymous redirect, existing and refreshed sessions. No network calls.');
})().catch(e => { console.error(e); process.exitCode = 1; });
