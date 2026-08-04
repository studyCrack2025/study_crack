import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

import { apiFailure, apiSuccess, postJson } from '../src/shared/api/client.js';

const envelopeKeys = ['code', 'data', 'error', 'ok', 'status'];

function assertEnvelope(result) {
  assert.deepEqual(Object.keys(result).sort(), envelopeKeys);
  assert.equal(typeof result.ok, 'boolean');
  assert.equal(typeof result.error, 'string');
  assert.equal(typeof result.status, 'number');
  assert.equal(typeof result.code, 'string');
}

assertEnvelope(apiSuccess({ value: 1 }));
assertEnvelope(apiFailure('실패'));

const success = await postJson({
  apiFetch: async () => ({ ok: true, status: 201, json: async () => ({ saved: true }) }),
  url: '/test',
  payload: { type: 'test' }
});
assertEnvelope(success);
assert.deepEqual(success.data, { saved: true });
assert.equal(success.status, 201);

const failure = await postJson({
  apiFetch: async () => ({ ok: false, status: 403, json: async () => ({ error: '만료', code: 'AUTH_EXPIRED' }) }),
  url: '/test',
  payload: { type: 'test' }
});
assertEnvelope(failure);
assert.equal(failure.code, 'AUTH_EXPIRED');
assert.equal(failure.status, 403);

const apiModules = [
  'src/features/account/api.js',
  'src/features/analysis/api.js',
  'src/features/notifications/api.js',
  'src/features/planner/api.js',
  'src/features/reports/api.js',
  'src/features/session/api.js',
  'src/features/support/api.js'
];
for (const path of apiModules) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.equal(/\bthrow\b/.test(source), false, `${path} must return the API envelope instead of throwing.`);
  assert.equal(/return\s+null\b/.test(source), false, `${path} must not encode API failure as null.`);
  assert.equal(/return\s+\[\]/.test(source), false, `${path} must not encode API failure as an empty list.`);
}

await assert.rejects(access(new URL('../src/runtime/persistence.js', import.meta.url)));

console.log('domain API envelope and ownership contracts passed');
