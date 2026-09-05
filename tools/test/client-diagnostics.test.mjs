import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../../js/client-diagnostics.js', import.meta.url), 'utf8');
function runtime({ enabled = true, sample = 0, fetchImpl, release = 'dev-aaaaaaaa', origin = 'https://dev.studycrack.co.kr', search = '', pathname = '/studycrack-mobile' } = {}) {
  const sent = [], listeners = new Map(), timers = new Map();
  let nextTimer = 0;
  const forbidden = () => { throw new Error('Private data must not be accessed'); };
  const browser = {
    CONFIG: { clientDiagnostics: { enabled, sampleRate: 0.1 } },
    location: { origin, hostname: new URL(origin).hostname, pathname, search },
    navigator: { onLine: true }, __studycrackAppBooted: true,
    document: { readyState: 'complete', querySelector: () => ({ content: release }), addEventListener() {} },
    addEventListener: (name, fn) => { listeners.set(name, fn); },
    setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
    fetch: async (url, options) => { sent.push({ url, options }); return fetchImpl ? fetchImpl(url, options) : { body: { cancel: async () => {} } }; },
    Math: { random: () => sample, min: Math.min }
  };
  Object.defineProperties(browser, { localStorage: { get: forbidden }, sessionStorage: { get: forbidden } });
  Object.defineProperty(browser.document, 'cookie', { get: forbidden });
  vm.runInNewContext(source, { window: browser, URL, URLSearchParams, AbortController, Object, Map, Set, JSON, Number, Math: browser.Math });
  return { browser, sent, listeners, timers, api: browser.STUDYCRACK_DIAGNOSTICS };
}

test('diagnostics default off and unsampled sessions create no traffic or timers', async () => {
  for (const options of [{ enabled: false }, { sample: 0.9 }, { release: 'email@example.com' }, { origin: 'https://evil.example' }]) {
    const ctx = runtime(options);
    ctx.api.record('api_failure', 'user', 500);
    await ctx.api.flush();
    assert.equal(ctx.sent.length, 0);
    assert.equal(ctx.timers.size, 0);
  }
});

test('payload is rebuilt from enums only, aggregated and detached from all credentials/referrer', async () => {
  const ctx = runtime({ search: '?token=secret&email=student@example.com' });
  ctx.api.record('api_failure', 'user', 503, { token: 'secret', score: 100 });
  ctx.api.record('api_failure', 'user', 503);
  ctx.api.record('email@example.com', 'user', 503);
  ctx.api.record('api_failure', 'https://secret.example?token=raw', 500);
  ctx.api.record('api_failure', 'user', '500');
  await ctx.api.flush();
  assert.equal(ctx.sent.length, 1);
  const { url, options } = ctx.sent[0];
  assert.equal(url, 'https://api.dev.studycrack.co.kr/api/client-diagnostics');
  assert.deepEqual(JSON.parse(options.body), { schema: 1, release: 'dev-aaaaaaaa', events: [{ kind: 'api_failure', route: 'user', status: 503, count: 2 }] });
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.deepEqual(Object.keys(options.headers), ['Content-Type']);
  assert.doesNotMatch(options.body, /secret|student|token|email|score/);
});

test('transport failures, offline state and excess events are dropped without recursive reporting or retry', async () => {
  const ctx = runtime({ fetchImpl: async () => { throw new Error('private error'); } });
  for (let i = 0; i < 100; i++) ctx.api.record('runtime_failure');
  await ctx.api.flush();
  await ctx.api.flush();
  assert.equal(ctx.sent.length, 1);
  assert.ok(JSON.parse(ctx.sent[0].options.body).events[0].count <= 10);
  ctx.browser.navigator.onLine = false;
  ctx.api.record('boot_failure');
  await ctx.api.flush();
  assert.equal(ctx.sent.length, 1);
  ctx.browser.navigator.onLine = true;
  await ctx.api.flush();
  assert.equal(ctx.sent.length, 1);
});

test('payment return checks only error presence and never records query values', async () => {
  const ctx = runtime({ pathname: '/payment', search: '?error=private-message&orderId=secret' });
  await ctx.api.flush();
  assert.deepEqual(JSON.parse(ctx.sent[0].options.body).events, [{ kind: 'payment_return_failure', route: 'payment', status: 0, count: 1 }]);
});

test('global failures never read the error object or change default error handling', async () => {
  const ctx = runtime();
  const event = {};
  Object.defineProperties(event, { error: { get: () => { throw new Error('Do not read errors'); } }, reason: { get: () => { throw new Error('Do not read reasons'); } } });
  ctx.listeners.get('unhandledrejection')(event);
  ctx.listeners.get('vite:preloadError')(event);
  await ctx.api.flush();
  const kinds = JSON.parse(ctx.sent[0].options.body).events.map((item) => item.kind);
  assert.deepEqual(kinds.sort(), ['chunk_load_failure', 'runtime_failure']);
});

test('offline batches are discarded and never replayed after reconnecting', async () => {
  const ctx = runtime();
  ctx.browser.navigator.onLine = false;
  ctx.api.record('api_failure', 'user', 503);
  await ctx.api.flush();
  assert.equal(ctx.sent.length, 0);
  ctx.browser.navigator.onLine = true;
  await ctx.api.flush();
  assert.equal(ctx.sent.length, 0);
  ctx.api.record('boot_failure');
  await ctx.api.flush();
  assert.deepEqual(JSON.parse(ctx.sent[0].options.body).events, [{ kind: 'boot_failure', route: 'none', status: 0, count: 1 }]);
});

test('each batch has at most five aggregates and each page sends at most three times', async () => {
  const ctx = runtime();
  for (let batch = 0; batch < 4; batch++) {
    for (const route of ['user', 'admin', 'file', 'noti', 'qna', 'report']) ctx.api.record('api_failure', route, 503);
    await ctx.api.flush();
  }
  assert.equal(ctx.sent.length, 3);
  for (const { options } of ctx.sent) assert.equal(JSON.parse(options.body).events.length, 5);
  assert.equal(ctx.timers.size, 0);
});

test('a stalled transport is aborted and leaves no retry or pending timer', async () => {
  const ctx = runtime({ fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }) });
  ctx.api.record('runtime_failure');
  const sending = ctx.api.flush();
  assert.equal(ctx.timers.size, 1);
  for (const callback of ctx.timers.values()) callback();
  await sending;
  assert.equal(ctx.sent[0].options.signal.aborted, true);
  assert.equal(ctx.timers.size, 0);
  await ctx.api.flush();
  assert.equal(ctx.sent.length, 1);
});
