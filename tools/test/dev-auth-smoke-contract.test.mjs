import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDevReleaseIdentity, validateDevSmokeConfig } from '../../studycrack-mobile-app/scripts/smoke-dev-auth-contract.mjs';
const commit = 'a'.repeat(40);
const env = { STUDYCRACK_DEV_SMOKE_EMAIL: 'test@example.invalid', STUDYCRACK_DEV_SMOKE_PASSWORD: 'synthetic', STUDYCRACK_DEV_SMOKE_COMMIT: commit };
test('dev smoke rejects unsafe destinations and missing version before sending account credentials', () => {
  assert.equal(validateDevSmokeConfig(env).expectedCommit, commit);
  for (const value of ['https://attacker.invalid/studycrack-mobile.html', 'https://studycrack.co.kr/studycrack-mobile.html', 'http://dev.studycrack.co.kr/studycrack-mobile.html', 'https://user:secret@dev.studycrack.co.kr/studycrack-mobile.html', 'https://dev.studycrack.co.kr/studycrack-mobile.html?next=anything', 'https://dev.studycrack.co.kr/login']) assert.throws(() => validateDevSmokeConfig({ ...env, STUDYCRACK_DEV_MOBILE_URL: value }));
  for (const field of Object.keys(env)) assert.throws(() => validateDevSmokeConfig({ ...env, [field]: '' }));
});
test('real smoke cannot declare an older or foreign release as current acceptance', () => {
  assertDevReleaseIdentity({ schema: 1, commit, release: 'dev-aaaaaaaa' }, commit);
  for (const value of [{ schema: 0, commit, release: 'dev-aaaaaaaa' }, { schema: 1, commit: 'b'.repeat(40), release: 'dev-bbbbbbbb' }, { schema: 1, commit, release: 'main-aaaaaaaa' }, null]) assert.throws(() => assertDevReleaseIdentity(value, commit));
});
