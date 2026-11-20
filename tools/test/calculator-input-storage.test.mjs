import test from 'node:test';
import assert from 'node:assert/strict';
import { CALCULATOR_STORAGE_CONSENT, normalizeStoredCalculatorInput, parseCalculatorStoredInput, requestCalculatorStorage } from '../../studycrack-mobile-app/src/features/jungsi-calculator/calculator-storage-api.js';
const applicationId = 'APP_11111111-1111-4111-8111-111111111111';
const input = { scores: { admissionYear: 2027, basis: 'official', exam: { kor: { opt: '화법과작문', std: 124, pct: 90, grd: 2 }, math: { opt: '미적분', std: 130, pct: 95, grd: 1 }, inq1: { name: '물리학Ⅰ', std: 64, pct: 90, grd: 2 }, inq2: { name: '화학Ⅰ', std: 63, pct: 89, grd: 2 }, eng: { grd: 2 }, hist: { grd: 1 } } }, targets: [{ university: '가상대학교', major: '예시학과', admissionUnitId: 'UNIT_SYNTHETIC_1' }] };
const record = { contractVersion: 'calculator-input-v1', applicationId, revision: 1, status: 'saved', updatedAt: '2026-11-20T00:00:00.000Z', input, source: 'self_reported', reviewed: false, canSave: true, consentRevision: CALCULATOR_STORAGE_CONSENT, candidateCount: 1, basis: 'official' };
test('stored calculator input validates year, source, revision, scope and all candidate identifiers', () => {
  assert.deepEqual(normalizeStoredCalculatorInput(input), input); assert.ok(parseCalculatorStoredInput(record, applicationId));
  for (const patch of [{ source: 'verified' }, { reviewed: true }, { revision: -1 }, { applicationId: 'other' }, { candidateCount: 2 }, { consentRevision: 'old' }]) assert.equal(parseCalculatorStoredInput({ ...record, ...patch }, applicationId), null);
  const bad = structuredClone(input); bad.targets[0].admissionUnitId = '../other'; assert.equal(normalizeStoredCalculatorInput(bad), null);
});
test('save acknowledgement must match the submitted snapshot and next version, and mutation failure never retries', async () => {
  let count = 0, response = record;
  const binding = { consultingApiUrl: '/synthetic', apiFetch: async () => { count++; return { ok: true, json: async () => ({ success: true, data: response }) }; } };
  const options = { applicationId, type: 'student_save_calculator_input', data: { expectedRevision: 0, input } };
  assert.equal((await requestCalculatorStorage(binding, options)).ok, true);
  response = { ...record, revision: 2 }; assert.equal((await requestCalculatorStorage(binding, options)).ok, false);
  binding.apiFetch = async () => { count++; throw Object.assign(new Error('retry'), { code: 'AUTH_RETRY_REQUIRED' }); }; count = 0;
  assert.equal((await requestCalculatorStorage(binding, options)).ok, false); assert.equal(count, 1);
});
