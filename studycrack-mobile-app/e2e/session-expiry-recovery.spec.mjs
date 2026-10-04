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
