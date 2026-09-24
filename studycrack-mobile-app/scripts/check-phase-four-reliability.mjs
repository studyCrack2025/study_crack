import assert from 'node:assert/strict';
import { requestJson, setApiAuthExpiredHandler } from '../src/shared/api/client.js';
import { createServiceHandlers } from '../src/handlers/service-handlers.js';

const response = (status, data = {}) => ({ ok: status < 400, status, json: async () => data });
let expired = 0;
const release = setApiAuthExpiredHandler(() => { expired += 1; });
for (const [status, code] of [[401, 'AUTH_EXPIRED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'CONFLICT'], [500, 'SERVER_ERROR']]) {
  let calls = 0;
  const result = await requestJson({ url: '/test', apiFetch: async () => { calls += 1; return response(status, { error: 'internal-private-detail' }); } });
  assert.equal(result.ok, false);
  assert.equal(result.code, code);
  assert.equal(result.status, status);
  assert.doesNotMatch(result.error, /internal-private-detail/);
  assert.equal(calls, 1, 'the client must not replay a failed request');
}
assert.equal(expired, 1, 'permission, missing, conflict and server errors must not expire the session');
const terminal = await requestJson({ url: '/test', apiFetch: async () => response(404, { code: 'STUDY_SESSION_NOT_FOUND' }) });
assert.equal(terminal.code, 'STUDY_SESSION_NOT_FOUND', 'domain recovery codes must be preserved');

let finishLate;
let timeoutSignal;
const timedOut = await requestJson({ url: '/slow', timeoutMs: 10, apiFetch: (_url, options) => {
  timeoutSignal = options.signal;
  return new Promise((resolve) => { finishLate = resolve; });
} });
assert.equal(timedOut.code, 'TIMEOUT');
assert.equal(timeoutSignal.aborted, true);
finishLate(response(401));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(expired, 1, 'late responses after timeout must not change the session');

const controller = new AbortController();
let signal;
const cancelled = requestJson({ url: '/cancel', options: { signal: controller.signal }, apiFetch: (_url, options) => {
  signal = options.signal;
  return new Promise(() => {});
} });
controller.abort();
assert.equal((await cancelled).code, 'REQUEST_ABORTED');
assert.equal(signal.aborted, true);
const network = await requestJson({ url: '/network', apiFetch: async () => { throw new TypeError('Failed to fetch'); } });
assert.equal(network.code, 'NETWORK_ERROR');

let requests = 0;
let settle;
let submitting = false;
const handlers = createServiceHandlers({
  operationLocksRef: { current: new Set() }, qnaDraftTitle: '문의', qnaDraftContent: '작성 내용',
  persistMobileQna: () => { requests += 1; return new Promise((resolve) => { settle = resolve; }); },
  setQnaSubmitting: (value) => { submitting = value; }, alert() {}
});
const saving = handlers.submitMobileQna();
assert.equal(await handlers.submitMobileQna(), false);
assert.equal(requests, 1, 'same-render repeated submit must send one mutation');
assert.equal(submitting, true);
settle({ ok: false, error: network.error });
await saving;
assert.equal(submitting, false);
assert.equal(requests, 1);
release();
console.log('Phase 4 reliability passed: failure taxonomy, cancellation, deadline, late response and mutation single-flight.');
