import { expect, test } from '@playwright/test';
import { auditSecurityHeaders, inspectSecurityHeaders } from '../../tools/audit-security-headers.mjs';
import { prepareMobileResponsePolicy } from '../../tools/prepare-mobile-response-policy.mjs';
import { prepareMobileSecurityFunction } from '../../tools/prepare-mobile-security-function.mjs';
import vm from 'node:vm';
import { installApiMock, installAuthenticatedSession } from './support/mock-api.mjs';

test.skip(!process.env.STUDYCRACK_PREVIEW_ROOT, 'Requires the verified public artifact.');

test('실제 정적 응답 감사는 누락된 보호와 올바른 manifest MIME을 구분한다', async ({ baseURL }) => {
  const result = await auditSecurityHeaders({ origin: baseURL });
  expect(result.ok).toBe(false);
  expect(result.enforcementChanged).toBe(false);
  expect(result.results.find(({ path }) => path === '/studycrack-mobile').findings).toContain('csp_missing');
  const manifest = result.results.find(({ path }) => path.endsWith('.webmanifest'));
  expect(manifest.status).toBe(200);
  expect(manifest.findings).not.toContain('content_type_mismatch');
});

async function observeViolations(page) {
  await page.addInitScript(() => {
    window.__headerTestViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__headerTestViolations.push({ directive: event.effectiveDirective, disposition: event.disposition });
    });
  });
}

test('보고 전용 CSP는 앱 실행을 막지 않으며 적용 완료로 판정하지 않는다', async ({ page }) => {
  await installApiMock(page);
  await observeViolations(page);
  await page.route('**/studycrack-mobile.html?*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy-report-only': "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" } });
  });
  const response = await page.goto('/studycrack-mobile.html?screen=authLogin');
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__reportOnlyProbe = true;';
    document.body.append(script);
  });
  await expect.poll(() => page.evaluate(() => window.__headerTestViolations.filter(({ directive, disposition }) => directive === 'script-src-elem' && disposition === 'report').length)).toBeGreaterThan(0);
  const inspected = inspectSecurityHeaders(new Headers(await response.allHeaders()), { document: true, https: false });
  expect(inspected.cspMode).toBe('report-only');
  expect(inspected.findings).toContain('csp_report_only_not_enforced');
  expect(await page.evaluate(() => window.__reportOnlyProbe)).toBe(true);
});

test('로컬 CSP 실험은 외부 파일 앱을 시작하고 승인하지 않은 인라인 실행은 차단한다', async ({ page }) => {
  const mockApiOrigin = 'https://api.example.test';
  await page.addInitScript((origin) => { window.STUDYCRACK_API_BASE_URL = origin; }, mockApiOrigin);
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await observeViolations(page);
  await page.route('**/studycrack-mobile.html?*', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const candidate = prepareMobileResponsePolicy({ html, connectOrigins: [mockApiOrigin] });
    expect(candidate.compatibilityVerified).toBe(false);
    const csp = candidate.responseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=()' } });
  });
  await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '공부 시작', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__studycrackAppBooted)).toBe(true);
  expect(await page.evaluate(() => window.__headerTestViolations.filter(({ disposition }) => disposition === 'enforce'))).toEqual([]);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__unapprovedHeaderProbe = true;';
    document.body.append(script);
  });
  await expect.poll(() => page.evaluate(() => window.__headerTestViolations.filter(({ directive, disposition }) => directive === 'script-src-elem' && disposition === 'enforce').length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__unapprovedHeaderProbe)).toBeUndefined();
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
});

test('실제 함수 코드의 차단 모드는 앱과 승인된 업로드를 유지하고 인라인·평가·외부 전송을 막는다', async ({ page }) => {
  const apiOrigin = 'https://api.example.test';
  const uploadOrigin = 'https://uploads.example.test';
  await page.addInitScript(origin => { window.STUDYCRACK_API_BASE_URL = origin; }, apiOrigin);
  await installAuthenticatedSession(page);
  await installApiMock(page);
  await observeViolations(page);
  let uploads = 0;
  await page.route(`${uploadOrigin}/**`, route => {
    uploads += 1;
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
  });
  await page.route('**/js/csp-eval-probe.js', route => route.fulfill({
    contentType: 'text/javascript', body: "try { new Function('window.__edgeEval = true;')(); window.__edgeEvalBlocked = false; } catch (_) { window.__edgeEvalBlocked = true; }"
  }));
  await page.route('**/studycrack-mobile.html?*', async route => {
    const response = await route.fetch();
    const candidate = prepareMobileSecurityFunction({ html: await response.text(), origin: 'https://dev.studycrack.co.kr', mode: 'enforce', connectOrigins: [apiOrigin, uploadOrigin] });
    const context = vm.createContext({});
    vm.runInContext(candidate.code, context);
    const result = context.handler({
      request: { uri: new URL(route.request().url()).pathname, method: route.request().method(), headers: { host: { value: 'dev.studycrack.co.kr' } } },
      response: { statusCode: response.status(), headers: Object.fromEntries(Object.entries({ ...response.headers(), 'strict-transport-security': 'max-age=31536000', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' }).map(([name, value]) => [name, { value }])) }
    });
    await route.fulfill({ response, headers: Object.fromEntries(Object.entries(result.headers).map(([name, entry]) => [name, entry.value])) });
  });
  const response = await page.goto('/studycrack-mobile.html?screen=timer');
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
  expect(inspectSecurityHeaders(new Headers(await response.allHeaders()), { https: false }).findings).toEqual([]);
  expect(await page.evaluate(() => window.__headerTestViolations)).toEqual([]);
  expect(await page.evaluate(async origin => {
    const form = new FormData(); form.append('file', new Blob(['synthetic'], { type: 'image/png' }), 'synthetic.png');
    return (await fetch(`${origin}/upload`, { method: 'POST', body: form })).status;
  }, uploadOrigin)).toBe(204);
  expect(uploads).toBe(1);
  // Run the eval probe as a page script; debugger evaluation can bypass CSP.
  await page.evaluate(() => new Promise(resolve => {
    const script = document.createElement('script'); script.src = '/js/csp-eval-probe.js'; script.onload = resolve; document.body.append(script);
  }));
  const blocked = await page.evaluate(async () => {
    const script = document.createElement('script'); script.textContent = 'window.__edgeProbe = true;'; document.body.append(script);
    let external = false;
    try { await fetch('https://not-approved.example.test/blocked'); } catch { external = true; }
    return { evaluation: window.__edgeEvalBlocked, external, inlineRan: window.__edgeProbe === true, evaluationRan: window.__edgeEval === true };
  });
  expect(blocked).toEqual({ evaluation: true, external: true, inlineRan: false, evaluationRan: false });
  await expect.poll(() => page.evaluate(() => window.__headerTestViolations.filter(event => event.disposition === 'enforce').length)).toBeGreaterThanOrEqual(3);
  await expect(page.locator('[data-screen="timer"]')).toBeVisible();
});

test('차단 CSP에서도 번들 실패·오프라인·재시도 안내가 외부 부팅 파일로 동작한다', async ({ page }) => {
  await installApiMock(page);
  await page.clock.install();
  let fail = true;
  await page.route('**/dist/studycrack-mobile.bundle.js', route => fail ? route.abort() : route.continue());
  await page.route('**/studycrack-mobile.html?*', async route => {
    const response = await route.fetch();
    const candidate = prepareMobileResponsePolicy({ html: await response.text() });
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': candidate.responseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy } });
  });
  await page.goto('/studycrack-mobile.html?screen=authLogin');
  await page.clock.fastForward(12001);
  await expect(page.getByRole('alert')).toContainText('앱을 불러오지 못했습니다');
  await page.context().setOffline(true);
  await expect(page.getByRole('alert')).toContainText('오프라인 상태예요');
  await page.context().setOffline(false);
  fail = false;
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.locator('[data-screen="authLogin"]')).toBeVisible();
});
