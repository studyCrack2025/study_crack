import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const sharedSource = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');

async function setup(page) {
  await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Session fixture</title>' }));
  await page.goto('https://dev.studycrack.co.kr/studycrack-mobile.html');
  await page.clock.install();
  await page.evaluate(() => {
    window.IS_LOCAL = false;
    window.CONFIG = { api: { auth: '/synthetic/auth', game: '/synthetic/game' } };
    localStorage.setItem('userId', 'owner');
    localStorage.setItem('plannerDraft', 'keep');
    window.__requests = [];
    window.__signals = [];
  });
  await page.addScriptTag({ content: sharedSource });
}

for (const phase of ['headers', 'body']) test(`갱신 ${phase} 정지는 12초에 종료되고 재시도할 수 있다`, async ({ page }) => {
  await setup(page);
  await page.evaluate(phase => {
    window.fetch = (_url, options) => {
      window.__requests.push(JSON.parse(options.body));
      window.__signals.push(options.signal);
      if (phase === 'headers') return new Promise(() => {});
      return Promise.resolve({ ok: true, status: 200, json: () => new Promise(() => {}) });
    };
    window.__errors = [];
    window.__pending = Promise.all([1, 2].map(() => tryRefreshToken({ preserveTransientErrors: true }).catch(error => window.__errors.push(error.code))));
  }, phase);
  await expect.poll(() => page.evaluate(() => window.__requests.length)).toBe(1);
  await page.clock.fastForward(12000);
  await page.evaluate(() => window.__pending);
  expect(await page.evaluate(() => window.__errors)).toEqual(['AUTH_CONNECTION_TIMEOUT', 'AUTH_CONNECTION_TIMEOUT']);
  expect(await page.evaluate(() => window.__signals[0].aborted)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('owner');
  await page.evaluate(() => {
    window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: true, userId: 'owner', accessToken: 'new-access', idToken: 'new-id' }) });
  });
  expect(await page.evaluate(() => tryRefreshToken())).toBe(true);
});

test('원 요청 403 이후 명시적인 갱신 만료는 로그인 복귀 신호가 된다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.fetch = async (url) => url === CONFIG.api.auth
      ? { ok: false, status: 401, json: async () => ({ code: 'AUTH_SESSION_EXPIRED' }) }
      : { ok: false, status: 403, json: async () => ({ message: 'Forbidden' }) };
  });
  expect(await page.evaluate(() => apiFetch(CONFIG.api.game).catch(error => error.code))).toBe('AUTH_EXPIRED');
});

test('유효한 갱신 후 서비스 권한 거절은 세션을 삭제하지 않는다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.fetch = async (url) => url === CONFIG.api.auth
      ? { ok: true, status: 200, json: async () => ({ success: true, userId: 'owner', accessToken: 'access', idToken: 'id' }) }
      : { ok: false, status: 403, json: async () => ({ code: 'FEATURE_FORBIDDEN', message: '권한이 없습니다.' }) };
  });
  expect(await page.evaluate(() => apiFetch(CONFIG.api.game).catch(error => error.code))).toBe('FEATURE_FORBIDDEN');
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('owner');
});

test('결제 내역 읽기만 재전송하고 결제 상태 확인·생성은 재전송하지 않는다', async ({ page }) => {
  await setup(page);
  expect(await page.evaluate(() => ['list_payment_history', 'get_payment_status', 'create_payment_intent'].map(type => canReplaySharedRequest({ method: 'POST', body: JSON.stringify({ type, data: { cursor: null } }) })))).toEqual([true, false, false]);
});

test('세션 정리 뒤 늦은 갱신은 토큰을 복원하지 않고 초안은 보존한다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.fetch = (_url, options) => {
      window.__signals.push(options.signal);
      return new Promise(resolve => { window.__late = resolve; });
    };
    window.__pending = tryRefreshToken({ preserveTransientErrors: true }).catch(error => error.name);
  });
  await expect.poll(() => page.evaluate(() => window.__signals.length)).toBe(1);
  await page.evaluate(() => clearClientSession());
  expect(await page.evaluate(() => window.__pending)).toBe('AbortError');
  await page.evaluate(async () => {
    window.__late({ ok: true, status: 200, json: async () => ({ success: true, userId: 'owner', accessToken: 'late-access', idToken: 'late-id' }) });
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(await page.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('plannerDraft'))).toBe('keep');
});

test('서버 로그아웃이 멈춰도 쿠키 정리 대기는 5초에 끝난다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.fetch = (_url, options) => { window.__signals.push(options.signal); return new Promise(() => {}); };
    clearClientSession();
    window.__pending = clearServerSessionCookies();
  });
  await expect.poll(() => page.evaluate(() => window.__signals.length)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBeNull();
  await page.clock.fastForward(5000);
  expect(await page.evaluate(() => window.__pending)).toBe(false);
  expect(await page.evaluate(() => window.__signals[0].aborted)).toBe(true);
});

test('잔류 쿠키가 있어도 로그아웃 뒤 새로고침과 새 탭에서 자동 복원하지 않는다', async ({ page, context }) => {
  await setup(page);
  await context.addCookies([{ name: 'at', value: 'residual', domain: 'dev.studycrack.co.kr', path: '/', httpOnly: true, secure: true }]);
  await page.evaluate(() => clearClientSession());
  await page.reload();
  await page.addScriptTag({ content: sharedSource });
  expect(await page.evaluate(() => hasClientSession())).toBe(false);
  expect(await page.evaluate(() => tryRefreshToken())).toBe(false);
  const second = await context.newPage();
  await second.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>New tab</title>' }));
  await second.goto('https://dev.studycrack.co.kr/studycrack-mobile.html');
  await second.evaluate(() => { window.IS_LOCAL = false; window.CONFIG = { api: { auth: '/synthetic/auth' } }; });
  await second.addScriptTag({ content: sharedSource });
  expect(await second.evaluate(() => hasClientSession())).toBe(false);
  expect(await second.evaluate(() => localStorage.getItem('plannerDraft'))).toBe('keep');
});

test('새 로그인 전에 시작한 응답은 같은 계정으로 재로그인해도 적용하지 않는다', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    let complete;
    window.fetch = async () => ({ ok: true, status: 200, json: () => new Promise(resolve => { complete = resolve; }) });
    const response = await apiFetch(CONFIG.api.game);
    const old = response.json().catch(error => error.name || error.code);
    await Promise.resolve();
    const scope = beginClientLogin();
    completeClientLogin({ userId: 'owner', accessToken: 'fresh' }, scope);
    complete({ privateData: 'stale' });
    return { result: await old, token: sessionStorage.getItem('accessToken') };
  });
  expect(result.result).toBe('AbortError');
  expect(result.token).toBe('fresh');
});

test('늦은 쿠키 갱신 응답에는 추가 로그아웃을 보내고 복원 차단을 유지한다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.fetch = (_url, options) => {
      const payload = JSON.parse(options.body);
      window.__requests.push(payload.type);
      if (payload.type === 'logout') return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
      return new Promise(resolve => { window.__lateRefresh = resolve; });
    };
    window.__pending = tryRefreshToken({ preserveTransientErrors: true }).catch(error => error.name);
  });
  await expect.poll(() => page.evaluate(() => window.__requests.length)).toBe(1);
  await page.evaluate(() => clearClientSession());
  expect(await page.evaluate(() => window.__pending)).toBe('AbortError');
  await page.evaluate(() => window.__lateRefresh({ ok: true, status: 200, json: async () => ({ success: true, userId: 'owner', accessToken: 'late' }) }));
  await expect.poll(() => page.evaluate(() => window.__requests)).toEqual(['silent_refresh', 'logout']);
  expect(await page.evaluate(() => hasClientSession())).toBe(false);
});

test('복귀 이벤트는 갱신 한 건을 공유하며 오프라인에서는 요청하지 않는다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.fetch = async (_url, options) => {
      window.__requests.push(JSON.parse(options.body).type);
      return { ok: true, status: 200, json: async () => ({ success: true, userId: 'owner' }) };
    };
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect.poll(() => page.evaluate(() => window.__requests.length)).toBe(1);
  await page.clock.fastForward(15001);
  await page.context().setOffline(true);
  expect(await page.evaluate(() => coordinateClientSessionResume())).toBe(false);
  expect(await page.evaluate(() => window.__requests.length)).toBe(1);
});

for (const type of ['save_qna', 'update_target_univs', 'delete_admission_calendar_event']) test(`${type}는 갱신 성공 뒤에도 자동으로 재전송하지 않는다`, async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async type => {
    let calls = 0;
    window.fetch = async url => url === CONFIG.api.auth
      ? { ok: true, status: 200, json: async () => ({ success: true, userId: 'owner' }) }
      : (calls++, { ok: false, status: 401, json: async () => ({}) });
    const code = await apiFetch(CONFIG.api.game, { method: 'POST', body: JSON.stringify({ type }) }).catch(error => error.code);
    return { code, calls };
  }, type);
  expect(result).toEqual({ code: 'AUTH_RETRY_REQUIRED', calls: 1 });
});

test('다른 탭 로그아웃은 기존 탭의 메모리 세션도 무효화한다', async ({ page, context }) => {
  await setup(page);
  await page.evaluate(() => { window.__scope = captureClientSession(); sessionStorage.setItem('accessToken', 'old'); });
  const other = await context.newPage();
  await other.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Other tab</title>' }));
  await other.goto('https://dev.studycrack.co.kr/studycrack-mobile.html');
  await other.evaluate(() => { window.IS_LOCAL = false; window.CONFIG = { api: { auth: '/synthetic/auth' } }; });
  await other.addScriptTag({ content: sharedSource });
  await other.evaluate(() => clearClientSession());
  await page.waitForURL('**/studycrack-mobile.html?screen=authLogin');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('sc_session_ended'))).toBe('1');
});
