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

function createRuntime({ localValues, sessionValues, fetch }) {
  const localStorage = createStorage(localValues);
  const sessionStorage = createStorage(sessionValues);
  const window = {
    addEventListener() {},
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    location: { pathname: '/studycrack-mobile.html', replace() {} }
  };
  const context = vm.createContext({
    CONFIG: { api: { auth: '/auth', admin: '/admin', report: '/report', file: '/file', payment: '/payment' } },
    IS_LOCAL: true,
    console,
    fetch,
    localStorage,
    sessionStorage,
    window
  });
  vm.runInContext(`${sharedApiSource}\nglobalThis.__sharedApi = { apiFetch, hasClientSession };`, context);
  return { api: context.__sharedApi, localStorage, sessionStorage };
}

const now = Math.floor(Date.now() / 1000);
const expiredAccessToken = token({ exp: now - 60, sub: 'student-1' });
const freshAccessToken = token({ exp: now + 3600, sub: 'student-1' });
const freshIdToken = token({ exp: now + 3600, sub: 'student-1' });
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

console.log('shared API session contracts passed');
