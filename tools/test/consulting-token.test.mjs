import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../../js/consulting-ad-attribution.js', import.meta.url), 'utf8');
const form = 'https://docs.google.com/forms/d/e/test/viewform';
function setup(url = 'https://studycrack.co.kr/', options = {}) {
  const store = new Map(), calls = [], timers = [];
  const window = { location: { href: url }, CONFIG: { api: { consultingPublic: 'https://api.example.test' } },
    sessionStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) } };
  vm.runInNewContext(code, { window, URL, AbortController,
    setTimeout: (callback, delay) => { timers.push(delay); return setTimeout(callback, options.fastTimer ? 0 : delay); }, clearTimeout,
    fetch: async (url, request) => {
      const body = JSON.parse(request.body); calls.push(body);
      if (options.fail) throw new Error('Unavailable');
      if (options.fetcher) return options.fetcher(body.data, request);
      return { ok: true, json: async () => ({ success: true, data: { token: 'signed-' + body.data.productType, productType: body.data.productType, expiresAt: new Date(Date.now() + 100000).toISOString() } }) };
    } });
  return { window, store, calls, timers, ...window.SCConsultingAttribution };
}

test('the server response token decorates the consulting form with its campaign and creative', async () => {
  const s = setup('https://studycrack.co.kr/?utm_source=naver&utm_content=creative1');
  assert.equal(new URL(await s.decorate(form, 'entry.1')).searchParams.get('entry.1'), 'signed-consulting');
  assert.equal(s.calls[0].data.creativeId, 'creative1'); assert.equal(s.calls[0].data.productType, 'consulting');
});
test('network failure preserves the original application path', async () => {
  const s = setup(undefined, { fail: true });
  assert.equal(await s.decorate(form, 'entry.1'), form); assert.equal(await s.getToken('calculator'), null);
});
test('navigation retains the consulting session source without reusing a calculator touch', async () => {
  const s = setup('https://studycrack.co.kr/jungsi');
  s.store.set('sc_site_touch_v2:consulting', JSON.stringify({ at: Date.now(), input: { source: 'google', creativeId: 'creative2', campaignId: 'campaign1' } }));
  await s.decorate(form, 'entry.1'); await s.getToken('calculator');
  assert.equal(s.calls[0].data.creativeId, 'creative2'); assert.equal(s.calls[1].data.source, 'unknown');
});
test('unconfigured or unsafe forms make no request and an existing prefilled code is preserved', async () => {
  const s = setup();
  for (const [url, entry] of [[form, null], ['https://attacker.invalid/forms/test', 'entry.1'], [form + '?entry.1=creative-code', 'entry.1']]) assert.equal(await s.decorate(url, entry), url);
  assert.equal(s.calls.length, 0);
});
test('all media calculator landings and consulting landings maintain separate touch and token caches', async () => {
  for (const source of ['naver', 'google', 'meta']) for (const product of ['consulting', 'calculator']) {
    const s = setup(`https://studycrack.co.kr/2027-jungsi-consulting?utm_source=${source}&utm_product=${product}&utm_content=creative1#${product}`);
    const other = product === 'calculator' ? 'consulting' : 'calculator';
    assert.equal(await s.getToken(product), 'signed-' + product); assert.equal(await s.getToken(product), 'signed-' + product);
    assert.equal(await s.getToken(other), 'signed-' + other);
    assert.equal(s.calls.length, 2); assert.equal(s.calls[0].data.source, source); assert.equal(s.calls[1].data.source, 'unknown');
    assert.equal(s.calls[1].data.creativeId, null);
  }
});
test('concurrent requests coalesce only within the same product and release independently', async () => {
  const releases = new Map();
  const s = setup(undefined, { fetcher: data => new Promise(resolve => releases.set(data.productType, () => resolve({ ok: true, json: async () => ({ success: true, data: { token: data.productType, productType: data.productType, expiresAt: '2030-01-01T00:00:00.000Z' } }) }))) });
  const first = s.getToken('consulting'), duplicate = s.getToken('consulting'), calculator = s.getToken('calculator');
  assert.equal(s.calls.length, 2); releases.get('calculator')(); assert.equal(await calculator, 'calculator');
  releases.get('consulting')(); assert.equal(await first, 'consulting'); assert.equal(await duplicate, 'consulting');
});
test('expired or malformed touches cannot carry an old campaign into a new application', async () => {
  for (const touch of [{ at: Date.now() - 8 * 86400000, input: { source: 'google', creativeId: 'old' } }, { at: Date.now() + 100000, input: { source: 'meta' } }, { at: Date.now(), input: { source: 'invalid' } }]) {
    const s = setup(); s.store.set('sc_site_touch_v2:consulting', JSON.stringify(touch));
    await s.getToken('consulting'); assert.equal(s.calls[0].data.source, 'unknown');
  }
});
test('legacy or mismatched product responses cannot attribute a calculator application', async () => {
  for (const productType of [undefined, 'consulting']) {
    const s = setup(undefined, { fetcher: async () => ({ ok: true, json: async () => ({ success: true, data: { token: 'legacy', productType, expiresAt: '2030-01-01T00:00:00.000Z' } }) }) });
    assert.equal(await s.getToken('calculator'), null);
  }
});
test('a stalled request aborts within the application wait budget and remains retryable', async () => {
  const s = setup(undefined, { fastTimer: true, fetcher: (_, request) => new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })) });
  assert.equal(await s.getToken('consulting'), null); assert.equal(await s.getToken('consulting'), null);
  assert.equal(s.calls.length, 2); assert.deepEqual(s.timers, [2500, 2500]);
});
