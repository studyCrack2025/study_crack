import { expect, test } from '@playwright/test';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test.skip(!process.env.STUDYCRACK_PREVIEW_ROOT, 'Requires a versioned public artifact.');

async function enableForMockPreview(page) {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.route(/\/js\/config\.js(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    expect(source).toContain('clientDiagnostics: { enabled: false');
    await route.fulfill({ response, body: source.replace('clientDiagnostics: { enabled: false', 'clientDiagnostics: { enabled: true') });
  });
}

test('기본 설정에서는 오류가 발생해도 진단 정보를 전송하지 않는다', async ({ page }) => {
  const sent = [];
  await page.route('**/api/client-diagnostics', async (route) => { sent.push(route.request()); await route.fulfill({ status: 204 }); });
  await page.goto('/studycrack-mobile.html?screen=authLogin&email=private@example.com&token=secret');
  await page.evaluate(async () => {
    window.STUDYCRACK_DIAGNOSTICS.record('runtime_failure');
    window.dispatchEvent(new Event('vite:preloadError'));
    await window.STUDYCRACK_DIAGNOSTICS.flush();
  });
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
  expect(sent).toHaveLength(0);
});

test('활성화된 진단 전송은 API 오류에서도 계정·토큰·원문 없이 이루어진다', async ({ page, context }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await context.addCookies([{ name: 'private-cookie', value: 'private-session', url: 'http://127.0.0.1:4177' }]);
  const batches = [];
  await page.route('**/api/client-diagnostics', async (route) => {
    batches.push({ body: route.request().postDataJSON(), headers: await route.request().allHeaders() });
    await route.fulfill({ status: 503, body: 'private collector error' });
  });
  await page.goto('/studycrack-mobile.html?screen=timer&token=private-query');
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  await page.route('**/api/noti', (route) => route.fulfill({ status: 503, json: { error: 'private-email@example.com private-token private-score' } }));
  await page.evaluate(async () => {
    window.CONFIG.clientDiagnostics = { enabled: true, sampleRate: 0.1 };
    const random = Math.random;
    Math.random = () => 0;
    try { await window.apiFetch(window.CONFIG.api.noti, { method: 'POST', body: JSON.stringify({ type: 'student_get_notifications' }) }); }
    catch (_) {} finally { Math.random = random; }
    await window.STUDYCRACK_DIAGNOSTICS.flush();
    await window.STUDYCRACK_DIAGNOSTICS.flush();
  });
  expect(batches).toHaveLength(1);
  expect(batches[0].body.events).toEqual([{ kind: 'api_failure', route: 'noti', status: 503, count: 1 }]);
  expect(Object.keys(batches[0].body).sort()).toEqual(['events', 'release', 'schema']);
  for (const header of ['authorization', 'cookie', 'referer']) expect(batches[0].headers[header]).toBeUndefined();
  expect(JSON.stringify(batches[0].body)).not.toMatch(/private|token|email|score|student|cookie/);
  expect(await page.evaluate(() => localStorage.getItem('userId'))).toBe('e2e-student');
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
});

test('화면 파일 오류는 원문 없이 감지하고 복구 UI를 유지한다', async ({ page }) => {
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await enableForMockPreview(page);
  const batches = [];
  await page.route('**/api/client-diagnostics', async (route) => { batches.push(route.request().postDataJSON()); await route.fulfill({ status: 204 }); });
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route(/\/chunks\/screen-registry-app-.*\.js$/, async (route) => { await pending; await route.abort(); });
  try {
    await page.goto('/studycrack-mobile.html?screen=timer', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.STUDYCRACK_DIAGNOSTICS));
  } finally { release(); }
  await expect(page.getByRole('heading', { name: '화면을 불러오지 못했습니다' })).toBeVisible();
  await page.evaluate(() => window.STUDYCRACK_DIAGNOSTICS.flush());
  expect(batches).toHaveLength(1);
  expect(batches[0].events).toContainEqual({ kind: 'chunk_load_failure', route: 'none', status: 0, count: 1 });
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
});

test('초기 bundle이 실패해도 독립 진단 파일은 실패 종류만 전송한다', async ({ page }) => {
  await installApiMock(page);
  await enableForMockPreview(page);
  await page.clock.install();
  const batches = [];
  await page.route('**/api/client-diagnostics', async (route) => { batches.push(route.request().postDataJSON()); await route.fulfill({ status: 204 }); });
  await page.route('**/dist/studycrack-mobile.bundle.js', (route) => route.abort());
  await page.goto('/studycrack-mobile.html?screen=authLogin');
  await page.clock.fastForward(12001);
  await expect(page.getByRole('alert')).toContainText('앱을 불러오지 못했습니다');
  await page.evaluate(() => window.STUDYCRACK_DIAGNOSTICS.flush());
  expect(batches).toHaveLength(1);
  expect(batches[0].events).toContainEqual({ kind: 'boot_failure', route: 'none', status: 0, count: 1 });
});
