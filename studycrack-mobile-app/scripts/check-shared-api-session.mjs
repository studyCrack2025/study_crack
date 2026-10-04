import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { CognitoAccessToken, CognitoIdToken, CognitoRefreshToken, CognitoUser, CognitoUserPool, CognitoUserSession } from 'amazon-cognito-identity-js';

const sharedApiSource = fs.readFileSync(new URL('../../js/shared/api.js', import.meta.url), 'utf8');

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    clear: () => values.clear(),
    getItem: (key) => values.has(key) ? values.get(key) : null,
    key: (index) => [...values.keys()][index] || null,
    get length() { return values.size; },
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value))
  };
}

function token(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function createRuntime({ localValues, sessionValues, fetch, isLocal = true, diagnostics, timers = { setTimeout, clearTimeout } }) {
  const localStorage = createStorage(localValues);
  const sessionStorage = createStorage(sessionValues);
  const window = {
    STUDYCRACK_DIAGNOSTICS: diagnostics,
    addEventListener() {},
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    location: { pathname: '/studycrack-mobile.html', replace() {} }
  };
  const context = vm.createContext({
    CONFIG: { api: { auth: '/auth', admin: '/admin', report: '/report', file: '/file', payment: '/payment' } },
    IS_LOCAL: isLocal,
    console: { ...console, error() {} },
    fetch,
    AbortController,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    localStorage,
    sessionStorage,
    window
  });
  vm.runInContext(`${sharedApiSource}\nglobalThis.__sharedApi = { apiFetch, hasClientSession, tryRefreshToken, createCognitoMemoryStorage, clearClientSession, clearServerSessionCookies, fetchSharedAuthJson, captureClientSession, isClientSessionCurrent, beginClientLogin, completeClientLogin, coordinateClientSessionResume, getClientAccountStorage };`, context);
  return { api: context.__sharedApi, localStorage, sessionStorage };
}

const now = Math.floor(Date.now() / 1000);
const expiredAccessToken = token({ exp: now - 60, sub: 'student-1' });
const freshAccessToken = token({ exp: now + 3600, sub: 'student-1' });
const freshIdToken = token({ exp: now + 3600, sub: 'student-1' });
// 실제 SDK의 세션 캐시도 메모리에만 저장되는지 확인한다.
const memoryRuntime = createRuntime({ isLocal: false, localValues: {}, sessionValues: {}, fetch: async () => { throw new Error('No external requests'); } });
const memoryStorage = memoryRuntime.api.createCognitoMemoryStorage();
const pool = new CognitoUserPool({ UserPoolId: 'synthetic_pool', ClientId: 'synthetic', Storage: memoryStorage });
const sdkUser = new CognitoUser({ Username: 'synthetic-user', Pool: pool, Storage: memoryStorage });
sdkUser.setSignInUserSession(new CognitoUserSession({ AccessToken: new CognitoAccessToken({ AccessToken: freshAccessToken }), IdToken: new CognitoIdToken({ IdToken: freshIdToken }), RefreshToken: new CognitoRefreshToken({ RefreshToken: 'synthetic-refresh' }) }));
assert.equal(memoryStorage.getItem('CognitoIdentityServiceProvider.synthetic.synthetic-user.refreshToken'), 'synthetic-refresh');
assert.equal(memoryRuntime.localStorage.length, 0);
sdkUser.signOut();
assert.equal(memoryStorage.getItem('CognitoIdentityServiceProvider.synthetic.synthetic-user.refreshToken'), null);
const diagnosticEvents = [];
const observed = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: { accessToken: freshAccessToken },
  diagnostics: { record: (...args) => diagnosticEvents.push(args) }, fetch: async () => response({ message: 'private-email@example.com', payload: 'secret' }, 503)
});
await assert.rejects(observed.api.apiFetch('/report'), (error) => error.status === 503);
assert.deepEqual(diagnosticEvents, [['api_failure', 'report', 503]]);
const brokenObserver = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: { accessToken: freshAccessToken },
  diagnostics: { record() { throw new Error('observer unavailable'); } }, fetch: async () => response({}, 500)
});
await assert.rejects(brokenObserver.api.apiFetch('/report'), (error) => error.status === 500);
let refreshCalls = 0;
const refreshEvents = [];
const observedRefresh = createRuntime({ isLocal: false, localValues: {}, sessionValues: {},
  diagnostics: { record: (...args) => refreshEvents.push(args) }, fetch: async () => { refreshCalls++; return response({}, 503); }
});
await Promise.all([observedRefresh.api.tryRefreshToken(), observedRefresh.api.tryRefreshToken()]);
assert.equal(refreshCalls, 1);
assert.deepEqual(refreshEvents, [['auth_refresh_failure', 'auth', 503]]);
const requests = [];

const runtime = createRuntime({
  localValues: { refreshToken: 'refresh-token', userId: 'student-1' },
  sessionValues: { accessToken: expiredAccessToken },
  fetch: async (url, options = {}) => {
    requests.push({ url, authorization: options.headers?.Authorization || '' });
    if (url === '/auth') {
      return response({ accessToken: freshAccessToken, idToken: freshIdToken });
    }
    assert.equal(options.headers?.Authorization, `Bearer ${freshAccessToken}`);
    return response({ success: true });
  }
});

await Promise.all(['/user', '/report', '/noti', '/analysis', '/qna'].map((url) => runtime.api.apiFetch(url)));
assert.equal(requests.filter(({ url }) => url === '/auth').length, 1);
assert.equal(requests.filter(({ authorization }) => authorization === `Bearer ${expiredAccessToken}`).length, 0);

const staleRuntime = createRuntime({
  localValues: { userId: 'stale-user' },
  sessionValues: {},
  fetch: async () => response({ success: true })
});
assert.equal(staleRuntime.api.hasClientSession(), false);

for (const isLocal of [true, false]) {
  const offlineRefresh = createRuntime({ isLocal,
    localValues: { userId: 'student-1', refreshToken: 'refresh-token' },
    sessionValues: { accessToken: isLocal ? expiredAccessToken : freshAccessToken },
    fetch: async (url) => { if (url === '/auth') throw new TypeError('Failed to fetch'); return response({}, 401); }
  });
  await assert.rejects(offlineRefresh.api.apiFetch('/user'), (error) => error.code !== 'AUTH_EXPIRED');
  assert.equal(offlineRefresh.localStorage.getItem('userId'), 'student-1');
  assert.equal(await offlineRefresh.api.tryRefreshToken(), false, 'legacy refresh callers keep their boolean contract');

  const unavailableRefresh = createRuntime({ isLocal,
    localValues: { userId: 'student-1', refreshToken: 'refresh-token' },
    sessionValues: { accessToken: isLocal ? expiredAccessToken : freshAccessToken },
    fetch: async (url) => response({}, url === '/auth' ? 500 : 401)
  });
  await assert.rejects(unavailableRefresh.api.apiFetch('/user'), (error) => error.status === 500 && error.code !== 'AUTH_EXPIRED');
  assert.equal(unavailableRefresh.localStorage.getItem('userId'), 'student-1');

  for (const status of [403, 404, 409, 500]) {
    let protectedRequests = 0;
    const refreshedRuntime = createRuntime({ isLocal,
      localValues: { userId: 'student-1', refreshToken: 'refresh-token' }, sessionValues: { accessToken: freshAccessToken },
      fetch: async (url) => {
        if (url === '/auth') return response({ accessToken: freshAccessToken, idToken: freshIdToken });
        protectedRequests += 1;
        return response({}, protectedRequests === 1 ? 401 : status);
      }
    });
    await assert.rejects(refreshedRuntime.api.apiFetch('/user'), (error) => error.status === status && error.code !== 'AUTH_EXPIRED');
    assert.equal(protectedRequests, 2, 'authenticated retry must happen at most once');
    assert.equal(refreshedRuntime.localStorage.getItem('userId'), 'student-1');
  }
  const forbidden = createRuntime({ isLocal, localValues: { userId: 'student-1' }, sessionValues: { accessToken: freshAccessToken },
    fetch: async (url) => response({}, url === '/auth' ? 401 : 403)
  });
  await assert.rejects(forbidden.api.apiFetch('/user'), (error) => error.status === 403 && error.code === 'AUTH_EXPIRED', 'explicit refresh rejection also ends an authorizer 403 session');
}
let cookieRequests = 0;
const cookieOnly = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async (url, options) => {
  assert.equal(options.credentials, 'include');
  assert.equal(options.headers.Authorization, undefined);
  if (url === '/auth') return response({ success: true });
  cookieRequests += 1;
  return response({ success: true }, cookieRequests === 1 ? 401 : 200);
} });
assert.equal((await cookieOnly.api.apiFetch('/user')).ok, true);
assert.equal(cookieRequests, 2);

const shortTimers = { setTimeout: callback => setTimeout(callback, 5), clearTimeout };
for (const hang of ['headers', 'body']) {
  let attempts = 0;
  let signal;
  const hanging = createRuntime({ isLocal: false, timers: shortTimers, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async (_url, options) => {
    signal = options.signal;
    attempts++;
    return hang === 'headers' ? new Promise(() => {}) : { ok: true, status: 200, json: () => new Promise(() => {}) };
  } });
  const results = await Promise.allSettled([hanging.api.tryRefreshToken({ preserveTransientErrors: true }), hanging.api.tryRefreshToken({ preserveTransientErrors: true })]);
  assert.equal(attempts, 1);
  assert.ok(results.every(result => result.status === 'rejected' && result.reason.code === 'AUTH_CONNECTION_TIMEOUT'));
  assert.equal(signal.aborted, true);
  assert.equal(hanging.localStorage.getItem('userId'), 'student-1');
  await assert.rejects(hanging.api.tryRefreshToken({ preserveTransientErrors: true }), error => error.code === 'AUTH_CONNECTION_TIMEOUT');
  assert.equal(attempts, 2, 'timeout releases single-flight for an explicit retry');
}

for (const status of [400, 403]) {
  const malformed = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async () => response({ error: 'invalid request' }, status) });
  await assert.rejects(malformed.api.tryRefreshToken({ preserveTransientErrors: true }), error => error.status === status && error.code !== 'AUTH_EXPIRED');
  assert.equal(malformed.localStorage.getItem('userId'), 'student-1');
}
const unavailableAccount = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async () => response({ code: 'AUTH_ACCOUNT_UNAVAILABLE' }, 403) });
assert.equal(await unavailableAccount.api.tryRefreshToken({ preserveTransientErrors: true }), false);
const malformedSuccess = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async () => response({}, 200) });
await assert.rejects(malformedSuccess.api.tryRefreshToken({ preserveTransientErrors: true }), error => error.code === 'AUTH_RESPONSE_INVALID');

let finishRefresh;
const late = createRuntime({ isLocal: false, localValues: { userId: 'student-1', plannerDraft: 'keep-draft' }, sessionValues: {}, fetch: () => new Promise(resolve => { finishRefresh = resolve; }) });
const refreshBeforeLogout = late.api.tryRefreshToken({ preserveTransientErrors: true });
await new Promise(resolve => setImmediate(resolve));
late.api.clearClientSession();
await assert.rejects(refreshBeforeLogout, error => error.name === 'AbortError');
finishRefresh(response({ accessToken: freshAccessToken, idToken: freshIdToken }));
await new Promise(resolve => setImmediate(resolve));
assert.equal(late.localStorage.getItem('userId'), null);
assert.equal(late.sessionStorage.getItem('accessToken'), null);
assert.equal(late.localStorage.getItem('plannerDraft'), 'keep-draft');

const logoutHang = createRuntime({ isLocal: false, timers: shortTimers, localValues: {}, sessionValues: {}, fetch: () => new Promise(() => {}) });
assert.equal(await logoutHang.api.clearServerSessionCookies(), false, 'cookie cleanup is bounded even when fetch ignores abort');

const fenced = createRuntime({ isLocal: false, localValues: { userId: 'student-1', plannerDraft: 'keep' }, sessionValues: {}, fetch: async () => response({ success: true }) });
const before = fenced.api.captureClientSession();
const originalStorage = fenced.api.getClientAccountStorage();
originalStorage.setItem('activeStudySession', 'original-recovery');
fenced.api.clearClientSession();
assert.equal(fenced.localStorage.getItem('sc_session_ended'), '1');
assert.equal(await fenced.api.tryRefreshToken(), false);
await assert.rejects(fenced.api.apiFetch('/user'), error => error.code === 'AUTH_EXPIRED');
const sameAccount = fenced.api.beginClientLogin();
fenced.api.completeClientLogin({ userId: 'student-1', accessToken: freshAccessToken, idToken: freshIdToken }, sameAccount);
assert.equal(fenced.api.isClientSessionCurrent(before), false);
assert.equal(fenced.api.getClientAccountStorage().getItem('activeStudySession'), 'original-recovery');
assert.throws(() => originalStorage.setItem('activeStudySession', 'stale'), error => error.code === 'AUTH_SESSION_CHANGED');
const otherAccount = fenced.api.beginClientLogin();
fenced.api.completeClientLogin({ userId: 'student-2', accessToken: 'new-access' }, otherAccount);
assert.equal(fenced.api.getClientAccountStorage().getItem('activeStudySession'), null);
assert.equal(fenced.localStorage.getItem('plannerDraft'), 'keep');
assert.throws(() => fenced.api.completeClientLogin({ userId: 'student-1', accessToken: 'old' }, sameAccount), error => error.code === 'AUTH_SESSION_CHANGED');

for (const type of ['save_qna', 'update_target_univs', 'delete_admission_calendar_event', 'draw_fish', 'planner_sync_v1']) {
  let writes = 0;
  const runtime = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async url => {
    if (url === '/auth') return response({ accessToken: freshAccessToken, idToken: freshIdToken });
    writes++; return response({}, 401);
  } });
  await assert.rejects(runtime.api.apiFetch('/user', { method: 'POST', body: JSON.stringify({ type }) }), error => error.code === 'AUTH_RETRY_REQUIRED');
  assert.equal(writes, 1, `${type} must not be blindly replayed`);
}
let receiptAttempts = [];
const receipt = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async (url, options) => {
  if (url === '/auth') return response({ accessToken: freshAccessToken, idToken: freshIdToken });
  receiptAttempts.push(options.body); return response({ success: true }, receiptAttempts.length === 1 ? 401 : 200);
} });
await receipt.api.apiFetch('/user', { method: 'POST', body: JSON.stringify({ type: 'complete_study_session', data: { sessionId: 'session-12345678' } }) });
assert.equal(receiptAttempts.length, 2);
assert.equal(receiptAttempts[0], receiptAttempts[1]);

let bodyResolve;
const bodyRuntime = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async () => ({ ok: true, status: 200, json: () => new Promise(resolve => { bodyResolve = resolve; }) }) });
const bodyResponse = await bodyRuntime.api.apiFetch('/user');
const bodyPromise = bodyResponse.json();
await new Promise(resolve => setImmediate(resolve));
bodyRuntime.api.clearClientSession();
await assert.rejects(bodyPromise, error => error.name === 'AbortError');
bodyResolve({ privateData: 'old-account' });

let resumeCalls = 0;
const resume = createRuntime({ isLocal: false, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async () => { resumeCalls++; return response({ success: true }); } });
await Promise.all([resume.api.coordinateClientSessionResume(), resume.api.coordinateClientSessionResume(), resume.api.coordinateClientSessionResume()]);
await resume.api.coordinateClientSessionResume();
assert.equal(resumeCalls, 1);
let localResumeCalls = 0;
const localResume = createRuntime({ localValues: { userId: 'student-1' }, sessionValues: { accessToken: freshAccessToken }, fetch: async () => { localResumeCalls++; return response({}); } });
assert.equal(await localResume.api.coordinateClientSessionResume(), true);
assert.equal(localResumeCalls, 0, 'valid local bearer remains usable without a refresh token on online recovery');
let headerSignal;
const headerHang = createRuntime({ isLocal: false, timers: shortTimers, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: (_url, init) => { headerSignal = init.signal; return new Promise(() => {}); } });
await assert.rejects(headerHang.api.apiFetch('/user'), error => error.code === 'TIMEOUT');
assert.equal(headerSignal.aborted, true);
const bodyHang = createRuntime({ isLocal: false, timers: shortTimers, localValues: { userId: 'student-1' }, sessionValues: {}, fetch: async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }) });
await assert.rejects((await bodyHang.api.apiFetch('/user')).json(), error => error.code === 'TIMEOUT');
console.log('shared API session contracts passed: bounded requests, logout barrier, login fencing, owner storage, resume single-flight, safe replay and stale body isolation');
