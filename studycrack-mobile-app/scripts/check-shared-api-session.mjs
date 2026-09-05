import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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

function createRuntime({ localValues, sessionValues, fetch, isLocal = true, diagnostics }) {
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
    localStorage,
    sessionStorage,
    window
  });
  vm.runInContext(`${sharedApiSource}\nglobalThis.__sharedApi = { apiFetch, hasClientSession, tryRefreshToken };`, context);
  return { api: context.__sharedApi, localStorage, sessionStorage };
}

const now = Math.floor(Date.now() / 1000);
const expiredAccessToken = token({ exp: now - 60, sub: 'student-1' });
const freshAccessToken = token({ exp: now + 3600, sub: 'student-1' });
const freshIdToken = token({ exp: now + 3600, sub: 'student-1' });
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
  await assert.rejects(forbidden.api.apiFetch('/user'), (error) => error.status === 403 && error.code !== 'AUTH_EXPIRED');
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
console.log('shared API session contracts passed: refresh single-flight, local/cookie transport failures and retry status preservation');
