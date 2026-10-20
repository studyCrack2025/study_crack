import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const studentSource = await readFile(new URL('../../js/mypage.js', import.meta.url), 'utf8');
const tutorSource = await readFile(new URL('../../js/mypage_tutor.js', import.meta.url), 'utf8');
const outcomes = [
  ['pending', { success: true, completed: false, status: 'review_required' }, false],
  ['ambiguous', { success: true }, false],
  ['contradictory', { success: false, completed: true, status: 'complete' }, false],
  ['complete', { success: true, completed: true, status: 'complete' }, true]
];
for (const [label, body, completed] of outcomes) {
  test(`web student ${label}: only explicit completion clears session`, async () => {
    let cleared = false;
    const requests = [];
    const element = { value: '', classList: { add() {}, remove() {} } };
    const context = { deletionReauthAccessToken: 'fresh', USER_API_URL: '/user',
      sessionStorage: { getItem: () => null, removeItem() {} },
      apiFetch: async (_url, options) => { requests.push(JSON.parse(options.body)); return { json: async () => body }; },
      clearClientSession: () => { cleared = true; }, alert() {}, window: { location: {} },
      document: { getElementById: () => element, querySelector: () => element } };
    const source = studentSource.slice(studentSource.indexOf('async function processBackendDeletion()'), studentSource.indexOf('// [기능 5]'));
    vm.runInNewContext(`${source}\nthis.run = processBackendDeletion`, context);
    await context.run();
    assert.equal(cleared, completed); assert.equal(context.deletionReauthAccessToken, '');
    assert.equal(requests[0].type, 'request_account_deletion'); assert.equal(requests[0].reauthAccessToken, 'fresh');
  });
  test(`web tutor ${label}: request acknowledgement is not withdrawal completion`, async () => {
    let pending, signedOut = false;
    const requests = [];
    const element = { value: 'password' };
    const context = { window: {}, CONFIG: { api: { user: '/user' } }, alert() {},
      document: { getElementById: () => element, querySelector: () => element },
      handleSignOut: () => { signedOut = true; },
      AmazonCognitoIdentity: { AuthenticationDetails: class {} },
      tutorCognitoUser: { getUsername: () => 'tutor', authenticateUser: (_details, callbacks) => {
        pending = callbacks.onSuccess({ getAccessToken: () => ({ getJwtToken: () => 'fresh' }) });
      } },
      apiFetch: async (_url, options) => { requests.push(JSON.parse(options.body)); return { json: async () => body }; }
    };
    const source = tutorSource.slice(tutorSource.indexOf('window.executeTutorWithdrawal = function()'), tutorSource.indexOf('/* 전화번호 수정 */'));
    vm.runInNewContext(source, context); context.window.executeTutorWithdrawal(); await pending;
    assert.equal(signedOut, completed); assert.equal(requests[0].reauthAccessToken, 'fresh');
  });
}
